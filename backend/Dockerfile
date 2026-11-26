ARG PYTHON_VERSION
FROM python:${PYTHON_VERSION}-slim AS base
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN apt-get update && apt-get install -y --no-install-recommends tzdata && rm -rf /var/lib/apt/lists/*
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH" PYTHONPATH="/app/src"
COPY maps/config.json maps/vandrar.json /maps/
COPY frontend/src/styles/tokens.css /frontend/src/styles/tokens.css
COPY backend/requirements.txt backend/constraints.txt backend/pyproject.toml ./
RUN python -m pip install --no-cache-dir -r requirements.txt

FROM base AS development
ARG API_PORT
ARG API_HOST
COPY backend/ .
EXPOSE ${API_PORT}
CMD ["sh", "-c", "alembic -c alembic.ini upgrade head && uvicorn knut_vandrar_backend.main:app --host ${API_HOST} --port ${API_PORT} --reload"]

FROM base AS production
ARG API_PORT
ARG API_HOST
COPY backend/ .
EXPOSE ${API_PORT}
CMD ["sh", "-c", "alembic -c alembic.ini upgrade head && uvicorn knut_vandrar_backend.main:app --host ${API_HOST} --port ${API_PORT} --proxy-headers --forwarded-allow-ips=*"]
