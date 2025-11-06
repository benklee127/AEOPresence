import { supabase } from './supabase-client.js';
import { createClient } from '@supabase/supabase-js';

// Handle both Vite (import.meta.env) and Node.js (process.env) environments
const getEnvVar = (key, defaultValue) => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key] || defaultValue;
  }
  return process.env[key] || defaultValue;
};

// Create service role client for admin operations (bypasses RLS)
const supabaseUrl = getEnvVar('VITE_SUPABASE_URL', 'http://127.0.0.1:54321');
const supabaseServiceKey = getEnvVar(
  'VITE_SUPABASE_SERVICE_ROLE_KEY',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
);

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  db: {
    schema: 'public',
  },
});

/**
 * Create an entity helper for database operations
 * @param {string} tableName - Name of the database table
 * @param {boolean} useServiceRole - Whether to use service role for operations
 * @returns {Object} Entity helper with CRUD methods
 */
export function createEntity(tableName, useServiceRole = false) {
  const client = useServiceRole ? supabaseAdmin : supabase;

  return {
    /**
     * List all records with optional ordering
     * @param {string} orderBy - Field to order by (prefix with '-' for descending)
     * @param {Object} options - Additional options
     * @returns {Promise<Array>} Array of records
     */
    async list(orderBy = 'created_at', options = {}) {
      let query = client.from(tableName).select('*');

      if (orderBy.startsWith('-')) {
        query = query.order(orderBy.substring(1), { ascending: false });
      } else {
        query = query.order(orderBy);
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    /**
     * Get a single record by ID
     * @param {string} id - Record ID
     * @returns {Promise<Object|null>} Single record or null
     */
    async get(id) {
      const { data, error } = await client
        .from(tableName)
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },

    /**
     * Create a new record
     * @param {Object} data - Record data
     * @returns {Promise<Object>} Created record
     */
    async create(data) {
      const { data: result, error } = await client
        .from(tableName)
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },

    /**
     * Update a record by ID
     * @param {string} id - Record ID
     * @param {Object} data - Updated data
     * @returns {Promise<Object|null>} Updated record or null
     */
    async update(id, data) {
      const updateData = {
        ...data,
        updated_at: new Date().toISOString(),
      };

      const { data: result, error } = await client
        .from(tableName)
        .update(updateData)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) throw error;
      return result;
    },

    /**
     * Delete a record by ID
     * @param {string} id - Record ID
     * @returns {Promise<void>}
     */
    async delete(id) {
      const { error } = await client
        .from(tableName)
        .delete()
        .eq('id', id);

      if (error) throw error;
    },

    /**
     * Filter records based on conditions
     * @param {Object} conditions - Filter conditions (key-value pairs)
     * @param {string} orderBy - Field to order by (prefix with '-' for descending)
     * @returns {Promise<Array>} Array of filtered records
     */
    async filter(conditions, orderBy = 'created_at') {
      let query = client.from(tableName).select('*');

      Object.entries(conditions).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          query = query.in(key, value);
        } else {
          query = query.eq(key, value);
        }
      });

      if (orderBy.startsWith('-')) {
        query = query.order(orderBy.substring(1), { ascending: false });
      } else {
        query = query.order(orderBy);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  };
}

/**
 * Export backend function helpers
 * These call Supabase Edge Functions
 */
export const functions = {
  async generateQueries(params) {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/generate-queries`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify(params),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate queries');
    }

    return response.json();
  },

  async analyzeQueries(params) {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/analyze-queries`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify(params),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to analyze queries');
    }

    return response.json();
  },

  async exportStep3Report(params) {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/export-step3-report`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify(params),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to export report');
    }

    return response.json();
  },

  async resetStuckQueries(params) {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/reset-stuck-queries`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify(params),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to reset stuck queries');
    }

    return response.json();
  },

  async diagnoseStuckQueries(params) {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/diagnose-stuck-queries`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify(params),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to diagnose stuck queries');
    }

    return response.json();
  },
};
