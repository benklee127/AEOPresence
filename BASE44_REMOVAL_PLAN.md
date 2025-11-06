# Complete Base44 Removal & Google OAuth Migration Plan

## 🎯 Objective
Remove all Base44 dependencies and implement direct Supabase authentication with Google OAuth.

---

## 📊 Current State Analysis

### Base44 Dependencies Found:
```
✓ package.json - @base44/sdk (to be removed)
✓ src/api/base44Client.js - wrapper around custom-sdk
✓ src/api/entities.js - exports entities via base44
✓ src/api/integrations.js - exports integrations via base44
✓ src/api/functions.js - exports functions via base44
✓ src/lib/custom-sdk.js - Supabase wrapper with Base44 API
```

### Files Importing base44:
```
- src/components/AuthStatus.jsx
- src/pages/Dashboard.jsx
- src/pages/Step1.jsx
- src/pages/Step2.jsx
- src/pages/Step3.jsx
- src/components/step1/OnboardingForm.jsx
- src/components/step3/ActionableInsights.jsx
```

---

## 🏗️ Migration Strategy

### Phase 1: Restructure SDK Layer
**Goal**: Remove Base44 API compatibility layer, use Supabase directly

1. **Rename custom-sdk.js → supabase-entities.js**
   - Remove Base44 terminology
   - Simplify to pure Supabase operations
   - Keep entity CRUD helpers

2. **Replace base44Client.js → supabase-client.js**
   - Export Supabase client directly
   - Export entity classes
   - Export auth helpers

3. **Update entities.js**
   ```javascript
   // Old:
   export const QueryProject = base44.entities.QueryProject;

   // New:
   import { createEntity } from './supabase-entities';
   export const QueryProject = createEntity('query_projects');
   ```

---

### Phase 2: Direct Supabase Authentication

#### Current Auth (via custom-sdk.js):
```javascript
// Development mode
base44.auth.login('dev')

// OAuth (not implemented)
base44.auth.login('google')
```

#### New Direct Supabase Auth:
```javascript
import { supabase } from './supabase-client';

// Google OAuth
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
    queryParams: {
      access_type: 'offline',
      prompt: 'consent',
    }
  }
});

// Get current user
const { data: { user } } = await supabase.auth.getUser();

// Sign out
await supabase.auth.signOut();
```

---

### Phase 3: Implement Google OAuth

#### Prerequisites:
1. **Google Cloud Console Setup**
   - Create OAuth 2.0 Client ID
   - Add authorized redirect URIs
   - Get Client ID and Secret

2. **Supabase Configuration**
   - Enable Google provider in Supabase Dashboard
   - Add Google Client ID and Secret
   - Configure redirect URLs

#### Implementation Steps:

**Step 3.1: Create Auth Helper (src/lib/auth.js)**
```javascript
import { supabase } from './supabase-client';

export const auth = {
  async signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        }
      }
    });

    if (error) throw error;
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  },

  async getSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  }
};
```

**Step 3.2: Update AuthStatus Component**
```javascript
import { auth } from '@/lib/auth';
import { supabase } from '@/lib/supabase-client';

// Replace base44.auth.login('dev') with:
const handleGoogleLogin = async () => {
  try {
    await auth.signInWithGoogle();
    // Redirect happens automatically
  } catch (error) {
    console.error('Login failed:', error);
  }
};

// Replace base44.auth.logout() with:
const handleLogout = async () => {
  await auth.signOut();
  window.location.href = '/';
};

// Replace base44.auth.getCurrentUser() with:
const user = await auth.getUser();
```

**Step 3.3: Create Auth Callback Page**
```javascript
// src/pages/AuthCallback.jsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase-client';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        navigate('/');
      }
    });
  }, [navigate]);

  return <div>Loading...</div>;
}
```

---

### Phase 4: Update Entity Operations

#### Keep Entity Helper Pattern:
```javascript
// src/lib/supabase-entities.js
import { supabase } from './supabase-client';

export function createEntity(tableName) {
  return {
    async list(orderBy = 'created_at', options = {}) {
      let query = supabase.from(tableName).select('*');

      if (orderBy.startsWith('-')) {
        query = query.order(orderBy.substring(1), { ascending: false });
      } else {
        query = query.order(orderBy);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async get(id) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },

    async create(data) {
      const { data: result, error } = await supabase
        .from(tableName)
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },

    async update(id, data) {
      const { data: result, error } = await supabase
        .from(tableName)
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },

    async delete(id) {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id);

      if (error) throw error;
    },

    async filter(conditions, orderBy = 'created_at') {
      let query = supabase.from(tableName).select('*');

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
    }
  };
}
```

---

### Phase 5: Backend Functions (Already Done!)

Backend functions already call Supabase Edge Functions directly:
```javascript
// src/lib/custom-sdk.js (lines 767-870)
// These already fetch from ${supabaseUrl}/functions/v1/...
// No changes needed!
```

---

### Phase 6: Update All Imports

**Find and Replace:**
```javascript
// Old:
import { base44 } from '@/api/base44Client';
base44.entities.QueryProject.list()
base44.auth.login()

// New:
import { QueryProject } from '@/api/entities';
import { auth } from '@/lib/auth';
QueryProject.list()
auth.signInWithGoogle()
```

---

## 📋 Implementation Checklist

### Phase 1: Preparation
- [ ] Backup current working code
- [ ] Document current auth flow
- [ ] Test current functionality

### Phase 2: Remove Base44 SDK
- [ ] Remove @base44/sdk from package.json
- [ ] Run npm install to clean lockfile
- [ ] Verify no build errors

### Phase 3: Restructure SDK Layer
- [ ] Rename custom-sdk.js → supabase-entities.js
- [ ] Simplify entity creation logic
- [ ] Create src/lib/auth.js helper
- [ ] Update base44Client.js → supabase-client.js
- [ ] Update entities.js exports

### Phase 4: Implement Google OAuth
- [ ] Set up Google Cloud OAuth credentials
- [ ] Configure Supabase Google provider
- [ ] Create auth callback route
- [ ] Update AuthStatus component
- [ ] Test Google sign-in flow

### Phase 5: Update All Components
- [ ] Update Dashboard.jsx
- [ ] Update Step1.jsx
- [ ] Update Step2.jsx
- [ ] Update Step3.jsx
- [ ] Update OnboardingForm.jsx
- [ ] Update ActionableInsights.jsx
- [ ] Update AuthStatus.jsx

### Phase 6: Testing
- [ ] Test entity CRUD operations
- [ ] Test Google OAuth sign-in
- [ ] Test sign-out
- [ ] Test authenticated operations
- [ ] Test RLS policies
- [ ] Test backend functions

### Phase 7: Documentation
- [ ] Update README.md
- [ ] Update MIGRATION_GUIDE.md
- [ ] Update TROUBLESHOOTING.md
- [ ] Document Google OAuth setup

---

## 🔑 Google OAuth Setup Guide

### 1. Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create or select a project
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth 2.0 Client ID**
5. Configure OAuth consent screen:
   - App name: "AEO Presence"
   - User support email: your email
   - Authorized domains: your domain
6. Create OAuth Client ID:
   - Application type: **Web application**
   - Name: "AEO Presence Web"
   - Authorized redirect URIs:
     ```
     http://localhost:5173/auth/callback
     https://yourdomain.com/auth/callback
     https://your-project.supabase.co/auth/v1/callback
     ```
7. Copy **Client ID** and **Client Secret**

### 2. Supabase Dashboard

1. Go to your Supabase project
2. Navigate to **Authentication** → **Providers**
3. Find **Google** and click to configure
4. Enable Google provider
5. Paste:
   - **Client ID** from Google
   - **Client Secret** from Google
6. Copy the **Callback URL** shown
7. Add this callback URL to Google Cloud Console authorized redirects
8. Save

### 3. Environment Variables

Add to `.env.local`:
```bash
# Google OAuth (optional - configured in Supabase dashboard)
# These are for reference only, actual auth happens server-side
VITE_GOOGLE_AUTH_ENABLED=true
```

---

## 🧪 Testing Plan

### Test 1: Google Sign In
```
1. Click "Sign in with Google" button
2. Redirected to Google OAuth consent
3. Approve permissions
4. Redirected back to app
5. User is authenticated
6. Can see user info in sidebar
```

### Test 2: Session Persistence
```
1. Sign in with Google
2. Refresh page
3. User still authenticated
4. No need to sign in again
```

### Test 3: Sign Out
```
1. While signed in, click "Sign Out"
2. Session cleared
3. Redirected to home
4. Cannot access protected resources
```

### Test 4: Protected Operations
```
1. Try creating folder while signed out → Should fail
2. Sign in with Google
3. Try creating folder while signed in → Should succeed
```

---

## 🚨 Breaking Changes

### For Developers:
```javascript
// Old import
import { base44 } from '@/api/base44Client';

// New imports
import { QueryProject, Query, Folder } from '@/api/entities';
import { auth } from '@/lib/auth';
import {
  generateQueries,
  analyzeQueries,
  exportStep3Report
} from '@/api/functions';
```

### For Users:
- No more development mode login (dev@localhost.com)
- Must use Google OAuth for authentication
- First-time users need to authorize Google access

---

## 📚 References

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Google OAuth Setup](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript)

---

**Created**: 2025-01-06
**Status**: Ready for Implementation
**Estimated Time**: 3-4 hours
