"""Daemon entrypoint for fail-closed AgentZ workflows.

The original GovChain proposal remains dry-run-only. Optional TinyFish A2A
research is restricted to a public read-only search, a host-bound API key,
and an explicit enable flag; outreach and payment workflows stay disabled.
"""
from __future__ import annotations

import logging
import os
import signal
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

POLL_SECONDS = max(300, int(os.getenv("AGENTZ_DAEMON_POLL_SECONDS", "900")))
SAFE_WORKFLOW = "govchain_grant_proposal"
SCOUT_WORKFLOW = "tinyfish_a2a_scout"
STOP = False


def _stop(_signum: int, _frame: object) -> None:
    global STOP
    STOP = True


def _claim_daily_scout_slot() -> bool:
    """Claim one UTC-day slot on a pre-existing host-managed persistent volume.

    This claim is written BEFORE the network request. A crash or failed call
    still consumes the day's slot, so restarts never multiply requests.
    The owner must explicitly provision an absolute durable state directory;
    ephemeral storage cannot establish cross-restart rate limiting.
    """
    raw = os.getenv("AGENTZ_TINYFISH_SCOUT_STATE_DIR", "").strip()
    if not raw:
        logging.error("TinyFish scout disabled: persistent state directory is unset")
        return False
    path = Path(raw)
    if not path.is_absolute() or path.is_symlink() or not path.is_dir():
        logging.error("TinyFish scout disabled: state directory must exist on an absolute persistent volume")
        return False
    marker = path / ("tinyfish-a2a-scout-" + datetime.now(timezone.utc).strftime("%Y%m%d") + ".claimed")
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    try:
        fd = os.open(marker, flags, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as record:
            record.write(datetime.now(timezone.utc).isoformat() + "\\n")
            record.flush()
            os.fsync(record.fileno())
        return True
    except FileExistsError:
        return False
    except OSError:
        logging.exception("TinyFish scout disabled: could not durably claim daily slot")
        return False


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

        # Opt-in to read-only public research. No secret -> no interactive OAuth.
        if (
            os.getenv("AGENTZ_TINYFISH_SCOUT_ENABLED", "").lower() == "true"
            and os.getenv("TINYFISH_API_KEY", "").strip()
            and _claim_daily_scout_slot()
        ):
            try:
                scout = subprocess.run(
                    [
                        sys.executable, "-m", "agentz.cli", "run",
                        SCOUT_WORKFLOW, "--mode", "confirm",
                    ],
                    check=False,
                    timeout=120,
                    capture_output=True,
                    text=True,
                )
                # Raw source content is untrusted and must not enter daemon logs.
                logging.info(
                    "TinyFish read-only scout completed; exit_code=%d",
                    scout.returncode,
                )
            except subprocess.TimeoutExpired:
                logging.error("TinyFish scout timed out")
            except Exception:
                logging.exception("TinyFish scout failed")

        deadline = time.monotonic() + POLL_SECONDS
        while not STOP and time.monotonic() < deadline:
            time.sleep(min(1, deadline - time.monotonic()))

    logging.info("AgentZ daemon received shutdown signal; exiting cleanly")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
