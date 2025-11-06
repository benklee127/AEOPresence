// Direct Supabase entity exports
import { createEntity } from '../lib/supabase-entities';
import { auth } from '../lib/auth';

// Create entity helpers for each table
export const QueryProject = createEntity('query_projects');
export const Query = createEntity('queries');
export const Folder = createEntity('folders');
export const User = createEntity('users', true); // Use service role for user operations

// Export auth helper
export { auth };