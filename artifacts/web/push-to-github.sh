#!/usr/bin/env bash
set -euo pipefail

# ─── Config ────────────────────────────────────────────────────────────────────
REPO_URL="https://github.com/83646uguh/Telegram-reporter"
BRANCH="main"

# Token: pass as env var or first argument
GITHUB_TOKEN="${GITHUB_PERSONAL_ACCESS_TOKEN:-${1:-}}"

if [ -z "$GITHUB_TOKEN" ]; then
  echo "Error: GitHub token not found."
  echo "Usage: GITHUB_PERSONAL_ACCESS_TOKEN=<token> ./push-to-github.sh"
  echo "   or: ./push-to-github.sh <token>"
  exit 1
fi

# ─── Resolve script location (always push from the tg-app directory) ───────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
echo "Working directory: $SCRIPT_DIR"

# ─── Check git-lfs ─────────────────────────────────────────────────────────────
if ! command -v git-lfs &>/dev/null; then
  echo "Error: git-lfs is not installed."
  echo "Install it from https://git-lfs.com and re-run this script."
  exit 1
fi

# ─── Initialise git repo ────────────────────────────────────────────────────────
if [ ! -d ".git" ]; then
  git init -b "$BRANCH"
  echo "Initialised new git repository."
else
  echo "Existing git repository detected."
fi

git config user.email "deploy@tg-reporter.local"
git config user.name  "TG Reporter Deploy"

# ─── Set up Git LFS ─────────────────────────────────────────────────────────────
git lfs install --local

# Track binary / asset file types via LFS
git lfs track "*.png"
git lfs track "*.jpg" "*.jpeg"
git lfs track "*.gif"
git lfs track "*.ico"
git lfs track "*.woff" "*.woff2"
git lfs track "*.ttf"  "*.eot" "*.otf"
git lfs track "*.zip"  "*.tar.gz" "*.gz"

echo "Git LFS tracking rules written."

# ─── Ensure .gitignore excludes generated/local artefacts ───────────────────────
cat > .gitignore << 'GITIGNORE'
# Dependencies
node_modules/

# Build output
dist/

# Local env files
.env
.env.local
.env.*.local

# Editor
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Logs
*.log
GITIGNORE

echo ".gitignore written."

# ─── Set remote (embed token in URL so no interactive prompt) ───────────────────
REMOTE_WITH_TOKEN="https://${GITHUB_TOKEN}@github.com/83646uguh/Telegram-reporter.git"

git remote remove origin 2>/dev/null || true
git remote add origin "$REMOTE_WITH_TOKEN"
echo "Remote 'origin' set."

# ─── Stage all files ─────────────────────────────────────────────────────────────
git add -A
echo "All files staged."

# ─── Commit ─────────────────────────────────────────────────────────────────────
COMMIT_MSG="Deploy: Telegram Reporter — $(date '+%Y-%m-%d %H:%M:%S')"
if git diff --cached --quiet; then
  echo "Nothing to commit — working tree is clean."
else
  git commit -m "$COMMIT_MSG"
  echo "Committed: $COMMIT_MSG"
fi

# ─── Push ────────────────────────────────────────────────────────────────────────
echo "Pushing to $REPO_URL ($BRANCH) ..."
git push -u origin "$BRANCH" --force

echo ""
echo "Done! Repository is live at: $REPO_URL"
