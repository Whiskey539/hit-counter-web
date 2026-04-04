export interface AnalysisSettings {
  gapThreshold: number; // seconds, 1 ~ 15
}

export interface Session {
  index: number;
  start: number;   // seconds
  end: number;     // seconds
  duration: number; // seconds
  hitCount: number;
}

export interface AnalysisResult {
  // Hit data
  hitTimes: number[];       // seconds
  hitCount: number;

  // BPM
  bpm: number;
  bpmStd: number;

  // Session data
  sessions: Session[];
  totalHittingTime: number;      // seconds
  totalHittingPercentage: number; // 0–100
  totalDuration: number;          // seconds

  // Chart data
  flux: number[];
  fluxTimes: number[];
  threshold: number[];   // per-frame adaptive threshold
  waveform: number[];    // downsampled envelope (positive)
  waveformTimes: number[];

  hopSize: number;
  sampleRate: number;

  // Auto-detection metadata
  detectedPeriod: number;   // seconds
  periodConfidence: number; // 0–1
}
