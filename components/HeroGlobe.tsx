"use client";

/* Canvas-based dotted globe with land/water separation and signal arcs.

   Land vs water:
   - 3D fBm noise sampled at each sphere point → keep the dot only if
     the value is above a threshold. Continents stay fixed on the
     rotating sphere because the noise key is the 3D position, not the
     projected 2D screen pos.

   Arcs ("signals leaving the planet"):
   - Position along an arc is a slerp between two sphere points, scaled
     outward by `(1 + sin(πt) * LIFT)` so the midpoint lifts off the
     surface — the trail bulges above the silhouette and falls back.
   - Phase is ease-in-out so the head accelerates off the surface and
     decelerates at the destination.
   - A glowing trail fades behind the head (shadowBlur + alpha ramp). */

import { useEffect, useRef } from "react";

type Vec3 = [number, number, number];

const DOT_COUNT = 2600;      // pre-filter count — land survivors ~35-45%
const LAND_THRESHOLD = 0.54;
const NOISE_SCALE = 2.2;

const ARC_COUNT = 5;
const ARC_SAMPLES = 72;
const TRAIL_FRACTION = 0.32;
const ARC_LIFT = 0.22;        // peak radius above surface (1.0 = surface)

const SPIN_RAD_PER_SEC = 0.1;

// ── Math helpers ─────────────────────────────────────────────
function fibonacciSphere(n: number): Vec3[] {
  const out: Vec3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const phi = i * golden;
    out.push([Math.cos(phi) * r, y, Math.sin(phi) * r]);
  }
  return out;
}

function rotY(p: Vec3, a: number): Vec3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
}

function dot3(a: Vec3, b: Vec3) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function randUnit(): Vec3 {
  const u = Math.random() * 2 - 1;
  const t = Math.random() * Math.PI * 2;
  const r = Math.sqrt(1 - u * u);
  return [Math.cos(t) * r, u, Math.sin(t) * r];
}

function slerp(a: Vec3, b: Vec3, t: number, omega: number, sinO: number): Vec3 {
  const k0 = Math.sin((1 - t) * omega) / sinO;
  const k1 = Math.sin(t * omega) / sinO;
  return [a[0] * k0 + b[0] * k1, a[1] * k0 + b[1] * k1, a[2] * k0 + b[2] * k1];
}

// Deterministic integer hash → [0,1)
function hash3(xi: number, yi: number, zi: number): number {
  let h = (xi | 0) * 374761393 + (yi | 0) * 668265263 + (zi | 0) * 2147483647;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

const fade = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function noise3(x: number, y: number, z: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = fade(xf), v = fade(yf), w = fade(zf);
  const c000 = hash3(xi,     yi,     zi);
  const c100 = hash3(xi + 1, yi,     zi);
  const c010 = hash3(xi,     yi + 1, zi);
  const c110 = hash3(xi + 1, yi + 1, zi);
  const c001 = hash3(xi,     yi,     zi + 1);
  const c101 = hash3(xi + 1, yi,     zi + 1);
  const c011 = hash3(xi,     yi + 1, zi + 1);
  const c111 = hash3(xi + 1, yi + 1, zi + 1);
  return lerp(
    lerp(lerp(c000, c100, u), lerp(c010, c110, u), v),
    lerp(lerp(c001, c101, u), lerp(c011, c111, u), v),
    w,
  );
}

function fbm3(x: number, y: number, z: number): number {
  let total = 0, amp = 1, freq = 1, norm = 0;
  for (let i = 0; i < 4; i++) {
    total += noise3(x * freq, y * freq, z * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return total / norm;
}

const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// ── Arcs ────────────────────────────────────────────────────
type Arc = {
  a: Vec3;
  b: Vec3;
  omega: number;
  sinO: number;
  speed: number;
  phase: number;
};

function makeArc(): Arc {
  let a: Vec3 = [1, 0, 0];
  let b: Vec3 = [0, 1, 0];
  let ang = 1;
  for (let i = 0; i < 16; i++) {
    a = randUnit();
    b = randUnit();
    ang = Math.acos(Math.max(-1, Math.min(1, dot3(a, b))));
    if (ang > 0.6 && ang < 2.0) break;
  }
  return {
    a, b,
    omega: ang,
    sinO: Math.sin(ang),
    speed: 0.09 + Math.random() * 0.08,
    phase: Math.random(),
  };
}

// Lifted arc position — on the sphere at the endpoints, above it mid-flight.
function arcPoint(arc: Arc, t: number): Vec3 {
  const base = slerp(arc.a, arc.b, t, arc.omega, arc.sinO);
  const lift = 1 + Math.sin(t * Math.PI) * ARC_LIFT;
  return [base[0] * lift, base[1] * lift, base[2] * lift];
}

// ── Component ───────────────────────────────────────────────
export default function HeroGlobe() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let W = 0;
    let H = 0;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      canvas.width = Math.max(1, Math.round(W * dpr));
      canvas.height = Math.max(1, Math.round(H * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Build land dot set — Fibonacci sphere filtered by 3D noise.
    const allDots = fibonacciSphere(DOT_COUNT);
    const landDots: Vec3[] = [];
    for (const p of allDots) {
      const v = fbm3(p[0] * NOISE_SCALE, p[1] * NOISE_SCALE, p[2] * NOISE_SCALE);
      if (v > LAND_THRESHOLD) landDots.push(p);
    }

    const arcs: Arc[] = Array.from({ length: ARC_COUNT }, makeArc);

    let spin = 0;
    let last = performance.now();
    let raf = 0;

    const draw = (now: number) => {
      const dt = Math.min(50, now - last) / 1000;
      last = now;
      if (!reduced) spin += SPIN_RAD_PER_SEC * dt;

      const cx = W / 2;
      const cy = H / 2;
      const R = Math.min(W, H) * 0.42;

      ctx.clearRect(0, 0, W, H);

      // ── Land dots ────────────────────────────────────────
      for (let i = 0; i < landDots.length; i++) {
        const p = rotY(landDots[i], spin);
        if (p[2] < -0.02) continue;
        const depth = Math.max(0, Math.min(1, (p[2] + 0.02) / 1.02));
        const rim = Math.pow(depth, 0.7);
        const alpha = 0.15 + rim * 0.7;
        const rad = 0.55 + rim * 0.85;
        const px = cx + p[0] * R;
        const py = cy - p[1] * R;
        ctx.fillStyle = `rgba(17, 17, 20, ${alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, rad, 0, Math.PI * 2);
        ctx.fill();
      }

      // ── Arcs ─────────────────────────────────────────────
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowColor = "rgba(39, 39, 42, 0.5)";
      ctx.shadowBlur = 10;

      for (const arc of arcs) {
        if (!reduced) {
          arc.phase += arc.speed * dt;
          if (arc.phase > 1) {
            arc.phase -= 1;
            if (Math.random() < 0.45) {
              const fresh = makeArc();
              arc.a = fresh.a; arc.b = fresh.b;
              arc.omega = fresh.omega; arc.sinO = fresh.sinO;
              arc.speed = fresh.speed;
            }
          }
        }

        const easedHead = easeInOut(arc.phase);
        const tEnd = easedHead;
        const tStart = easedHead - TRAIL_FRACTION;

        let prev: Vec3 | null = null;
        for (let s = 0; s <= ARC_SAMPLES; s++) {
          const t = s / ARC_SAMPLES;
          const p = rotY(arcPoint(arc, t), spin);
          if (prev) {
            const midT = t - 0.5 / ARC_SAMPLES;
            if (midT >= tStart && midT <= tEnd) {
              const avgZ = (prev[2] + p[2]) / 2;
              if (avgZ > -0.08) {
                const localT = (midT - tStart) / TRAIL_FRACTION; // 0 oldest → 1 head
                const zFade = Math.max(0, Math.min(1, (avgZ + 0.1) / 0.6));
                const alpha = Math.pow(localT, 1.6) * 0.95 * zFade;
                ctx.strokeStyle = `rgba(24, 24, 27, ${alpha})`;
                ctx.lineWidth = 1.1 + localT * 0.5;
                ctx.beginPath();
                ctx.moveTo(cx + prev[0] * R, cy - prev[1] * R);
                ctx.lineTo(cx + p[0] * R,    cy - p[1] * R);
                ctx.stroke();
              }
            }
          }
          prev = p;
        }

        // Head — glowing point riding the arc.
        const headT = Math.max(0, Math.min(1, tEnd));
        const head = rotY(arcPoint(arc, headT), spin);
        if (head[2] > -0.08) {
          const zFade = Math.max(0, Math.min(1, (head[2] + 0.1) / 0.6));
          const hx = cx + head[0] * R;
          const hy = cy - head[1] * R;
          ctx.fillStyle = `rgba(24, 24, 27, ${0.95 * zFade})`;
          ctx.beginPath();
          ctx.arc(hx, hy, 2.6, 0, Math.PI * 2);
          ctx.fill();
        }

        // Small anchor dots at source/destination so they read as endpoints.
        for (const anchor of [arc.a, arc.b]) {
          const ap = rotY(anchor, spin);
          if (ap[2] < -0.02) continue;
          const depth = Math.max(0, Math.min(1, (ap[2] + 0.02) / 1.02));
          ctx.fillStyle = `rgba(24, 24, 27, ${0.55 * depth})`;
          ctx.beginPath();
          ctx.arc(cx + ap[0] * R, cy - ap[1] * R, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      if (!reduced) raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute right-0 top-1/2 -z-10 hidden h-90 w-90 -translate-y-1/2 xl:block 2xl:right-12"
      style={{
        WebkitMaskImage:
          "radial-gradient(circle at 50% 50%, black 0%, black 56%, transparent 94%)",
        maskImage:
          "radial-gradient(circle at 50% 50%, black 0%, black 56%, transparent 94%)",
      }}
    >
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
