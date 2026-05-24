"use client";

import { useState } from "react";
import {
  parseGitHubUrl,
  fetchGitHubRepo,
  parseGitLog,
  type ImportedRepo,
} from "@/lib/repoImport";

type Props = {
  open: boolean;
  onClose: () => void;
  onImport: (imp: ImportedRepo, sourceLabel: string) => void;
};

type Tab = "github" | "paste";

export default function ImportModal({ open, onClose, onImport }: Props) {
  const [tab, setTab] = useState<Tab>("github");
  const [url, setUrl] = useState("");
  const [pasted, setPasted] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleImportFromGitHub() {
    setError(null);
    const parsed = parseGitHubUrl(url);
    if (!parsed) {
      setError(
        "Couldn't parse that URL. Try: https://github.com/owner/repo or owner/repo",
      );
      return;
    }
    setLoading(true);
    try {
      const imp = await fetchGitHubRepo(parsed.owner, parsed.repo);
      onImport(imp, `${parsed.owner}/${parsed.repo}`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function handleImportFromPaste() {
    setError(null);
    const result = parseGitLog(pasted);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    onImport(result, "pasted git log");
    onClose();
  }

  return (
    <div
      className={`fixed inset-0 z-200 bg-black/30 backdrop-blur-md flex items-center justify-center transition-opacity duration-180 ${
        open
          ? "opacity-100 pointer-events-auto"
          : "opacity-0 pointer-events-none"
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`bg-white border border-zinc-200 rounded-[10px] w-[min(640px,94vw)] max-h-[86vh] overflow-hidden flex flex-col shadow-[0_24px_80px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.04)] [transition:transform_0.2s_cubic-bezier(0.16,1,0.3,1),opacity_0.18s] ${
          open
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-2 scale-[0.99] opacity-0"
        }`}
      >
        {/* ── Header ── */}
        <div className="px-6 pt-5 pb-4 border-b border-zinc-200 flex items-center justify-between shrink-0 bg-zinc-50">
          <div>
            <div className="text-[13px] font-semibold text-zinc-900">
              Import a Repository
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5 font-mono">
              Visualize an existing repo&apos;s branch history
            </div>
          </div>
          <button
            className="w-7 h-7 rounded-sm bg-transparent border border-zinc-200 text-zinc-400 cursor-pointer flex items-center justify-center text-sm transition-all duration-120 hover:bg-zinc-100 hover:text-zinc-700 hover:border-zinc-300"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="flex border-b border-zinc-200 px-6 shrink-0 bg-white">
          <TabButton
            active={tab === "github"}
            onClick={() => {
              setTab("github");
              setError(null);
            }}
          >
            GitHub URL
          </TabButton>
          <TabButton
            active={tab === "paste"}
            onClick={() => {
              setTab("paste");
              setError(null);
            }}
          >
            Paste git log
          </TabButton>
        </div>

        {/* ── Body ── */}
        <div className="px-6 py-5 overflow-y-auto flex-1 scrollbar-light">
          {tab === "github" ? (
            <div className="flex flex-col gap-3">
              <label className="text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500">
                Repository URL
              </label>
              <input
                type="url"
                placeholder="https://github.com/vercel/next.js"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !loading) handleImportFromGitHub();
                }}
                className="font-mono text-[12.5px] bg-white border border-zinc-200 rounded-sm px-3 py-2.5 outline-none transition-colors duration-120 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100"
                autoFocus
              />
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Pulls up to 100 branches and the most recent 50 commits per
                branch via GitHub&apos;s public API. Unauthenticated requests
                are limited to 60 per hour per IP.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <label className="text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500">
                Paste output of <code className="font-mono">git log</code>
              </label>
              <textarea
                placeholder={`Run locally:\n  git log --all --pretty=format:"%H|%P|%an|%ai|%s"\n\nThen paste the result here.`}
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                rows={10}
                className="font-mono text-[11.5px] bg-zinc-50 border border-zinc-200 rounded-sm px-3 py-2.5 outline-none transition-colors duration-120 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100 resize-none whitespace-pre"
              />
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Best results with the pipe-delimited format above (gives full
                parent SHAs and dates). Also accepts{" "}
                <code className="font-mono">--oneline --decorate</code> output
                but branch inference is approximate.
              </p>
            </div>
          )}

          {error && (
            <div className="mt-4 border border-red-200 bg-red-50 rounded-sm px-3 py-2 text-[12px] text-red-700 font-mono whitespace-pre-wrap">
              {error}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-3.5 border-t border-zinc-200 bg-zinc-50 flex items-center justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            className="font-mono text-[11.5px] font-normal text-zinc-600 bg-transparent border border-zinc-200 px-3 py-1.5 rounded-sm cursor-pointer transition-all duration-120 hover:text-zinc-900 hover:border-zinc-300 hover:bg-white"
          >
            Cancel
          </button>
          <button
            onClick={
              tab === "github" ? handleImportFromGitHub : handleImportFromPaste
            }
            disabled={
              loading ||
              (tab === "github" ? !url.trim() : !pasted.trim())
            }
            className="font-mono text-[11.5px] font-medium text-white bg-zinc-950 border border-zinc-950 px-3 py-1.5 rounded-sm cursor-pointer transition-all duration-120 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-zinc-950"
          >
            {loading ? "Importing…" : "Import & Visualize"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`font-sans text-[12px] font-medium px-3 py-3 -mb-px border-b-2 transition-colors duration-120 cursor-pointer ${
        active
          ? "border-zinc-950 text-zinc-950"
          : "border-transparent text-zinc-500 hover:text-zinc-800"
      }`}
    >
      {children}
    </button>
  );
}
