# MAXIMUS backend image (development-oriented: runs migrations then the API).
FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH=/app

WORKDIR /app

RUN addgroup --system maximus && adduser --system --ingroup maximus maximus

COPY requirements.txt ./
RUN pip install --no-cache-dir --retries 10 --resume-retries 10 -r requirements.txt

COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app

USER maximus

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=25s --retries=5 \
    CMD python -c "import urllib.request,sys; r=urllib.request.urlopen('http://127.0.0.1:8000/api/health/live', timeout=3); sys.exit(0 if r.status==200 else 1)"

# Apply versioned migrations, then start the API server.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
