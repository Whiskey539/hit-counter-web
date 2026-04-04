import type { AnalysisResult, AnalysisSettings, Session } from "./types";

// ─── FFT (Cooley-Tukey, radix-2, in-place) ──────────────────────────────────

function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length;

  // Bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }

  // Butterfly
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1.0, curIm = 0.0;
      const half = len >> 1;
      for (let j = 0; j < half; j++) {
        const uRe = re[i + j], uIm = im[i + j];
        const vRe = re[i + j + half] * curRe - im[i + j + half] * curIm;
        const vIm = re[i + j + half] * curIm + im[i + j + half] * curRe;
        re[i + j] = uRe + vRe;
        im[i + j] = uIm + vIm;
        re[i + j + half] = uRe - vRe;
        im[i + j + half] = uIm - vIm;
        const nr = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nr;
      }
    }
  }
}

// ─── Breaker parameters ──────────────────────────────────────────────────────

interface BreakerParams {
  frameSize: number;
  hopSize: number;
  lowFreq: number;
  highFreq: number;
  minDistance: number; // seconds
}

function getBreakerParams(type: string): BreakerParams {
  switch (type) {
    case "small":
      return { frameSize: 2048, hopSize: 512, lowFreq: 120, highFreq: 1200, minDistance: 0.05 };
    case "medium":
      return { frameSize: 2048, hopSize: 512, lowFreq: 80, highFreq: 800, minDistance: 0.07 };
    case "large":
    default:
      return { frameSize: 2048, hopSize: 512, lowFreq: 60, highFreq: 500, minDistance: 0.10 };
  }
}

// ─── Spectral Flux ───────────────────────────────────────────────────────────

async function computeSpectralFlux(
  audio: Float32Array,
  sampleRate: number,
  frameSize: number,
  hopSize: number,
  lowFreq: number,
  highFreq: number,
  onProgress: (p: number) => void,
  progressStart: number,
  progressEnd: number
): Promise<{ flux: Float32Array; threshold: Float32Array }> {
  const lowBin = Math.max(1, Math.round((lowFreq * frameSize) / sampleRate));
  const highBin = Math.min(frameSize / 2, Math.round((highFreq * frameSize) / sampleRate));

  // Hanning window
  const win = new Float32Array(frameSize);
  for (let i = 0; i < frameSize; i++) {
    win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (frameSize - 1)));
  }

  const nFrames = Math.floor((audio.length - frameSize) / hopSize);
  const flux = new Float32Array(nFrames);
  const prevMag = new Float32Array(highBin + 1);
  const re = new Float32Array(frameSize);
  const im = new Float32Array(frameSize);

  for (let f = 0; f < nFrames; f++) {
    // Yield to UI every 500 frames
    if (f % 500 === 0) {
      await new Promise<void>((r) => setTimeout(r, 0));
      onProgress(progressStart + (progressEnd - progressStart) * (f / nFrames));
    }

    const start = f * hopSize;
    for (let i = 0; i < frameSize; i++) {
      re[i] = (audio[start + i] ?? 0) * win[i];
      im[i] = 0;
    }
    fft(re, im);

    let val = 0;
    for (let b = lowBin; b <= highBin; b++) {
      const mag = Math.sqrt(re[b] * re[b] + im[b] * im[b]);
      const diff = mag - prevMag[b];
      if (diff > 0) val += diff;
      prevMag[b] = mag;
    }
    flux[f] = val;
  }

  // ── Adaptive threshold: O(n) sliding window mean ──
  const winFrames = Math.round((2.0 * sampleRate) / hopSize); // 2-second window
  const threshold = new Float32Array(nFrames);
  let sum = 0;
  let count = 0;

  // Pre-fill right half of first window
  const initEnd = Math.min(Math.floor(winFrames / 2), nFrames);
  for (let i = 0; i < initEnd; i++) { sum += flux[i]; count++; }

  for (let i = 0; i < nFrames; i++) {
    const addIdx = i + Math.floor(winFrames / 2);
    const removeIdx = i - Math.floor(winFrames / 2) - 1;
    if (addIdx < nFrames) { sum += flux[addIdx]; count++; }
    if (removeIdx >= 0) { sum -= flux[removeIdx]; count--; }
    threshold[i] = count > 0 ? (sum / count) : 0;
  }

  return { flux, threshold };
}

// ─── Hit detection ───────────────────────────────────────────────────────────

function detectHits(
  flux: Float32Array,
  threshold: Float32Array,
  sampleRate: number,
  hopSize: number,
  minDistanceSec: number,
  sensitivity: number
): number[] {
  const minDistFrames = Math.round((minDistanceSec * sampleRate) / hopSize);
  const hits: number[] = [];
  let lastHit = -minDistFrames;

  for (let i = 1; i < flux.length - 1; i++) {
    const thr = threshold[i] * sensitivity;
    if (
      flux[i] > thr &&
      flux[i] >= flux[i - 1] &&
      flux[i] >= flux[i + 1] &&
      i - lastHit >= minDistFrames
    ) {
      hits.push(i);
      lastHit = i;
    }
  }

  return hits;
}

// ─── Session detection ───────────────────────────────────────────────────────

function detectSessions(hitTimes: number[], gapThreshold: number): Session[] {
  if (hitTimes.length === 0) return [];

  const sessions: Session[] = [];
  let start = hitTimes[0];
  let end = hitTimes[0];
  let hitCount = 1;

  for (let i = 1; i < hitTimes.length; i++) {
    if (hitTimes[i] - hitTimes[i - 1] > gapThreshold) {
      sessions.push({ index: sessions.length + 1, start, end, duration: end - start, hitCount });
      start = hitTimes[i];
      hitCount = 1;
    } else {
      hitCount++;
    }
    end = hitTimes[i];
  }
  sessions.push({ index: sessions.length + 1, start, end, duration: end - start, hitCount });

  return sessions;
}

// ─── Waveform downsampling ───────────────────────────────────────────────────

function downsampleWaveform(
  audio: Float32Array,
  sampleRate: number,
  targetPoints: number
): { waveform: number[]; waveformTimes: number[] } {
  const step = Math.max(1, Math.floor(audio.length / targetPoints));
  const waveform: number[] = [];
  const waveformTimes: number[] = [];

  for (let i = 0; i < audio.length; i += step) {
    const end = Math.min(i + step, audio.length);
    let maxAbs = 0;
    for (let j = i; j < end; j++) {
      const v = Math.abs(audio[j]);
      if (v > maxAbs) maxAbs = v;
    }
    waveform.push(maxAbs);
    waveformTimes.push(i / sampleRate);
  }

  return { waveform, waveformTimes };
}

// ─── Main entry point ────────────────────────────────────────────────────────

export async function analyzeAudio(
  file: File,
  settings: AnalysisSettings,
  onProgress: (p: number) => void = () => {}
): Promise<AnalysisResult> {
  // 1. Decode
  onProgress(2);
  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new AudioContext();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  await audioCtx.close();
  onProgress(10);

  const sampleRate = audioBuffer.sampleRate;
  const totalDuration = audioBuffer.duration;

  // 2. Mix to mono + normalize
  let audio: Float32Array;
  if (audioBuffer.numberOfChannels > 1) {
    audio = new Float32Array(audioBuffer.length);
    for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
      const ch = audioBuffer.getChannelData(c);
      for (let i = 0; i < audio.length; i++) audio[i] += ch[i];
    }
    const factor = audioBuffer.numberOfChannels;
    for (let i = 0; i < audio.length; i++) audio[i] /= factor;
  } else {
    audio = audioBuffer.getChannelData(0).slice();
  }

  let maxAbs = 0;
  for (let i = 0; i < audio.length; i++) { const v = Math.abs(audio[i]); if (v > maxAbs) maxAbs = v; }
  if (maxAbs > 0) for (let i = 0; i < audio.length; i++) audio[i] /= maxAbs;

  // 3. Spectral flux
  const params = getBreakerParams(settings.breakerType);
  const { frameSize, hopSize, lowFreq, highFreq, minDistance } = params;

  const { flux, threshold } = await computeSpectralFlux(
    audio, sampleRate, frameSize, hopSize, lowFreq, highFreq,
    onProgress, 10, 80
  );
  onProgress(80);

  const fluxTimes = Array.from({ length: flux.length }, (_, i) => (i * hopSize) / sampleRate);

  // 4. Detect hits
  const hitFrames = detectHits(flux, threshold, sampleRate, hopSize, minDistance, settings.sensitivity);
  const hitTimes = hitFrames.map((f) => (f * hopSize) / sampleRate);
  onProgress(88);

  // 5. BPM
  let bpm = 0, bpmStd = 0;
  if (hitTimes.length > 1) {
    const intervals = hitTimes.slice(1).map((t, i) => t - hitTimes[i]);
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    bpm = 60 / avg;
    const variance = intervals.reduce((a, b) => a + (b - avg) ** 2, 0) / intervals.length;
    bpmStd = (60 / (avg * avg)) * Math.sqrt(variance);
  }

  // 6. Sessions
  const sessions = detectSessions(hitTimes, settings.gapThreshold);
  const totalHittingTime = sessions.reduce((s, sess) => s + sess.duration, 0);
  const totalHittingPercentage = totalDuration > 0 ? (totalHittingTime / totalDuration) * 100 : 0;
  onProgress(94);

  // 7. Waveform
  const { waveform, waveformTimes } = downsampleWaveform(audio, sampleRate, 4000);
  onProgress(100);

  return {
    hitTimes,
    hitCount: hitTimes.length,
    bpm,
    bpmStd,
    sessions,
    totalHittingTime,
    totalHittingPercentage,
    totalDuration,
    flux: Array.from(flux),
    fluxTimes,
    threshold: Array.from(threshold).map((v) => v * settings.sensitivity),
    waveform,
    waveformTimes,
    hopSize,
    sampleRate,
  };
}
