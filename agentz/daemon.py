"""Vercel Daemon entrypoint for safe AgentZ workflow evaluation.

The daemon deliberately runs only in dry-run mode. It does not send outbound
messages, perform live sales actions, or override the repository's human gates.
"""
from __future__ import annotations

import logging
import os
import signal
import subprocess
import sys
import time

POLL_SECONDS = max(300, int(os.getenv("AGENTZ_DAEMON_POLL_SECONDS", "900")))
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
        "AgentZ daemon starting; mode=dry-run; poll_seconds=%s; "
        "production_send=false; human approval gates remain enabled",
        POLL_SECONDS,
    )

    while not STOP:
        try:
            # The CLI itself rejects --all with --mode auto. Keep this worker
            # explicitly dry-run so it cannot bypass humanHold or send gates.
            result = subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "agentz.cli",
                    "run",
                    "--all",
                    "--mode",
                    "dry-run",
                ],
                check=False,
                timeout=600,
            )
            if result.returncode == 0:
                logging.info("AgentZ dry-run evaluation completed")
            else:
                logging.error(
                    "AgentZ dry-run evaluation exited with code %s",
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
