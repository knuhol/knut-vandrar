FROM python:3.12-slim AS base
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY requirements.txt pyproject.toml ./
RUN pip install --no-cache-dir -r requirements.txt

FROM base AS development
ARG API_PORT
COPY . .
EXPOSE ${API_PORT}
CMD ["sh", "-c", "uvicorn src.main:app --host ${API_HOST} --port ${API_PORT} --reload"]
