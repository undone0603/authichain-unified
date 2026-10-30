"""Vercel Daemon entrypoint for a fail-closed AgentZ workflow.

Only the registry's documented dry-run-safe GovChain proposal workflow is
scheduled here. Do not expand this allowlist without reviewing each handler
for external side effects and human-approval requirements.
"""
from __future__ import annotations

import logging
import os
import signal
import subprocess
import sys
import time

POLL_SECONDS = max(300, int(os.getenv("AGENTZ_DAEMON_POLL_SECONDS", "900")))
SAFE_WORKFLOW = "govchain_grant_proposal"
STOP = False


def _stop(_signum: int, _frame: object) -> None:
    global STOP
    STOP = True


def main() -> int:
    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)s agentz-daemon %(message)s",
    )
    signal.signal(signal.SIGTERM, _stop)
    signal.signal(signal.SIGINT, _stop)

    logging.info(
        "AgentZ daemon starting; workflow=%s; mode=dry-run; poll_seconds=%s; "
        "production_send=false; human approval gates remain enabled",
        SAFE_WORKFLOW,
        POLL_SECONDS,
    )

    while not STOP:
        try:
            # The registry describes this workflow's dry-run as local proposal
            # drafting only; it skips the pipeline ledger and external submit.
            # Never dispatch the entire registry from an always-on daemon:
            # other handlers may contact CRM, payment, or messaging APIs.
            result = subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "agentz.cli",
                    "run",
                    SAFE_WORKFLOW,
                    "--mode",
                    "dry-run",
                ],
                check=False,
                timeout=600,
            )
            if result.returncode == 0:
                logging.info("AgentZ safe workflow dry-run completed")
            else:
                logging.error(
                    "AgentZ safe workflow dry-run exited with code %s",
                    result.returncode,
                )
        except subprocess.TimeoutExpired:
            logging.error("AgentZ dry-run evaluation timed out after 600 seconds")
        except Exception:
            logging.exception("AgentZ dry-run evaluation failed")

        deadline = time.monotonic() + POLL_SECONDS
        while not STOP and time.monotonic() < deadline:
            time.sleep(min(1, deadline - time.monotonic()))

    logging.info("AgentZ daemon received shutdown signal; exiting cleanly")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
