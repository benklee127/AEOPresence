# AEO Presence

A powerful Vite+React application for managing and analyzing AEO (Answer Engine Optimization) queries. Built with Supabase backend for scalable, self-hosted infrastructure and support for multiple LLM providers.

## 🚀 Backend Migration Notice

This application has been successfully migrated from Base44 to **Supabase**!

- ✅ Self-hosted PostgreSQL database
- ✅ Built-in authentication with Row Level Security
- ✅ Zero code changes required (100% API compatible)
- ✅ Full control over your data

📖 **New to this project?** See [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for complete setup instructions.

## 🏁 Quick Start

### Prerequisites

1. **Supabase Account** - Create a free account at [supabase.com](https://supabase.com)
2. **Node.js 18+** - Required for running the application
3. **Gemini API Key** (optional) - For LLM-powered query generation

### Initial Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment Variables**
   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` and add your credentials:
   ```bash
   # Supabase Configuration (Required)
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key_here
   VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

   # LLM Provider (Optional - for query generation)
   VITE_LLM_PROVIDER=gemini
   VITE_GEMINI_API_KEY=your_gemini_api_key_here
   ```

3. **Set Up Database**
   - Apply the migrations in `supabase/migrations/` to your Supabase project
   - See [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for detailed instructions

4. **Run Development Server**
   ```bash
   npm run dev
   ```

5. **Build for Production**
   ```bash
   npm run build
   ```

### Development Authentication

The app includes built-in development authentication:
- **Email**: `dev@localhost.com`
- **Password**: `dev123456`

This user is automatically created and set as admin on first login.

## 🤖 LLM Provider Configuration

The application uses Large Language Models (LLMs) for query generation and analysis. Currently supported:

### Google Gemini API (Recommended)

1. **Get a Gemini API Key**
   - Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create or sign in to your Google account
   - Generate an API key

2. **Configure Environment Variables**
   - Edit `.env.local` and set:
     ```bash
     VITE_LLM_PROVIDER=gemini
     VITE_GEMINI_API_KEY=your_actual_api_key_here
     ```

3. **Features**
   - Model: `gemini-1.5-pro`
   - Structured JSON responses
   - High-quality query generation and analysis

### Custom LLM Integration

You can integrate other LLM providers (OpenAI, Anthropic, etc.) by:
1. Updating `src/lib/custom-sdk.js` - See `InvokeLLM` function
2. Implementing your preferred LLM API
3. See [BACKEND_FUNCTIONS.md](./BACKEND_FUNCTIONS.md) for details

### Environment Variables

- `VITE_LLM_PROVIDER`: Set to `gemini` for Google Gemini
- `VITE_GEMINI_API_KEY`: Your Gemini API key
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `VITE_SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (keep secret!)

## ✨ Features

### Backend & Infrastructure
- **Supabase Backend**: Self-hosted PostgreSQL database with real-time capabilities
- **Row Level Security**: Built-in security policies for data protection
- **Authentication**: Supabase Auth with development mode and OAuth support
- **Zero Vendor Lock-in**: Full control over your data and infrastructure

### Query Management
- **AEO Query Generation**: AI-powered generation of Answer Engine Optimization queries
- **Query Analysis**: Automated analysis of brand mentions, sources, and categorization
- **Project Organization**: Organize queries into projects with folders and themes
- **Multi-step Workflow**: Guided 3-step process (Generate → Analyze → Results)

### Data & Analytics
- **10 Query Categories**: Industry monitoring, competitor benchmarking, and more
- **Brand Mention Tracking**: Identify which brands appear in query responses
- **Source Analysis**: Track where queries are answered (forums, docs, etc.)
- **Visual Analytics**: Charts and insights from query analysis
- **Export Capabilities**: PDF reports and CSV exports

### Developer Experience
- **100% API Compatible**: Universal SDK maintains Base44 API compatibility
- **Modern Stack**: React 18, Vite, TailwindCSS, TanStack Query
- **Type Safety**: Zod schemas for form validation
- **Modular Architecture**: Clean separation of concerns

## 🏗️ Architecture

### Tech Stack

**Frontend:**
- React 18.2 + Vite 6.1
- TailwindCSS + Radix UI components
- TanStack React Query for data fetching
- React Hook Form + Zod for forms
- Recharts for visualizations

**Backend:**
- Supabase (PostgreSQL + Auth + Storage)
- Universal Custom SDK (Base44 API compatible)
- Supabase Edge Functions (serverless)

**LLM Integration:**
- Google Gemini API (`gemini-1.5-pro`)
- Abstraction layer in `src/api/llmProvider.js`
- Extensible for OpenAI, Anthropic, etc.

### Database Schema

Four main tables:
- **users** - Authentication and role-based access control
- **folders** - Project organization
- **query_projects** - Project configuration and tracking
- **queries** - Individual queries with analysis results

See `supabase/migrations/` for complete schema.

### Custom SDK

The universal custom SDK (`src/lib/custom-sdk.js`) provides:
- Automatic entity name conversion (PascalCase → snake_case)
- Field name mapping (created_date → created_at)
- Service role support for admin operations
- Dynamic entity creation on-demand
- 100% Base44 API compatibility

## 📚 Documentation

- **[MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)** - Complete setup and migration instructions
- **[BACKEND_FUNCTIONS.md](./BACKEND_FUNCTIONS.md)** - Backend function implementation guide
- **[Database Schema](./supabase/migrations/)** - SQL migrations for database setup

## 🔒 Security

- Row Level Security (RLS) policies on all tables
- Service role key for admin operations (never expose in frontend!)
- Development authentication for local testing
- OAuth support for production (Google, GitHub, etc.)

## 🚧 Roadmap

- [ ] Implement backend functions (see BACKEND_FUNCTIONS.md)
- [ ] Add email notifications (SendEmail integration)
- [ ] Implement file upload to Supabase Storage
- [ ] Add real-time query analysis tracking
- [ ] Multi-user support with user-scoped data
- [ ] Additional LLM provider integrations

## 🤝 Contributing

Contributions are welcome! This is a self-hosted, open-architecture application that you can customize to your needs.

## 📄 License

See LICENSE file for details.

---

**Built with**: React + Vite + Supabase + Gemini AI
