"use client";

import type { Session } from "@/lib/types";

interface Props {
  sessions: Session[];
  totalDuration: number;
}

function formatTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function SessionList({ sessions, totalDuration }: Props) {
  if (sessions.length === 0) return null;

  return (
    <div className="bg-slate-800/60 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-700">
        <span className="text-slate-400 text-xs uppercase tracking-wide">타격 구간 상세</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400 text-xs">
              <th className="text-left px-5 py-2">구간</th>
              <th className="text-left px-4 py-2">시작</th>
              <th className="text-left px-4 py-2">종료</th>
              <th className="text-right px-4 py-2">지속 시간</th>
              <th className="text-right px-4 py-2">타격수</th>
              <th className="text-right px-5 py-2">비율</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((sess) => (
              <tr key={sess.index} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                <td className="px-5 py-2.5 text-sky-400 font-medium">#{sess.index}</td>
                <td className="px-4 py-2.5 text-slate-300 font-mono">{formatTime(sess.start)}</td>
                <td className="px-4 py-2.5 text-slate-300 font-mono">{formatTime(sess.end)}</td>
                <td className="px-4 py-2.5 text-right text-slate-200 font-mono">{sess.duration.toFixed(1)}s</td>
                <td className="px-4 py-2.5 text-right text-slate-200">{sess.hitCount}회</td>
                <td className="px-5 py-2.5 text-right text-slate-400">
                  {totalDuration > 0 ? ((sess.duration / totalDuration) * 100).toFixed(1) : "0"}%
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-700/30 text-slate-300 font-semibold text-xs">
              <td className="px-5 py-2.5" colSpan={3}>합계 ({sessions.length}구간)</td>
              <td className="px-4 py-2.5 text-right font-mono">
                {sessions.reduce((s, r) => s + r.duration, 0).toFixed(1)}s
              </td>
              <td className="px-4 py-2.5 text-right">
                {sessions.reduce((s, r) => s + r.hitCount, 0)}회
              </td>
              <td className="px-5 py-2.5 text-right text-sky-400">
                {totalDuration > 0
                  ? ((sessions.reduce((s, r) => s + r.duration, 0) / totalDuration) * 100).toFixed(1)
                  : "0"}%
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
