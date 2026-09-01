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
4. Run a workflow: `python -m agentz.cli run <workflow-name> --mode dry-run`

See `../docs/technical-reference/` for API and workflow details.
