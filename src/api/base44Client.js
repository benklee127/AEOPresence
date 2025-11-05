// Supabase-backed Base44 compatible client
// This is a drop-in replacement that maintains 100% API compatibility with Base44
import { customClient } from "../lib/custom-sdk.js";

// Export the custom client as base44 for compatibility
export const base44 = customClient;
