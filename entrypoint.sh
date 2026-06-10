#!/bin/bash
set -e

exec gunicorn \
    --pythonpath /app \
    --bind 0.0.0.0:${PORT:-8000} \
    --workers 1 \
    --timeout 60 \
    backend.main:app
