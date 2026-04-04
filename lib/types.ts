export type BreakerType = "small" | "medium" | "large";

export interface AnalysisSettings {
  breakerType: BreakerType;
  sensitivity: number;   // threshold multiplier, 0.5 ~ 5.0
  gapThreshold: number;  // seconds, 1 ~ 10
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
}
