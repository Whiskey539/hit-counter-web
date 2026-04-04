"use client";

import type { AnalysisResult } from "@/lib/types";

interface Props {
  result: AnalysisResult;
}

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}시간 ${m}분 ${s}초`;
  if (m > 0) return `${m}분 ${s}초`;
  return `${s}초`;
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="bg-slate-800/80 rounded-xl px-5 py-4 border border-slate-700/60">
      <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent ?? "text-slate-100"}`}>{value}</p>
      {sub && <p className="text-slate-400 text-xs mt-1">{sub}</p>}
    </div>
  );
}

export default function StatsGrid({ result }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <StatCard
        label="총 타격수"
        value={`${result.hitCount}회`}
        accent="text-sky-400"
      />
      <StatCard
        label="평균 BPM"
        value={result.bpm > 0 ? result.bpm.toFixed(1) : "—"}
        sub={result.bpmStd > 0 ? `±${result.bpmStd.toFixed(1)} BPM` : undefined}
        accent="text-emerald-400"
      />
      <StatCard
        label="전체 길이"
        value={formatDuration(result.totalDuration)}
        accent="text-slate-200"
      />
      <StatCard
        label="타격 구간 시간"
        value={formatDuration(result.totalHittingTime)}
        sub={`${result.sessions.length}개 구간`}
        accent="text-orange-400"
      />
      <StatCard
        label="타격 비율"
        value={`${result.totalHittingPercentage.toFixed(1)}%`}
        sub={`${formatDuration(result.totalHittingTime)} / ${formatDuration(result.totalDuration)}`}
        accent={result.totalHittingPercentage > 50 ? "text-red-400" : "text-amber-400"}
      />
      <StatCard
        label="구간 수"
        value={`${result.sessions.length}구간`}
        sub={
          result.sessions.length > 0
            ? `평균 ${formatDuration(result.totalHittingTime / result.sessions.length)}/구간`
            : undefined
        }
        accent="text-purple-400"
      />
    </div>
  );
}
