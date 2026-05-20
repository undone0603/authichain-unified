# Security Policy

We take the security of this project and its users seriously. This policy describes how to report security vulnerabilities and what to expect after submitting a report.

## Reporting a Vulnerability

If you believe you have found a security vulnerability in this project, please do **not** open a public issue or discuss it in public forums. Instead, use **GitHub's private vulnerability reporting**:

1. Go to the repository's [Security Advisories tab](https://github.com/undone0603/authichain-unified/security/advisories/new) and click **"Report a vulnerability"**.
2. Include as much detail as possible: steps to reproduce, potential impact, affected versions, and any suggestions for remediation.
3. We will acknowledge receipt within 72 hours. After triage, we will work with you to resolve the issue and release a fix.
4. Please allow reasonable time to investigate and patch the vulnerability before any public disclosure.

We value the efforts of the security community and will credit researchers who responsibly disclose vulnerabilities (unless anonymity is requested).

## Scope

This policy covers all code in this repository and the services it powers. Vulnerabilities in third-party dependencies should be reported upstream to those projects (we monitor them via Dependabot and patch on release).

## Supported Versions

Security fixes are provided only for the latest version of the project on `main`. Users running older versions are encouraged to upgrade.

| Version | Supported |
|---------|-----------|
| `main` (latest) | ✅ |
| older versions | ❌ |

## Security Practices

- **Dependency Updates**: Dependabot monitors and opens PRs for vulnerable packages; patch-level bumps auto-merge after CI.
- **Secret Scanning**: A scheduled gitleaks workflow scans every push to `main` and all human PRs.
- **Secret Management**: Secrets live in GitHub Actions secrets and Cloudflare Worker secret bindings — never in source.
- **Least Privilege**: Workflows run with `permissions: contents: read` by default; broader scopes are opt-in per job.
- **Static Type-Checking**: `tsc --noEmit` runs on every PR; type-unsafe patterns are caught before merge.
