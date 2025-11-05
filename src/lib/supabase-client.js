import { createClient } from '@supabase/supabase-js'

// Handle both Vite (import.meta.env) and Node.js (process.env) environments
const getEnvVar = (key, defaultValue) => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key] || defaultValue
  }
  return process.env[key] || defaultValue
}

// Get environment variables with validation
const supabaseUrl = getEnvVar('VITE_SUPABASE_URL', '').trim()
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY', '').trim()

// Validate that we have real values, not placeholders
if (!supabaseUrl || supabaseUrl === 'your_supabase_project_url' || !supabaseUrl.startsWith('http')) {
  throw new Error(
    '\n\n' +
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
    '❌ CONFIGURATION ERROR: Invalid Supabase URL\n' +
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
    '🔧 To fix this:\n\n' +
    '1. Create a .env.local file in the project root\n' +
    '2. Add your REAL Supabase credentials from your dashboard:\n\n' +
    '   VITE_SUPABASE_URL=https://xxxxx.supabase.co\n' +
    '   VITE_SUPABASE_ANON_KEY=eyJhbGc...\n' +
    '   VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...\n\n' +
    '📍 Get credentials from:\n' +
    '   https://supabase.com/dashboard > Your Project > Settings > API\n\n' +
    '📖 See MIGRATION_GUIDE.md for detailed setup instructions\n' +
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
  )
}

if (!supabaseAnonKey || supabaseAnonKey === 'your_supabase_anon_key' || supabaseAnonKey.length < 20) {
  throw new Error(
    '\n\n' +
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
    '❌ CONFIGURATION ERROR: Invalid Supabase Anon Key\n' +
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
    'Please set a valid VITE_SUPABASE_ANON_KEY in .env.local\n' +
    'See MIGRATION_GUIDE.md for setup instructions\n' +
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
