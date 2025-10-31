import { createClient } from '@base44/sdk';
// import { getAccessToken } from '@base44/sdk/utils/auth-utils';

// Create a client with authentication required
export const base44 = createClient({
  appId: "68f6958fde9a29d0cdb93bac", 
  requiresAuth: true // Ensure authentication is required for all operations
});
