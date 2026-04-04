"use client";

import { useRef, useState, DragEvent } from "react";

interface Props {
  onFile: (file: File) => void;
  disabled?: boolean;
}

const ACCEPTED = ["audio/mpeg", "audio/wav", "audio/ogg", "audio/flac", "audio/aac", "audio/mp4",
  "video/mp4", "video/quicktime", "video/x-msvideo"];

export default function FileUpload({ onFile, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    e.target.value = "";
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={[
        "border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors select-none",
        dragging ? "border-sky-400 bg-sky-400/10" : "border-slate-600 hover:border-slate-400 bg-slate-800/40",
        disabled ? "opacity-50 pointer-events-none" : "",
      ].join(" ")}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        className="hidden"
        onChange={handleChange}
      />
      <div className="text-5xl mb-4">🎵</div>
      <p className="text-slate-200 text-lg font-semibold mb-1">
        파일을 드래그하거나 클릭하여 업로드
      </p>
      <p className="text-slate-400 text-sm">
        MP3, WAV, OGG, FLAC, AAC, MP4, MOV, AVI 지원
      </p>
    </div>
  );
}
