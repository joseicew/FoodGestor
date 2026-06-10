#!/bin/bash
set -e

exec gunicorn \
    --pythonpath /app/backend \
    --bind 0.0.0.0:${PORT:-8000} \
    --workers 1 \
    --timeout 60 \
    main:app
