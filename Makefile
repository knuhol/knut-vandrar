.PHONY: format-check format-fix lint test check

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

test:
	cd frontend && npm test --if-present
	cd backend && python3 -m pytest

check: format-check lint test
