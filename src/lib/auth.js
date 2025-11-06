import { supabase } from './supabase-client';
import { createClient } from '@supabase/supabase-js';

// Handle both Vite (import.meta.env) and Node.js (process.env) environments
const getEnvVar = (key, defaultValue) => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key] || defaultValue;
  }
  return process.env[key] || defaultValue;
};

// Create service role client for user operations (bypasses RLS)
const supabaseUrl = getEnvVar('VITE_SUPABASE_URL', 'http://127.0.0.1:54321');
const supabaseServiceKey = getEnvVar('VITE_SUPABASE_SERVICE_ROLE_KEY', '');

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Authentication helper functions
 */
export const auth = {
  /**
   * Sign in with Google OAuth
   * @returns {Promise<Object>} OAuth response
   */
  async signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      throw new Error(
        `[src/lib/auth.js] Google OAuth sign-in failed\n\n` +
        `❌ Error:\n   ${error.message}\n\n` +
        `💡 Possible causes:\n` +
        `   • Google OAuth provider not enabled in Supabase\n` +
        `   • Google Client ID/Secret not configured\n` +
        `   • Redirect URL not authorized in Google Console\n` +
        `   • Pop-up blocked by browser\n` +
        `   • User denied permissions\n\n` +
        `🔧 Setup Google OAuth:\n` +
        `   1. Go to: https://console.cloud.google.com\n` +
        `   2. Create OAuth Client ID (Web application)\n` +
        `   3. Add authorized redirect URIs:\n` +
        `      • ${window.location.origin}/auth/callback\n` +
        `      • https://YOUR_PROJECT.supabase.co/auth/v1/callback\n` +
        `   4. Enable Google provider in Supabase Dashboard\n` +
        `   5. Add Client ID and Secret to Supabase\n\n` +
        `📖 See BASE44_REMOVAL_PLAN.md for detailed Google OAuth setup\n` +
        `Error Code: ${error.code || 'unknown'}`
      );
    }
    return data;
  },

  /**
   * Sign out current user
   * @returns {Promise<void>}
   */
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(
        `[src/lib/auth.js] Sign-out failed\n\n` +
        `❌ Error:\n   ${error.message}\n\n` +
        `💡 This is unusual - sign-out rarely fails\n` +
        `🔧 Try: Clear browser cookies and local storage\n` +
        `Error Code: ${error.code || 'unknown'}`
      );
    }
  },

  /**
   * Get current authenticated user
   * @returns {Promise<Object|null>} User object or null
   */
  async getUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      if (error.message?.includes('Auth session missing')) {
        return null;
      }
      throw new Error(
        `[src/lib/auth.js] Failed to get authenticated user\n\n` +
        `❌ Error:\n   ${error.message}\n\n` +
        `💡 Possible causes:\n` +
        `   • Session expired or invalid\n` +
        `   • Supabase connection issue\n` +
        `   • Auth token corrupted in local storage\n\n` +
        `🔧 Try: Sign out and sign in again\n` +
        `Error Code: ${error.code || 'unknown'}`
      );
    }
    return user;
  },

  /**
   * Get current session
   * @returns {Promise<Object|null>} Session object or null
   */
  async getSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      throw new Error(
        `[src/lib/auth.js] Failed to get session\n\n` +
        `❌ Error:\n   ${error.message}\n\n` +
        `💡 Possible causes:\n` +
        `   • No active session\n` +
        `   • Session expired\n` +
        `   • Local storage access denied\n\n` +
        `🔧 Try: Sign in again\n` +
        `Error Code: ${error.code || 'unknown'}`
      );
    }
    return session;
  },

  /**
   * Check if user is authenticated
   * @returns {Promise<boolean>}
   */
  async isAuthenticated() {
    try {
      const user = await this.getUser();
      return !!user;
    } catch {
      return false;
    }
  },

  /**
   * Get user data from database (includes role, full_name, etc.)
   * @returns {Promise<Object|null>} User data from database or null
   */
  async getUserData() {
    try {
      const user = await this.getUser();
      if (!user) return null;

      // Use service role to bypass RLS
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        throw new Error(
          `[src/lib/auth.js] Failed to fetch user data from database\n\n` +
          `❌ Error:\n   ${error.message}\n\n` +
          `💡 Possible causes:\n` +
          `   • Table "users" does not exist\n` +
          `   • Database migrations not run\n` +
          `   • Service role key invalid\n` +
          `   • Network connection issue\n\n` +
          `🔧 Troubleshooting:\n` +
          `   1. Run migrations: See MIGRATION_GUIDE.md\n` +
          `   2. Verify VITE_SUPABASE_SERVICE_ROLE_KEY in .env.local\n` +
          `   3. Check table exists in Supabase Dashboard\n` +
          `Error Code: ${error.code || 'unknown'}`
        );
      }

      // If user doesn't exist in database, create them
      if (!data) {
        const newUser = {
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.email,
          email_verified: !!user.email_confirmed_at,
          role: 'user', // Default role
        };

        const { data: createdUser, error: createError } = await supabaseAdmin
          .from('users')
          .insert(newUser)
          .select()
          .single();

        if (createError) {
          throw new Error(
            `[src/lib/auth.js] Failed to create user record in database\n\n` +
            `❌ Error:\n   ${createError.message}\n\n` +
            `💡 Possible causes:\n` +
            `   • User ID already exists (UUID conflict)\n` +
            `   • RLS policies deny insert\n` +
            `   • Required fields missing\n` +
            `   • Table schema mismatch\n\n` +
            `🔧 Check: Table "users" schema and RLS policies\n` +
            `Error Code: ${createError.code || 'unknown'}`
          );
        }
        return createdUser;
      }

      return data;
    } catch (error) {
      if (error.message?.includes('Auth session missing')) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Update current user's data in database
   * @param {Object} userData - User data to update
   * @returns {Promise<Object|null>} Updated user data
   */
  async updateUserData(userData) {
    const user = await this.getUser();
    if (!user) {
      throw new Error(
        `[src/lib/auth.js] Cannot update user data - not authenticated\n\n` +
        `🔒 You must be signed in to update user data\n` +
        `🔧 Sign in first using: auth.signInWithGoogle()`
      );
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .update({
        ...userData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select()
      .maybeSingle();

    if (error) {
      throw new Error(
        `[src/lib/auth.js] Failed to update user data\n\n` +
        `❌ Error:\n   ${error.message}\n\n` +
        `📊 Update Details:\n` +
        `   • User ID: ${user.id}\n` +
        `   • Fields: ${Object.keys(userData).join(', ')}\n\n` +
        `💡 Possible causes:\n` +
        `   • RLS policies deny update\n` +
        `   • Field type mismatch\n` +
        `   • Invalid field names\n` +
        `   • User record doesn't exist in database\n\n` +
        `🔧 Check: Table "users" schema and RLS policies\n` +
        `Error Code: ${error.code || 'unknown'}`
      );
    }
    return data;
  },

  /**
   * Subscribe to authentication state changes
   * @param {Function} callback - Callback function to handle auth changes
   * @returns {Object} Subscription object with unsubscribe method
   */
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });
  },
};
