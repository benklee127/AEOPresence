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

    if (error) throw error;
    return data;
  },

  /**
   * Sign out current user
   * @returns {Promise<void>}
   */
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
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
      throw error;
    }
    return user;
  },

  /**
   * Get current session
   * @returns {Promise<Object|null>} Session object or null
   */
  async getSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
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

      if (error) throw error;

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

        if (createError) throw createError;
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
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabaseAdmin
      .from('users')
      .update({
        ...userData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select()
      .maybeSingle();

    if (error) throw error;
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
