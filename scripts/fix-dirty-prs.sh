#!/usr/bin/env bash
# fix-dirty-prs.sh — Triage DIRTY Dependabot PRs for undone0603/authichain-unified
# Usage: ./scripts/fix-dirty-prs.sh [--dry-run] [--close-on-fail]
set -euo pipefail

REPO="undone0603/authichain-unified"
DRY_RUN=false
CLOSE_ON_FAIL=false
ORIGINAL_BRANCH=$(git branch --show-current)

RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'

for arg in "$@"; do
  case $arg in
    --dry-run)       DRY_RUN=true ;;
    --close-on-fail) CLOSE_ON_FAIL=true ;;
  esac
done

command -v gh  >/dev/null 2>&1 || { echo -e "${RED}Error: gh not found${NC}"; exit 1; }
command -v jq  >/dev/null 2>&1 || { echo -e "${RED}Error: jq not found — sudo apt install jq${NC}"; exit 1; }
gh auth status >/dev/null 2>&1 || { echo -e "${RED}Error: not authenticated — run gh auth login${NC}"; exit 1; }

REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")
if [[ "$REMOTE_URL" != *"authichain-unified"* ]]; then
  echo -e "${RED}Error: not in authichain-unified repo${NC}"; exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo -e "${RED}Error: working tree is dirty. Stash or commit first.${NC}"; exit 1
fi

cleanup() {
  echo -e "\n${CYAN}→ Returning to ${ORIGINAL_BRANCH}${NC}"
  git checkout "$ORIGINAL_BRANCH" --quiet 2>/dev/null || true
}
trap cleanup EXIT

confirm() {
  read -rp "${1} [y/N]: " yn; [[ "$yn" =~ ^[Yy]$ ]]
}

handle_push_rejection() {
  local PR_NUMBER=$1 PR_HEAD=$2
  echo -e "\n  ${RED}Push rejected for PR #${PR_NUMBER}${NC}"
  echo -e "  Remote moved ahead while you were rebasing."
  echo -e "    [f] Force push (--force)  [r] Re-fetch and retry  [s] Skip"
  read -rp "  Choice [f/r/s]: " PUSH_CHOICE
  case "$PUSH_CHOICE" in
    f|F)
      if git push origin "${PR_HEAD}" --force --quiet; then
        echo -e "  ${GREEN}✓ Force pushed PR #${PR_NUMBER}${NC}"
        MERGED+=("$PR_NUMBER")
      else
        echo -e "  ${RED}✗ Force push failed — check branch protection rules${NC}"
        FAILED+=("$PR_NUMBER")
      fi
      ;;
    r|R)
      git rebase --abort 2>/dev/null || true
      git checkout "$ORIGINAL_BRANCH" --quiet
      process_pr "$PR_NUMBER"
      ;;
    *)
      echo -e "  ${YELLOW}⤷ Skipped${NC}"
      FAILED+=("$PR_NUMBER")
      ;;
  esac
}

process_pr() {
  local PR_NUMBER=$1
  local PR_TITLE PR_HEAD PR_BASE
  PR_TITLE=$(echo "$DIRTY_PRS" | jq -r --argjson n "$PR_NUMBER" '.[] | select(.number==$n) | .title')
  PR_HEAD=$(echo  "$DIRTY_PRS" | jq -r --argjson n "$PR_NUMBER" '.[] | select(.number==$n) | .headRefName')
  PR_BASE=$(echo  "$DIRTY_PRS" | jq -r --argjson n "$PR_NUMBER" '.[] | select(.number==$n) | .baseRefName')

  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}PR #${PR_NUMBER}${NC}: ${PR_TITLE}"
  echo -e "  Head: ${PR_HEAD}  →  Base: ${PR_BASE}"

  if [[ "$DRY_RUN" == true ]]; then
    echo -e "  ${YELLOW}[dry-run] would attempt rebase — skipping${NC}"
    SKIPPED+=("$PR_NUMBER")
    return
  fi

  git fetch origin "$PR_BASE" --quiet

  if ! git fetch origin "${PR_HEAD}" --quiet 2>/dev/null; then
    echo -e "  ${RED}✗ Branch not found on remote — branch may be deleted. Skipping.${NC}"
    SKIPPED+=("$PR_NUMBER")
    return
  fi

  git checkout -B "$PR_HEAD" "origin/${PR_HEAD}" --quiet

  if git rebase "origin/${PR_BASE}" --quiet 2>/dev/null; then
    echo -e "  ${GREEN}✓ Clean rebase${NC}"
    if git push origin "${PR_HEAD}" --force-with-lease --quiet; then
      echo -e "  ${GREEN}✓ Pushed — CI will re-run on PR #${PR_NUMBER}${NC}"
      MERGED+=("$PR_NUMBER")
    else
      handle_push_rejection "$PR_NUMBER" "$PR_HEAD"
    fi
  else
    echo -e "\n  ${RED}✗ Rebase conflict on PR #${PR_NUMBER}${NC}"
    echo -e "  Conflicted files:"
    git diff --name-only --diff-filter=U | sed 's/^/    /'
    echo -e "\n    [r] Open editor to resolve   [c] Close as stale   [s] Skip"
    read -rp "  Choice [r/c/s]: " CHOICE
    case "$CHOICE" in
      r|R)
        "${EDITOR:-vim}" $(git diff --name-only --diff-filter=U)
        echo -e "  Stage resolved files with: git add <file>"
        read -rp "  Press Enter when staged and ready to continue rebase: "
        if git rebase --continue; then
          if git push origin "${PR_HEAD}" --force-with-lease --quiet; then
            echo -e "  ${GREEN}✓ Conflict resolved and pushed PR #${PR_NUMBER}${NC}"
            MERGED+=("$PR_NUMBER")
          else
            handle_push_rejection "$PR_NUMBER" "$PR_HEAD"
          fi
        else
          echo -e "  ${RED}✗ Rebase still conflicting — aborting${NC}"
          git rebase --abort
          FAILED+=("$PR_NUMBER")
        fi
        ;;
      c|C)
        git rebase --abort 2>/dev/null || true
        if [[ "$CLOSE_ON_FAIL" == true ]] || confirm "  Confirm close PR #${PR_NUMBER}?"; then
          gh pr close "$PR_NUMBER" --repo "$REPO" \
            --comment "Closing: unrebaseable merge conflict. Superseded or requires manual dependency resolution."
          echo -e "  ${GREEN}✓ Closed PR #${PR_NUMBER}${NC}"
          CLOSED+=("$PR_NUMBER")
        else
          echo -e "  ${YELLOW}⤷ Close cancelled${NC}"
          SKIPPED+=("$PR_NUMBER")
        fi
        ;;
      *)
        git rebase --abort 2>/dev/null || true
        echo -e "  ${YELLOW}⤷ Skipped PR #${PR_NUMBER}${NC}"
        SKIPPED+=("$PR_NUMBER")
        ;;
    esac
  fi

  git checkout "$ORIGINAL_BRANCH" --quiet 2>/dev/null || true
}

# ── Main ──────────────────────────────────────────────────────────────────────
echo -e "${CYAN}Fetching DIRTY Dependabot PRs from ${REPO}...${NC}"

DIRTY_PRS=$(gh pr list \
  --repo "$REPO" \
  --author "app/dependabot" \
  --state open \
  --limit 100 \
  --json number,title,headRefName,baseRefName,mergeable,mergeStateStatus \
  | jq '[.[] | select(.mergeStateStatus == "DIRTY" or .mergeable == "CONFLICTING")]')

COUNT=$(echo "$DIRTY_PRS" | jq 'length')

if [[ "$COUNT" -eq 0 ]]; then
  echo -e "${GREEN}✓ No DIRTY Dependabot PRs found. Nothing to do.${NC}"
  exit 0
fi

echo -e "${YELLOW}Found ${COUNT} DIRTY PR(s):${NC}"
echo "$DIRTY_PRS" | jq -r '.[] | "  PR #\(.number) — \(.title)"'
echo ""

MERGED=(); CLOSED=(); SKIPPED=(); FAILED=()
PR_NUMBERS=$(echo "$DIRTY_PRS" | jq -r '.[].number')

for PR_NUM in $PR_NUMBERS; do
  process_pr "$PR_NUM"
  echo ""
done

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Summary:${NC}"
[[ ${#MERGED[@]}  -gt 0 ]] && echo -e "  ${GREEN}✓ Rebased & pushed:${NC} ${MERGED[*]}"
[[ ${#CLOSED[@]}  -gt 0 ]] && echo -e "  ${RED}✗ Closed as stale:${NC}  ${CLOSED[*]}"
[[ ${#SKIPPED[@]} -gt 0 ]] && echo -e "  ${YELLOW}⤷ Skipped:${NC}          ${SKIPPED[*]}"
[[ ${#FAILED[@]}  -gt 0 ]] && echo -e "  ${RED}✗ Failed/manual:${NC}    ${FAILED[*]}"
