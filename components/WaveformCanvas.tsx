"use client";

import { useEffect, useRef } from "react";

interface Props {
  waveform: number[];
  waveformTimes: number[];
  hitTimes: number[];
  totalDuration: number;
  currentTime: number;
}

const PAD = { top: 16, bottom: 24, left: 8, right: 8 };

export default function WaveformCanvas({
  waveform, waveformTimes, hitTimes, totalDuration, currentTime,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Cached snapshot of the static layer (waveform + hit markers)
  const baseImageRef = useRef<ImageData | null>(null);

  // Redraw static layer whenever data changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const drawW = W - PAD.left - PAD.right;
    const drawH = H - PAD.top - PAD.bottom;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, W, H);

    const tx = (t: number) => PAD.left + (t / totalDuration) * drawW;

    // Waveform bars
    ctx.fillStyle = "#1e4a72";
    for (let i = 0; i < waveform.length; i++) {
      const x = tx(waveformTimes[i]);
      const h = waveform[i] * drawH * 0.92;
      ctx.fillRect(x, PAD.top + drawH / 2 - h / 2, 1.5, h);
    }

    // Hit markers (dashed vertical lines)
    ctx.strokeStyle = "#ef444466";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    for (const t of hitTimes) {
      const x = tx(t);
      ctx.beginPath();
      ctx.moveTo(x, PAD.top);
      ctx.lineTo(x, PAD.top + drawH);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Time axis labels
    ctx.fillStyle = "#475569";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    const nLabels = Math.min(11, Math.max(2, Math.floor(totalDuration / 10) + 2));
    for (let i = 0; i < nLabels; i++) {
      const t = (i / (nLabels - 1)) * totalDuration;
      const x = tx(t);
      const m = Math.floor(t / 60);
      const s = Math.floor(t % 60);
      ctx.fillText(`${m}:${s.toString().padStart(2, "0")}`, x, H - 4);
    }

    // Save snapshot
    baseImageRef.current = ctx.getImageData(0, 0, W, H);
  }, [waveform, waveformTimes, hitTimes, totalDuration]);

  // Overlay playback line onto snapshot
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !baseImageRef.current) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.putImageData(baseImageRef.current, 0, 0);

    if (currentTime > 0 && currentTime <= totalDuration) {
      const W = canvas.width;
      const H = canvas.height;
      const drawW = W - PAD.left - PAD.right;
      const x = PAD.left + (currentTime / totalDuration) * drawW;

      ctx.strokeStyle = "#f97316cc";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x, PAD.top);
      ctx.lineTo(x, H - PAD.bottom);
      ctx.stroke();
    }
  }, [currentTime, totalDuration]);

  return (
    <div className="rounded-lg overflow-hidden bg-slate-900 border border-slate-700">
      <div className="px-4 py-2 border-b border-slate-700">
        <span className="text-xs text-slate-400 uppercase tracking-wide">파형 (Waveform)</span>
      </div>
      <canvas ref={canvasRef} width={1200} height={140} className="w-full h-auto" />
    </div>
  );
}
