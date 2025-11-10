# Airtable ↔ Supabase Realtime Dashboard

A production-grade, fully responsive dashboard that syncs Airtable data to Supabase with real-time updates via webhooks. Built with Next.js, TypeScript, Tailwind CSS, and Framer Motion.

## ✨ Features

- 🔄 **Automatic Sync**: Sync all Airtable tables to Supabase with a single command
- ⚡ **Real-time Updates**: Webhook-based updates keep data in sync automatically
- 📱 **Mobile-First**: Fully responsive design with hamburger menu and bottom navigation
- 🌓 **Dark Mode**: Day/night theme toggle with smooth transitions
- 🎨 **Beautiful UI**: Minimalist design with smooth animations
- 📊 **Insights Dashboard**: Charts and statistics for your data
- 🔒 **Secure**: Server-side only credentials, read-only frontend

## 🏗️ Architecture

- **Frontend**: Next.js 14 (App Router) + React + Tailwind CSS + TypeScript + Framer Motion
- **Backend**: Next.js API routes
- **Database**: Supabase (PostgreSQL + Realtime)
- **Sync**: Airtable Personal Access Token + Webhooks
- **Deployment**: Vercel (frontend & API) + Supabase (DB)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Airtable account with Personal Access Token
- Supabase account and project
- Airtable base with data

### 1. Clone and Install

```bash
git clone <your-repo>
cd salesdashboard
npm install
```

### 2. Environment Setup

Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

Required environment variables:

```env
# Airtable Configuration
AIRTABLE_PAT=pat_XXXXXXXXXXXX
AIRTABLE_BASE_ID=appXXXXXXXXXXXX

# Supabase Configuration
SUPABASE_URL=https://xyz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=service_role_XXXXXXXXXXXX
SUPABASE_ANON_KEY=anon_XXXXXXXXXXXX

# Webhook Security
WEBHOOK_SECRET=supersecretstring
```

**Getting Your Credentials:**

- **Airtable PAT**: [Create a Personal Access Token](https://airtable.com/create/tokens)
- **Airtable Base ID**: Found in your base URL: `https://airtable.com/appXXXXXXXXXXXX/...`
- **Supabase Keys**: Found in Project Settings > API

### 3. Create Database Schema

Generate and run the SQL migration:

```bash
npm run generate-migration
```

This creates a `migration-*.sql` file. Run it in Supabase SQL Editor:

1. Go to Supabase Dashboard > SQL Editor
2. Paste the generated SQL
3. Click "Run"

Alternatively, tables will be created automatically during the first sync (with instructions printed).

### 4. Initial Sync

Sync all Airtable data to Supabase:

```bash
npm run sync
```

This will:
- Fetch all tables from Airtable
- Create Supabase tables (if they don't exist)
- Import all records
- Set up metadata tracking

### 5. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see your dashboard!

## 🔗 Setting Up Airtable Webhooks

To enable real-time updates, set up Airtable automations that call your webhook endpoint.

### Option 1: Airtable Automations (Recommended)

1. In Airtable, go to your base > Automations
2. Create a new automation with trigger: "When record matches conditions" or "When record is created/updated/deleted"
3. Add action: "Run a script" or use "Send web request"
4. Configure the webhook:

   - **URL**: `https://your-domain.vercel.app/api/webhook`
   - **Method**: POST
   - **Body** (JSON):
     ```json
     {
       "event": "{{trigger.event}}",
       "tableId": "{{trigger.tableId}}",
       "tableName": "{{trigger.tableName}}",
       "recordId": "{{trigger.recordId}}",
       "secret": "your-webhook-secret"
     }
     ```

### Option 2: Manual Webhook Testing

Test webhooks locally:

```bash
# Start dev server first
npm run dev

# In another terminal, test webhook
tsx scripts/test-webhook.ts create tblXXXXXXXXXXXX "My Table" recXXXXXXXXXXXX
```

### Webhook Security

The webhook endpoint validates requests using the `WEBHOOK_SECRET`. Make sure to:
- Use a strong, random secret
- Never commit secrets to version control
- Set the secret in your deployment environment variables

## 📁 Project Structure

```
├── app/
│   ├── api/
│   │   └── webhook/
│   │       └── route.ts          # Webhook endpoint
│   ├── tables/
│   │   ├── page.tsx              # Tables listing
│   │   └── [tableId]/
│   │       └── page.tsx          # Table detail view
│   ├── insights/
│   │   └── page.tsx              # Analytics page
│   ├── page.tsx                  # Home page
│   ├── layout.tsx                # Root layout
│   └── globals.css               # Global styles
├── components/
│   ├── Navbar.tsx                # Top navigation
│   ├── BottomNav.tsx             # Mobile bottom nav
│   ├── HamburgerMenu.tsx         # Slide-over menu
│   ├── ThemeToggle.tsx           # Dark mode toggle
│   ├── TableCard.tsx             # Table card component
│   ├── RecordList.tsx            # Record list component
│   └── ThemeProvider.tsx         # Theme context
├── lib/
│   ├── airtableClient.ts         # Airtable API client
│   ├── supabaseClient.ts         # Supabase client & utilities
│   └── utils.ts                  # Utility functions
├── scripts/
│   ├── sync.ts                   # Sync script
│   ├── generate-migration.ts     # SQL migration generator
│   └── test-webhook.ts           # Webhook testing script
├── .env.example                  # Environment template
└── README.md                     # This file
```

## 🚢 Deployment

### Complete Guide: Deploying to Vercel

#### Step 1: Push Your Code to GitHub

1. **Initialize Git** (if not already done):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. **Create a GitHub Repository**:
   - Go to [GitHub](https://github.com/new)
   - Create a new repository (e.g., `salesdashboard`)
   - **Don't** initialize with README, .gitignore, or license

3. **Push Your Code**:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/salesdashboard.git
   git branch -M main
   git push -u origin main
   ```

#### Step 2: Import Project to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New..."** → **"Project"**
3. Click **"Import Git Repository"**
4. Select your GitHub repository
5. Vercel will auto-detect Next.js settings

#### Step 3: Add Environment Variables in Vercel

**Method 1: During Project Setup (Easiest)**

1. After importing, you'll see the **"Configure Project"** page
2. Scroll down to the **"Environment Variables"** section
3. Add each variable one by one using the **"Add"** button:

   **Add these 7 environment variables:**

   | Variable Name | Value | Environments |
   |--------------|-------|--------------|
   | `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase URL (e.g., `https://xxxxx.supabase.co`) | ✅ Production, ✅ Preview, ✅ Development |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon/public key | ✅ Production, ✅ Preview, ✅ Development |
   | `SUPABASE_URL` | Same as `NEXT_PUBLIC_SUPABASE_URL` | ✅ Production, ✅ Preview, ✅ Development |
   | `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service_role key | ✅ Production, ✅ Preview, ✅ Development |
   | `AIRTABLE_PAT` | Your Airtable Personal Access Token (starts with `pat_`) | ✅ Production, ✅ Preview, ✅ Development |
   | `AIRTABLE_BASE_ID` | Your Airtable Base ID (starts with `app`) | ✅ Production, ✅ Preview, ✅ Development |
   | `WEBHOOK_SECRET` | A random secret string (e.g., `my-super-secret-key-12345`) | ✅ Production, ✅ Preview, ✅ Development |

4. For each variable:
   - Enter the **Name** (exactly as shown above)
   - Enter the **Value**
   - Check all three environments: **Production**, **Preview**, and **Development**
   - Click **"Add"**

5. After adding all variables, click **"Deploy"** button at the bottom

**Method 2: Add After Deployment**

If you already deployed or need to add variables later:

1. Go to your project dashboard on Vercel
2. Click on **"Settings"** tab (top navigation bar)
3. Click on **"Environment Variables"** in the left sidebar
4. Click **"Add New"** button
5. Enter:
   - **Name**: The variable name (e.g., `NEXT_PUBLIC_SUPABASE_URL`)
   - **Value**: The variable value
   - **Environments**: Select **Production**, **Preview**, and **Development**
6. Click **"Save"**
7. **Important:** After adding variables, you **must redeploy**:
   - Go to **"Deployments"** tab
   - Find the latest deployment
   - Click the **"..."** (three dots) menu
   - Click **"Redeploy"**
   - Confirm redeployment

#### Step 4: Where to Find Your Credentials

**Supabase Credentials:**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **API**
4. You'll find:
   - **Project URL** → Use for `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_URL`
   - **anon public** key → Use for `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → Use for `SUPABASE_SERVICE_ROLE_KEY` (⚠️ Keep this secret!)

**Airtable Credentials:**
1. **Personal Access Token (PAT)**:
   - Go to [Airtable Account](https://airtable.com/account)
   - Scroll to **"Developer options"**
   - Click **"Create new token"**
   - Give it a name (e.g., "Sales Dashboard")
   - Select scopes: `data.records:read`, `schema.bases:read`
   - Copy the token (starts with `pat_`)

2. **Base ID**:
   - Open your Airtable base
   - Look at the URL: `https://airtable.com/appXXXXXXXXXXXX/...`
   - The part after `/app` is your Base ID (starts with `app`)

**Webhook Secret:**
- Generate any random string (e.g., `my-secret-webhook-key-2024`)
- Use the same value in both Vercel and your Airtable automation

#### Step 5: Verify Deployment

1. After deployment completes, click **"Visit"** to open your live site
2. The site should load successfully
3. If you see errors, check:
   - All environment variables are correctly set
   - Variables are added to all environments (Production, Preview, Development)
   - You've redeployed after adding variables

#### Step 6: Run Initial Data Sync

After deployment, you need to populate your database:

**Option A: Using Vercel CLI (Recommended)**

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. Link your project:
   ```bash
   cd salesdashboard
   vercel link
   ```
   - Select your project
   - Select the directory (keep defaults)

4. Pull environment variables:
   ```bash
   vercel env pull .env.local
   ```
   This creates a `.env.local` file with all your Vercel environment variables

5. Run sync locally:
   ```bash
   npm run sync
   ```
   This will use the environment variables from `.env.local` to sync your data

**Option B: Create a Sync API Endpoint (Alternative)**

Create `app/api/sync/route.ts`:
```typescript
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // Add authentication
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.WEBHOOK_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Import and run sync
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    const { stdout, stderr } = await execAsync('npm run sync');
    return NextResponse.json({ 
      success: true, 
      output: stdout,
      error: stderr 
    });
  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
```

Then call it:
```bash
curl -X POST https://your-app.vercel.app/api/sync \
  -H "Authorization: Bearer YOUR_WEBHOOK_SECRET"
```

### Environment Variables Summary

| Variable Name | Description | Where to Find |
|--------------|-------------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase Dashboard → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key (public) | Supabase Dashboard → Settings → API → anon public |
| `SUPABASE_URL` | Same as NEXT_PUBLIC_SUPABASE_URL | Supabase Dashboard → Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (secret!) | Supabase Dashboard → Settings → API → service_role |
| `AIRTABLE_PAT` | Airtable Personal Access Token | Airtable Account → Developer options → Create token |
| `AIRTABLE_BASE_ID` | Airtable Base ID | Airtable Base URL (after `/app`) |
| `WEBHOOK_SECRET` | Secret for webhook authentication | Generate a random string |

### Important Notes

1. **Never commit `.env` files** - They're already in `.gitignore`
2. **Service Role Key is sensitive** - Only use server-side, never expose to client
3. **Redeploy after adding variables** - Changes only take effect after redeployment
4. **Use same values for all environments** - Or set different values if needed
5. **Variable names are case-sensitive** - Must match exactly
6. **NEXT_PUBLIC_ prefix** - Variables starting with `NEXT_PUBLIC_` are exposed to the browser

### Troubleshooting Deployment

**Build fails with "env is missing" error:**
- ✅ Make sure all 7 environment variables are added
- ✅ Check that variables are added to all environments (Production, Preview, Development)
- ✅ Verify variable names match exactly (case-sensitive)
- ✅ Redeploy after adding variables

**Site loads but shows errors:**
- ✅ Check browser console for specific errors
- ✅ Verify environment variables are correct
- ✅ Make sure you've run the initial sync (`npm run sync`)
- ✅ Check Supabase connection with correct keys

**Data not syncing:**
- ✅ Verify `AIRTABLE_PAT` and `AIRTABLE_BASE_ID` are correct
- ✅ Check Supabase connection with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- ✅ Run sync manually using Vercel CLI or API endpoint

### Update Webhook URL

After deployment, update your Airtable automation webhook URL to:
```
https://your-app.vercel.app/api/webhook
```

### Enable Supabase Realtime

1. Go to Supabase Dashboard > Database > Replication
2. Enable replication for all synced tables
3. Or run this SQL for each table:
   ```sql
   ALTER PUBLICATION supabase_realtime ADD TABLE your_table_name;
   ```

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run sync` - Sync Airtable → Supabase
- `npm run generate-migration` - Generate SQL migration file
- `tsx scripts/test-webhook.ts` - Test webhook endpoint

## 📊 How It Works

### Data Flow

1. **Initial Sync**: `npm run sync` fetches all tables and records from Airtable and imports them into Supabase
2. **Schema Mapping**: Airtable field types are automatically mapped to PostgreSQL types
3. **Real-time Updates**: Airtable automations trigger webhooks → API updates Supabase → Frontend receives updates via Supabase Realtime
4. **Frontend**: React components subscribe to Supabase Realtime channels for live updates

### Database Schema

Each synced table includes:

- `id` (uuid) - Primary key
- `airtable_id` (text) - Unique Airtable record ID
- `raw_json` (jsonb) - Complete Airtable record data
- `created_at` (timestamptz) - Record creation time
- `updated_at` (timestamptz) - Last update time
- `deleted` (boolean) - Soft delete flag
- Field columns - Dynamically created based on Airtable schema

## 🐛 Troubleshooting

### Sync Issues

**Error: "Table does not exist"**
- Run the generated migration SQL in Supabase SQL Editor
- Or check that table names are sanitized correctly (spaces → underscores)

**Error: "AIRTABLE_PAT is not set"**
- Ensure `.env.local` exists and contains all required variables
- Check that environment variables are loaded correctly

### Webhook Issues

**Webhook returns 401**
- Verify `WEBHOOK_SECRET` matches in both Airtable automation and `.env.local`
- Check that the secret is sent in the webhook payload

**Webhook returns 404**
- Ensure the webhook URL is correct: `/api/webhook`
- Check that the API route is deployed

### Frontend Issues

**No data showing**
- Run `npm run sync` to import data
- Check browser console for errors
- Verify Supabase ANON key is correct
- Ensure RLS (Row Level Security) policies allow read access

**Realtime not working**
- Enable replication in Supabase Dashboard
- Check that tables are added to `supabase_realtime` publication
- Verify Supabase Realtime is enabled for your project

## 🔒 Security Notes

- **Never expose** `AIRTABLE_PAT` or `SUPABASE_SERVICE_ROLE_KEY` to the frontend
- Frontend uses only `SUPABASE_ANON_KEY` (read-only)
- Webhook endpoint validates `WEBHOOK_SECRET`
- Consider adding rate limiting for production
- Set up Supabase RLS policies for additional security

## 📝 License

MIT

## 🤝 Contributing

Contributions welcome! Please open an issue or PR.

---

Built with ❤️ using Next.js, Supabase, and Airtable

