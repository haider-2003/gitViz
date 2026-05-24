/* Decorative Git-graph backdrop for the landing hero.
   Pure SVG + CSS + SMIL — no client JS, no framer dep.
   pointer-events-none and aria-hidden so it stays invisible to
   keyboard users and screen readers. */

type Node = { x: number; y: number; color: string; inDelay: number };

const MAIN_PATH =
  "M 60 250 L 1140 250";
const FEAT_UP_PATH =
  "M 280 250 C 340 250 340 130 400 130 L 560 130 C 620 130 620 250 680 250";
const FEAT_DN_PATH =
  "M 480 250 C 540 250 540 370 600 370 L 760 370 C 820 370 820 250 880 250";
const BRANCH_UP_PATH =
  "M 820 250 C 880 250 880 160 940 160 L 1100 160";

const NODES: Node[] = [
  { x: 120, y: 250, color: "#a1a1aa", inDelay: 900 },
  { x: 360, y: 250, color: "#a1a1aa", inDelay: 1050 },
  { x: 600, y: 250, color: "#a1a1aa", inDelay: 1200 },
  { x: 840, y: 250, color: "#a1a1aa", inDelay: 1350 },
  { x: 1080, y: 250, color: "#a1a1aa", inDelay: 1500 },
  { x: 460, y: 130, color: "#3b82f6", inDelay: 1400 },
  { x: 580, y: 130, color: "#3b82f6", inDelay: 1600 },
  { x: 640, y: 370, color: "#10b981", inDelay: 1600 },
  { x: 760, y: 370, color: "#10b981", inDelay: 1800 },
  { x: 1060, y: 160, color: "#f59e0b", inDelay: 1900 },
];

export default function HeroBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      style={{
        WebkitMaskImage:
          "linear-gradient(to bottom, transparent 0%, black 14%, black 82%, transparent 100%)",
        maskImage:
          "linear-gradient(to bottom, transparent 0%, black 14%, black 82%, transparent 100%)",
      }}
    >
      <svg
        viewBox="0 0 1200 500"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full opacity-[0.32]"
        fill="none"
      >
        {/* Branch paths — referenced by both rendering and <animateMotion>. */}
        <path
          id="gv-bg-main"
          d={MAIN_PATH}
          pathLength="1"
          stroke="#a1a1aa"
          strokeWidth="1.5"
          strokeLinecap="round"
          className="gv-bg-path"
          style={{ animationDelay: "0ms" }}
        />
        <path
          id="gv-bg-feat-up"
          d={FEAT_UP_PATH}
          pathLength="1"
          stroke="#3b82f6"
          strokeWidth="1.5"
          strokeLinecap="round"
          className="gv-bg-path"
          style={{ animationDelay: "500ms" }}
        />
        <path
          id="gv-bg-feat-dn"
          d={FEAT_DN_PATH}
          pathLength="1"
          stroke="#10b981"
          strokeWidth="1.5"
          strokeLinecap="round"
          className="gv-bg-path"
          style={{ animationDelay: "700ms" }}
        />
        <path
          id="gv-bg-up-right"
          d={BRANCH_UP_PATH}
          pathLength="1"
          stroke="#f59e0b"
          strokeWidth="1.5"
          strokeLinecap="round"
          className="gv-bg-path"
          style={{ animationDelay: "1000ms" }}
        />

        {/* Commit nodes — ring + filled center, staggered fade-in. */}
        {NODES.map((n, i) => (
          <g
            key={i}
            className="gv-bg-node"
            style={{ animationDelay: `${n.inDelay}ms` }}
          >
            <circle
              cx={n.x}
              cy={n.y}
              r="4.5"
              fill="#ffffff"
              stroke={n.color}
              strokeWidth="1.5"
            />
            <circle cx={n.x} cy={n.y} r="1.6" fill={n.color} />
          </g>
        ))}

        {/* Travelers — flow along each branch on a loop. */}
        <circle r="2.6" fill="#a1a1aa" className="gv-bg-traveler">
          <animateMotion dur="11s" begin="2.2s" repeatCount="indefinite">
            <mpath href="#gv-bg-main" />
          </animateMotion>
        </circle>
        <circle r="2.6" fill="#3b82f6" className="gv-bg-traveler">
          <animateMotion dur="8s" begin="2.6s" repeatCount="indefinite">
            <mpath href="#gv-bg-feat-up" />
          </animateMotion>
        </circle>
        <circle r="2.6" fill="#10b981" className="gv-bg-traveler">
          <animateMotion dur="9s" begin="2.9s" repeatCount="indefinite">
            <mpath href="#gv-bg-feat-dn" />
          </animateMotion>
        </circle>
        <circle r="2.6" fill="#f59e0b" className="gv-bg-traveler">
          <animateMotion dur="7s" begin="3.2s" repeatCount="indefinite">
            <mpath href="#gv-bg-up-right" />
          </animateMotion>
        </circle>
      </svg>
    </div>
  );
}
