"""Only deliberately requested jobs may incur provider costs."""

EXPLICIT_REASONS = frozenset({"needs_retranslation", "explicit_request"})
