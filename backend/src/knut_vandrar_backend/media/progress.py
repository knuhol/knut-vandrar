"""Optional, throttled progress reporting shared by media transfer stages."""

from collections.abc import Callable
from time import monotonic


class Progress:
    def __init__(self, write: Callable[[str], None] | None = None) -> None:
        self.write = write
        self.last_update = float("-inf")

    def report(self, message: str, *, force: bool = True) -> None:
        if self.write is None:
            return
        now = monotonic()
        if force or now - self.last_update >= 1:
            self.write(message)
            self.last_update = now
