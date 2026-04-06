"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  waveform: number[];
  waveformTimes: number[];
  hitTimes: number[];
  totalDuration: number;
  currentTime: number;
  zoom: number;
}

const PAD = { top: 16, bottom: 24, left: 8, right: 8 };

export default function WaveformCanvas({
  waveform, waveformTimes, hitTimes, totalDuration, currentTime, zoom,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const baseImageRef = useRef<ImageData | null>(null);
  const [containerWidth, setContainerWidth] = useState(800);

  // Track container width via ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const canvasWidth = Math.max(containerWidth, containerWidth * zoom);
  const canvasHeight = 140;

  // Redraw static layer when data or size changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvasWidth;
    const H = canvasHeight;
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

    // Hit markers
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
    const labelInterval = zoom <= 2 ? 10 : zoom <= 4 ? 5 : 2;
    const nLabels = Math.floor(totalDuration / labelInterval) + 1;
    for (let i = 0; i <= nLabels; i++) {
      const t = i * labelInterval;
      if (t > totalDuration) break;
      const x = tx(t);
      const m = Math.floor(t / 60);
      const s = Math.floor(t % 60);
      ctx.fillText(`${m}:${s.toString().padStart(2, "0")}`, x, H - 4);
    }

    baseImageRef.current = ctx.getImageData(0, 0, W, H);
  }, [waveform, waveformTimes, hitTimes, totalDuration, canvasWidth, zoom]);

  // Overlay playback line + auto-scroll
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !baseImageRef.current) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.putImageData(baseImageRef.current, 0, 0);

    const drawW = canvasWidth - PAD.left - PAD.right;

    if (currentTime > 0 && currentTime <= totalDuration) {
      const x = PAD.left + (currentTime / totalDuration) * drawW;

      ctx.strokeStyle = "#f97316cc";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x, PAD.top);
      ctx.lineTo(x, canvasHeight - PAD.bottom);
      ctx.stroke();

      // Auto-scroll to keep playhead visible
      const scrollEl = scrollRef.current;
      if (scrollEl) {
        const visible = scrollEl.clientWidth;
        const left = scrollEl.scrollLeft;
        if (x > left + visible * 0.85 || x < left + visible * 0.1) {
          scrollEl.scrollLeft = Math.max(0, x - visible * 0.3);
        }
      }
    }
  }, [currentTime, totalDuration, canvasWidth]);

  return (
    <div className="rounded-lg overflow-hidden bg-slate-900 border border-slate-700">
      <div className="px-4 py-2 border-b border-slate-700 flex items-center justify-between">
        <span className="text-xs text-slate-400 uppercase tracking-wide">파형 (Waveform)</span>
      </div>
      <div ref={containerRef} className="w-full">
        <div ref={scrollRef} className="overflow-x-auto">
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            style={{ display: "block", width: canvasWidth, height: "auto" }}
          />
        </div>
      </div>
    </div>
  );
}
