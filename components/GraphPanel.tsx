"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  drawGraph,
  cancelGraphAnimation,
  type NodeHit,
} from "@/lib/graphRenderer";
import type { RepoState } from "@/lib/gitState";

type Props = {
  state: RepoState;
  // Incremented by the parent on every state mutation to trigger a redraw.
  revision: number;
};

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;

export default function GraphPanel({ state, revision }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<NodeHit[]>([]);
  const didCenterRef = useRef(false);
  const zoomRef = useRef(1);

  // Pending zoom anchor — cursor-relative logical point to re-align
  // scroll against once the next draw completes.
  const zoomAnchorRef = useRef<{
    cx: number;
    cy: number;
    logicalX: number;
    logicalY: number;
  } | null>(null);

  const [count, setCount] = useState(0);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [zoom, setZoom] = useState(1);

  // Keep a live ref so pointer/wheel handlers always see the latest value.
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  // Re-center on reset (commit count drops to 0).
  useEffect(() => {
    if (state.commits.length === 0) didCenterRef.current = false;
  }, [state.commits.length]);

  // Redraw when state / hover / zoom changes or container resizes.
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    let lastW = 0;
    let lastH = 0;

    const render = () => {
      const res = drawGraph(canvas, wrap, state, { hoveredId, zoom });
      nodesRef.current = res.nodes;
      setCount(res.commitCount);

      // Cursor-anchored zoom: after the re-render, align scroll so the
      // logical point under the cursor lands at the same screen position.
      const anchor = zoomAnchorRef.current;
      if (anchor) {
        const rect = wrap.getBoundingClientRect();
        const targetX = anchor.logicalX * zoom - (anchor.cx - rect.left);
        const targetY = anchor.logicalY * zoom - (anchor.cy - rect.top);
        const maxX = wrap.scrollWidth - wrap.clientWidth;
        const maxY = wrap.scrollHeight - wrap.clientHeight;
        wrap.scrollLeft = Math.max(0, Math.min(maxX, targetX));
        wrap.scrollTop = Math.max(0, Math.min(maxY, targetY));
        zoomAnchorRef.current = null;
      } else if (!didCenterRef.current && res.commitCount > 0) {
        // Initial centering — first render with commits.
        const midX = Math.max(0, (wrap.scrollWidth - wrap.clientWidth) / 2);
        wrap.scrollLeft = midX;
        wrap.scrollTop = 0;
        didCenterRef.current = true;
      }
    };
    render();
    lastW = wrap.clientWidth;
    lastH = wrap.clientHeight;

    const ro = new ResizeObserver(() => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (w === lastW && h === lastH) return;
      lastW = w;
      lastH = h;
      render();
    });
    ro.observe(wrap);
    return () => {
      ro.disconnect();
      cancelGraphAnimation();
    };
  }, [state, revision, hoveredId, zoom]);

  // Click-drag pan with inertia + pointer hover + wheel zoom.
  useEffect(() => {
    const wrapMaybe = wrapRef.current;
    if (!wrapMaybe) return;
    const wrap: HTMLDivElement = wrapMaybe;

    let dragging = false;
    let engaged = false;
    let startX = 0;
    let startY = 0;
    let startScrollLeft = 0;
    let startScrollTop = 0;
    let lastX = 0;
    let lastY = 0;
    let lastT = 0;
    let vx = 0;
    let vy = 0;
    let rafId: number | null = null;
    let capturedId: number | null = null;

    const DRAG_THRESHOLD = 3;

    function stopInertia() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      vx = 0;
      vy = 0;
    }

    function hitTest(clientX: number, clientY: number): string | null {
      const rect = wrap.getBoundingClientRect();
      const z = zoomRef.current;
      const px = (clientX - rect.left + wrap.scrollLeft) / z;
      const py = (clientY - rect.top + wrap.scrollTop) / z;
      for (const n of nodesRef.current) {
        const dx = px - n.x;
        const dy = py - n.y;
        const reach = n.r + 4;
        if (dx * dx + dy * dy <= reach * reach) return n.id;
      }
      return null;
    }

    function onPointerDown(e: PointerEvent) {
      if (e.button !== 0) return;
      stopInertia();
      dragging = true;
      engaged = false;
      startX = e.clientX;
      startY = e.clientY;
      startScrollLeft = wrap.scrollLeft;
      startScrollTop = wrap.scrollTop;
      lastX = e.clientX;
      lastY = e.clientY;
      lastT = performance.now();
      vx = 0;
      vy = 0;
      try {
        wrap.setPointerCapture(e.pointerId);
        capturedId = e.pointerId;
      } catch {
        /* ignore */
      }
    }

    function onPointerMove(e: PointerEvent) {
      if (dragging) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (!engaged && Math.hypot(dx, dy) >= DRAG_THRESHOLD) {
          engaged = true;
          setIsDragging(true);
          setHoveredId(null);
        }
        if (!engaged) return;

        wrap.scrollLeft = startScrollLeft - dx;
        wrap.scrollTop = startScrollTop - dy;

        const now = performance.now();
        const dt = Math.max(1, now - lastT);
        const instVx = -((e.clientX - lastX) * 16) / dt;
        const instVy = -((e.clientY - lastY) * 16) / dt;
        vx = vx * 0.3 + instVx * 0.7;
        vy = vy * 0.3 + instVy * 0.7;
        lastX = e.clientX;
        lastY = e.clientY;
        lastT = now;
      } else {
        const id = hitTest(e.clientX, e.clientY);
        setHoveredId((prev) => (prev === id ? prev : id));
      }
    }

    function endDrag() {
      if (!dragging) return;
      const wasEngaged = engaged;
      dragging = false;
      engaged = false;
      setIsDragging(false);
      if (capturedId !== null) {
        try {
          wrap.releasePointerCapture(capturedId);
        } catch {
          /* ignore */
        }
        capturedId = null;
      }
      if (!wasEngaged) return;

      const friction = 0.92;
      const epsilon = 0.3;
      const step = () => {
        const maxX = wrap.scrollWidth - wrap.clientWidth;
        const maxY = wrap.scrollHeight - wrap.clientHeight;
        const nextX = wrap.scrollLeft + vx;
        const nextY = wrap.scrollTop + vy;
        if (nextX <= 0 || nextX >= maxX) vx = 0;
        if (nextY <= 0 || nextY >= maxY) vy = 0;
        wrap.scrollLeft = Math.max(0, Math.min(maxX, nextX));
        wrap.scrollTop = Math.max(0, Math.min(maxY, nextY));
        vx *= friction;
        vy *= friction;
        if (Math.abs(vx) < epsilon && Math.abs(vy) < epsilon) {
          rafId = null;
          return;
        }
        rafId = requestAnimationFrame(step);
      };
      if (Math.abs(vx) >= epsilon || Math.abs(vy) >= epsilon) {
        rafId = requestAnimationFrame(step);
      }
    }

    function onPointerLeave() {
      if (!dragging) setHoveredId(null);
    }

    // ── WHEEL ZOOM ──────────────────────────────────────
    // Exponential scaling per wheel tick, clamped to [ZOOM_MIN, ZOOM_MAX].
    // Cursor-anchored: the logical point under the cursor stays put.
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      stopInertia();

      const prev = zoomRef.current;
      const factor = Math.exp(-e.deltaY * 0.0015);
      const next = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, prev * factor));
      if (Math.abs(next - prev) < 1e-4) return;

      const rect = wrap.getBoundingClientRect();
      zoomAnchorRef.current = {
        cx: e.clientX,
        cy: e.clientY,
        logicalX: (e.clientX - rect.left + wrap.scrollLeft) / prev,
        logicalY: (e.clientY - rect.top + wrap.scrollTop) / prev,
      };

      setZoom(next);
    }

    wrap.addEventListener("pointerdown", onPointerDown);
    wrap.addEventListener("pointermove", onPointerMove);
    wrap.addEventListener("pointerup", endDrag);
    wrap.addEventListener("pointercancel", endDrag);
    wrap.addEventListener("pointerleave", onPointerLeave);
    wrap.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      stopInertia();
      wrap.removeEventListener("pointerdown", onPointerDown);
      wrap.removeEventListener("pointermove", onPointerMove);
      wrap.removeEventListener("pointerup", endDrag);
      wrap.removeEventListener("pointercancel", endDrag);
      wrap.removeEventListener("pointerleave", onPointerLeave);
      wrap.removeEventListener("wheel", onWheel);
    };
  }, []);

  // Reset zoom — animates from current value back to 1 for a smooth return.
  const resetZoom = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const from = zoomRef.current;
    if (Math.abs(from - 1) < 1e-3) return;

    const start = performance.now();
    const duration = 220;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);

    // Anchor at the viewport center so the graph re-centers naturally.
    const rect = wrap.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const logicalX = (cx - rect.left + wrap.scrollLeft) / from;
    const logicalY = (cy - rect.top + wrap.scrollTop) / from;

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = ease(t);
      const z = from + (1 - from) * eased;
      zoomAnchorRef.current = { cx, cy, logicalX, logicalY };
      setZoom(z);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, []);

  const zoomLabel = `${Math.round(zoom * 100)}%`;
  const atCustomZoom = Math.abs(zoom - 1) > 1e-3;

  return (
    <div className="overflow-hidden flex flex-col relative bg-white border-l border-zinc-200">
      {/* ── Panel bar ── */}
      <div className="h-9 flex items-center justify-between px-4 shrink-0 bg-zinc-50 border-b border-zinc-200">
        <div className="flex items-center gap-1.75">
          <span className="text-[11px] font-medium tracking-[0.06em] uppercase font-sans text-zinc-400">
            Graph
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={resetZoom}
            disabled={!atCustomZoom}
            className={`font-mono text-[11px] tabular-nums rounded-sm border px-1.5 py-0.5 transition-all duration-150 ease-out ${
              atCustomZoom
                ? "text-zinc-600 border-zinc-200 bg-white hover:border-zinc-300 hover:text-zinc-900 cursor-pointer"
                : "text-zinc-400 border-transparent bg-transparent cursor-default"
            }`}
            title={atCustomZoom ? "Reset zoom (100%)" : "Scroll to zoom"}
          >
            {zoomLabel}
          </button>
          {count > 0 && (
            <span className="text-[11px] font-mono text-zinc-400">
              {count} commit{count !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* ── Canvas wrapper ── */}
      <div
        ref={wrapRef}
        className={`flex-1 overflow-auto relative bg-white scrollbar-graph bg-[radial-gradient(circle,#d4d4d8_1px,transparent_1px)] bg-size-[22px_22px] select-none touch-none ${
          isDragging ? "cursor-grabbing-dark" : "cursor-grab-dark"
        }`}
      >
        <canvas ref={canvasRef} className="block relative z-1" />
      </div>
    </div>
  );
}
