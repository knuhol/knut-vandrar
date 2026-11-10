.PHONY: generate-api generate-api-docker check-api translations-retranslate format-check format-fix lint test check

generate-api:
	cd backend && python3 scripts/export_openapi.py

generate-api-docker:
	@set -e; temp=frontend/src/generated/openapi.ts.tmp; \
	trap 'rm -f "$$temp"' EXIT; \
	./scripts/compose.sh exec -T backend python scripts/export_openapi.py --stdout > "$$temp"; \
	mv "$$temp" frontend/src/generated/openapi.ts; \
	trap - EXIT

check-api:
	cd backend && python3 scripts/export_openapi.py --check

translations-retranslate:
	./scripts/compose.sh exec -T backend python -m knut_vandrar_backend.translations.cli

format-check:
	cd frontend && npm run format:check
	cd backend && python3 -m ruff format --check .

format-fix:
	cd frontend && npm run format:fix
	cd backend && python3 -m ruff format .
	cd backend && python3 -m ruff check --fix .

lint:
	cd frontend && npm run lint
	cd backend && python3 -m ruff check .
	cd backend && python3 -m mypy

test:
	cd frontend && npm test --if-present
	cd backend && python3 -m pytest

check: format-check lint test check-api

.PHONY: cache-refresh
cache-refresh:
	./scripts/refresh-cache.sh
