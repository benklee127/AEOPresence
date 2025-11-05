# Troubleshooting Guide - AEO Presence

This guide helps diagnose and fix common issues after the Supabase migration.

## 🚨 Blank Webpage / White Screen

### Issue: Application renders a blank white page

**Cause**: Missing QueryClientProvider wrapper (FIXED)

**Solution**: ✅ Already fixed in `src/main.jsx`

The app now includes:
```javascript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
```

If you still see a blank page, check the browser console for errors (F12 > Console tab).

---

## 🔧 Common Issues After Migration

### 1. Environment Variables Not Loaded

**Symptoms:**
- Console errors about Supabase connection
- "Invalid API key" errors
- Authentication failures

**Check:**
```bash
# Make sure .env.local exists
ls -la .env.local

# If missing, create it:
cp .env.local.template .env.local
```

**Required variables:**
```bash
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
VITE_LLM_PROVIDER=gemini
VITE_GEMINI_API_KEY=AIza...
```

**Important:**
- Variable names MUST start with `VITE_` (Vite requirement)
- Restart dev server after changing `.env.local`
- Never commit `.env.local` to git (already in `.gitignore`)

---

### 2. Database Connection Errors

**Symptoms:**
- "Could not find the table" errors
- "relation does not exist" errors
- Empty dashboard with no projects/folders

**Solutions:**

#### A. Verify Supabase Credentials
1. Go to your Supabase project dashboard
2. Navigate to Settings > API
3. Copy the correct values:
   - Project URL → `VITE_SUPABASE_URL`
   - anon/public key → `VITE_SUPABASE_ANON_KEY`
   - service_role key → `VITE_SUPABASE_SERVICE_ROLE_KEY`

#### B. Apply Database Migrations
If tables don't exist:

**Option 1: Using Supabase Dashboard (Easiest)**
1. Go to your Supabase dashboard
2. Click SQL Editor (left sidebar)
3. Create a new query
4. Copy contents of `supabase/migrations/20250101000000_initial_schema.sql`
5. Paste and click "Run"
6. Repeat for `supabase/migrations/20250101000001_rls_policies.sql`

**Option 2: Using Supabase CLI**
```bash
# Install CLI
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref your-project-ref

# Apply migrations
supabase db push
```

#### C. Verify Tables Created
In Supabase Dashboard > Database > Tables, you should see:
- ✅ users
- ✅ folders
- ✅ query_projects
- ✅ queries

---

### 3. Authentication Issues

**Symptoms:**
- Can't log in
- "Not authenticated" errors
- Redirect loops

**Solutions:**

#### Development Authentication
Use the built-in dev account:
- **Email**: `dev@localhost.com`
- **Password**: `dev123456`

This account is automatically created on first login and set as admin.

#### Check Supabase Auth Settings
1. Go to Supabase Dashboard > Authentication > Settings
2. Ensure "Enable email confirmations" is OFF for local development
3. Check that the site URL is set to `http://localhost:5173`

#### Clear Browser Storage
Sometimes stale auth tokens cause issues:
```javascript
// In browser console (F12):
localStorage.clear()
sessionStorage.clear()
// Then refresh the page
```

---

### 4. Backend Functions Not Implemented

**Symptoms:**
- Error: "generateQueries needs to be implemented"
- Error: "analyzeQueries needs to be implemented"
- Generate/Analyze buttons don't work

**Expected Behavior:**
These functions are **not yet implemented** in the migration. This is normal.

**What Works:**
- ✅ Viewing/creating/editing/deleting projects
- ✅ Viewing/creating/editing/deleting folders
- ✅ Dashboard statistics
- ✅ Project organization

**What Doesn't Work (Yet):**
- ❌ Generating queries (Step 1)
- ❌ Analyzing queries (Step 2)
- ❌ Exporting reports (Step 3)

**Solution:**
See `BACKEND_FUNCTIONS.md` for implementation guide.

---

### 5. CORS Errors

**Symptoms:**
- Browser console shows CORS errors
- Network requests blocked

**Solution:**
1. Go to Supabase Dashboard > Settings > API
2. Check "CORS allowed origins"
3. Add `http://localhost:5173` (for development)
4. Add your production domain when deploying

---

### 6. Console Warnings About InvokeLLM

**Symptoms:**
```
InvokeLLM called with: {...}
LLM integration not yet implemented
```

**Expected Behavior:**
This is a placeholder warning. The LLM integration in the custom SDK is a mock implementation.

**Solution:**
For production, implement actual LLM calls in `src/lib/custom-sdk.js`:
- Replace the `InvokeLLM` placeholder
- Use your preferred LLM provider (OpenAI, Anthropic, etc.)
- Or use the Gemini integration already set up in `src/api/llmProvider.js`

---

## 🐛 Debugging Tips

### Check Browser Console
Always check for errors:
1. Open browser (Chrome/Firefox/Edge)
2. Press F12 or right-click > Inspect
3. Go to Console tab
4. Look for red error messages
5. Copy the full error and search for it in this guide

### Check Network Tab
For API issues:
1. F12 > Network tab
2. Reload the page
3. Look for failed requests (red)
4. Click on them to see details
5. Check if Supabase URLs are correct

### Enable Verbose Logging
Add to your `.env.local`:
```bash
VITE_DEBUG=true
```

Then check the SDK output in `src/lib/custom-sdk.js` (console.log statements).

### Verify Package Installation
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Check for peer dependency issues
npm ls
```

---

## 🔍 Quick Diagnostic Checklist

Run through this checklist:

- [ ] `.env.local` file exists with correct Supabase credentials
- [ ] Supabase project is active (check dashboard)
- [ ] Database migrations have been applied (4 tables exist)
- [ ] Dev server restarted after changing `.env.local`
- [ ] Browser console shows no errors (F12)
- [ ] Network tab shows successful Supabase API calls
- [ ] Using development auth: `dev@localhost.com` / `dev123456`
- [ ] QueryClientProvider is in `src/main.jsx` (already fixed)

---

## 📊 Expected Console Output

### Normal Startup:
```
Created entity: QueryProject -> query_projects (service role: false)
Created entity: Folder -> folders (service role: false)
```

### Successful Authentication:
```
Successfully signed in: { user: {...} }
```

### Expected Warnings (Safe to Ignore):
```
InvokeLLM called with: {...}
LLM integration not yet implemented
```

---

## 🆘 Still Having Issues?

### Collect This Information:

1. **Browser Console Errors** (F12 > Console)
   - Copy the full error message
   - Include stack trace

2. **Network Errors** (F12 > Network)
   - Failed request URLs
   - Status codes
   - Response bodies

3. **Environment Info**
   ```bash
   node --version
   npm --version
   # Contents of .env.local (redact secrets!)
   ```

4. **Supabase Project Status**
   - Is project active?
   - Are tables created?
   - Is RLS enabled?

### Next Steps:

1. Check `MIGRATION_GUIDE.md` for detailed setup instructions
2. Check `BACKEND_FUNCTIONS.md` for function implementation
3. Review Supabase logs in dashboard > Logs
4. Check this repo's Issues on GitHub

---

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [TanStack Query Docs](https://tanstack.com/query/latest/docs/react/overview)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [React Router Documentation](https://reactrouter.com/)

---

**Last Updated**: 2025-11-05
**Migration Version**: Supabase Universal SDK v1.0
