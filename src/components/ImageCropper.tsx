import { useEffect, useRef, useState } from "react";

export interface CropBox { x: number; y: number; w: number; h: number; }

interface Props {
  src: string;                            // data URL or http URL
  value: CropBox;                         // 0..1 normalised
  onChange: (b: CropBox) => void;
  aspect?: "free" | "square";
}

type DragMode = null | "move" | "tl" | "tr" | "bl" | "br";

export default function ImageCropper({ src, value, onChange, aspect = "free" }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragMode>(null);
  const startRef = useRef<{ px: number; py: number; box: CropBox } | null>(null);

  // Keep box square if requested
  useEffect(() => {
    if (aspect === "square") {
      const s = Math.min(value.w, value.h);
      if (Math.abs(value.w - value.h) > 0.001) {
        onChange({ ...value, w: s, h: s });
      }
    }
  }, [aspect]); // eslint-disable-line

  const norm = (clientX: number, clientY: number) => {
    const r = wrapRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (clientY - r.top) / r.height)),
    };
  };

  const onPointerDown = (mode: DragMode) => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const p = norm(e.clientX, e.clientY);
    startRef.current = { px: p.x, py: p.y, box: { ...value } };
    setDrag(mode);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag || !startRef.current) return;
    const { px, py, box } = startRef.current;
    const p = norm(e.clientX, e.clientY);
    const dx = p.x - px;
    const dy = p.y - py;
    let nb: CropBox = { ...box };

    if (drag === "move") {
      nb.x = clamp(box.x + dx, 0, 1 - box.w);
      nb.y = clamp(box.y + dy, 0, 1 - box.h);
    } else {
      let x1 = box.x, y1 = box.y, x2 = box.x + box.w, y2 = box.y + box.h;
      if (drag.includes("l")) x1 = clamp(box.x + dx, 0, x2 - 0.05);
      if (drag.includes("r")) x2 = clamp(box.x + box.w + dx, x1 + 0.05, 1);
      if (drag.includes("t")) y1 = clamp(box.y + dy, 0, y2 - 0.05);
      if (drag.includes("b")) y2 = clamp(box.y + box.h + dy, y1 + 0.05, 1);
      nb = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };

      if (aspect === "square") {
        const s = Math.min(nb.w, nb.h);
        // Anchor square to opposite corner depending on handle
        if (drag === "br") nb = { x: x1, y: y1, w: s, h: s };
        else if (drag === "tr") nb = { x: x1, y: y2 - s, w: s, h: s };
        else if (drag === "bl") nb = { x: x2 - s, y: y1, w: s, h: s };
        else if (drag === "tl") nb = { x: x2 - s, y: y2 - s, w: s, h: s };
        if (nb.x < 0) nb.x = 0; if (nb.y < 0) nb.y = 0;
        if (nb.x + nb.w > 1) nb.w = 1 - nb.x;
        if (nb.y + nb.h > 1) nb.h = 1 - nb.y;
      }
    }
    onChange(nb);
  };

  const stop = () => { setDrag(null); startRef.current = null; };

  const cb = value;
  const dim = "rgba(28,15,0,0.55)";

  return (
    <div
      ref={wrapRef}
      onPointerMove={onPointerMove}
      onPointerUp={stop}
      onPointerCancel={stop}
      style={{
        position: "relative", width: "100%", aspectRatio: "1",
        background: "#1c0f00", borderRadius: 12, overflow: "hidden",
        userSelect: "none", touchAction: "none",
      }}
    >
      <img
        src={src} alt="crop"
        draggable={false}
        style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none" }}
      />
      {/* Overlays around crop box */}
      <div style={{ position: "absolute", left: 0, top: 0, width: "100%", height: `${cb.y * 100}%`, background: dim, pointerEvents: "none" }} />
      <div style={{ position: "absolute", left: 0, top: `${(cb.y + cb.h) * 100}%`, width: "100%", bottom: 0, background: dim, pointerEvents: "none" }} />
      <div style={{ position: "absolute", left: 0, top: `${cb.y * 100}%`, width: `${cb.x * 100}%`, height: `${cb.h * 100}%`, background: dim, pointerEvents: "none" }} />
      <div style={{ position: "absolute", left: `${(cb.x + cb.w) * 100}%`, top: `${cb.y * 100}%`, right: 0, height: `${cb.h * 100}%`, background: dim, pointerEvents: "none" }} />

      {/* Crop frame */}
      <div
        onPointerDown={onPointerDown("move")}
        style={{
          position: "absolute",
          left: `${cb.x * 100}%`, top: `${cb.y * 100}%`,
          width: `${cb.w * 100}%`, height: `${cb.h * 100}%`,
          border: "1.5px solid #e8c080",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.3)",
          cursor: "move",
        }}
      >
        {/* Rule of thirds grid */}
        {[1, 2].map(i => (
          <div key={"v" + i} style={{ position: "absolute", left: `${i * 33.3}%`, top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.25)", pointerEvents: "none" }} />
        ))}
        {[1, 2].map(i => (
          <div key={"h" + i} style={{ position: "absolute", top: `${i * 33.3}%`, left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.25)", pointerEvents: "none" }} />
        ))}
        {(["tl", "tr", "bl", "br"] as DragMode[]).map(corner => (
          <div
            key={corner!}
            onPointerDown={onPointerDown(corner)}
            style={{
              position: "absolute",
              ...cornerPos(corner!),
              width: 22, height: 22, borderRadius: "50%",
              background: "#e8c080", border: "2px solid #1c0f00",
              cursor: corner!.includes("l") === corner!.includes("t") ? "nwse-resize" : "nesw-resize",
              touchAction: "none",
            }}
          />
        ))}
      </div>
    </div>
  );
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function cornerPos(c: string): React.CSSProperties {
  const off = -11;
  return {
    left: c.includes("l") ? off : undefined,
    right: c.includes("r") ? off : undefined,
    top: c.includes("t") ? off : undefined,
    bottom: c.includes("b") ? off : undefined,
  };
}
