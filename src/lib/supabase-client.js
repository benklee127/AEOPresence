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
    '❌ SUPABASE CONNECTION ERROR\n' +
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
    '📁 File: src/lib/supabase-client.js\n' +
    '🔴 Issue: Invalid or missing VITE_SUPABASE_URL\n' +
    '📊 Current value: "' + (supabaseUrl || '(empty)') + '"\n\n' +
    '💡 Likely causes:\n' +
    '   • .env.local file is missing or not in project root\n' +
    '   • VITE_SUPABASE_URL is not set or has placeholder value\n' +
    '   • Environment variable missing VITE_ prefix (required for Vite)\n' +
    '   • Dev server needs restart after adding .env.local\n\n' +
    '🔧 How to fix:\n\n' +
    '1. Create .env.local in project root (same directory as package.json)\n' +
    '2. Add your Supabase credentials:\n\n' +
    '   VITE_SUPABASE_URL=https://xxxxx.supabase.co\n' +
    '   VITE_SUPABASE_ANON_KEY=eyJhbGc...\n' +
    '   VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...\n\n' +
    '3. Restart your dev server (npm run dev)\n\n' +
    '📍 Get credentials from:\n' +
    '   https://supabase.com/dashboard → Your Project → Settings → API\n\n' +
    '📖 See MIGRATION_GUIDE.md for detailed setup instructions\n' +
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
  )
}

if (!supabaseAnonKey || supabaseAnonKey === 'your_supabase_anon_key' || supabaseAnonKey.length < 20) {
  throw new Error(
    '\n\n' +
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
    '❌ SUPABASE CONNECTION ERROR\n' +
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
    '📁 File: src/lib/supabase-client.js\n' +
    '🔴 Issue: Invalid or missing VITE_SUPABASE_ANON_KEY\n' +
    '📊 Key length: ' + (supabaseAnonKey ? supabaseAnonKey.length + ' characters' : '(empty)') + '\n\n' +
    '💡 Likely causes:\n' +
    '   • VITE_SUPABASE_ANON_KEY not set in .env.local\n' +
    '   • Anon key has placeholder or test value\n' +
    '   • Anon key copied incorrectly (should be ~200+ characters)\n' +
    '   • Wrong key used (not the "anon/public" key)\n\n' +
    '🔧 How to fix:\n\n' +
    '1. Go to: https://supabase.com/dashboard\n' +
    '2. Select your project → Settings → API\n' +
    '3. Copy the "anon public" key (NOT service_role)\n' +
    '4. Add to .env.local:\n\n' +
    '   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...\n\n' +
    '5. Restart dev server (npm run dev)\n\n' +
    '📖 See MIGRATION_GUIDE.md for detailed setup instructions\n' +
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
