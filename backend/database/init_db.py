#!/usr/bin/env python3
"""
Database initialization script
Run this to set up the database with ORM-based schema

This script can be run directly or through the venv wrapper scripts.
"""

import sys
import os
import logging

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from database import init_database, test_connection, create_initial_data
    from migrate import upgrade_database, stamp_database
except ImportError as e:
    print(f"Error importing database modules: {e}")
    print("Make sure you're running this from the correct directory and have installed the dependencies.")
    print("Try running: pip install sqlalchemy psycopg2-binary alembic python-dateutil")
    sys.exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


def main():
    """Main initialization function"""
    try:
        logger.info("Starting database initialization...")
        
        # Test connection first
        if not test_connection():
            logger.error("Database connection failed. Please check your database configuration.")
            sys.exit(1)
        
        # Run Alembic migrations
        logger.info("Running Alembic migrations...")
        if not upgrade_database("head"):
            logger.error("Failed to run Alembic migrations")
            sys.exit(1)
        
        # Create initial data
        logger.info("Creating initial data...")
        create_initial_data()
        
        logger.info("Database initialization completed successfully!")
        
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
