#!/usr/bin/env node
/**
 * Classify open PRs against main. Default is report-only.
 * --apply closes already_merged / duplicate_superseded only.
 * Never merges. Never deploys. Green checks are not used as a merge signal.
 */
import { classifyBranch } from "./lib/branch-classify.mjs";

export { classifyBranch };

async function gh(pathname) {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo) return null;
  const res = await fetch(`https://api.github.com/repos/${repo}${pathname}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) throw new Error(`GitHub ${pathname} ${res.status}`);
  return res.json();
}

export function classifyFromPull(pr, files = []) {
  const merged = Boolean(pr.merged_at) || (pr.state === "closed" && pr.merged);
  return classifyBranch({
    merged,
    commitsOnMain: Boolean(pr.head?.sha && pr.base?.sha && pr.head.sha === pr.base.sha),
    files: files.map((f) => f.filename || f),
    title: pr.title,
    draft: pr.draft,
    requiredChecksGreen: false,
  });
}

if (process.argv.includes("--run")) {
  const apply = process.argv.includes("--apply");
  const pulls = (await gh("/pulls?state=open&per_page=50")) ?? [];
  const report = [];
  for (const pr of pulls) {
    const files = (await gh(`/pulls/${pr.number}/files?per_page=100`)) ?? [];
    const classification = classifyFromPull(pr, files);
    report.push({ number: pr.number, title: pr.title, classification });
    if (
      apply &&
      (classification.class === "already_merged" ||
        classification.class === "duplicate_superseded")
    ) {
      await fetch(
        `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/issues/${pr.number}/labels`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
            Accept: "application/vnd.github+json",
          },
          body: JSON.stringify({ labels: ["hygiene:superseded"] }),
        }
      );
      await fetch(
        `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/issues/${pr.number}/comments`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
            Accept: "application/vnd.github+json",
          },
          body: JSON.stringify({
            body: `Superseded by \`main\` (${classification.reason}). Frozen; not merged because the branch was green.`,
          }),
        }
      );
      await fetch(
        `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/pulls/${pr.number}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
            Accept: "application/vnd.github+json",
          },
          body: JSON.stringify({ state: "closed" }),
        }
      );
    }
  }
  console.log(JSON.stringify({ apply, report }, null, 2));
}
