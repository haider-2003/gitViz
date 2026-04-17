import Link from "next/link";
import Reveal from "@/components/Reveal";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-zinc-950 antialiased font-sans">
      <LandingNav />
      <Hero />
      <Preview />
      <Features />
      <HowItWorks />
      <FinalCta />
      <LandingFooter />
    </div>
  );
}

/* ─────────────────────────── Nav ─────────────────────────── */

function LandingNav() {
  return (
    <nav className="sticky top-0 z-40 border-b border-zinc-200 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <LogoMark />
          <span>GitViz</span>
          <span className="mx-0.5 text-zinc-300">/</span>
          <span className="font-normal text-zinc-500">practice</span>
        </Link>

        <div className="flex items-center gap-1">
          <a
            href="#features"
            className="hidden rounded-md px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:text-zinc-950 md:inline-block"
          >
            Features
          </a>
          <a
            href="#how"
            className="hidden rounded-md px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:text-zinc-950 md:inline-block"
          >
            How it works
          </a>
          <Link
            href="/play"
            className="group ml-2 inline-flex items-center gap-1.5 rounded-md bg-zinc-950 px-3.5 py-1.5 text-sm font-medium text-white transition-all duration-200 ease-out hover:bg-zinc-800 hover:shadow-[0_6px_20px_-8px_rgba(24,24,27,0.4)] active:translate-y-px"
          >
            Open sandbox
            <ArrowRight className="transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </nav>
  );
}

/* ─────────────────────────── Hero ─────────────────────────── */

function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pt-20 pb-12 md:pt-32 md:pb-16">
      {/* Soft ambient backdrop — static gradient, no motion. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] opacity-70"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(0,112,243,0.06), transparent 70%), radial-gradient(ellipse 40% 35% at 80% 10%, rgba(16,185,129,0.05), transparent 70%)",
        }}
      />

      <div className="mx-auto max-w-4xl text-center">
        <div
          className="hero-reveal mb-7 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 font-mono text-[11px] text-zinc-600"
          style={{ animationDelay: "60ms" }}
        >
          <span className="gv-pulse h-1.5 w-1.5 rounded-full bg-emerald-500" />
          In your browser — no install
        </div>

        <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl">
          <span
            className="hero-reveal inline-block"
            style={{ animationDelay: "140ms" }}
          >
            Practice Git.
          </span>
          <br />
          <span
            className="hero-reveal inline-block text-zinc-400"
            style={{ animationDelay: "240ms" }}
          >
            See every commit.
          </span>
        </h1>

        <p
          className="hero-reveal mx-auto mt-6 max-w-xl text-base leading-relaxed text-zinc-600 md:text-lg"
          style={{ animationDelay: "360ms" }}
        >
          An interactive sandbox where every command you type draws itself
          as a graph. Learn branches, merges, and rebases by doing — not
          guessing.
        </p>

        <div
          className="hero-reveal mt-9 flex flex-wrap items-center justify-center gap-3"
          style={{ animationDelay: "480ms" }}
        >
          <Link
            href="/play"
            className="group relative inline-flex items-center gap-2 overflow-hidden rounded-md bg-[#0070F3] px-5 py-2.5 text-sm font-medium text-white shadow-[0_1px_0_0_rgba(255,255,255,0.3)_inset,0_2px_8px_-2px_rgba(0,112,243,0.4)] transition-all duration-200 ease-out hover:bg-[#0061d5] hover:shadow-[0_1px_0_0_rgba(255,255,255,0.3)_inset,0_10px_30px_-8px_rgba(0,112,243,0.55)] active:translate-y-px active:shadow-[0_1px_0_0_rgba(255,255,255,0.3)_inset,0_2px_6px_-2px_rgba(0,112,243,0.4)]"
          >
            {/* Sheen sweep on hover */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
            />
            <span className="relative">Start practicing</span>
            <ArrowRight className="relative transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
          </Link>
          <a
            href="#features"
            className="group inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-5 py-2.5 text-sm font-medium text-zinc-800 transition-all duration-200 ease-out hover:-translate-y-px hover:border-zinc-300 hover:bg-zinc-50 hover:shadow-[0_6px_16px_-10px_rgba(0,0,0,0.2)] active:translate-y-0"
          >
            See the features
            <ArrowDown className="transition-transform duration-200 ease-out group-hover:translate-y-0.5" />
          </a>
        </div>

        <div
          className="hero-reveal mt-10 flex flex-wrap items-center justify-center gap-6 font-mono text-[11px] text-zinc-400"
          style={{ animationDelay: "620ms" }}
        >
          <span className="inline-flex items-center gap-1.5">
            <Kbd>?</Kbd> commands
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> history
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Kbd>Tab</Kbd> autocomplete
          </span>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Preview ───────────────────────── */

function Preview() {
  return (
    <section className="px-6 pb-24">
      <div className="mx-auto max-w-5xl">
        <div
          className="hero-scale-in group overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.02),0_30px_60px_-12px_rgba(0,0,0,0.08)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_40px_80px_-16px_rgba(0,0,0,0.12)]"
          style={{ animationDelay: "720ms" }}
        >
          {/* window chrome */}
          <div className="flex h-9 items-center gap-1.5 border-b border-zinc-200 bg-zinc-50 px-3">
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
            <span className="ml-3 font-mono text-[11px] text-zinc-400">
              gitviz — /practice
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2">
            <MockTerminal />
            <MockGraph />
          </div>
        </div>
      </div>
    </section>
  );
}

function MockTerminal() {
  const lines: Array<{ text: string; cls: string }> = [
    { text: "$ git init", cls: "text-emerald-400" },
    { text: "Initialized empty repository", cls: "text-zinc-500" },
    { text: "", cls: "" },
    { text: "$ git commit -m \"initial\"", cls: "text-emerald-400" },
    { text: "[main a1b2c3d] initial", cls: "text-zinc-300" },
    { text: "", cls: "" },
    { text: "$ git checkout -b feature", cls: "text-emerald-400" },
    { text: "Switched to a new branch 'feature'", cls: "text-zinc-500" },
    { text: "", cls: "" },
    { text: "$ git commit -m \"add login\"", cls: "text-emerald-400" },
    { text: "[feature e4f5g6h] add login", cls: "text-zinc-300" },
    { text: "", cls: "" },
    { text: "$ git merge feature", cls: "text-emerald-400" },
    { text: "Merge made by the 'ort' strategy.", cls: "text-zinc-300" },
  ];

  return (
    <div className="h-80 bg-[#0e0e10] p-5 font-mono text-xs leading-relaxed md:h-96">
      {lines.map((l, i) =>
        l.text === "" ? (
          <div key={i} className="h-2" />
        ) : (
          <div key={i} className={l.cls}>
            {l.text}
          </div>
        ),
      )}
      <div className="mt-2 inline-flex items-center text-emerald-400">
        $ <span className="ml-2 inline-block h-3.5 w-1.5 animate-pulse bg-emerald-400/70" />
      </div>
    </div>
  );
}

function MockGraph() {
  return (
    <div
      className="relative h-80 border-t border-zinc-200 bg-white md:h-96 md:border-l md:border-t-0"
      style={{
        backgroundImage:
          "radial-gradient(circle, #d4d4d8 1px, transparent 1px)",
        backgroundSize: "22px 22px",
      }}
    >
      <svg
        viewBox="0 0 400 320"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* main branch line */}
        <line x1="80" y1="60" x2="80" y2="260" stroke="#3b82f6" strokeWidth="2" />
        {/* branch off to feature */}
        <path
          d="M 80 140 C 80 170, 180 150, 180 180"
          stroke="#f59e0b"
          strokeWidth="2"
          fill="none"
        />
        {/* feature line */}
        <line x1="180" y1="180" x2="180" y2="220" stroke="#f59e0b" strokeWidth="2" />
        {/* merge back */}
        <path
          d="M 180 220 C 180 250, 80 230, 80 260"
          stroke="#f59e0b"
          strokeWidth="2"
          fill="none"
        />

        {/* commit nodes */}
        <CommitNode cx={80} cy={60} color="#3b82f6" label="a1b2c3d" />
        <CommitNode cx={80} cy={140} color="#3b82f6" label="b2c3d4e" />
        <CommitNode cx={180} cy={180} color="#f59e0b" label="e4f5g6h" />
        <CommitNode cx={180} cy={220} color="#f59e0b" label="f5g6h7i" />
        <CommitNode cx={80} cy={260} color="#3b82f6" label="g6h7i8j" />

        {/* branch tags */}
        <BranchTag x={100} y={260} label="main" color="#3b82f6" />
        <BranchTag x={200} y={220} label="feature" color="#f59e0b" />
        <BranchTag x={100} y={60} label="initial" color="#71717a" subtle />
      </svg>
    </div>
  );
}

function CommitNode({
  cx,
  cy,
  color,
  label,
}: {
  cx: number;
  cy: number;
  color: string;
  label: string;
}) {
  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r="9"
        fill="white"
        stroke={color}
        strokeWidth="2.5"
      />
      <circle cx={cx} cy={cy} r="3.5" fill={color} />
      <text
        x={cx - 18}
        y={cy + 3.5}
        textAnchor="end"
        fontFamily="ui-monospace, monospace"
        fontSize="10"
        fill="#a1a1aa"
      >
        {label}
      </text>
    </g>
  );
}

function BranchTag({
  x,
  y,
  label,
  color,
  subtle,
}: {
  x: number;
  y: number;
  label: string;
  color: string;
  subtle?: boolean;
}) {
  const width = label.length * 6.5 + 14;
  return (
    <g>
      <rect
        x={x + 12}
        y={y - 9}
        width={width}
        height="18"
        rx="4"
        fill={subtle ? "#fafafa" : "white"}
        stroke={color}
        strokeWidth="1.25"
      />
      <text
        x={x + 19}
        y={y + 4}
        fontFamily="ui-monospace, monospace"
        fontSize="10"
        fontWeight="500"
        fill={color}
      >
        {label}
      </text>
    </g>
  );
}

/* ─────────────────────── Features grid ─────────────────────── */

function Features() {
  const items: Array<{
    icon: React.ReactNode;
    title: string;
    desc: string;
  }> = [
    {
      icon: <IconGraph />,
      title: "Live graph",
      desc: "Commits become nodes. Branches trace through them. Merges connect. Every command redraws the tree — instantly.",
    },
    {
      icon: <IconTerminal />,
      title: "Real commands",
      desc: "init, commit, branch, checkout, merge, rebase, cherry-pick, reset, stash — the same verbs and flags you use daily.",
    },
    {
      icon: <IconBolt />,
      title: "Zero setup",
      desc: "Open the page, start typing. No install, no repo to clone, no directory to cd into. Fresh sandbox on every reload.",
    },
    {
      icon: <IconKey />,
      title: "Keyboard-first",
      desc: "Arrow-key history. Tab completion. Press ? for the command reference. Built to feel like a terminal, not a form.",
    },
    {
      icon: <IconEye />,
      title: "Always visible",
      desc: "The graph sits beside the terminal. See HEAD move. See branches split. See rebases rewrite history in place.",
    },
    {
      icon: <IconReset />,
      title: "Safe to break",
      desc: "Nothing is real. Reset wipes everything. Try the dangerous commands — force reset, rebase, amend — without fear.",
    },
  ];

  return (
    <section
      id="features"
      className="border-t border-zinc-200 px-6 py-20 md:py-28"
    >
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-2xl">
          <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">
            Features
          </div>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Built for learning, not for show.
          </h2>
          <p className="mt-4 text-zinc-600 md:text-lg">
            Every feature exists to make one thing easier: understanding what
            Git actually does when you run a command.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 md:grid-cols-3">
          {items.map((it, i) => (
            <Reveal key={it.title} delay={i * 70}>
              <FeatureCard icon={it.icon} title={it.title} desc={it.desc} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="group relative h-full overflow-hidden bg-white p-7 transition-colors duration-300 ease-out hover:bg-zinc-50/70">
      <div className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 transition-all duration-300 ease-out group-hover:-translate-y-0.5 group-hover:border-zinc-300 group-hover:text-[#0070F3] group-hover:shadow-[0_6px_16px_-10px_rgba(0,0,0,0.18)]">
        {icon}
      </div>
      <h3 className="text-base font-semibold tracking-tight text-zinc-950">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600">{desc}</p>
    </div>
  );
}

/* ─────────────────────── How it works ─────────────────────── */

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Type a command",
      desc: "Start with git init. Then commit, branch, merge. The terminal accepts the same syntax you'd use in a shell.",
    },
    {
      n: "02",
      title: "Watch the graph",
      desc: "The panel on the right redraws on every command. A new commit is a new node. A branch is a new line. A merge is a new joint.",
    },
    {
      n: "03",
      title: "Learn the pattern",
      desc: "Seeing the shape of a rebase or a fast-forward merge once is worth reading about it three times. Repeat until obvious.",
    },
  ];
  return (
    <section
      id="how"
      className="border-t border-zinc-200 bg-zinc-50/50 px-6 py-20 md:py-28"
    >
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-2xl">
          <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">
            How it works
          </div>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Three steps. Then muscle memory.
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={120 + i * 90}>
              <Step n={s.n} title={s.title} desc={s.desc} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Step({
  n,
  title,
  desc,
}: {
  n: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="group h-full rounded-lg border border-zinc-200 bg-white p-7 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-[0_12px_32px_-20px_rgba(0,0,0,0.2)]">
      <div className="font-mono text-xs font-medium text-[#0070F3] transition-colors duration-300 ease-out group-hover:text-[#0061d5]">
        {n}
      </div>
      <h3 className="mt-3 text-base font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600">{desc}</p>
    </div>
  );
}

/* ─────────────────────── Final CTA ─────────────────────── */

function FinalCta() {
  return (
    <section className="border-t border-zinc-200 px-6 py-24 md:py-32">
      <Reveal className="mx-auto max-w-3xl text-center">
        <h2 className="text-4xl font-semibold tracking-tight md:text-5xl">
          Ready to see Git?
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-zinc-600 md:text-lg">
          No signup. No install. Just type a command and watch the tree grow.
        </p>
        <div className="mt-9">
          <Link
            href="/play"
            className="group relative inline-flex items-center gap-2 overflow-hidden rounded-md bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white shadow-[0_2px_6px_-2px_rgba(0,0,0,0.3)] transition-all duration-200 ease-out hover:bg-zinc-800 hover:shadow-[0_14px_30px_-10px_rgba(0,0,0,0.4)] active:translate-y-px"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
            />
            <span className="relative">Open the sandbox</span>
            <ArrowRight className="relative transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
          </Link>
        </div>
      </Reveal>
    </section>
  );
}

/* ─────────────────────────── Footer ─────────────────────────── */

function LandingFooter() {
  return (
    <footer className="border-t border-zinc-200 px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 text-sm text-zinc-500 md:flex-row md:items-center">
        <div className="flex items-center gap-2">
          <LogoMark small />
          <span className="font-medium text-zinc-700">GitViz</span>
          <span className="text-zinc-300">/</span>
          <span>Interactive Git practice</span>
        </div>
        <div className="flex items-center gap-5">
          <Link href="/play" className="hover:text-zinc-950">
            Sandbox
          </Link>
          <a href="#features" className="hover:text-zinc-950">
            Features
          </a>
          <a href="#how" className="hover:text-zinc-950">
            How it works
          </a>
        </div>
      </div>
    </footer>
  );
}

/* ─────────────────────── Primitives ─────────────────────── */

function LogoMark({ small = false }: { small?: boolean }) {
  const size = small ? "h-5 w-5" : "h-6 w-6";
  return (
    <div
      className={`${size} flex items-center justify-center rounded-[5px] bg-zinc-950`}
    >
      <svg
        viewBox="0 0 16 16"
        className="h-3 w-3 fill-none stroke-white [stroke-linecap:round] [stroke-linejoin:round]"
        strokeWidth="2"
      >
        <circle cx="4" cy="4" r="2" />
        <circle cx="12" cy="12" r="2" />
        <circle cx="12" cy="4" r="2" />
        <line x1="4" y1="6" x2="4" y2="12" />
        <line x1="6" y1="4" x2="10" y2="4" />
        <line x1="12" y1="6" x2="12" y2="10" />
      </svg>
    </div>
  );
}

function ArrowRight({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`h-3.5 w-3.5 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="3" y1="8" x2="13" y2="8" />
      <polyline points="9,4 13,8 9,12" />
    </svg>
  );
}

function ArrowDown({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`h-3.5 w-3.5 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="8" y1="3" x2="8" y2="13" />
      <polyline points="4,9 8,13 12,9" />
    </svg>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-[4px] border border-zinc-200 border-b-2 bg-white px-1.5 font-mono text-[10px] text-zinc-600">
      {children}
    </span>
  );
}

/* ─────────────────────────── Icons ─────────────────────────── */

function IconGraph() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4 fill-none stroke-current"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="4" cy="4" r="1.75" />
      <circle cx="12" cy="4" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <line x1="4" y1="5.75" x2="4" y2="12" />
      <line x1="5.75" y1="4" x2="10.25" y2="4" />
      <line x1="12" y1="5.75" x2="12" y2="10.25" />
    </svg>
  );
}
function IconTerminal() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4 fill-none stroke-current"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3,5 6,8 3,11" />
      <line x1="8" y1="11" x2="13" y2="11" />
    </svg>
  );
}
function IconBolt() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4 fill-none stroke-current"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="9,2 4,9 8,9 7,14 12,7 8,7" />
    </svg>
  );
}
function IconKey() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4 fill-none stroke-current"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="4" width="12" height="8" rx="1.5" />
      <line x1="5" y1="7" x2="5" y2="7.01" />
      <line x1="8" y1="7" x2="8" y2="7.01" />
      <line x1="11" y1="7" x2="11" y2="7.01" />
      <line x1="4.5" y1="10" x2="11.5" y2="10" />
    </svg>
  );
}
function IconEye() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4 fill-none stroke-current"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1.5 8 C3.5 4.5, 6 3, 8 3 S12.5 4.5, 14.5 8 C12.5 11.5, 10 13, 8 13 S3.5 11.5, 1.5 8 Z" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  );
}
function IconReset() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4 fill-none stroke-current"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 8 A5 5 0 1 1 5 12" />
      <polyline points="3,4 3,8 7,8" />
    </svg>
  );
}
