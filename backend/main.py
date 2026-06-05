import os
from dotenv import load_dotenv

basedir = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(basedir, '.env'))

from app import create_app

app = create_app()

if __name__ == '__main__':
    app.run(debug=False, port=5000, host='127.0.0.1')
