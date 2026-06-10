#!/bin/bash
set -e

cd /app/backend
exec gunicorn \
    --bind 0.0.0.0:${PORT:-8000} \
    --workers 1 \
    --timeout 60 \
    main:app
