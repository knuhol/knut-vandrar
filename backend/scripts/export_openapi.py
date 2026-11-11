"""Export FastAPI's OpenAPI document as a feTS-compatible TypeScript constant."""

import argparse
import importlib
import json
import math
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
BACKEND_SOURCE = BACKEND_ROOT / "src"
REPOSITORY_ROOT = BACKEND_ROOT.parent
DEFAULT_OUTPUT = REPOSITORY_ROOT / "frontend" / "src" / "generated" / "openapi.ts"

sys.path.insert(0, str(BACKEND_SOURCE))


def generated_schema() -> str:
    app = importlib.import_module("knut_vandrar_backend.main").app
    schema = _normalize_numbers(app.openapi())
    serialized_schema = json.dumps(schema, ensure_ascii=False, indent=2)
    return (
        "/* Generated from FastAPI by backend/scripts/export_openapi.py. */\n"
        f"export const openapi = {serialized_schema} as const\n"
    )


def _normalize_numbers(value: object) -> object:
    """Serialize integral JSON numbers as integers for stable generated TypeScript."""
    if isinstance(value, dict):
        normalized = {
            key: _normalize_numbers(item) for key, item in value.items() if key != "const"
        }
        # feTS understands singleton enums; OpenAPI 3.1 const is equivalent.
        if "const" in value:
            normalized["enum"] = [_normalize_numbers(value["const"])]
        return normalized
    if isinstance(value, list):
        return [_normalize_numbers(item) for item in value]
    if isinstance(value, float) and math.isfinite(value) and value.is_integer():
        return int(value)
    return value


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="TypeScript output path (default: frontend/src/generated/openapi.ts)",
    )
    parser.add_argument(
        "--stdout",
        action="store_true",
        help="Write the generated TypeScript to stdout instead of a file",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Exit nonzero if the output file is missing or out of date",
    )
    args = parser.parse_args()
    content = generated_schema()

    if args.stdout:
        if args.check:
            parser.error("--stdout and --check cannot be used together")
        sys.stdout.write(content)
        return 0

    output_path = args.output.resolve()
    if args.check:
        if not output_path.is_file() or output_path.read_text(encoding="utf-8") != content:
            print(f"Generated OpenAPI client schema is stale: {output_path}", file=sys.stderr)
            return 1
        print(f"Generated OpenAPI client schema is up to date: {output_path}")
        return 0

    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.is_file() and output_path.read_text(encoding="utf-8") == content:
        print(f"Generated OpenAPI client schema is already up to date: {output_path}")
        return 0

    output_path.write_text(content, encoding="utf-8", newline="\n")
    print(f"Generated OpenAPI client schema: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
