import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    """Configuración base de la aplicación"""
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ECHO = True

class DevelopmentConfig(Config):
    """Configuración de desarrollo"""
    DEBUG = True
    TESTING = False
    SQLALCHEMY_DATABASE_URI = os.getenv(
        'DATABASE_URL',
        'sqlite:///foodgestor.db'
    )

class ProductionConfig(Config):
    """Configuración de producción"""
    DEBUG = False
    TESTING = False
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL')

class TestingConfig(Config):
    """Configuración de testing"""
    DEBUG = True
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'

config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}
