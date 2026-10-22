# GitLab migration status

Evidence date: 2026-10-22 (revised after the owner chose GitLab as the primary home), read through the
authenticated GitLab browser session (GET requests) and the read-only GitHub connector.

This file replaces an earlier version that described GitLab as a one-way pull mirror whose `main` would be
overwritten by GitHub. That was wrong for the current configuration; the evidence is below.

## Finding

The project has **two mirrors in opposite directions**, both on protected branches only.

| Check                          | Result                                                                                                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Namespace                      | `authichain-group` (16 projects, no subgroups listed)                                                                                                                           |
| Project                        | `authichain-group/authichain-unified`, id `87889112`, private, default branch `main`                                                                                            |
| Pull mirror (GitHub to GitLab) | `mirror: true`, protected branches only, overwrite of diverged branches **off**. Last run `finished` at 2026-10-22T19:00:16Z, no error                                          |
| Push mirror (GitLab to GitHub) | remote mirror id `4138937`, SSH key auth, protected branches only, keep divergent refs **on**. Last run `finished` at 2026-10-22T19:27:58Z, no error                            |
| `main` head                    | GitLab `5308335b8f` = GitHub `main` `5308335b8f` (identical)                                                                                                                    |
| Merges made on GitLab          | !1997, !1998, !2000, !2002, !2003, !2004 and !2008 were merged on GitLab on 2026-10-22; the merge commits of !2003 (`1740258613`) and !2008 (`5308335b8f`) are on GitHub `main` |
| Protected branch               | `main`: push by Maintainers and Developers + Maintainers, force-push off                                                                                                        |
| Shared runners                 | enabled; free tier, 400 minutes a month                                                                                                                                         |
| Schedules                      | `AE launch checks 06:20 UTC` and `18:20 UTC`, active                                                                                                                            |

The protected-branch, shared-runner, schedule and sibling-project rows are carried over from the earlier version
and were not re-read today.

Other projects in the group: `Authichain-project`, `agent-browser`, `authichain-blog`,
`authichain-com`, `authichain-mcp-server`, `authichain-protocol`, `authichain-spec`,
`authichain-verify`, `cf-workers`, `claimpilot`, `govchain-us`, `qron`, `qron-harvest`,
`qron-space`, `qron-webapp`. Their contents have not been compared with the monorepo yet.

## Direction

Decided 2026-10-22 on the owner's instruction ("start launching on GitLab", option "Make GitLab the primary
home"): **GitLab is the working source of truth for `main`; GitHub is a downstream mirror.** This supersedes the
earlier "GitHub stays primary" note (BLOCKERS B-2).

How work flows now:

1. Branch and open a merge request on GitLab. Gates run on the MR: `static_checks`, `node_test_runner_coverage`,
   `secret_scan_gate`, `quality_gate`, `build_gate`.
2. Merge on GitLab. The push mirror carries protected branches to GitHub.
3. Feature branches are not protected, so they exist only on GitLab. That is expected.
4. GitHub Actions is billing-locked (BLOCKERS B-4). GitLab CI is the live CI.

Sessions cannot push to GitHub (BLOCKERS B-3). That no longer blocks shipping, because nothing has to be pushed
to GitHub by hand.

## Owner action still open

The pull mirror is still on. While it is, GitHub is also an input to GitLab `main`. With overwrite off and the
push mirror set to keep divergent refs, a direct commit to GitHub `main` should make the two diverge and stall
rather than overwrite either side. That follows from the two flags; it has not been tested. To make GitLab the
only input, disable the pull mirror (GitLab: Settings, Repository, Mirroring repositories). It is a project
setting, so no session changed it.

## Verification still owed

1. Itemise branches present on GitHub and absent on GitLab. Only protected branches are mirrored, so a difference
   in branch counts is not a defect by itself.
2. Confirm tags and the `v1.0.0-launch` tag exist on GitLab.
3. Compare the 15 sibling projects against their monorepo directories before treating any as redundant.
4. Measure how long a GitLab merge takes to reach GitHub `main`. It has not been timed.
