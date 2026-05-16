"""Allow `python -m agentz` as an alias for `python -m agentz.cli`."""

from .cli import main
import sys

sys.exit(main())
