-- Aviatrix.bet Database Initialization
-- This script runs on first container creation

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create schemas for organization
CREATE SCHEMA IF NOT EXISTS game;
CREATE SCHEMA IF NOT EXISTS social;
CREATE SCHEMA IF NOT EXISTS analytics;

-- Grant permissions
GRANT ALL PRIVILEGES ON SCHEMA game TO aviatrix;
GRANT ALL PRIVILEGES ON SCHEMA social TO aviatrix;
GRANT ALL PRIVILEGES ON SCHEMA analytics TO aviatrix;

-- Log initialization
DO $$
BEGIN
  RAISE NOTICE 'Aviatrix database initialized successfully';
END $$;
