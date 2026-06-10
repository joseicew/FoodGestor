import logging
import sys

bind = "0.0.0.0:8000"
workers = 1
worker_class = "sync"
timeout = 60
access_log = "-"
error_log = "-"
loglevel = "debug"

# Log to stdout/stderr para que Railway vea los logs
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.DEBUG,
    stream=sys.stdout
)
