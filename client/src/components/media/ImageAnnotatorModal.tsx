"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  Pen,
  Square,
  ArrowUpRight,
  Type,
  RotateCcw,
  Trash2,
  Check,
  X,
} from "lucide-react";

interface ImageAnnotatorModalProps {
  isOpen: boolean;
  file: File | null;
  onClose: () => void;
  onSave: (annotatedFile: File) => void;
}

type Tool = "pen" | "rect" | "arrow" | "text";

const COLORS = [
  { label: "Red", value: "#ef4444" },
  { label: "Amber", value: "#f59e0b" },
  { label: "Green", value: "#10b981" },
  { label: "Blue", value: "#3b82f6" },
  { label: "White", value: "#ffffff" },
];

const STROKE_WIDTHS = [
  { label: "Thin", value: 3 },
  { label: "Medium", value: 5 },
  { label: "Thick", value: 8 },
];

export function ImageAnnotatorModal({
  isOpen,
  file,
  onClose,
  onSave,
}: ImageAnnotatorModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [currentTool, setCurrentTool] = useState<Tool>("pen");
  const [currentColor, setCurrentColor] = useState<string>("#ef4444");
  const [strokeWidth, setStrokeWidth] = useState<number>(4);
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [textInput, setTextInput] = useState("");
  const [showTextInput, setShowTextInput] = useState<{ x: number; y: number } | null>(null);

  const startCoordRef = useRef<{ x: number; y: number } | null>(null);
  const snapshotRef = useRef<ImageData | null>(null);

  // Load image onto canvas when file changes or modal opens
  useEffect(() => {
    if (!isOpen || !file) return;

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Fit within max dimensions while preserving aspect ratio
      const maxWidth = 900;
      const maxHeight = 560;
      let width = img.naturalWidth || 800;
      let height = img.naturalHeight || 600;

      const scale = Math.min(maxWidth / width, maxHeight / height, 1);
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Save initial clean state in history
      const initialSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setHistory([initialSnapshot]);
      setShowTextInput(null);
      setTextInput("");
      URL.revokeObjectURL(objectUrl);
    };

    img.src = objectUrl;

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [isOpen, file]);

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (currentTool === "text") {
      setShowTextInput(coords);
      return;
    }

    setShowTextInput(null);
    setIsDrawing(true);
    startCoordRef.current = coords;
    snapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (currentTool === "pen") {
      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startCoordRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const currentCoords = getCanvasCoords(e);

    if (currentTool === "pen") {
      ctx.lineTo(currentCoords.x, currentCoords.y);
      ctx.stroke();
    } else {
      // Restore before drawing shape preview
      if (snapshotRef.current) {
        ctx.putImageData(snapshotRef.current, 0, 0);
      }
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = strokeWidth;

      if (currentTool === "rect") {
        const x = Math.min(startCoordRef.current.x, currentCoords.x);
        const y = Math.min(startCoordRef.current.y, currentCoords.y);
        const w = Math.abs(currentCoords.x - startCoordRef.current.x);
        const h = Math.abs(currentCoords.y - startCoordRef.current.y);
        ctx.strokeRect(x, y, w, h);
      } else if (currentTool === "arrow") {
        drawArrow(
          ctx,
          startCoordRef.current.x,
          startCoordRef.current.y,
          currentCoords.x,
          currentCoords.y,
          strokeWidth,
          currentColor
        );
      }
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    startCoordRef.current = null;
    snapshotRef.current = null;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const newSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory((prev) => [...prev, newSnapshot]);
  };

  const drawArrow = (
    ctx: CanvasRenderingContext2D,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    width: number,
    color: string
  ) => {
    const headlen = Math.max(12, width * 3.5);
    const angle = Math.atan2(toY - fromY, toX - fromX);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";

    // Shaft
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    // Arrowhead
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(
      toX - headlen * Math.cos(angle - Math.PI / 6),
      toY - headlen * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      toX - headlen * Math.cos(angle + Math.PI / 6),
      toY - headlen * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  const applyText = () => {
    if (!showTextInput || !textInput.trim()) {
      setShowTextInput(null);
      setTextInput("");
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.save();
    ctx.font = `bold ${Math.max(16, strokeWidth * 4)}px sans-serif`;

    // Drop shadow / outline for high contrast
    ctx.strokeStyle = "rgba(0,0,0,0.85)";
    ctx.lineWidth = 4;
    ctx.strokeText(textInput, showTextInput.x, showTextInput.y);

    ctx.fillStyle = currentColor;
    ctx.fillText(textInput, showTextInput.x, showTextInput.y);
    ctx.restore();

    const newSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory((prev) => [...prev, newSnapshot]);
    setShowTextInput(null);
    setTextInput("");
  };

  const handleUndo = useCallback(() => {
    if (history.length <= 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const updated = [...history];
    updated.pop();
    const previous = updated[updated.length - 1];
    ctx.putImageData(previous, 0, 0);
    setHistory(updated);
  }, [history]);

  const handleReset = () => {
    if (history.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const original = history[0];
    ctx.putImageData(original, 0, 0);
    setHistory([original]);
    setShowTextInput(null);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas || !file) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      const newFile = new File([blob], `${baseName}-annotated.png`, {
        type: "image/png",
        lastModified: Date.now(),
      });
      onSave(newFile);
      onClose();
    }, "image/png");
  };

  if (!isOpen || !file) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-bold text-white">Annotate Screenshot</h3>
            <span className="text-xs text-slate-400 truncate max-w-xs">{file.name}</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-b border-slate-800 bg-slate-950/60">
          {/* Tools */}
          <div className="flex items-center gap-1 bg-slate-850 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setCurrentTool("pen")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                currentTool === "pen"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
              title="Freehand Pen"
            >
              <Pen className="w-3.5 h-3.5" />
              <span>Pen</span>
            </button>
            <button
              type="button"
              onClick={() => setCurrentTool("rect")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                currentTool === "rect"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
              title="Bounding Box"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Box</span>
            </button>
            <button
              type="button"
              onClick={() => setCurrentTool("arrow")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                currentTool === "arrow"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
              title="Arrow Callout"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Arrow</span>
            </button>
            <button
              type="button"
              onClick={() => setCurrentTool("text")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                currentTool === "text"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
              title="Click on image to add text"
            >
              <Type className="w-3.5 h-3.5" />
              <span>Text</span>
            </button>
          </div>

          {/* Color palette */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase text-slate-400">Color:</span>
            <div className="flex items-center gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCurrentColor(c.value)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${
                    currentColor === c.value
                      ? "scale-110 border-white ring-2 ring-indigo-500"
                      : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {/* Stroke Width */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase text-slate-400">Size:</span>
            <div className="flex items-center gap-1">
              {STROKE_WIDTHS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStrokeWidth(s.value)}
                  className={`px-2.5 py-1 rounded text-xs transition-colors ${
                    strokeWidth === s.value
                      ? "bg-indigo-600 text-white font-bold"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Action History */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleUndo}
              disabled={history.length <= 1}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Undo"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={history.length <= 1}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Reset to original"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Canvas Body */}
        <div className="relative flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-950/90 min-h-[380px]">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="rounded-lg shadow-2xl border border-slate-800 cursor-crosshair max-w-full"
          />

          {/* Text input overlay if tool is text */}
          {showTextInput && (
            <div
              className="absolute z-10 flex items-center gap-2 p-1.5 rounded-lg bg-slate-900 border border-indigo-500 shadow-2xl"
              style={{
                left: Math.max(10, showTextInput.x - 40),
                top: Math.max(10, showTextInput.y - 40),
              }}
            >
              <input
                type="text"
                autoFocus
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyText();
                  if (e.key === "Escape") setShowTextInput(null);
                }}
                placeholder="Type annotation note..."
                className="px-2 py-1 text-xs bg-slate-950 text-white rounded border border-slate-700 focus:outline-none focus:border-indigo-500 w-48"
              />
              <button
                type="button"
                onClick={applyText}
                className="p-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setShowTextInput(null)}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/90">
          <p className="text-xs text-slate-400">
            {currentTool === "text"
              ? "Click anywhere on the image to place a label or note."
              : "Drag on image to mark up bugs or critical UI sections."}
          </p>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md transition-colors flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Save & Apply Annotation</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}