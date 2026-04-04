"use client";

import type { AnalysisSettings, BreakerType } from "@/lib/types";

interface Props {
  settings: AnalysisSettings;
  onChange: (s: AnalysisSettings) => void;
  disabled?: boolean;
}

const BREAKER_TYPES: { value: BreakerType; label: string; desc: string }[] = [
  { value: "small",  label: "소형",  desc: "min dist 50ms · 120–1200 Hz" },
  { value: "medium", label: "중형",  desc: "min dist 70ms · 80–800 Hz" },
  { value: "large",  label: "대형",  desc: "min dist 100ms · 60–500 Hz" },
];

export default function Settings({ settings, onChange, disabled }: Props) {
  function set<K extends keyof AnalysisSettings>(key: K, value: AnalysisSettings[K]) {
    onChange({ ...settings, [key]: value });
  }

  return (
    <div className={`bg-slate-800/60 rounded-xl p-6 space-y-6 ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      <h2 className="text-slate-200 font-semibold text-base">분석 설정</h2>

      {/* Breaker type */}
      <div>
        <p className="text-slate-400 text-xs mb-2 uppercase tracking-wide">브레이커 유형</p>
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

      {/* Sensitivity */}
      <div>
        <div className="flex justify-between mb-2">
          <p className="text-slate-400 text-xs uppercase tracking-wide">감도 (Threshold 배율)</p>
          <span className="text-sky-400 text-sm font-mono">{settings.sensitivity.toFixed(1)}×</span>
        </div>
        <input
          type="range"
          min={0.5} max={5.0} step={0.1}
          value={settings.sensitivity}
          onChange={(e) => set("sensitivity", parseFloat(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span>민감 (0.5×)</span>
          <span>둔감 (5.0×)</span>
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
    </div>
  );
}
