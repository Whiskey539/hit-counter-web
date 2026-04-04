"use client";

import type { AnalysisSettings, AnalysisResult } from "@/lib/types";

interface Props {
  settings: AnalysisSettings;
  onChange: (s: AnalysisSettings) => void;
  disabled?: boolean;
  result?: AnalysisResult | null;
}

export default function Settings({ settings, onChange, disabled, result }: Props) {
  return (
    <div className={`bg-slate-800/60 rounded-xl p-6 space-y-5 ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-slate-200 font-semibold text-base">분석 설정</h2>
        <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/30">
          완전 자동
        </span>
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
          onChange={(e) => onChange({ ...settings, gapThreshold: parseFloat(e.target.value) })}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span>짧은 공백 (1s)</span>
          <span>긴 공백 (15s)</span>
        </div>
      </div>

      {/* Auto-detection result */}
      {result && (
        <div className="rounded-lg bg-slate-700/40 border border-slate-600 px-4 py-3 space-y-2">
          <p className="text-xs text-slate-400 uppercase tracking-wide">자동 감지 결과</p>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">감지된 타격 주기</span>
            <span className="text-slate-200 font-mono">
              {result.detectedPeriod.toFixed(3)}s
              <span className="text-slate-400 ml-1">({(60 / result.detectedPeriod).toFixed(1)} BPM)</span>
            </span>
          </div>
          <div className="flex justify-between text-sm items-center">
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
