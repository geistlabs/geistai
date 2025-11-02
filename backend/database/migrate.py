#!/usr/bin/env python3
"""
Database migration management script
Handles Alembic migrations for the database
"""

import os
import sys
import subprocess
import logging
from pathlib import Path
from dotenv import load_dotenv

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


def run_alembic_command(command: str, *args):
    """Run an alembic command with proper environment setup"""
    try:
        # Get the directory where this config.py file is located
        env_file = Path(__file__).parent
        # Go up one directory to find the .env file
        env_file = env_file.parent / ".env"
        print(f"Loading .env file from: {env_file}")
        if env_file.exists():
            load_dotenv(env_file)
            print(f"Loaded environment variables from: {env_file}")
        else:
            print(f"No .env file found at: {env_file}")
    except ImportError:
        print("python-dotenv not installed, skipping .env file loading")
    try:
        # Set environment variables
        env = os.environ.copy()
        env['DATABASE_URL'] = os.getenv(
            'DATABASE_URL', 
            'postgresql://postgres:password@localhost:5433/test-storage'
        )
        print(f"Using DATABASE_URL: {env['DATABASE_URL']}")
        # Change to the database directory
        db_dir = Path(__file__).parent
        os.chdir(db_dir)
        
        # Run the alembic command
        cmd = ['alembic'] + command.split() + list(args)
        logger.info(f"Running: {' '.join(cmd)}")
        
        result = subprocess.run(cmd, env=env, capture_output=True, text=True, )
        
        if result.stdout:
            print(result.stdout)
        if result.stderr:
            print(result.stderr)
            
        if result.returncode != 0:
            logger.error(f"Alembic command failed with return code {result.returncode}")
            return False
            
        return True
        
    except Exception as e:
        logger.error(f"Error running alembic command: {e}")
        return False


def init_alembic():
    """Initialize Alembic for the project"""
    logger.info("Initializing Alembic...")
    return run_alembic_command("init migrations")


def create_migration(message: str):
    """Create a new migration"""
    logger.info(f"Creating migration: {message}")
    return run_alembic_command("revision --autogenerate", "-m", message)


def upgrade_database(revision: str = "head"):
    """Upgrade database to a specific revision"""
    logger.info(f"Upgrading database to revision: {revision}")
    return run_alembic_command("upgrade", revision)


def downgrade_database(revision: str):
    """Downgrade database to a specific revision"""
    logger.info(f"Downgrading database to revision: {revision}")
    return run_alembic_command("downgrade", revision)


def show_current_revision():
    """Show current database revision"""
    logger.info("Showing current database revision...")
    return run_alembic_command("current")


def show_migration_history():
    """Show migration history"""
    logger.info("Showing migration history...")
    return run_alembic_command("history")


def stamp_database(revision: str = "head"):
    """Stamp database with a specific revision without running migrations"""
    logger.info(f"Stamping database with revision: {revision}")
    return run_alembic_command("stamp", revision)


def main():
    """Main migration management function"""
    if len(sys.argv) < 2:
        print("Usage: python migrate.py <command> [args...]")
        print("\nAvailable commands:")
        print("  init                    - Initialize Alembic")
        print("  create <message>        - Create a new migration")
        print("  upgrade [revision]      - Upgrade database (default: head)")
        print("  downgrade <revision>    - Downgrade database")
        print("  current                 - Show current revision")
        print("  history                 - Show migration history")
        print("  stamp [revision]        - Stamp database (default: head)")
        print("\nExamples:")
        print("  python migrate.py create 'Add user preferences table'")
        print("  python migrate.py upgrade")
        print("  python migrate.py downgrade 0001")
        print("  python migrate.py current")
        return
    
    command = sys.argv[1].lower()
    
    if command == "init":
        success = init_alembic()
    elif command == "create":
        if len(sys.argv) < 3:
            print("Error: Migration message required")
            print("Usage: python migrate.py create 'Your migration message'")
            return
        message = sys.argv[2]
        success = create_migration(message)
    elif command == "upgrade":
        revision = sys.argv[2] if len(sys.argv) > 2 else "head"
        success = upgrade_database(revision)
    elif command == "downgrade":
        if len(sys.argv) < 3:
            print("Error: Target revision required")
            print("Usage: python migrate.py downgrade <revision>")
            return
        revision = sys.argv[2]
        success = downgrade_database(revision)
    elif command == "current":
        success = show_current_revision()
    elif command == "history":
        success = show_migration_history()
    elif command == "stamp":
        revision = sys.argv[2] if len(sys.argv) > 2 else "head"
        success = stamp_database(revision)
    else:
        print(f"Unknown command: {command}")
        return
    
    if success:
        logger.info("Command completed successfully")
    else:
        logger.error("Command failed")
        sys.exit(1)


if __name__ == "__main__":
    main()


