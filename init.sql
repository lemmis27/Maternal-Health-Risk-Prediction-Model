-- Initialize PostgreSQL database for Maternal Health System
-- This script runs when the PostgreSQL container starts for the first time

-- Create database if it doesn't exist (handled by POSTGRES_DB env var)
-- CREATE DATABASE IF NOT EXISTS maternal_health;

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Set timezone
SET timezone = 'UTC';

-- Create indexes for better performance (these will be created by SQLAlchemy migrations)
-- But we can prepare the database with some initial settings

-- Log the initialization
DO $$
BEGIN
    RAISE NOTICE 'Maternal Health Database initialized successfully';
END $$;