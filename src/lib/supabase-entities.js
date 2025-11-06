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
 * Map field names from Base44 style to Supabase style
 * Handles legacy field naming (created_date -> created_at)
 * @param {string} fieldName - Field name to map
 * @returns {string} Mapped field name
 */
function mapFieldName(fieldName) {
  const fieldMappings = {
    created_date: 'created_at',
    updated_date: 'updated_at',
  };
  return fieldMappings[fieldName] || fieldName;
}

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
        const field = mapFieldName(orderBy.substring(1));
        query = query.order(field, { ascending: false });
      } else {
        const field = mapFieldName(orderBy);
        query = query.order(field);
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;
      if (error) {
        throw new Error(
          `[src/lib/supabase-entities.js] Failed to list records from table "${tableName}"\n\n` +
          `📊 Query Details:\n` +
          `   • Order by: ${orderBy}\n` +
          `   • Limit: ${options.limit || 'none'}\n` +
          `   • Using: ${useServiceRole ? 'Service Role (admin)' : 'Public Key (authenticated)'}\n\n` +
          `❌ Supabase Error:\n` +
          `   ${error.message}\n\n` +
          `💡 Possible causes:\n` +
          `   • Table "${tableName}" does not exist in database\n` +
          `   • RLS policies deny read access (check Supabase dashboard)\n` +
          `   • Field "${orderBy}" does not exist in table\n` +
          `   • Network/connection issue to Supabase\n\n` +
          `🔧 Troubleshooting:\n` +
          `   1. Verify table exists: Dashboard → Table Editor → "${tableName}"\n` +
          `   2. Check RLS policies: Dashboard → Authentication → Policies\n` +
          `   3. Run migrations: See MIGRATION_GUIDE.md\n\n` +
          `Error Code: ${error.code || 'unknown'}\n` +
          `Hint: ${error.hint || 'No additional hint available'}`
        );
      }
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

      if (error) {
        throw new Error(
          `[src/lib/supabase-entities.js] Failed to get record from table "${tableName}"\n\n` +
          `🔍 Query Details:\n` +
          `   • Table: ${tableName}\n` +
          `   • Record ID: ${id}\n` +
          `   • Using: ${useServiceRole ? 'Service Role (admin)' : 'Public Key (authenticated)'}\n\n` +
          `❌ Supabase Error:\n` +
          `   ${error.message}\n\n` +
          `💡 Possible causes:\n` +
          `   • Table "${tableName}" does not exist\n` +
          `   • RLS policies deny read access for this record\n` +
          `   • Invalid UUID format for id: "${id}"\n` +
          `   • Network/connection issue\n\n` +
          `🔧 Troubleshooting:\n` +
          `   1. Check table exists in Supabase Dashboard\n` +
          `   2. Verify RLS policies allow reading this record\n` +
          `   3. Confirm ID format is valid UUID\n\n` +
          `Error Code: ${error.code || 'unknown'}`
        );
      }
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

      if (error) {
        throw new Error(
          `[src/lib/supabase-entities.js] Failed to create record in table "${tableName}"\n\n` +
          `📝 Operation Details:\n` +
          `   • Table: ${tableName}\n` +
          `   • Data keys: ${Object.keys(data).join(', ')}\n` +
          `   • Using: ${useServiceRole ? 'Service Role (admin)' : 'Public Key (authenticated)'}\n\n` +
          `❌ Supabase Error:\n` +
          `   ${error.message}\n\n` +
          `💡 Possible causes:\n` +
          `   • Table "${tableName}" does not exist\n` +
          `   • RLS policies deny insert access\n` +
          `   • Required fields are missing\n` +
          `   • Field type mismatch (e.g., string instead of UUID)\n` +
          `   • Foreign key constraint violation\n` +
          `   • Unique constraint violation (duplicate value)\n\n` +
          `🔧 Troubleshooting:\n` +
          `   1. Check table schema matches data structure\n` +
          `   2. Verify all required fields are provided\n` +
          `   3. Check RLS policies allow insert for your user\n` +
          `   4. Ensure UUIDs and foreign keys are valid\n\n` +
          `Error Code: ${error.code || 'unknown'}\n` +
          `Details: ${error.details || 'No additional details'}`
        );
      }
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

      if (error) {
        throw new Error(
          `[src/lib/supabase-entities.js] Failed to update record in table "${tableName}"\n\n` +
          `🔄 Operation Details:\n` +
          `   • Table: ${tableName}\n` +
          `   • Record ID: ${id}\n` +
          `   • Fields to update: ${Object.keys(data).join(', ')}\n` +
          `   • Using: ${useServiceRole ? 'Service Role (admin)' : 'Public Key (authenticated)'}\n\n` +
          `❌ Supabase Error:\n` +
          `   ${error.message}\n\n` +
          `💡 Possible causes:\n` +
          `   • Record with ID "${id}" does not exist\n` +
          `   • RLS policies deny update access\n` +
          `   • Field type mismatch in update data\n` +
          `   • Foreign key constraint violation\n` +
          `   • Unique constraint violation\n` +
          `   • Invalid UUID format for id\n\n` +
          `🔧 Troubleshooting:\n` +
          `   1. Verify record exists with this ID\n` +
          `   2. Check RLS policies allow update for your user\n` +
          `   3. Ensure field types match table schema\n` +
          `   4. Confirm ID is valid UUID format\n\n` +
          `Error Code: ${error.code || 'unknown'}\n` +
          `Details: ${error.details || 'No additional details'}`
        );
      }
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

      if (error) {
        throw new Error(
          `[src/lib/supabase-entities.js] Failed to delete record from table "${tableName}"\n\n` +
          `🗑️  Operation Details:\n` +
          `   • Table: ${tableName}\n` +
          `   • Record ID: ${id}\n` +
          `   • Using: ${useServiceRole ? 'Service Role (admin)' : 'Public Key (authenticated)'}\n\n` +
          `❌ Supabase Error:\n` +
          `   ${error.message}\n\n` +
          `💡 Possible causes:\n` +
          `   • Record with ID "${id}" does not exist\n` +
          `   • RLS policies deny delete access\n` +
          `   • Foreign key constraint prevents deletion (record referenced elsewhere)\n` +
          `   • Invalid UUID format for id\n\n` +
          `🔧 Troubleshooting:\n` +
          `   1. Check record exists with this ID\n` +
          `   2. Verify RLS policies allow delete for your user\n` +
          `   3. Check for dependent records in other tables\n` +
          `   4. Consider cascade delete or remove dependencies first\n\n` +
          `Error Code: ${error.code || 'unknown'}\n` +
          `Details: ${error.details || 'No additional details'}`
        );
      }
    },

    /**
     * Filter records based on conditions
     * @param {Object} conditions - Filter conditions (key-value pairs)
     * @param {string} orderBy - Field to order by (prefix with '-' for descending)
     * @returns {Promise<Array>} Array of filtered records
     */
    async filter(conditions, orderBy = 'created_at') {
      let query = client.from(tableName).select('*');

      // Map condition field names
      Object.entries(conditions).forEach(([key, value]) => {
        const mappedKey = mapFieldName(key);
        if (Array.isArray(value)) {
          query = query.in(mappedKey, value);
        } else {
          query = query.eq(mappedKey, value);
        }
      });

      // Map orderBy field name
      if (orderBy.startsWith('-')) {
        const field = mapFieldName(orderBy.substring(1));
        query = query.order(field, { ascending: false });
      } else {
        const field = mapFieldName(orderBy);
        query = query.order(field);
      }

      const { data, error } = await query;
      if (error) {
        const conditionsSummary = Object.entries(conditions)
          .map(([k, v]) => `${k}=${Array.isArray(v) ? `[${v.join(',')}]` : v}`)
          .join(', ');

        throw new Error(
          `[src/lib/supabase-entities.js] Failed to filter records from table "${tableName}"\n\n` +
          `🔍 Query Details:\n` +
          `   • Table: ${tableName}\n` +
          `   • Conditions: ${conditionsSummary || '(none)'}\n` +
          `   • Order by: ${orderBy}\n` +
          `   • Using: ${useServiceRole ? 'Service Role (admin)' : 'Public Key (authenticated)'}\n\n` +
          `❌ Supabase Error:\n` +
          `   ${error.message}\n\n` +
          `💡 Possible causes:\n` +
          `   • Table "${tableName}" does not exist\n` +
          `   • RLS policies deny read access\n` +
          `   • Invalid field name in conditions or orderBy\n` +
          `   • Field type mismatch in filter values\n` +
          `   • Network/connection issue\n\n` +
          `🔧 Troubleshooting:\n` +
          `   1. Verify all field names exist in table schema\n` +
          `   2. Check RLS policies allow filtered queries\n` +
          `   3. Ensure filter values match field types\n` +
          `   4. Run: npm run migrations (if table is missing)\n\n` +
          `Error Code: ${error.code || 'unknown'}\n` +
          `Hint: ${error.hint || 'No additional hint available'}`
        );
      }
      return data || [];
    },

    /**
     * Bulk create multiple records at once
     * @param {Array<Object>} dataArray - Array of records to create
     * @returns {Promise<Array>} Array of created records
     */
    async bulkCreate(dataArray) {
      if (!Array.isArray(dataArray) || dataArray.length === 0) {
        throw new Error(
          `[src/lib/supabase-entities.js] bulkCreate requires a non-empty array\n\n` +
          `📝 Operation Details:\n` +
          `   • Table: ${tableName}\n` +
          `   • Provided data: ${typeof dataArray}\n\n` +
          `💡 Expected: Array of objects with record data\n` +
          `   Example: [{ name: 'Item 1' }, { name: 'Item 2' }]`
        );
      }

      const { data: result, error } = await client
        .from(tableName)
        .insert(dataArray)
        .select();

      if (error) {
        throw new Error(
          `[src/lib/supabase-entities.js] Failed to bulk create records in table "${tableName}"\n\n` +
          `📝 Operation Details:\n` +
          `   • Table: ${tableName}\n` +
          `   • Records to insert: ${dataArray.length}\n` +
          `   • Sample keys: ${Object.keys(dataArray[0] || {}).join(', ')}\n` +
          `   • Using: ${useServiceRole ? 'Service Role (admin)' : 'Public Key (authenticated)'}\n\n` +
          `❌ Supabase Error:\n` +
          `   ${error.message}\n\n` +
          `💡 Possible causes:\n` +
          `   • Table "${tableName}" does not exist\n` +
          `   • RLS policies deny insert access\n` +
          `   • Required fields are missing in one or more records\n` +
          `   • Field type mismatch (e.g., string instead of UUID)\n` +
          `   • Foreign key constraint violation\n` +
          `   • Unique constraint violation (duplicate value)\n` +
          `   • Payload too large (consider batching)\n\n` +
          `🔧 Troubleshooting:\n` +
          `   1. Check table schema matches data structure\n` +
          `   2. Verify all required fields are provided in each record\n` +
          `   3. Check RLS policies allow insert for your user\n` +
          `   4. Ensure UUIDs and foreign keys are valid\n` +
          `   5. For large datasets (>1000 records), batch the inserts\n\n` +
          `Error Code: ${error.code || 'unknown'}\n` +
          `Details: ${error.details || 'No additional details'}\n` +
          `Hint: ${error.hint || 'No additional hint available'}`
        );
      }

      return result || [];
    },
  };
}

/**
 * Helper to handle Edge Function errors with descriptive messages
 */
async function callEdgeFunction(functionName, params, additionalInfo = {}) {
  const response = await fetch(
    `${supabaseUrl}/functions/v1/${functionName}`,
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
    let errorMessage = 'Unknown error';
    try {
      const error = await response.json();
      errorMessage = error.error || error.message || `Failed to call ${functionName}`;
    } catch {
      errorMessage = await response.text();
    }

    throw new Error(
      `[src/lib/supabase-entities.js] Edge Function "${functionName}" failed\n\n` +
      `📡 Request Details:\n` +
      `   • Function: ${functionName}\n` +
      `   • Status: ${response.status} ${response.statusText}\n` +
      Object.entries(additionalInfo).map(([k, v]) => `   • ${k}: ${v}`).join('\n') +
      `\n\n❌ Error:\n   ${errorMessage}\n\n` +
      `💡 Common causes:\n` +
      `   • Edge function not deployed (run: supabase functions deploy ${functionName})\n` +
      `   • Missing environment variables (VITE_GEMINI_API_KEY, etc.)\n` +
      `   • Service role key invalid\n` +
      `   • Function timeout or resource limit\n` +
      `   • Invalid request parameters\n\n` +
      `🔧 Troubleshooting:\n` +
      `   1. Check function logs: Dashboard → Edge Functions → ${functionName}\n` +
      `   2. Verify all environment variables in .env.local\n` +
      `   3. See BACKEND_FUNCTIONS.md for deployment guide`
    );
  }

  return response.json();
}

/**
 * Export backend function helpers
 * These call Supabase Edge Functions
 */
export const functions = {
  async generateQueries(params) {
    return callEdgeFunction('generate-queries', params, {
      'Project ID': params.projectId || '(not provided)',
    });
  },

  async analyzeQueries(params) {
    return callEdgeFunction('analyze-queries', params, {
      'Project ID': params.projectId || '(not provided)',
    });
  },

  async exportStep3Report(params) {
    return callEdgeFunction('export-step3-report', params, {
      'Project ID': params.projectId || '(not provided)',
      'Format': params.format || 'csv',
    });
  },

  async resetStuckQueries(params) {
    return callEdgeFunction('reset-stuck-queries', params, {
      'Project ID': params.projectId || '(not provided)',
    });
  },

  async diagnoseStuckQueries(params) {
    return callEdgeFunction('diagnose-stuck-queries', params, {
      'Project ID': params.projectId || '(not provided)',
    });
  },
};
