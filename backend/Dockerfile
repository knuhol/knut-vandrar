ARG PYTHON_VERSION
FROM python:${PYTHON_VERSION}-slim AS base
COPY --from=ghcr.io/astral-sh/uv:0.13.7 /uv /usr/local/bin/uv
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
COPY backend/requirements.txt backend/constraints.txt backend/pyproject.toml ./
RUN python -m pip install --no-cache-dir -r requirements.txt
FROM base AS development
ARG API_PORT
COPY backend/ .
EXPOSE ${API_PORT}
CMD ["sh", "-c", "uvicorn src.main:app --host ${API_HOST} --port ${API_PORT} --reload"]
