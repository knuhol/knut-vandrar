.PHONY: generate-api generate-api-docker check-api translations-retranslate format-check format-fix lint test check

BACKEND_PYTHON ?= .venv/bin/python

generate-api:
	cd backend && $(BACKEND_PYTHON) scripts/export_openapi.py

generate-api-docker:
	@set -e; temp=frontend/src/generated/openapi.ts.tmp; \
	trap 'rm -f "$$temp"' EXIT; \
	./scripts/compose.sh exec -T backend python scripts/export_openapi.py --stdout > "$$temp"; \
	mv "$$temp" frontend/src/generated/openapi.ts; \
	trap - EXIT

check-api:
	cd backend && $(BACKEND_PYTHON) scripts/export_openapi.py --check

translations-retranslate:
	./scripts/compose.sh exec -T backend python -m knut_vandrar_backend.translations.cli

format-check:
	cd frontend && npm run format:check
	cd backend && $(BACKEND_PYTHON) -m ruff format --check .

format-fix:
	cd frontend && npm run format:fix
	cd backend && $(BACKEND_PYTHON) -m ruff format .
	cd backend && $(BACKEND_PYTHON) -m ruff check --fix .

lint:
	cd frontend && npm run lint
	cd backend && $(BACKEND_PYTHON) -m ruff check .
	cd backend && $(BACKEND_PYTHON) -m mypy

test:
	cd frontend && npm test --if-present
	cd backend && $(BACKEND_PYTHON) -m pytest

check: format-check lint test check-api
