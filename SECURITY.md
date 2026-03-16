# Security Policy

We take the security of this project and its users seriously. This policy describes how to report security vulnerabilities and what to expect after submitting a report.

## Reporting a Vulnerability

If you believe you have found a security vulnerability in this project, please do **not** open a public issue or discuss it in public forums. Instead:

1. **Privately disclose the issue** by opening a new GitHub issue and applying the `security` label, or by contacting the maintainers directly through the channels listed in this repository.
2. Include as much detail as possible in your report, including steps to reproduce the issue, potential impact, and any suggestions for remediation.
3. We will acknowledge receipt of your report within 72 hours. After triage, we will work with you to resolve the issue as quickly as possible and release a fix.
4. Please allow us a reasonable time to investigate and patch the vulnerability before any public disclosure.

We value the efforts of the security community and will credit researchers who responsibly disclose vulnerabilities (unless anonymity is requested).

## Scope

This policy covers all code in this repository and the services that it powers. Vulnerabilities in third‑party dependencies should be reported upstream to those projects.

## Supported Versions

Security fixes are provided only for the latest version of the project. Users running older versions are encouraged to upgrade to receive patches and improvements.

| Version | Supported |
|---------|-----------|
| main (latest) | ✅ |
| older versions | ❌ |

## Security Practices

- **Dependency Updates**: Automated tools such as Dependabot are enabled to monitor and upgrade vulnerable packages.
- **Static & Secret Analysis**: Continuous integration workflows include static analysis (CodeQL) and secret scanning (Gitleaks) to detect vulnerabilities early.
- **Secret Management**: Secrets and credentials are managed securely through environment variables and external secret stores; they are never committed to the repository.
- **Least Privilege**: Only the minimal permissions necessary are used for access tokens in CI/CD pipelines.

## Contact

If you have any questions about this policy, please contact the project maintainers through GitHub issues. Thank you for helping keep the project and its users safe.
