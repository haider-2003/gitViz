import {
  type RepoState,
  type Commit,
  fresh,
  makeId,
  headCommit,
  ancestors,
  isAncestor,
  now,
  pushRL,
  fireAction,
} from "./gitState";
import {
  renameBranchColor,
  resetAnimations,
  resetPalette,
} from "./graphRenderer";

export type LineClass =
  | "p"
  | "ok"
  | "er"
  | "in"
  | "wn"
  | "dm"
  | "ou"
  | "hl"
  | "sep"
  | "";

export type Printer = {
  print(text: string, cls?: LineClass): void;
  clearTerminal(): void;
  openHelp(): void;
};

export type EngineHooks = {
  printer: Printer;
  // Called after any state mutation that should trigger a UI refresh (graph + header).
  onStateChange: () => void;
  // Called when command processing wipes the repo (also triggers state change).
  onReset: () => void;
};

// Tokenize a raw command line, honoring simple quoting (", ', `).
export function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let cur = "",
    inQ = false,
    qc = "";
  for (const ch of input) {
    if (inQ) {
      if (ch === qc) inQ = false;
      else cur += ch;
    } else if (ch === '"' || ch === "'" || ch === "`") {
      inQ = true;
      qc = ch;
    } else if (ch === " ") {
      if (cur) {
        tokens.push(cur);
        cur = "";
      }
    } else {
      cur += ch;
    }
  }
  if (cur) tokens.push(cur);
  return tokens;
}

// Mutates S in place. The reference to S must stay alive across calls
// (we use a mutable container so the engine can also replace it on `reset`).
export function createEngine(
  stateRef: { current: RepoState },
  hooks: EngineHooks,
) {
  const { printer } = hooks;
  const p = (t: string, c: LineClass = "ou") => printer.print(t, c);
  const pCmd = (t: string) => p(t, "p");
  const pOk = (t: string) => p(t, "ok");
  const pErr = (t: string) => p(t, "er");
  const pIn = (t: string) => p(t, "in");
  const pWn = (t: string) => p(t, "wn");
  const pDm = (t: string) => p(t, "dm");
  const pHl = (t: string) => p(t, "hl");
  const pSep = () => p("─".repeat(52), "sep");

  function doReset() {
    stateRef.current = fresh();
    resetPalette();
    resetAnimations();
    pWn("Repository wiped. Run  git init  to start fresh.");
    hooks.onReset();
  }

  function processCommand(raw: string) {
    const input = raw.trim();
    if (!input) return;
    pCmd(input);

    if (input === "clear") {
      printer.clearTerminal();
      return;
    }
    if (input === "reset") {
      doReset();
      return;
    }
    if (input === "help") {
      printer.openHelp();
      return;
    }

    const tok = tokenize(input);
    if (!tok.length) return;
    if (tok[0] !== "git") {
      pErr(`command not found: ${tok[0]}`);
      return;
    }

    const S = stateRef.current;
    const sub = tok[1];

    // ── Repository setup ───────────────────────────
    if (sub === "init") {
      if (S.inited) {
        pWn("Reinitialized existing Git repository.");
        return;
      }
      S.inited = true;
      S.branches["main"] = null;
      S.HEAD = "main";
      pOk("Initialized empty Git repository.");
      pDm('Tip: git commit -m "initial commit"');
      hooks.onStateChange();
      return;
    }
    if (sub === "clone") {
      if (S.inited) {
        pErr("Already in a repository.");
        return;
      }
      const url = tok[2] || "https://github.com/example/repo.git";
      S.inited = true;
      S.branches["main"] = null;
      S.HEAD = "main";
      const id = makeId(S);
      S.commits.push({
        id,
        msg: "Initial commit (cloned)",
        parents: [],
        branch: "main",
        author: "origin",
        ts: now(),
      });
      S.branches["main"] = id;
      S.remotes["origin"] = url;
      // Clone seeds the remote tracking ref so origin/main shows on canvas.
      S.remoteBranches["origin/main"] = id;
      pushRL(S, "clone", `from ${url}`);
      fireAction(S, "fetch", "origin");
      pOk(`Cloning from ${url}`);
      pOk("Checked out 'main'.");
      hooks.onStateChange();
      return;
    }

    if (!S.inited) {
      pErr("fatal: not a git repository. Run  git init  first.");
      return;
    }

    // ── Staging ────────────────────────────────────
    if (sub === "add") {
      const f = tok[2] || ".";
      if (f === "-p") {
        pIn("Interactive staging (simulated).");
        S.staged.push("(interactive patch)");
      } else {
        S.staged.push(f);
        pOk(`Added '${f}' to staging area.`);
      }
      fireAction(S, "stage", S.HEAD);
      hooks.onStateChange();
      return;
    }
    if (sub === "restore") {
      if (tok[2] === "--staged") {
        const f = tok[3] || ".";
        S.staged = S.staged.filter((x) => x !== f && f !== ".");
        pOk(`Unstaged '${f}'.`);
      } else {
        const f = tok[2] || ".";
        S.working = S.working.filter((x) => x !== f && f !== ".");
        pOk(`Restored '${f}'.`);
      }
      fireAction(S, "restore", S.HEAD);
      hooks.onStateChange();
      return;
    }

    // ── Commit ─────────────────────────────────────
    if (sub === "commit") {
      const flags = tok.slice(2);
      const amend = flags.includes("--amend"),
        noEdit = flags.includes("--no-edit");
      const aFlag = flags.some((f) => f === "-a" || f === "-am");
      const mIdx = flags.findIndex((f) => f === "-m");
      let msg = "";
      if (mIdx !== -1 && flags[mIdx + 1])
        msg = flags
          .slice(mIdx + 1)
          .join(" ")
          .replace(/^["'`]|["'`]$/g, "");
      if (!msg && !noEdit) {
        pErr('error: commit message required. Use -m "message"');
        return;
      }
      if (aFlag) S.staged.push("(all tracked)");
      if (amend) {
        const last = headCommit(S);
        if (!last) {
          pErr("error: nothing to amend.");
          return;
        }
        if (!noEdit && msg) last.msg = msg;
        // Absorb any staged changes into the amended commit (visual cue).
        S.staged = [];
        fireAction(S, "amend", last.id);
        pOk(`[${S.HEAD} ${last.id}] ${last.msg} (amended)`);
        pushRL(S, "commit --amend", last.msg);
        hooks.onStateChange();
        return;
      }
      const parentCommit = headCommit(S);
      const parent = parentCommit?.id || null;
      const id = makeId(S);
      // In detached HEAD, inherit the parent commit's branch so the new
      // commit stays in the same visual lane instead of jumping to main.
      const commitBranch = S.detached
        ? (parentCommit?.branch ?? null)
        : S.HEAD;
      S.commits.push({
        id,
        msg: msg || "commit",
        parents: parent ? [parent] : [],
        branch: commitBranch,
        author: S.config["user.name"],
        ts: now(),
      });
      if (!S.detached && S.HEAD) S.branches[S.HEAD] = id;
      else S.HEAD = id;
      // Squash-merge follow-up: clear the marker, commit now represents the
      // merge result so the dashed source-edge can fade away.
      if (S.squashSourceBranch) S.squashSourceBranch = null;
      S.staged = [];
      pushRL(S, "commit", msg);
      pOk(`[${S.detached ? id : S.HEAD} ${id}] ${msg}`);
      hooks.onStateChange();
      return;
    }

    // ── Branches ───────────────────────────────────
    if (sub === "branch") {
      const flags = tok.slice(2);
      if (!flags.length) {
        const bs = Object.keys(S.branches);
        if (!bs.length) {
          pDm("(no branches)");
          return;
        }
        bs.forEach((b) => {
          const cid = S.branches[b];
          const c = S.commits.find((x) => x.id === cid);
          const m = !S.detached && b === S.HEAD ? "* " : "  ";
          p(
            m +
              b +
              (c
                ? `  ${cid!.slice(0, 7)}  ${c.msg.slice(0, 30)}`
                : "  (empty)"),
            !S.detached && b === S.HEAD ? "ok" : "ou",
          );
        });
        return;
      }
      if (flags[0] === "-v") {
        Object.keys(S.branches).forEach((b) => {
          const cid = S.branches[b];
          const c = S.commits.find((x) => x.id === cid);
          const m = !S.detached && b === S.HEAD ? "* " : "  ";
          p(
            m +
              b.padEnd(22) +
              (cid?.slice(0, 7) || "-------") +
              "  " +
              (c?.msg.slice(0, 30) || ""),
            !S.detached && b === S.HEAD ? "ok" : "ou",
          );
        });
        return;
      }
      if (flags[0] === "--merged") {
        const hid = headCommit(S)?.id;
        if (!hid) {
          pDm("(no commits)");
          return;
        }
        Object.keys(S.branches)
          .filter((b) => {
            const c = S.branches[b];
            return c && isAncestor(S, c, hid);
          })
          .forEach((b) => p("  " + b, "ou"));
        return;
      }
      if (flags[0] === "--no-merged") {
        const hid = headCommit(S)?.id;
        if (!hid) {
          pDm("(no commits)");
          return;
        }
        Object.keys(S.branches)
          .filter((b) => {
            const c = S.branches[b];
            return c && !isAncestor(S, c, hid);
          })
          .forEach((b) => p("  " + b, "ou"));
        return;
      }
      if (flags[0] === "-m") {
        const [, old, nw] = flags;
        if (!old || !nw) {
          pErr("usage: git branch -m <old> <new>");
          return;
        }
        if (!Object.prototype.hasOwnProperty.call(S.branches, old)) {
          pErr(`error: branch '${old}' not found.`);
          return;
        }
        S.branches[nw] = S.branches[old];
        delete S.branches[old];
        renameBranchColor(old, nw);
        if (S.HEAD === old) S.HEAD = nw;
        S.commits
          .filter((c) => c.branch === old)
          .forEach((c) => (c.branch = nw));
        pOk(`Renamed '${old}' to '${nw}'.`);
        hooks.onStateChange();
        return;
      }
      if (flags[0] === "-d" || flags[0] === "-D") {
        const name = flags[1];
        if (!name) {
          pErr("usage: git branch -d <n>");
          return;
        }
        if (!Object.prototype.hasOwnProperty.call(S.branches, name)) {
          pErr(`error: branch '${name}' not found.`);
          return;
        }
        if (!S.detached && S.HEAD === name) {
          pErr(`error: cannot delete branch '${name}' you are on.`);
          return;
        }
        delete S.branches[name];
        pOk(`Deleted branch ${name}.`);
        hooks.onStateChange();
        return;
      }
      // Create branch.
      const name = flags[0];
      if (Object.prototype.hasOwnProperty.call(S.branches, name)) {
        pErr(`fatal: branch '${name}' already exists.`);
        return;
      }
      const cur = headCommit(S);
      S.branches[name] = cur?.id || null;
      pOk(`Branch '${name}' created at ${cur?.id?.slice(0, 7) || "(empty)"}.`);
      hooks.onStateChange();
      return;
    }

    // ── Checkout / Switch ──────────────────────────
    if (sub === "checkout") {
      const flags = tok.slice(2);
      const bF = flags[0] === "-b" || flags[0] === "-B";
      const name = bF ? flags[1] : flags[0];
      if (!name) {
        pErr("error: branch/commit name required.");
        return;
      }
      if (bF) {
        if (
          Object.prototype.hasOwnProperty.call(S.branches, name) &&
          flags[0] !== "-B"
        ) {
          pErr(`fatal: branch '${name}' already exists.`);
          return;
        }
        const cur = headCommit(S);
        S.branches[name] = cur?.id || null;
        S.prevBranch = S.HEAD;
        S.HEAD = name;
        S.detached = false;
        pOk(`Switched to a new branch '${name}'.`);
        pushRL(S, "checkout -b", name);
        hooks.onStateChange();
        return;
      }
      if (Object.prototype.hasOwnProperty.call(S.branches, name)) {
        S.prevBranch = S.HEAD;
        S.HEAD = name;
        S.detached = false;
        pOk(`Switched to branch '${name}'.`);
        pushRL(S, "checkout", name);
        hooks.onStateChange();
        return;
      }
      const c = S.commits.find((x) => x.id.startsWith(name));
      if (c) {
        S.prevBranch = S.HEAD;
        S.HEAD = c.id;
        S.detached = true;
        pWn(`HEAD is now at ${c.id.slice(0, 7)} ${c.msg}`);
        pWn("You are in detached HEAD state.");
        pushRL(S, "checkout", c.id);
        hooks.onStateChange();
        return;
      }
      pErr(`error: pathspec '${name}' did not match any branch or commit.`);
      return;
    }
    if (sub === "switch") {
      const flags = tok.slice(2);
      const cF = flags[0] === "-c" || flags[0] === "-C";
      const name = cF ? flags[1] : flags[0];
      if (name === "-") {
        if (!S.prevBranch) {
          pErr("error: no previous branch.");
          return;
        }
        const prev = S.prevBranch;
        S.prevBranch = S.HEAD;
        S.HEAD = prev;
        S.detached = false;
        pOk(`Switched to branch '${prev}'.`);
        pushRL(S, "switch -", prev);
        hooks.onStateChange();
        return;
      }
      if (!name) {
        pErr("error: branch name required.");
        return;
      }
      if (cF) {
        if (Object.prototype.hasOwnProperty.call(S.branches, name)) {
          pErr(`fatal: branch '${name}' already exists.`);
          return;
        }
        const cur = headCommit(S);
        S.branches[name] = cur?.id || null;
        S.prevBranch = S.HEAD;
        S.HEAD = name;
        S.detached = false;
        pOk(`Switched to a new branch '${name}'.`);
        pushRL(S, "switch -c", name);
        hooks.onStateChange();
        return;
      }
      if (!Object.prototype.hasOwnProperty.call(S.branches, name)) {
        pErr(`error: branch '${name}' not found. Use  git switch -c ${name}`);
        return;
      }
      S.prevBranch = S.HEAD;
      S.HEAD = name;
      S.detached = false;
      pOk(`Switched to branch '${name}'.`);
      pushRL(S, "switch", name);
      hooks.onStateChange();
      return;
    }

    // ── Merge ──────────────────────────────────────
    if (sub === "merge") {
      const flags = tok.slice(2);
      if (flags[0] === "--abort") {
        pWn("Merge aborted.");
        fireAction(S, "inspect", S.HEAD);
        hooks.onStateChange();
        return;
      }
      const squash = flags.includes("--squash"),
        noFf = flags.includes("--no-ff");
      const name = flags.find((f) => !f.startsWith("-"));
      if (!name) {
        pErr("error: branch name required.");
        return;
      }
      if (S.detached) {
        pErr("error: cannot merge in detached HEAD state.");
        return;
      }
      if (!Object.prototype.hasOwnProperty.call(S.branches, name)) {
        pErr(`merge: '${name}' is not a valid branch.`);
        return;
      }
      if (name === S.HEAD) {
        pOk("Already on same branch.");
        return;
      }
      const srcId = S.branches[name];
      const dstId = S.HEAD ? S.branches[S.HEAD] : null;
      if (!srcId) {
        pErr(`'${name}' has no commits.`);
        return;
      }
      // Fast-forward is the default when possible — only forced off by --no-ff
      // or --squash. This matches real git behavior.
      if (dstId && isAncestor(S, dstId, srcId) && !noFf && !squash) {
        S.branches[S.HEAD!] = srcId;
        pOk("Fast-forward");
        pIn(`${S.HEAD} → ${srcId.slice(0, 7)}`);
        pushRL(S, "merge (ff)", name);
        hooks.onStateChange();
        return;
      }
      if (squash) {
        S.staged.push(`(squashed from '${name}')`);
        S.squashSourceBranch = name;
        fireAction(S, "squashSource", name);
        pWn(
          `Squash merge: changes staged. Run  git commit -m "msg"  to finish.`,
        );
        hooks.onStateChange();
        return;
      }
      const id = makeId(S);
      S.commits.push({
        id,
        msg: `Merge branch '${name}' into ${S.HEAD}`,
        parents: [dstId, srcId].filter(Boolean) as string[],
        branch: S.HEAD,
        author: S.config["user.name"],
        ts: now(),
      });
      S.branches[S.HEAD!] = id;
      pushRL(S, "merge", name);
      pOk(`Merge made by 'ort' strategy.`);
      pIn(`'${name}' → '${S.HEAD}'`);
      hooks.onStateChange();
      return;
    }

    // ── Rebase ─────────────────────────────────────
    if (sub === "rebase") {
      const flags = tok.slice(2);
      if (flags[0] === "--abort") {
        pWn("Rebase aborted.");
        fireAction(S, "inspect", S.HEAD);
        hooks.onStateChange();
        return;
      }
      if (flags[0] === "--continue") {
        pOk("Rebase continued.");
        fireAction(S, "inspect", S.HEAD);
        hooks.onStateChange();
        return;
      }
      const iF = flags[0] === "-i",
        arg = iF ? flags[1] : flags[0];
      if (!arg) {
        pErr("error: branch or HEAD~n required.");
        return;
      }
      const hm = arg.match(/^HEAD~(\d+)$/i);
      if (hm || iF) {
        const n = hm
          ? parseInt(hm[1])
          : parseInt(arg.replace(/HEAD~/i, "")) || 1;
        pIn(`Interactive rebase of last ${n} commit(s) (simulated).`);
        pDm("In real Git this opens an editor.");
        fireAction(S, "inspect", S.HEAD);
        hooks.onStateChange();
        return;
      }
      if (S.detached) {
        pErr("error: cannot rebase in detached HEAD state.");
        return;
      }
      if (!Object.prototype.hasOwnProperty.call(S.branches, arg)) {
        pErr(`error: invalid upstream '${arg}'.`);
        return;
      }
      const baseId = S.branches[arg];
      if (!baseId) {
        pErr(`'${arg}' has no commits.`);
        return;
      }
      const cur = S.HEAD!;
      const curTip = S.branches[cur];
      if (!curTip) {
        pErr(`'${cur}' has no commits.`);
        return;
      }
      // If upstream is already an ancestor of current tip, nothing to do.
      // If current tip is an ancestor of upstream, fast-forward instead.
      if (isAncestor(S, baseId, curTip)) {
        pOk("Current branch is up to date.");
        return;
      }
      if (isAncestor(S, curTip, baseId)) {
        S.branches[cur] = baseId;
        pushRL(S, "rebase (ff)", arg);
        pOk(`Fast-forwarded ${cur} to ${arg}.`);
        hooks.onStateChange();
        return;
      }
      // Walk from cur's tip back through first-parent until we hit something
      // reachable from baseId — that is the merge base. Collect commits along
      // the way; they are the ones to replay (in oldest→newest order).
      const baseAncs = ancestors(S, baseId);
      const toReplay: Commit[] = [];
      {
        let cursor: string | null = curTip;
        const guard = new Set<string>();
        while (cursor && !baseAncs.has(cursor) && !guard.has(cursor)) {
          guard.add(cursor);
          const c = S.commits.find((x) => x.id === cursor);
          if (!c) break;
          toReplay.unshift(c);
          cursor = c.parents[0] ?? null;
        }
      }
      if (!toReplay.length) {
        pOk("Already up to date.");
        return;
      }
      // Replay: re-parent each commit onto the previous one, starting from
      // baseId. Update branch field so layout assigns the correct lane.
      let prev: string = baseId;
      for (const c of toReplay) {
        c.parents = [prev];
        c.branch = cur;
        prev = c.id;
      }
      S.branches[cur] = prev;
      pushRL(S, "rebase", arg);
      toReplay.forEach((c) =>
        pDm(`  applied: ${c.id.slice(0, 7)} ${c.msg}`),
      );
      pOk(`Successfully rebased ${cur} onto ${arg}.`);
      hooks.onStateChange();
      return;
    }

    // ── Cherry-pick ────────────────────────────────
    if (sub === "cherry-pick") {
      const arg = tok[2];
      if (!arg) {
        pErr("usage: git cherry-pick <id>");
        return;
      }
      if (S.detached) {
        pErr("error: cannot cherry-pick in detached HEAD state.");
        return;
      }
      const range = arg.match(/^(.+)\.\.(.+)$/);
      if (range) {
        const [, f, t] = range;
        const fi = S.commits.findIndex((c) => c.id.startsWith(f));
        const ti = S.commits.findIndex((c) => c.id.startsWith(t));
        if (fi === -1 || ti === -1) {
          pErr("error: invalid range.");
          return;
        }
        const rng = S.commits.slice(fi + 1, ti + 1);
        rng.forEach((orig) => {
          const id = makeId(S);
          const par = headCommit(S)?.id || null;
          S.commits.push({
            id,
            msg: orig.msg + " (cherry-picked)",
            parents: par ? [par] : [],
            branch: S.HEAD,
            author: S.config["user.name"],
            ts: now(),
          });
          S.branches[S.HEAD!] = id;
        });
        pushRL(S, "cherry-pick", arg);
        pOk(`Cherry-picked ${rng.length} commit(s) onto ${S.HEAD}.`);
        hooks.onStateChange();
        return;
      }
      const orig = S.commits.find((c) => c.id.startsWith(arg));
      if (!orig) {
        pErr(`error: commit '${arg}' not found.`);
        return;
      }
      const id = makeId(S),
        par = headCommit(S)?.id || null;
      S.commits.push({
        id,
        msg: orig.msg + " (cherry-picked)",
        parents: par ? [par] : [],
        branch: S.HEAD,
        author: S.config["user.name"],
        ts: now(),
      });
      S.branches[S.HEAD!] = id;
      pushRL(S, "cherry-pick", orig.id);
      pOk(`[${S.HEAD} ${id}] ${orig.msg} (cherry-picked)`);
      hooks.onStateChange();
      return;
    }

    // ── Stash ──────────────────────────────────────
    if (sub === "stash") {
      const act = tok[2] || "push";
      if (act === "list") {
        if (!S.stashes.length) {
          pDm("(no stashes)");
          return;
        }
        S.stashes.forEach((s, i) =>
          p(`stash@{${i}}: On ${s.branch}: ${s.msg}`, "ou"),
        );
        fireAction(S, "inspect", null);
        hooks.onStateChange();
        return;
      }
      if (act === "show") {
        if (!S.stashes.length) {
          pErr("No stash found.");
          return;
        }
        pIn(`stash@{0}: ${S.stashes[0].msg}`);
        pDm("(simulated diff)");
        fireAction(S, "inspect", null);
        hooks.onStateChange();
        return;
      }
      if (act === "pop" || act === "apply") {
        const idxArg = tok[3];
        const idx = idxArg ? parseInt(idxArg.replace(/stash@\{|\}/g, "")) : 0;
        if (!S.stashes[idx]) {
          pErr(`error: stash@{${idx}} does not exist.`);
          return;
        }
        const st = S.stashes[idx];
        S.staged.push(`(from stash@{${idx}}: ${st.msg})`);
        pOk(`Applied stash@{${idx}}: ${st.msg}`);
        if (act === "pop") {
          S.stashes.splice(idx, 1);
          pOk(`Dropped stash@{${idx}}`);
        }
        fireAction(S, "stashPop", S.HEAD);
        hooks.onStateChange();
        return;
      }
      if (act === "drop") {
        const idxArg = tok[3];
        const idx = idxArg ? parseInt(idxArg.replace(/stash@\{|\}/g, "")) : 0;
        if (!S.stashes[idx]) {
          pErr(`error: stash@{${idx}} does not exist.`);
          return;
        }
        S.stashes.splice(idx, 1);
        pOk(`Dropped stash@{${idx}}`);
        fireAction(S, "stashPop", null);
        hooks.onStateChange();
        return;
      }
      if (act === "clear") {
        S.stashes = [];
        pOk("All stashes cleared.");
        fireAction(S, "stashPop", null);
        hooks.onStateChange();
        return;
      }
      if (act === "branch") {
        const bn = tok[3];
        if (!bn) {
          pErr("usage: git stash branch <n>");
          return;
        }
        if (!S.stashes.length) {
          pErr("No stash found.");
          return;
        }
        const st = S.stashes.shift()!;
        S.branches[bn] = S.branches[st.branch] || null;
        S.prevBranch = S.HEAD;
        S.HEAD = bn;
        S.detached = false;
        S.staged.push(`(from stash: ${st.msg})`);
        pOk(`Switched to new branch '${bn}'.`);
        hooks.onStateChange();
        return;
      }
      // Default: push.
      const mi = tok.findIndex((t) => t === "-m");
      const msg =
        mi !== -1 && tok[mi + 1]
          ? tok
              .slice(mi + 1)
              .join(" ")
              .replace(/^["']|["']$/g, "")
          : `WIP on ${S.HEAD}`;
      S.stashes.unshift({
        msg,
        branch: S.HEAD || "",
        commitId: headCommit(S)?.id || null,
      });
      S.staged = [];
      S.working = [];
      fireAction(S, "stashSave", S.HEAD);
      pOk(`Saved working directory: ${msg}`);
      hooks.onStateChange();
      return;
    }

    // ── Reset ──────────────────────────────────────
    if (sub === "reset") {
      const flags = tok.slice(2);
      const soft = flags.includes("--soft"),
        hard = flags.includes("--hard");
      const target = flags.find((f) => !f.startsWith("-")) || "HEAD~1";
      const m = target.match(/^HEAD~(\d+)$/i);
      const n = m ? parseInt(m[1]) : 1;
      const cur = headCommit(S);
      let tgt: Commit | null = cur;
      for (let i = 0; i < n && tgt; i++) {
        const par = tgt.parents[0];
        tgt = S.commits.find((c) => c.id === par) || null;
      }
      if (!tgt && n > 0) {
        pErr(`error: HEAD~${n} does not exist.`);
        return;
      }
      const toRm: string[] = [];
      let walk: Commit | null = cur;
      for (let i = 0; i < n && walk; i++) {
        toRm.push(walk.id);
        walk = S.commits.find((c) => c.id === walk!.parents[0]) || null;
      }
      S.commits = S.commits.filter((c) => !toRm.includes(c.id));
      if (!S.detached && S.HEAD) S.branches[S.HEAD] = tgt?.id || null;
      else S.HEAD = tgt?.id || null;
      if (hard) {
        S.staged = [];
        S.working = [];
        pWn(`HEAD is now at ${tgt?.id?.slice(0, 7) || "null"} (hard reset)`);
      } else if (soft) {
        pOk(
          `Soft reset to ${tgt?.id?.slice(0, 7) || "null"} — changes kept staged.`,
        );
      } else {
        S.staged = [];
        pOk(
          `Mixed reset to ${tgt?.id?.slice(0, 7) || "null"} — changes unstaged.`,
        );
      }
      pushRL(S, "reset", target);
      hooks.onStateChange();
      return;
    }

    // ── Revert ─────────────────────────────────────
    if (sub === "revert") {
      const arg = tok[2] || "HEAD";
      const tgt =
        arg.toUpperCase() === "HEAD"
          ? headCommit(S)
          : S.commits.find((c) => c.id.startsWith(arg));
      if (!tgt) {
        pErr(`error: '${arg}' not found.`);
        return;
      }
      if (S.detached) {
        pErr("error: cannot revert in detached HEAD state.");
        return;
      }
      const id = makeId(S),
        par = headCommit(S)?.id || null;
      S.commits.push({
        id,
        msg: `Revert "${tgt.msg}"`,
        parents: par ? [par] : [],
        branch: S.HEAD,
        author: S.config["user.name"],
        ts: now(),
      });
      S.branches[S.HEAD!] = id;
      pushRL(S, "revert", tgt.id);
      pOk(`[${S.HEAD} ${id}] Revert "${tgt.msg}"`);
      hooks.onStateChange();
      return;
    }

    // ── Tags ───────────────────────────────────────
    if (sub === "tag") {
      const flags = tok.slice(2);
      if (!flags.length) {
        const tags = Object.keys(S.tags);
        if (!tags.length) {
          pDm("(no tags)");
          return;
        }
        tags.forEach((t) => pHl(t));
        return;
      }
      if (flags[0] === "-d") {
        const n = flags[1];
        if (!S.tags[n]) {
          pErr(`error: tag '${n}' not found.`);
          return;
        }
        delete S.tags[n];
        pOk(`Deleted tag '${n}'.`);
        hooks.onStateChange();
        return;
      }
      const annotated = flags.includes("-a"),
        mi = flags.findIndex((f) => f === "-m");
      const tagMsg =
        mi !== -1
          ? flags
              .slice(mi + 1)
              .join(" ")
              .replace(/^["']|["']$/g, "")
          : "";
      const name = flags.find((f) => !f.startsWith("-")) || flags[0];
      const commitArg = flags.find(
        (f, i) => !f.startsWith("-") && f !== name && i > 0,
      );
      const c = commitArg
        ? S.commits.find((x) => x.id.startsWith(commitArg))
        : headCommit(S);
      if (!c) {
        pErr("error: no commit to tag.");
        return;
      }
      S.tags[name] = { commitId: c.id, annotated, msg: tagMsg };
      pOk(
        `Tagged ${c.id.slice(0, 7)} as '${name}'${annotated ? ` (annotated: "${tagMsg}")` : "."}`,
      );
      hooks.onStateChange();
      return;
    }

    // ── Log ────────────────────────────────────────
    if (sub === "log") {
      const flags = tok.slice(2);
      const oneline = flags.includes("--oneline") || S.onelineMode;
      const graph = flags.includes("--graph");
      const ni = flags.findIndex((f) => f === "-n");
      const limit = ni !== -1 ? parseInt(flags[ni + 1]) : Infinity;
      const bArg = flags.find(
        (f) =>
          !f.startsWith("-") &&
          Object.prototype.hasOwnProperty.call(S.branches, f),
      );
      let list = [...S.commits].reverse();
      if (bArg) {
        const ba = ancestors(S, S.branches[bArg]!);
        list = list.filter((c) => ba.has(c.id));
      }
      if (isFinite(limit)) list = list.slice(0, limit);
      if (!list.length) {
        pDm("(no commits)");
        return;
      }
      pSep();
      fireAction(S, "inspect", list[0]?.id ?? null);
      hooks.onStateChange();
      list.forEach((c) => {
        const brs = Object.entries(S.branches)
          .filter(([, cid]) => cid === c.id)
          .map(([b]) => b);
        const tgs = Object.entries(S.tags)
          .filter(([, t]) => t.commitId === c.id)
          .map(([n]) => n);
        if (oneline && !graph) {
          const refs = [...brs, ...tgs.map((t) => "tag:" + t)].join(", ");
          p(
            `${c.id.slice(0, 7)}  ${refs ? "(" + refs + ")  " : ""}${c.msg}`,
            "ou",
          );
        } else if (graph) {
          const pre = c.parents.length > 1 ? "*-.  " : "*    ";
          p(pre + c.id.slice(0, 7) + "  " + c.msg, "ou");
          if (brs.length) pIn("|    (" + brs.join(", ") + ")");
        } else {
          p(`commit ${c.id}`, "wn");
          if (brs.length) pIn(`Refs: (${brs.join(", ")})`);
          if (tgs.length) pHl(`Tags: ${tgs.join(", ")}`);
          p(`Author: ${c.author || "unknown"}`, "ou");
          p(`Date:   ${c.ts || ""}`, "dm");
          p(`    ${c.msg}`, "ou");
          p("");
        }
      });
      pSep();
      return;
    }

    // ── Inspection ─────────────────────────────────
    if (sub === "status") {
      pIn(
        S.detached
          ? `HEAD detached at ${S.HEAD?.slice(0, 7)}`
          : `On branch ${S.HEAD}`,
      );
      const cur = headCommit(S);
      if (!cur) pDm("No commits yet.");
      else p(`HEAD → ${cur.id.slice(0, 7)}: ${cur.msg}`, "ou");
      if (S.staged.length) {
        pOk("Changes to be committed:");
        S.staged.forEach((f) => pOk(`  staged: ${f}`));
      } else pDm("nothing to commit, working tree clean");
      if (S.working.length) {
        pWn("Changes not staged:");
        S.working.forEach((f) => pWn(`  modified: ${f}`));
      }
      fireAction(S, "inspect", cur?.id ?? null);
      hooks.onStateChange();
      return;
    }
    if (sub === "diff") {
      pDm("(diff — no actual file content in this simulator)");
      if (S.staged.length) {
        pWn("Staged:");
        S.staged.forEach((f) => p("  + " + f, "ok"));
      } else pDm("No staged changes.");
      fireAction(S, "inspect", S.HEAD);
      hooks.onStateChange();
      return;
    }
    if (sub === "show") {
      const arg = tok[2] || "HEAD";
      const c =
        arg.toUpperCase() === "HEAD"
          ? headCommit(S)
          : S.commits.find((x) => x.id.startsWith(arg));
      if (!c) {
        pErr(`error: '${arg}' not found.`);
        return;
      }
      pSep();
      p(`commit ${c.id}`, "wn");
      p(`Author: ${c.author || "unknown"}`, "ou");
      p(`Date:   ${c.ts || ""}`, "dm");
      p(`    ${c.msg}`, "ou");
      pDm("(no file diff in simulator)");
      pSep();
      fireAction(S, "inspect", c.id);
      hooks.onStateChange();
      return;
    }
    if (sub === "reflog") {
      if (!S.reflog.length) {
        pDm("(empty reflog)");
        return;
      }
      S.reflog.forEach((r, i) =>
        p(
          `HEAD@{${i}}  ${(r.to || "---").slice(0, 7)}  ${r.action}: ${r.desc}`,
          "ou",
        ),
      );
      fireAction(S, "inspect", S.HEAD);
      hooks.onStateChange();
      return;
    }
    if (sub === "shortlog") {
      const by: Record<string, string[]> = {};
      S.commits.forEach((c) => {
        const a = c.author || "unknown";
        if (!by[a]) by[a] = [];
        by[a].push(c.msg);
      });
      Object.entries(by).forEach(([a, ms]) => {
        p(`${a} (${ms.length}):`, "wn");
        ms.forEach((m) => p(`      ${m}`, "ou"));
      });
      fireAction(S, "inspect", null);
      hooks.onStateChange();
      return;
    }
    if (sub === "blame") {
      const f = tok[2] || "<file>";
      pDm(`blame for '${f}' (simulated)`);
      S.commits
        .slice(-5)
        .forEach((c) =>
          p(
            `${c.id.slice(0, 7)}  (${(c.author || "?").padEnd(12)})  ${c.msg}`,
            "ou",
          ),
        );
      fireAction(S, "inspect", S.HEAD);
      hooks.onStateChange();
      return;
    }

    // ── Remote (simulated) ─────────────────────────
    if (sub === "remote") {
      const act = tok[2];
      if (!act || act === "-v") {
        if (!Object.keys(S.remotes).length) {
          pDm("(no remotes)");
          return;
        }
        Object.entries(S.remotes).forEach(([n, u]) => {
          p(`${n}\t${u} (fetch)`, "ou");
          p(`${n}\t${u} (push)`, "ou");
        });
        return;
      }
      if (act === "add") {
        const [, , , n, u] = tok;
        if (!n || !u) {
          pErr("usage: git remote add <n> <url>");
          return;
        }
        S.remotes[n] = u;
        fireAction(S, "remote", n);
        pOk(`Remote '${n}' added.`);
        hooks.onStateChange();
        return;
      }
      if (act === "remove" || act === "rm") {
        const n = tok[3];
        if (!S.remotes[n]) {
          pErr(`error: No such remote '${n}'.`);
          return;
        }
        delete S.remotes[n];
        // Drop tracking refs that belonged to this remote.
        Object.keys(S.remoteBranches)
          .filter((k) => k.startsWith(n + "/"))
          .forEach((k) => delete S.remoteBranches[k]);
        fireAction(S, "remote", n);
        pOk(`Removed '${n}'.`);
        hooks.onStateChange();
        return;
      }
      pErr(`git: 'remote ${act}' not supported.`);
      return;
    }
    if (sub === "fetch") {
      if (!Object.keys(S.remotes).length) {
        pErr("fatal: no remotes configured.");
        return;
      }
      const remote = Object.keys(S.remotes)[0];
      // Sync every local branch to its remote-tracking ref. This represents
      // the remote already being in sync with the local repo (simulator
      // doesn't model divergence yet, but the labels become visible).
      Object.entries(S.branches).forEach(([b, cid]) => {
        if (cid) S.remoteBranches[`${remote}/${b}`] = cid;
      });
      fireAction(S, "fetch", remote);
      pIn(`Fetching from ${remote}...`);
      pDm("(simulated)");
      pOk("Updated remote tracking refs.");
      hooks.onStateChange();
      return;
    }
    if (sub === "pull") {
      if (!Object.keys(S.remotes).length) {
        pErr("fatal: no remotes configured.");
        return;
      }
      const rb = tok.includes("--rebase");
      const remote = Object.keys(S.remotes)[0];
      // Same as fetch in the simulator — refs become visible/aligned.
      Object.entries(S.branches).forEach(([b, cid]) => {
        if (cid) S.remoteBranches[`${remote}/${b}`] = cid;
      });
      fireAction(S, "pull", remote);
      pIn(`Pulling from ${remote}...`);
      pDm("(simulated)");
      pOk(rb ? "Successfully rebased from remote." : "Already up to date.");
      hooks.onStateChange();
      return;
    }
    if (sub === "push") {
      if (!Object.keys(S.remotes).length) {
        pErr("fatal: no remotes. Use  git remote add origin <url>  first.");
        return;
      }
      const force = tok.includes("--force") || tok.includes("-f");
      const del = tok.includes("--delete");
      // tok layout for `git push [-u] [remote] [branch]`. -u is a flag, not
      // positional, so collect non-flag positional args after "push".
      const positional = tok
        .slice(2)
        .filter((t) => !t.startsWith("-"));
      const remote = positional[0] || "origin";
      const branch = positional[1] || S.HEAD || "main";
      if (del) {
        delete S.remoteBranches[`${remote}/${branch}`];
        fireAction(S, "push", `${remote}/${branch}`);
        pWn(`Deleted remote branch ${remote}/${branch}.`);
        hooks.onStateChange();
        return;
      }
      const tipId = S.branches[branch] ?? null;
      if (!tipId) {
        pErr(`error: branch '${branch}' has no commits to push.`);
        return;
      }
      S.remoteBranches[`${remote}/${branch}`] = tipId;
      fireAction(S, "push", `${remote}/${branch}`);
      if (tok.includes("-u"))
        pOk(`Branch '${branch}' tracks remote '${remote}/${branch}'.`);
      pOk(
        `${force ? "Force-" : ""}Pushed ${branch} → ${remote}/${branch}.`,
      );
      hooks.onStateChange();
      return;
    }

    // ── Config ─────────────────────────────────────
    if (sub === "config") {
      const flags = tok.slice(2);
      if (flags[0] === "--list") {
        Object.entries(S.config).forEach(([k, v]) => p(`${k}=${v}`, "ou"));
        fireAction(S, "config", null);
        hooks.onStateChange();
        return;
      }
      const key = flags[0];
      const val = flags
        .slice(1)
        .join(" ")
        .replace(/^["']|["']$/g, "");
      if (!key) {
        pErr("usage: git config <key> <value>");
        return;
      }
      if (val) {
        S.config[key] = val;
        pOk(`Set ${key} = ${val}`);
      } else p(S.config[key] || "(not set)", "ou");
      fireAction(S, "config", null);
      hooks.onStateChange();
      return;
    }

    pErr(`git: '${sub}' is not recognized. Type  help  to see all commands.`);
  }

  return { processCommand, doReset };
}
