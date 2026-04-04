"use client";

import { useEffect, useRef } from "react";

interface Props {
  flux: number[];
  fluxTimes: number[];
  threshold: number[];
  hitTimes: number[];
  totalDuration: number;
  currentTime: number;
}

const PAD = { top: 16, bottom: 24, left: 8, right: 8 };

export default function FluxCanvas({
  flux, fluxTimes, threshold, hitTimes, totalDuration, currentTime,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseImageRef = useRef<ImageData | null>(null);

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

    const maxFlux = Math.max(...flux) || 1;
    const tx = (t: number) => PAD.left + (t / totalDuration) * drawW;
    const vy = (v: number) => PAD.top + drawH - (v / maxFlux) * drawH * 0.92;

    // Flux filled area
    ctx.save();
    const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + drawH);
    grad.addColorStop(0, "#0ea5e940");
    grad.addColorStop(1, "#0ea5e905");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(tx(fluxTimes[0] ?? 0), PAD.top + drawH);
    for (let i = 0; i < flux.length; i++) {
      ctx.lineTo(tx(fluxTimes[i]), vy(flux[i]));
    }
    ctx.lineTo(tx(fluxTimes[flux.length - 1] ?? 0), PAD.top + drawH);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Flux line
    ctx.save();
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < flux.length; i++) {
      const x = tx(fluxTimes[i]);
      const y = vy(flux[i]);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    // Threshold curve
    ctx.save();
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    for (let i = 0; i < threshold.length; i++) {
      const x = tx(fluxTimes[i]);
      const y = vy(threshold[i]);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Hit dots
    ctx.save();
    for (const t of hitTimes) {
      const fi = Math.min(flux.length - 1, Math.round((t / totalDuration) * (flux.length - 1)));
      const x = tx(t);
      const y = vy(flux[fi] ?? 0);
      ctx.fillStyle = "#ef4444";
      ctx.strokeStyle = "#fca5a5";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    // Time axis
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

    baseImageRef.current = ctx.getImageData(0, 0, W, H);
  }, [flux, fluxTimes, threshold, hitTimes, totalDuration]);

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
      <div className="px-4 py-2 border-b border-slate-700 flex items-center gap-4 flex-wrap">
        <span className="text-xs text-slate-400 uppercase tracking-wide">Spectral Flux</span>
        <span className="flex items-center gap-1.5 text-xs text-cyan-400">
          <span className="inline-block w-4 h-px bg-cyan-400"></span>Flux
        </span>
        <span className="flex items-center gap-1.5 text-xs text-green-400">
          <span className="inline-block w-4 h-px bg-green-500" style={{borderTop: "1.5px dashed #22c55e"}}></span>
          Threshold
        </span>
        <span className="flex items-center gap-1.5 text-xs text-red-400">
          <span className="inline-block w-2.5 h-2.5 bg-red-500 rounded-full"></span>
          타격 감지
        </span>
      </div>
      <canvas ref={canvasRef} width={1200} height={200} className="w-full h-auto" />
    </div>
  );
}
