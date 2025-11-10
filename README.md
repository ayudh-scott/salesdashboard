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

### Deploy to Vercel

1. Push your code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy!

### Environment Variables for Production

Set these in Vercel:

- `AIRTABLE_PAT`
- `AIRTABLE_BASE_ID`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `WEBHOOK_SECRET`

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

