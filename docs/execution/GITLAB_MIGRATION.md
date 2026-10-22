# GitLab migration status

Evidence date: 2026-10-22, read through the authenticated GitLab browser session (read-only GET requests).
The only writes were commits and draft MRs on two new branches (`fix/p1-dpp-fulfill-test-cas-mock`, `fix/p1-qron-launch-checkout-gate`)
and confidential issue #2005, made through the same session; the owner approved this write path on 2026-10-22.

## Finding

The migration is already in place as a **pull mirror**. It is not a one-off copy.

| Check | Result |
| ----- | ------ |
| Namespace | `authichain-group` (16 projects, no subgroups listed) |
| Project | `authichain-group/authichain-unified`, id `87889112`, private |
| Import | `mirror: true`, `import_status: finished` |
| `main` head | GitLab `caf0f08356cd82ba8867f65f1a00c59d06150ef7` = GitHub `main` (identical) |
| Branches | GitLab 360, GitHub 364 (4-branch delta not yet itemised) |
| Protected branch | `main`: push by Maintainers and Developers + Maintainers, force-push off |
| Shared runners | enabled |
| Schedules | `AE launch checks 06:20 UTC` and `18:20 UTC`, active |

Other projects in the group: `Authichain-project`, `agent-browser`, `authichain-blog`,
`authichain-com`, `authichain-mcp-server`, `authichain-protocol`, `authichain-spec`,
`authichain-verify`, `cf-workers`, `claimpilot`, `govchain-us`, `qron`, `qron-harvest`,
`qron-space`, `qron-webapp`. Their contents have not been compared with the monorepo yet.

## Consequences

- GitHub is currently the source of truth. Anything pushed to GitLab `main` would be overwritten by
  the next mirror pull.
- Branches that exist only on GitLab (for example `fix-qron-interdiction-gate`, MR !1997) are not on
  GitHub.
- Direction decided 2026-10-22: GitHub stays primary and GitLab stays the pull mirror (BLOCKERS B-2). Making GitLab primary later means
  disabling or reversing the mirror on purpose.
- The two branches also exist on GitHub as draft PRs #1995 and #1996, opened by the owner from exported patches. The commit ids differ from
  the GitLab ones; the file contents match.

## Verification still owed

1. Itemise the 4 branches present on GitHub and absent on GitLab (and any GitLab-only branches).
2. Confirm tags and the `v1.0.0-launch` tag exist on GitLab.
3. Compare the 15 sibling projects against their monorepo directories before treating any as redundant.
4. Direction is decided (GitHub primary). Revisit when a GitHub write path exists.
