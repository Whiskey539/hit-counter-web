import type { AnalysisResult, AnalysisSettings, Session } from "./types";

// ─── FFT (Cooley-Tukey, radix-2, in-place) ──────────────────────────────────

function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang), wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1.0, curIm = 0.0;
      const half = len >> 1;
      for (let j = 0; j < half; j++) {
        const uRe = re[i + j], uIm = im[i + j];
        const vRe = re[i + j + half] * curRe - im[i + j + half] * curIm;
        const vIm = re[i + j + half] * curIm + im[i + j + half] * curRe;
        re[i + j] = uRe + vRe; im[i + j] = uIm + vIm;
        re[i + j + half] = uRe - vRe; im[i + j + half] = uIm - vIm;
        const nr = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe; curRe = nr;
      }
    }
  }
}

// 80–500 Hz: best trade-off across all breaker types
// (wider bands cause period doubling errors on fast breakers)
const FLUX_BAND = { lo: 80, hi: 500 };

// ─── Spectral Flux ───────────────────────────────────────────────────────────

async function computeSpectralFlux(
  audio: Float32Array,
  sampleRate: number,
  frameSize: number,
  hopSize: number,
  lo: number,
  hi: number,
  onProgress: (p: number) => void,
  pStart: number,
  pEnd: number
): Promise<Float32Array> {
  const loBin = Math.max(1, Math.round((lo * frameSize) / sampleRate));
  const hiBin = Math.min(frameSize / 2, Math.round((hi * frameSize) / sampleRate));

  const win = new Float32Array(frameSize);
  for (let i = 0; i < frameSize; i++)
    win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (frameSize - 1)));

  const nFrames = Math.floor((audio.length - frameSize) / hopSize);
  const flux = new Float32Array(nFrames);
  const prev = new Float32Array(hiBin + 1);
  const re = new Float32Array(frameSize);
  const im = new Float32Array(frameSize);

  for (let f = 0; f < nFrames; f++) {
    if (f % 500 === 0) {
      await new Promise<void>((r) => setTimeout(r, 0));
      onProgress(pStart + (pEnd - pStart) * (f / nFrames));
    }
    const start = f * hopSize;
    for (let i = 0; i < frameSize; i++) { re[i] = (audio[start + i] ?? 0) * win[i]; im[i] = 0; }
    fft(re, im);
    let val = 0;
    for (let b = loBin; b <= hiBin; b++) {
      const mag = Math.sqrt(re[b] * re[b] + im[b] * im[b]);
      const d = mag - prev[b]; if (d > 0) val += d; prev[b] = mag;
    }
    flux[f] = val;
  }
  return flux;
}

// ─── Adaptive threshold (O(n) sliding window mean) ───────────────────────────

function adaptiveThreshold(flux: Float32Array, sampleRate: number, hopSize: number): Float32Array {
  const winFrames = Math.max(1, Math.round((2.0 * sampleRate) / hopSize));
  const thr = new Float32Array(flux.length);
  let sum = 0, count = 0;
  const initEnd = Math.min(Math.floor(winFrames / 2), flux.length);
  for (let i = 0; i < initEnd; i++) { sum += flux[i]; count++; }
  for (let i = 0; i < flux.length; i++) {
    const add = i + Math.floor(winFrames / 2);
    const rem = i - Math.floor(winFrames / 2) - 1;
    if (add < flux.length) { sum += flux[add]; count++; }
    if (rem >= 0) { sum -= flux[rem]; count--; }
    thr[i] = count > 0 ? sum / count : 0;
  }
  return thr;
}

// ─── Dominant period via autocorrelation ─────────────────────────────────────

function dominantPeriod(
  flux: Float32Array,
  sampleRate: number,
  hopSize: number
): { period: number; confidence: number } {
  // Whiten: subtract half of local mean to suppress DC
  const f = new Float32Array(flux.length);
  const winF = Math.max(1, Math.round((1.0 * sampleRate) / hopSize));
  const tmp = new Float32Array(flux.length);
  // moving average
  let s = 0;
  for (let i = 0; i < Math.min(winF, flux.length); i++) s += flux[i];
  for (let i = 0; i < flux.length; i++) {
    const add = i + winF; const rem = i - 1;
    if (add < flux.length) s += flux[add];
    if (rem >= 0) s -= flux[rem];
    tmp[i] = s / Math.min(winF, flux.length);
  }
  for (let i = 0; i < flux.length; i++)
    f[i] = Math.max(0, flux[i] - tmp[i] * 0.5);

  // Autocorrelation via direct sum (fast for moderate length)
  // Limit to first 10 000 frames for performance
  const L = Math.min(f.length, 10000);
  const minLag = Math.max(1, Math.round(0.05 * sampleRate / hopSize));
  const maxLag = Math.min(L - 1, Math.round(3.0 * sampleRate / hopSize));

  let bestVal = -1, bestLag = minLag;
  const norm = (() => { let v = 0; for (let i = 0; i < L; i++) v += f[i] * f[i]; return v || 1; })();

  for (let lag = minLag; lag <= maxLag; lag++) {
    let ac = 0;
    for (let i = 0; i < L - lag; i++) ac += f[i] * f[i + lag];
    ac /= norm;
    if (ac > bestVal) { bestVal = ac; bestLag = lag; }
  }

  return { period: (bestLag * hopSize) / sampleRate, confidence: bestVal };
}

// ─── Rhythm-aware sweep detection ────────────────────────────────────────────

function rhythmSweepDetect(
  flux: Float32Array,
  thrBase: Float32Array,
  sampleRate: number,
  hopSize: number,
  periodSec: number
): number[] {
  const minDistF = Math.max(1, Math.round((periodSec * 0.45 * sampleRate) / hopSize));
  let bestHits: number[] = [];
  let bestScore = 1e9;

  for (let si = 0; si < 45; si++) {
    const sens = 0.5 + si * (5.5 / 44);
    const hits: number[] = [];
    let last = -minDistF;
    for (let i = 1; i < flux.length - 1; i++) {
      if (
        flux[i] > thrBase[i] * sens &&
        flux[i] >= flux[i - 1] &&
        flux[i] >= flux[i + 1] &&
        i - last >= minDistF
      ) { hits.push(i); last = i; }
    }
    if (hits.length < 2) continue;

    // Score: how well do intervals match multiples of period?
    let totalRes = 0;
    for (let i = 1; i < hits.length; i++) {
      const intervalSec = ((hits[i] - hits[i - 1]) * hopSize) / sampleRate;
      const ratio = intervalSec / periodSec;
      const rounded = Math.max(1, Math.round(ratio));
      totalRes += Math.abs(ratio - rounded);
    }
    const score = totalRes / (hits.length - 1);
    if (score < bestScore) { bestScore = score; bestHits = hits; }
  }
  return bestHits;
}

// ─── Rhythm fill: insert missed hits at expected grid positions ───────────────

function rhythmFill(
  hits: number[],
  flux: Float32Array,
  sampleRate: number,
  hopSize: number,
  periodSec: number,
  tolerance = 0.4
): number[] {
  if (hits.length < 2) return hits;

  const times = hits.map((h) => (h * hopSize) / sampleRate);
  const tolSec = tolerance * periodSec;
  const fluxMean = Array.from(flux).reduce((a, b) => a + b, 0) / flux.length;

  const filled = [...times];
  // Walk through consecutive hit pairs and fill gaps
  let i = 0;
  while (i < filled.length - 1) {
    const gap = filled[i + 1] - filled[i];
    const nPeriods = Math.round(gap / periodSec);
    if (nPeriods >= 2) {
      for (let k = 1; k < nPeriods; k++) {
        const expected = filled[i] + k * periodSec;
        const fi = Math.round((expected * sampleRate) / hopSize);
        const win = Math.round((tolSec * sampleRate) / hopSize);
        const lo = Math.max(0, fi - win);
        const hi = Math.min(flux.length - 1, fi + win);
        if (lo < hi) {
          let peakI = lo;
          for (let j = lo + 1; j <= hi; j++) if (flux[j] > flux[peakI]) peakI = j;
          if (flux[peakI] > fluxMean * 0.8)
            filled.push((peakI * hopSize) / sampleRate);
        }
      }
      filled.sort((a, b) => a - b);
    }
    i++;
  }

  // Deduplicate within min gap
  const minGap = periodSec * 0.4;
  const pruned: number[] = [];
  for (const t of filled) {
    if (!pruned.length || t - pruned[pruned.length - 1] >= minGap) pruned.push(t);
  }
  return pruned.map((t) => Math.round((t * sampleRate) / hopSize));
}

// ─── Sparse-file detection (noisy field recordings) ─────────────────────────
// Used when autocorrelation detects noise period (detected_hits << expected_from_period).
// 1. CV sweep: find the most regularly-spaced hit set (min 4 hits).
// 2. Try subharmonic halving (period/2) with no-cascade fill + p95 threshold.

function sparseDetect(
  flux: Float32Array,
  thrBase: Float32Array,
  sampleRate: number,
  hopSize: number,
  duration: number
): number[] {
  // --- Step 1: CV sweep ---
  const minDistCandidates: number[] = [];
  for (let md = 0.3; md < 1.0; md += 0.1) minDistCandidates.push(md);
  for (let md = 1.0; md < Math.min(duration / 2, 4.0); md += 0.25) minDistCandidates.push(md);

  let bestHits: number[] = [], bestCV = 1e9, bestPeriod = 1.0;

  for (const minDistSec of minDistCandidates) {
    const minD = Math.max(1, Math.round((minDistSec * sampleRate) / hopSize));
    for (let si = 0; si < 40; si++) {
      const sens = 0.5 + si * (5.5 / 39);
      const h: number[] = [];
      let last = -minD;
      for (let i = 1; i < flux.length - 1; i++) {
        if (
          flux[i] > thrBase[i] * sens &&
          flux[i] >= flux[i - 1] &&
          flux[i] >= flux[i + 1] &&
          i - last >= minD
        ) { h.push(i); last = i; }
      }
      if (h.length < 4) continue;
      const times = h.map((x) => (x * hopSize) / sampleRate);
      const intervals = times.slice(1).map((t, i) => t - times[i]);
      const meanIv = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      if (meanIv < 0.3) continue;
      const cv = Math.sqrt(intervals.reduce((a, b) => a + (b - meanIv) ** 2, 0) / intervals.length) / meanIv;
      if (cv < bestCV) { bestCV = cv; bestHits = h; bestPeriod = meanIv; }
    }
  }

  if (bestHits.length < 2) return bestHits;

  // --- Step 2: try period/2 with no-cascade fill + p95 threshold ---
  const fluxArr = Array.from(flux);
  const sorted = fluxArr.slice().sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)];

  const baseN = bestHits.length;

  function fillNoCascade(hits: number[], periodSec: number): number[] {
    if (hits.length < 2) return hits;
    const timesOrig = hits.map((h) => (h * hopSize) / sampleRate).sort((a, b) => a - b);
    const newTimes: number[] = [];
    const tol = 0.4;
    for (let i = 0; i < timesOrig.length - 1; i++) {
      const gap = timesOrig[i + 1] - timesOrig[i];
      const n = Math.round(gap / periodSec);
      if (n >= 2) {
        for (let k = 1; k < n; k++) {
          const et = timesOrig[i] + k * periodSec;
          const fi = Math.round((et * sampleRate) / hopSize);
          const win = Math.round((tol * periodSec * sampleRate) / hopSize);
          const lo = Math.max(0, fi - win);
          const hi = Math.min(flux.length - 1, fi + win);
          if (lo < hi) {
            let peakI = lo;
            for (let j = lo + 1; j <= hi; j++) if (flux[j] > flux[peakI]) peakI = j;
            if (flux[peakI] > p95) newTimes.push((peakI * hopSize) / sampleRate);
          }
        }
      }
    }
    const all = [...timesOrig, ...newTimes].sort((a, b) => a - b);
    const deduped = Array.from(new Set(all.map((t) => Math.round(t * 1000) / 1000)));
    const minGap = periodSec * 0.4;
    const pruned: number[] = [];
    for (const t of deduped) {
      if (!pruned.length || t - pruned[pruned.length - 1] >= minGap) pruned.push(t);
    }
    return pruned.map((t) => Math.round((t * sampleRate) / hopSize));
  }

  // Try halving the period
  const halfPeriod = bestPeriod / 2;
  if (halfPeriod >= 0.3) {
    const filled = fillNoCascade(bestHits, halfPeriod);
    if (filled.length > baseN && filled.length <= baseN * 2.5) {
      return filled;
    }
  }

  return bestHits;
}

// ─── Session detection ───────────────────────────────────────────────────────

function detectSessions(hitTimes: number[], gapThreshold: number): Session[] {
  if (!hitTimes.length) return [];
  const sessions: Session[] = [];
  let start = hitTimes[0], end = hitTimes[0], hitCount = 1;
  for (let i = 1; i < hitTimes.length; i++) {
    if (hitTimes[i] - hitTimes[i - 1] > gapThreshold) {
      sessions.push({ index: sessions.length + 1, start, end, duration: end - start, hitCount });
      start = hitTimes[i]; hitCount = 1;
    } else { hitCount++; }
    end = hitTimes[i];
  }
  sessions.push({ index: sessions.length + 1, start, end, duration: end - start, hitCount });
  return sessions;
}

// ─── Waveform downsampling ───────────────────────────────────────────────────

function downsampleWaveform(audio: Float32Array, sampleRate: number, targetPoints: number) {
  const step = Math.max(1, Math.floor(audio.length / targetPoints));
  const waveform: number[] = [], waveformTimes: number[] = [];
  for (let i = 0; i < audio.length; i += step) {
    const end = Math.min(i + step, audio.length);
    let maxAbs = 0;
    for (let j = i; j < end; j++) { const v = Math.abs(audio[j]); if (v > maxAbs) maxAbs = v; }
    waveform.push(maxAbs); waveformTimes.push(i / sampleRate);
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
    for (let i = 0; i < audio.length; i++) audio[i] /= audioBuffer.numberOfChannels;
  } else {
    audio = audioBuffer.getChannelData(0).slice();
  }
  let maxAbs = 0;
  for (let i = 0; i < audio.length; i++) { const v = Math.abs(audio[i]); if (v > maxAbs) maxAbs = v; }
  if (maxAbs > 0) for (let i = 0; i < audio.length; i++) audio[i] /= maxAbs;

  // 3. Spectral flux
  const frameSize = 2048, hopSize = 512;
  const flux = await computeSpectralFlux(audio, sampleRate, frameSize, hopSize, FLUX_BAND.lo, FLUX_BAND.hi, onProgress, 10, 70);
  onProgress(70);

  const fluxTimes = Array.from({ length: flux.length }, (_, i) => (i * hopSize) / sampleRate);

  // 4. Adaptive threshold base
  const thrBase = adaptiveThreshold(flux, sampleRate, hopSize);

  // 5. Dominant period (fully automatic)
  const { period: periodSec, confidence } = dominantPeriod(flux, sampleRate, hopSize);
  onProgress(80);

  // 6. Rhythm-aware sweep (auto-calibrates sensitivity)
  const hitFramesRaw = rhythmSweepDetect(flux, thrBase, sampleRate, hopSize, periodSec);
  onProgress(87);

  // 6b. Sparse fallback: if very few hits found relative to expected count,
  //     the autocorrelation period is likely noise-dominated (e.g. excavator hum).
  //     Use CV-sweep + subharmonic fill instead.
  const expectedFromPeriod = totalDuration / periodSec;
  const sparsityRatio = hitFramesRaw.length / expectedFromPeriod;
  let filledFrames: number[];
  if (sparsityRatio < 0.25 && hitFramesRaw.length < 5) {
    filledFrames = sparseDetect(flux, thrBase, sampleRate, hopSize, totalDuration);
  } else {
    // 7. Fill in missed hits on the rhythm grid
    filledFrames = rhythmFill(hitFramesRaw, flux, sampleRate, hopSize, periodSec);
  }
  const hitTimes = filledFrames.map((f) => (f * hopSize) / sampleRate);
  onProgress(92);

  // 8. BPM
  let bpm = 0, bpmStd = 0;
  if (hitTimes.length > 1) {
    const intervals = hitTimes.slice(1).map((t, i) => t - hitTimes[i]);
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    bpm = 60 / avg;
    const variance = intervals.reduce((a, b) => a + (b - avg) ** 2, 0) / intervals.length;
    bpmStd = (60 / (avg * avg)) * Math.sqrt(variance);
  }

  // 9. Sessions
  const sessions = detectSessions(hitTimes, settings.gapThreshold);
  const totalHittingTime = sessions.reduce((s, sess) => s + sess.duration, 0);
  const totalHittingPercentage = totalDuration > 0 ? (totalHittingTime / totalDuration) * 100 : 0;
  onProgress(96);

  // 10. Display threshold (scale thrBase by median sensitivity)
  const displayThreshold = Array.from(thrBase).map((v) => v * 1.5);

  // 11. Waveform
  const { waveform, waveformTimes } = downsampleWaveform(audio, sampleRate, 4000);
  onProgress(100);

  return {
    hitTimes, hitCount: hitTimes.length,
    bpm, bpmStd,
    sessions, totalHittingTime, totalHittingPercentage, totalDuration,
    flux: Array.from(flux), fluxTimes,
    threshold: displayThreshold,
    waveform, waveformTimes,
    hopSize, sampleRate,
    // Extra info for display
    detectedPeriod: periodSec,
    periodConfidence: confidence,
  } as AnalysisResult;
}
