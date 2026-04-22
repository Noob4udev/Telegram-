#!/usr/bin/env bash
set -euo pipefail

# ─── Config ────────────────────────────────────────────────────────────────────
GITHUB_USER="Noob4udev"
GITHUB_REPO="Telegram-"
BRANCH="main"

# Token (hardcoded per user request). Override with env var or 1st arg if needed.
GITHUB_TOKEN="${GITHUB_PERSONAL_ACCESS_TOKEN:-${1:-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}}"

REPO_URL="https://github.com/${GITHUB_USER}/${GITHUB_REPO}"

# ─── Run from the monorepo root (render.yaml lives there) ─────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"
echo "Working directory: $ROOT_DIR"

# ─── Clear any stale lock files left behind by crashed git processes ─────────
if [ -d ".git" ]; then
  rm -f .git/HEAD.lock .git/index.lock .git/config.lock 2>/dev/null || true
  rm -f .git/refs/heads/${BRANCH}.lock 2>/dev/null || true
fi

# ─── Initialise git repo if needed ────────────────────────────────────────────
if [ ! -d ".git" ]; then
  git init -b "$BRANCH"
  echo "Initialised new git repository."
else
  # Ensure we are on the target branch
  git symbolic-ref HEAD "refs/heads/${BRANCH}" 2>/dev/null || true
fi

git config user.email "deploy@tg-reporter.local"
git config user.name  "TG Reporter Deploy"

# ─── Tear down any prior Git LFS state ────────────────────────────────────────
# An earlier version of this script enabled LFS, which left behind a
# .gitattributes file plus broken pointer files (e.g. favicon.png) whose blobs
# were never uploaded. Strip all of that out so the push is plain git.
if command -v git-lfs >/dev/null 2>&1; then
  git lfs uninstall --local >/dev/null 2>&1 || true
fi

# Remove any leftover LFS pointer FILES in the working tree (broken/orphaned).
# Anything tiny that begins with the LFS spec header is a pointer to a blob we
# don't actually have — drop it.
while IFS= read -r -d '' f; do
  if head -c 64 "$f" 2>/dev/null | grep -q "git-lfs.github.com/spec/v1"; then
    echo "Removing broken LFS pointer file: $f"
    rm -f "$f"
  fi
done < <(find . -type f -size -10k \
    -not -path "./.git/*" \
    -not -path "./node_modules/*" \
    -not -path "*/node_modules/*" \
    -not -path "./attached_assets/*" \
    -print0 2>/dev/null)

# ─── Ensure .gitignore excludes generated / local artefacts ───────────────────
# Always make sure attached_assets/ is ignored — it can contain large user uploads
# (zips, screenshots) that exceed GitHub's 100MB hard limit and pollute the repo.
if [ -f .gitignore ] && ! grep -q "^attached_assets/" .gitignore; then
  echo "attached_assets/" >> .gitignore
  echo "Appended attached_assets/ to .gitignore."
fi

if [ ! -f .gitignore ] || ! grep -q "^node_modules/" .gitignore; then
  cat > .gitignore << 'GITIGNORE'
# Dependencies
node_modules/
**/node_modules/

# Build output
dist/
**/dist/
build/
**/build/
.tsbuildinfo
**/*.tsbuildinfo

# Local env files
.env
.env.local
.env.*.local

# Editor / OS
.vscode/
.idea/
.DS_Store
Thumbs.db

# Logs
*.log
logs/

# Replit-local working files
.local/
.agents/
attached_assets/
GITIGNORE
  echo ".gitignore written."
fi

# ─── Configure remote (token embedded so push is non-interactive) ─────────────
REMOTE_WITH_TOKEN="https://${GITHUB_USER}:${GITHUB_TOKEN}@github.com/${GITHUB_USER}/${GITHUB_REPO}.git"

git remote remove origin 2>/dev/null || true
git remote add origin "$REMOTE_WITH_TOKEN"
echo "Remote 'origin' configured."

# ─── Untrack anything that just became ignored (e.g. attached_assets/) ────────
git rm -r --cached --ignore-unmatch attached_assets/ >/dev/null 2>&1 || true

# ─── Force the index to be rebuilt from the working tree ─────────────────────
# A previous run may have stored files in the index as LFS pointer blobs (e.g.
# pnpm-lock.yaml). With LFS now uninstalled, we must drop the cached index
# entries and re-add from the working tree so the real file contents are used.
git rm -r --cached --ignore-unmatch . >/dev/null 2>&1 || true
git add -A
echo "All files staged (index rebuilt from working tree)."

# ─── Build a single squashed commit (no parents) of the current tree ─────────
# This keeps history small and, crucially, drops any blobs from prior commits
# (e.g. large files that were committed before being added to .gitignore) so
# GitHub's 100 MB-per-file limit is never tripped by leftover history.
COMMIT_MSG="Deploy: $(date '+%Y-%m-%d %H:%M:%S')"
TREE_SHA=$(git write-tree)
NEW_COMMIT=$(echo "$COMMIT_MSG" | git commit-tree "$TREE_SHA")
git update-ref "refs/heads/${BRANCH}" "$NEW_COMMIT"
echo "Created snapshot commit ${NEW_COMMIT} on ${BRANCH}."

# Drop unreferenced blobs (old large files) from the local repo before pushing
git reflog expire --expire=now --all >/dev/null 2>&1 || true
git gc --prune=now --quiet >/dev/null 2>&1 || true

# ─── Push ─────────────────────────────────────────────────────────────────────
echo "Pushing LFS objects + commits to ${REPO_URL} (${BRANCH}) ..."
git push -u origin "$BRANCH" --force

echo ""
echo "Done. Repository: ${REPO_URL}"
