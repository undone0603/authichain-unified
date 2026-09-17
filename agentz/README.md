# AgentZ: AuthiChain Autonomous Launch

The `agentz/` directory contains the control-plane layer for autonomous operational workflows.

## Core Features

- **Workflow Registry**: Centralized declaration of operational tasks.
- **Operational Modes**: `dry-run`, `confirm`, `auto`.
- **Dependency Resolution**: Automated task ordering.
- **Audit Logging**: Comprehensive run history.

## Getting Started

1. Set up Python environment: `pip install -r requirements-agentz.txt`
2. Configure environment variables.
3. List workflows: `python -m agentz.cli list`
4. Credential inventory (names, status, length — never values): `python -m agentz.cli creds --critical`
5. Run a workflow by **registry id**: `python -m agentz.cli run launch_governor --mode dry-run`

`run` defaults to `--mode confirm` and goes through the registry runner (credential preflight + audit log). `run --all --mode auto` is refused.

See `../docs/launch-governor.md` and `../docs/technical-reference/` for API and workflow details.
