"""
Database connection and session management
"""

import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from contextlib import contextmanager
from typing import Generator
import logging

from .models import Base

logger = logging.getLogger(__name__)

# Database configuration
DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://postgres:password@localhost:5433/test-storage"
)

# Create engine
engine = create_engine(
    DATABASE_URL,
    poolclass=StaticPool,
    pool_pre_ping=True,
    echo=os.getenv("DB_ECHO", "false").lower() == "true"
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def create_tables():
    """Create all database tables"""
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created successfully")
    except Exception as e:
        logger.error(f"Error creating database tables: {e}")
        raise


def drop_tables():
    """Drop all database tables"""
    try:
        Base.metadata.drop_all(bind=engine)
        logger.info("Database tables dropped successfully")
    except Exception as e:
        logger.error(f"Error dropping database tables: {e}")
        raise


@contextmanager
def get_db_session() -> Generator[Session, None, None]:
    """
    Context manager for database sessions
    Usage:
        with get_db_session() as db:
            user = db.query(User).first()
    """
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Database session error: {e}")
        raise
    finally:
        db.close()


def get_db() -> Generator[Session, None, None]:
    """
    Dependency for FastAPI to get database session
    Usage in FastAPI endpoints:
        def endpoint(db: Session = Depends(get_db)):
            user = db.query(User).first()
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_database():
    """Initialize database with tables and default data"""
    try:
        # Create tables
        create_tables()
        
        # Add any default data here
        with get_db_session() as db:
            # Example: Create default system config
            from .models import SystemConfig
            
            # Check if config already exists
            existing_config = db.query(SystemConfig).filter(
                SystemConfig.key == "app_version"
            ).first()
            
            if not existing_config:
                default_config = SystemConfig(
                    key="app_version",
                    value={"version": "1.0.0"},
                    description="Application version"
                )
                db.add(default_config)
                logger.info("Default system configuration created")
        
        logger.info("Database initialized successfully")
        
    except Exception as e:
        logger.error(f"Error initializing database: {e}")
        raise


def test_connection():
    """Test database connection"""
    try:
        with get_db_session() as db:
            db.execute(text("SELECT 1"))
        logger.info("Database connection test successful")
        return True
    except Exception as e:
        logger.error(f"Database connection test failed: {e}")
        return False


def create_initial_data():
    """Create initial data for the application"""
    try:
        with get_db_session() as db:
            # No initial data needed for the simple schema
            logger.info("Initial data creation completed (no data needed)")
            
    except Exception as e:
        logger.error(f"Error creating initial data: {e}")
        raise
