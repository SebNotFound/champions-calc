/**
 * Manual crop tool for the enemy (red) Team Preview panels.
 *
 * The free on-device matcher reads sprites reliably, but *locating* the six
 * panels is brittle on off-centre shots, ones with a trainer-name banner, or odd
 * layouts. This lets the user draw the box themselves: drag/resize a rectangle
 * around the six enemy panels, and the recognizer splits it into six equal rows
 * (the five guide lines show exactly where) — skipping the fragile locate step.
 *
 * The box and pointer math are kept in source-image pixels (via {@link CropRect})
 * so the result maps straight onto the decoded image; only rendering converts to
 * a percentage of the displayed image, so it stays correct at any display size.
 */
import { useEffect, useRef, useState } from 'react';
import type { CropRect } from '../recognition';

interface Props {
  /** Object URL of the uploaded screenshot. */
  src: string;
  /** Image-pixel rect to pre-fill (e.g. the auto-detected column); null → a default. */
  initialRect: CropRect | null;
  onConfirm: (rect: CropRect) => void;
  onCancel: () => void;
  busy?: boolean;
}

type Handle = 'move' | 'nw' | 'ne' | 'sw' | 'se';
const MIN = 24; // smallest crop side, in image pixels

export function CropBox({ src, initialRect, onConfirm, onCancel, busy }: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [rect, setRect] = useState<CropRect | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ mode: Handle; sx: number; sy: number; start: CropRect } | null>(null);

  // Once we know the image's true size, seed the box: the auto-detected column
  // if we have one, otherwise a sensible default over the right-hand third.
  const onImgLoad = () => {
    const el = imgRef.current;
    if (!el) return;
    const w = el.naturalWidth, h = el.naturalHeight;
    setNat({ w, h });
    const seed = initialRect ?? { x: w * 0.58, y: h * 0.1, w: w * 0.4, h: h * 0.8 };
    setRect({
      x: Math.max(0, Math.min(seed.x, w - MIN)),
      y: Math.max(0, Math.min(seed.y, h - MIN)),
      w: Math.min(seed.w, w - seed.x),
      h: Math.min(seed.h, h - seed.y),
    });
  };

  const begin = (mode: Handle) => (e: React.PointerEvent) => {
    if (!rect) return;
    e.preventDefault();
    e.stopPropagation();
    drag.current = { mode, sx: e.clientX, sy: e.clientY, start: { ...rect } };
    setDragging(true);
  };

  // Drag handling lives on the window so a fast pointer can leave the box; the
  // listeners are bound only while dragging and always compute from the rect
  // captured at drag-start, so there are no stale-closure surprises.
  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => {
      const d = drag.current, el = imgRef.current;
      if (!d || !el || !nat) return;
      const scale = nat.w / el.clientWidth; // image px per displayed px
      const dx = (e.clientX - d.sx) * scale;
      const dy = (e.clientY - d.sy) * scale;
      let { x, y, w, h } = d.start;
      if (d.mode === 'move') { x += dx; y += dy; }
      if (d.mode.includes('w')) { x += dx; w -= dx; }
      if (d.mode.includes('e')) { w += dx; }
      if (d.mode.includes('n')) { y += dy; h -= dy; }
      if (d.mode.includes('s')) { h += dy; }
      if (w < MIN) { if (d.mode.includes('w')) x = d.start.x + d.start.w - MIN; w = MIN; }
      if (h < MIN) { if (d.mode.includes('n')) y = d.start.y + d.start.h - MIN; h = MIN; }
      x = Math.max(0, Math.min(x, nat.w - w));
      y = Math.max(0, Math.min(y, nat.h - h));
      w = Math.min(w, nat.w - x);
      h = Math.min(h, nat.h - y);
      setRect({ x, y, w, h });
    };
    const up = () => { drag.current = null; setDragging(false); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [dragging, nat]);

  const pct = rect && nat
    ? { left: `${(rect.x / nat.w) * 100}%`, top: `${(rect.y / nat.h) * 100}%`, width: `${(rect.w / nat.w) * 100}%`, height: `${(rect.h / nat.h) * 100}%` }
    : undefined;

  return (
    <div className="cropper">
      <p className="crop-help">Drag the box around the <strong>six enemy panels</strong>. The lines split it into the six rows we’ll read.</p>
      <div className="crop-stage">
        <img ref={imgRef} src={src} alt="Screenshot to crop" className="crop-img" draggable={false} onLoad={onImgLoad} />
        {pct && (
          <div className="crop-box" style={pct} onPointerDown={begin('move')}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="crop-guide" style={{ top: `${(i / 6) * 100}%` }} />
            ))}
            <span className="crop-handle nw" onPointerDown={begin('nw')} />
            <span className="crop-handle ne" onPointerDown={begin('ne')} />
            <span className="crop-handle sw" onPointerDown={begin('sw')} />
            <span className="crop-handle se" onPointerDown={begin('se')} />
          </div>
        )}
      </div>
      <div className="crop-actions">
        <button onClick={onCancel}>Back</button>
        <button className="primary" onClick={() => rect && onConfirm(rect)} disabled={!rect || busy}>
          {busy ? 'Reading…' : 'Read this crop'}
        </button>
      </div>
    </div>
  );
}
