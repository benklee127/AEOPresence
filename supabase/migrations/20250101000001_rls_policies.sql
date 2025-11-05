-- AEO Presence Row Level Security Policies
-- Security policies for all tables

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE query_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE queries ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- USERS TABLE POLICIES
-- ============================================================================

-- Users can view their own profile
CREATE POLICY "Users can view their own profile" ON users
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE
  USING (auth.uid() = id);

-- Admins can view all users
CREATE POLICY "Admins can view all users" ON users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can update any user
CREATE POLICY "Admins can update any user" ON users
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can delete users
CREATE POLICY "Admins can delete users" ON users
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- FOLDERS TABLE POLICIES
-- ============================================================================
-- Note: For now, folders are public to all authenticated users
-- In the future, you can add user_id to folders table for ownership

-- Authenticated users can view all folders
CREATE POLICY "Authenticated users can view folders" ON folders
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Authenticated users can create folders
CREATE POLICY "Authenticated users can create folders" ON folders
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Authenticated users can update folders
CREATE POLICY "Authenticated users can update folders" ON folders
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Authenticated users can delete folders
CREATE POLICY "Authenticated users can delete folders" ON folders
  FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ============================================================================
-- QUERY_PROJECTS TABLE POLICIES
-- ============================================================================
-- Note: For now, projects are public to all authenticated users
-- In the future, you can add user_id to query_projects table for ownership

-- Authenticated users can view all projects
CREATE POLICY "Authenticated users can view projects" ON query_projects
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Authenticated users can create projects
CREATE POLICY "Authenticated users can create projects" ON query_projects
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Authenticated users can update projects
CREATE POLICY "Authenticated users can update projects" ON query_projects
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Authenticated users can delete projects
CREATE POLICY "Authenticated users can delete projects" ON query_projects
  FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ============================================================================
-- QUERIES TABLE POLICIES
-- ============================================================================
-- Queries inherit access from their parent project

-- Authenticated users can view queries
CREATE POLICY "Authenticated users can view queries" ON queries
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
  );

-- Authenticated users can create queries
CREATE POLICY "Authenticated users can create queries" ON queries
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
  );

-- Authenticated users can update queries
CREATE POLICY "Authenticated users can update queries" ON queries
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
  );

-- Authenticated users can delete queries
CREATE POLICY "Authenticated users can delete queries" ON queries
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL
  );

-- ============================================================================
-- HELPER FUNCTIONS FOR RLS
-- ============================================================================

-- Function to check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON POLICY "Users can view their own profile" ON users IS
  'Users can view their own profile data';

COMMENT ON POLICY "Admins can view all users" ON users IS
  'Admin users can view all user profiles';

COMMENT ON POLICY "Authenticated users can view projects" ON query_projects IS
  'All authenticated users can view projects. Add user_id column for per-user ownership';

COMMENT ON POLICY "Authenticated users can view queries" ON queries IS
  'All authenticated users can view queries. Access control inherited from project';
