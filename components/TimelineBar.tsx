"use client";

import type { Session } from "@/lib/types";

interface Props {
  totalDuration: number;
  sessions: Session[];
  currentTime?: number;
}

function formatTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const SESSION_COLORS = [
  "#f97316", "#0ea5e9", "#a855f7", "#22c55e", "#f59e0b",
  "#ec4899", "#14b8a6", "#ef4444", "#6366f1", "#84cc16",
];

export default function TimelineBar({ totalDuration, sessions, currentTime = 0 }: Props) {
  const playPct = (currentTime / totalDuration) * 100;

  return (
    <div className="bg-slate-800/60 rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-slate-400 text-xs uppercase tracking-wide">타격 구간 타임라인</span>
        <span className="text-slate-400 text-xs">{formatTime(totalDuration)}</span>
      </div>

      {/* Bar */}
      <div className="relative h-8 rounded-md bg-slate-700 overflow-hidden">
        {/* Session segments */}
        {sessions.map((sess, i) => {
          const left = (sess.start / totalDuration) * 100;
          const width = (sess.duration / totalDuration) * 100;
          const color = SESSION_COLORS[i % SESSION_COLORS.length];
          return (
            <div
              key={i}
              className="absolute top-0 h-full rounded-sm opacity-80"
              style={{ left: `${left}%`, width: `${Math.max(width, 0.3)}%`, background: color }}
              title={`구간 ${sess.index}: ${formatTime(sess.start)} ~ ${formatTime(sess.end)} (${sess.duration.toFixed(1)}s, ${sess.hitCount}회)`}
            />
          );
        })}
        {/* Playback cursor */}
        {currentTime > 0 && (
          <div
            className="absolute top-0 h-full w-0.5 bg-white/80 z-10"
            style={{ left: `${playPct}%` }}
          />
        )}
        {/* Time ticks */}
        {Array.from({ length: 5 }, (_, i) => {
          const pct = (i / 4) * 100;
          const t = (i / 4) * totalDuration;
          return (
            <div key={i} className="absolute top-0 h-full flex flex-col justify-end" style={{ left: `${pct}%` }}>
              <div className="w-px h-2 bg-slate-500/50" />
            </div>
          );
        })}
      </div>

      {/* Time labels */}
      <div className="flex justify-between text-xs text-slate-500">
        {Array.from({ length: 5 }, (_, i) => {
          const t = (i / 4) * totalDuration;
          return <span key={i}>{formatTime(t)}</span>;
        })}
      </div>

      {/* Session chips */}
      {sessions.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {sessions.map((sess, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs"
              style={{ background: SESSION_COLORS[i % SESSION_COLORS.length] + "33", border: `1px solid ${SESSION_COLORS[i % SESSION_COLORS.length]}66` }}
            >
              <div className="w-2 h-2 rounded-full" style={{ background: SESSION_COLORS[i % SESSION_COLORS.length] }} />
              <span className="text-slate-200">구간 {sess.index}</span>
              <span className="text-slate-400">{formatTime(sess.start)}~{formatTime(sess.end)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
