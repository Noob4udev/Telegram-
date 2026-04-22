import type { Response } from "express";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import type { AuthRequest } from "./auth";

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 10; i++) {
    if (
      fs.existsSync(path.join(dir, "pnpm-workspace.yaml")) ||
      fs.existsSync(path.join(dir, ".git"))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

let busy = false;
let lastResult: { ok: boolean; output: string; finishedAt: string } | null = null;

export function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: () => void,
) {
  if (!req.user) return res.status(401).json({ message: "Not signed in" });
  if (!req.user.isAdmin) return res.status(403).json({ message: "Admin only" });
  next();
}

export function getPushStatus(_req: AuthRequest, res: Response) {
  res.json({ busy, lastResult });
}

export function runPush(_req: AuthRequest, res: Response) {
  if (busy) {
    return res
      .status(409)
      .json({ message: "A push is already in progress." });
  }

  const repoRoot = findRepoRoot(process.cwd());
  const script = path.join(repoRoot, "scripts", "push-to-github.sh");

  if (!fs.existsSync(script)) {
    return res
      .status(500)
      .json({ message: `Push script not found at ${script}` });
  }

  busy = true;
  const startedAt = new Date().toISOString();
  let buffer = "";
  const child = spawn("bash", [script], {
    cwd: repoRoot,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });

  child.stdout.on("data", (d) => {
    buffer += d.toString();
  });
  child.stderr.on("data", (d) => {
    buffer += d.toString();
  });
  child.on("error", (err) => {
    busy = false;
    lastResult = {
      ok: false,
      output: `${buffer}\n[spawn error] ${err.message}`,
      finishedAt: new Date().toISOString(),
    };
  });
  child.on("close", (code) => {
    busy = false;
    // Strip the token from the output before storing/returning
    const sanitized = buffer.replace(/ghp_[A-Za-z0-9]+/g, "ghp_***");
    lastResult = {
      ok: code === 0,
      output: sanitized,
      finishedAt: new Date().toISOString(),
    };
  });

  res.status(202).json({ started: true, startedAt });
}
