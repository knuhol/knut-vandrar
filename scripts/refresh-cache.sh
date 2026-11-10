#!/usr/bin/env bash
set -euo pipefail
./scripts/compose.sh exec -T backend python - <<'PY'
from urllib.request import Request, urlopen
from knut_vandrar_backend.settings import settings
if not settings.frontend_revalidation_url or not settings.cache_revalidation_secret:
    raise SystemExit('Configure FRONTEND_REVALIDATION_URL and CACHE_REVALIDATION_SECRET first.')
request = Request(settings.frontend_revalidation_url, data=b'{}', headers={'Authorization': f'Bearer {settings.cache_revalidation_secret}'}, method='POST')
with urlopen(request, timeout=10) as response:
    print('Frontend content cache refreshed.' if response.status == 200 else 'Cache refresh failed.')
PY
