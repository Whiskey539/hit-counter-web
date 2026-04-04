"use client";

import type { AnalysisSettings, BreakerType, AnalysisResult } from "@/lib/types";

interface Props {
  settings: AnalysisSettings;
  onChange: (s: AnalysisSettings) => void;
  disabled?: boolean;
  result?: AnalysisResult | null;
}

const BREAKER_TYPES: { value: BreakerType; label: string; desc: string }[] = [
  { value: "small",  label: "소형",  desc: "120–1200 Hz" },
  { value: "medium", label: "중형",  desc: "80–800 Hz" },
  { value: "large",  label: "대형",  desc: "60–800 Hz" },
];

export default function Settings({ settings, onChange, disabled, result }: Props) {
  function set<K extends keyof AnalysisSettings>(key: K, value: AnalysisSettings[K]) {
    onChange({ ...settings, [key]: value });
  }

  return (
    <div className={`bg-slate-800/60 rounded-xl p-6 space-y-5 ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-slate-200 font-semibold text-base">분석 설정</h2>
        <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/30">
          자동 감도 조정
        </span>
      </div>

      {/* Breaker type */}
      <div>
        <p className="text-slate-400 text-xs mb-2 uppercase tracking-wide">브레이커 유형 (분석 주파수 대역)</p>
        <div className="grid grid-cols-3 gap-2">
          {BREAKER_TYPES.map(({ value, label, desc }) => (
            <button
              key={value}
              onClick={() => set("breakerType", value)}
              className={[
                "rounded-lg px-3 py-3 text-sm font-medium border transition-colors text-left",
                settings.breakerType === value
                  ? "border-sky-500 bg-sky-500/20 text-sky-300"
                  : "border-slate-600 bg-slate-700/40 text-slate-300 hover:border-slate-400",
              ].join(" ")}
            >
              <div className="font-semibold">{label}</div>
              <div className="text-xs opacity-70 mt-0.5">{desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Gap threshold */}
      <div>
        <div className="flex justify-between mb-2">
          <p className="text-slate-400 text-xs uppercase tracking-wide">구간 분리 기준 (Gap)</p>
          <span className="text-sky-400 text-sm font-mono">{settings.gapThreshold.toFixed(1)}초</span>
        </div>
        <input
          type="range"
          min={1.0} max={15.0} step={0.5}
          value={settings.gapThreshold}
          onChange={(e) => set("gapThreshold", parseFloat(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span>짧은 공백 (1s)</span>
          <span>긴 공백 (15s)</span>
        </div>
      </div>

      {/* Auto-detection result */}
      {result && (
        <div className="rounded-lg bg-slate-700/40 border border-slate-600 px-4 py-3 space-y-1.5">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">자동 감지 결과</p>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">감지된 타격 주기</span>
            <span className="text-slate-200 font-mono">
              {result.detectedPeriod.toFixed(3)}s
              <span className="text-slate-400 ml-1">({(60 / result.detectedPeriod).toFixed(1)} BPM)</span>
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">주기 신뢰도</span>
            <div className="flex items-center gap-2">
              <div className="w-20 h-1.5 bg-slate-600 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-400"
                  style={{ width: `${Math.min(100, result.periodConfidence * 150)}%` }}
                />
              </div>
              <span className="text-slate-300 font-mono text-xs">{(result.periodConfidence * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
