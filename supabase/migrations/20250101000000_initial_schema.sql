-- AEO Presence Database Schema Migration
-- Initial schema for migrating from Base44 to Supabase

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USERS TABLE
-- ============================================================================
CREATE TABLE users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- User information
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  email_verified BOOLEAN DEFAULT FALSE,

  -- Role-based access control
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- FOLDERS TABLE
-- ============================================================================
CREATE TABLE folders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Folder information
  name TEXT NOT NULL,
  color TEXT,
  description TEXT,

  -- Owner reference (optional - can be added for multi-user support)
  -- user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  CONSTRAINT folders_name_check CHECK (char_length(name) > 0)
);

-- ============================================================================
-- QUERY_PROJECTS TABLE
-- ============================================================================
CREATE TABLE query_projects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Project information
  name TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (
    status IN ('draft', 'generating', 'queries_generated', 'analysis_complete', 'archived')
  ),
  current_step INTEGER DEFAULT 1 CHECK (current_step IN (1, 2, 3)),

  -- Configuration
  company_url TEXT,
  company_logo_url TEXT,
  competitor_urls TEXT[], -- Array of competitor URLs
  audience TEXT[], -- Array of audience types
  themes TEXT, -- Focus areas/topics
  query_mix_type TEXT DEFAULT 'Mixed',
  educational_ratio INTEGER DEFAULT 50 CHECK (educational_ratio >= 0 AND educational_ratio <= 100),
  service_ratio INTEGER DEFAULT 50 CHECK (service_ratio >= 0 AND service_ratio <= 100),

  -- Metrics
  total_queries INTEGER DEFAULT 0,

  -- Manual queries
  manual_queries TEXT[], -- Array of manually entered queries

  -- Organization
  folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,

  -- Owner reference (optional - can be added for multi-user support)
  -- user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  CONSTRAINT query_projects_name_check CHECK (char_length(name) > 0)
);

-- ============================================================================
-- QUERIES TABLE
-- ============================================================================
CREATE TABLE queries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Query information
  project_id UUID NOT NULL REFERENCES query_projects(id) ON DELETE CASCADE,
  query_id INTEGER, -- Sequential ID within project
  query_text TEXT NOT NULL,

  -- Query classification
  query_type TEXT CHECK (query_type IN ('Educational', 'Service-Aligned')),
  query_category TEXT CHECK (query_category IN (
    'Industry monitoring',
    'Competitor benchmarking',
    'Operational training',
    'Foundational understanding',
    'Real-world learning examples',
    'Educational — people-focused',
    'Trend explanation',
    'Pain-point focused — commercial intent',
    'Product or vendor-related — lead intent',
    'Decision-stage — ready to buy or engage'
  )),
  query_format TEXT CHECK (query_format IN ('Natural-language questions', 'Keyword phrases')),
  target_audience TEXT,

  -- Analysis results
  analysis_status TEXT DEFAULT 'pending' CHECK (
    analysis_status IN ('pending', 'analyzing', 'complete', 'error')
  ),
  brand_mentions TEXT, -- Comma-separated brand names
  source TEXT, -- Where the query appears

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  CONSTRAINT queries_query_text_check CHECK (char_length(query_text) > 0),

  -- Ensure unique query_id per project
  UNIQUE (project_id, query_id)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Users indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Folders indexes
CREATE INDEX idx_folders_created_at ON folders(created_at DESC);

-- Query Projects indexes
CREATE INDEX idx_query_projects_created_at ON query_projects(created_at DESC);
CREATE INDEX idx_query_projects_status ON query_projects(status);
CREATE INDEX idx_query_projects_folder_id ON query_projects(folder_id);
CREATE INDEX idx_query_projects_current_step ON query_projects(current_step);

-- Queries indexes
CREATE INDEX idx_queries_project_id ON queries(project_id);
CREATE INDEX idx_queries_analysis_status ON queries(analysis_status);
CREATE INDEX idx_queries_query_type ON queries(query_type);
CREATE INDEX idx_queries_query_category ON queries(query_category);
CREATE INDEX idx_queries_created_at ON queries(created_at);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT TIMESTAMP
-- ============================================================================

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to all tables
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_folders_updated_at
  BEFORE UPDATE ON folders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_query_projects_updated_at
  BEFORE UPDATE ON query_projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_queries_updated_at
  BEFORE UPDATE ON queries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE users IS 'User accounts and authentication data';
COMMENT ON TABLE folders IS 'Project organization folders';
COMMENT ON TABLE query_projects IS 'AEO query generation projects';
COMMENT ON TABLE queries IS 'Individual queries within projects';

COMMENT ON COLUMN query_projects.status IS 'Project workflow status: draft -> generating -> queries_generated -> analysis_complete -> archived';
COMMENT ON COLUMN query_projects.current_step IS 'Current step in the 3-step workflow (1=Generate, 2=Analyze, 3=View Results)';
COMMENT ON COLUMN queries.analysis_status IS 'Query analysis status: pending -> analyzing -> complete or error';
