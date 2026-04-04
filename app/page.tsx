"use client";

import { useCallback, useRef, useState } from "react";
import type { AnalysisResult, AnalysisSettings } from "@/lib/types";
import { analyzeAudio } from "@/lib/audioProcessor";
import FileUpload from "@/components/FileUpload";
import Settings from "@/components/Settings";
import StatsGrid from "@/components/StatsGrid";
import WaveformCanvas from "@/components/WaveformCanvas";
import FluxCanvas from "@/components/FluxCanvas";
import TimelineBar from "@/components/TimelineBar";
import SessionList from "@/components/SessionList";
import AudioPlayer from "@/components/AudioPlayer";

const DEFAULT_SETTINGS: AnalysisSettings = {
  breakerType: "large",
  gapThreshold: 3.0,
};

function exportCSV(result: AnalysisResult, filename: string) {
  const rows = [
    ["Hit#", "Time (s)", "Time (hh:mm:ss)", "Session#"],
    ...result.hitTimes.map((t, i) => {
      const h = Math.floor(t / 3600);
      const m = Math.floor((t % 3600) / 60);
      const s = (t % 60).toFixed(3);
      const sessIdx = result.sessions.findIndex((sess) => t >= sess.start && t <= sess.end);
      return [i + 1, t.toFixed(3), `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(6,"0")}`, sessIdx + 1];
    }),
  ];
  const csv = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.replace(/\.[^.]+$/, "") + "_hits.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [settings, setSettings] = useState<AnalysisSettings>(DEFAULT_SETTINGS);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const prevUrlRef = useRef<string | null>(null);

  function handleFile(f: File) {
    if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
    const url = URL.createObjectURL(f);
    prevUrlRef.current = url;
    setFile(f);
    setAudioUrl(url);
    setResult(null);
    setError(null);
    setCurrentTime(0);
  }

  const handleAnalyze = useCallback(async () => {
    if (!file) return;
    setAnalyzing(true);
    setError(null);
    setProgress(0);

    try {
      const res = await analyzeAudio(file, settings, setProgress);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "분석 중 오류가 발생했습니다.");
    } finally {
      setAnalyzing(false);
    }
  }, [file, settings]);

  return (
    <main className="min-h-screen px-4 py-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
          유압브레이커 타격 음향 분석기
        </h1>
        <p className="text-slate-400 text-sm">Hydraulic Breaker Impact Sound Analyzer</p>
      </div>

      {/* Upload */}
      <FileUpload onFile={handleFile} disabled={analyzing} />

      {/* File info + settings + analyze */}
      {file && (
        <div className="space-y-4">
          {/* File info bar */}
          <div className="flex items-center justify-between bg-slate-800/60 rounded-xl px-5 py-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎧</span>
              <div>
                <p className="text-slate-200 text-sm font-medium">{file.name}</p>
                <p className="text-slate-400 text-xs">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>
            <button
              onClick={() => { setFile(null); setAudioUrl(null); setResult(null); setError(null); }}
              disabled={analyzing}
              className="text-slate-400 hover:text-slate-200 text-xs px-3 py-1.5 rounded-lg border border-slate-600 hover:border-slate-400 transition-colors"
            >
              파일 변경
            </button>
          </div>

          <Settings settings={settings} onChange={setSettings} disabled={analyzing} result={result} />

          {/* Analyze button */}
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="w-full rounded-xl py-3.5 font-semibold text-white transition-colors text-sm
              bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed"
          >
            {analyzing ? "분석 중..." : result ? "재분석" : "분석하기"}
          </button>

          {/* Progress bar */}
          {analyzing && (
            <div className="space-y-1">
              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-500 rounded-full transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-center text-xs text-slate-400">{Math.round(progress)}%</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-xl bg-red-900/30 border border-red-500/40 px-5 py-3 text-red-300 text-sm">
              {error}
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {result && audioUrl && (
        <div className="space-y-5">
          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-700" />
            <span className="text-slate-400 text-xs uppercase tracking-wide">분석 결과</span>
            <div className="flex-1 h-px bg-slate-700" />
          </div>

          {/* Stats */}
          <StatsGrid result={result} />

          {/* Timeline */}
          <TimelineBar
            totalDuration={result.totalDuration}
            sessions={result.sessions}
            currentTime={currentTime}
          />

          {/* Audio player */}
          <AudioPlayer src={audioUrl} onTimeUpdate={setCurrentTime} />

          {/* Charts */}
          <WaveformCanvas
            waveform={result.waveform}
            waveformTimes={result.waveformTimes}
            hitTimes={result.hitTimes}
            totalDuration={result.totalDuration}
            currentTime={currentTime}
          />
          <FluxCanvas
            flux={result.flux}
            fluxTimes={result.fluxTimes}
            threshold={result.threshold}
            hitTimes={result.hitTimes}
            totalDuration={result.totalDuration}
            currentTime={currentTime}
          />

          {/* Session list */}
          <SessionList sessions={result.sessions} totalDuration={result.totalDuration} />

          {/* Export */}
          <div className="flex justify-end">
            <button
              onClick={() => exportCSV(result, file?.name ?? "result")}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm transition-colors border border-slate-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              CSV 내보내기
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
