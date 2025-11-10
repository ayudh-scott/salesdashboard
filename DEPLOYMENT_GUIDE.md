# 🚀 Complete Vercel Deployment Guide

## Quick Reference: Adding Environment Variables in Vercel

### Method 1: During Initial Setup (Recommended)

1. **After importing your GitHub repo to Vercel:**
   - You'll see the "Configure Project" page
   - Scroll down to find "Environment Variables" section

2. **For each variable, click "Add" and enter:**
   - **Key**: The variable name (exactly as shown)
   - **Value**: Your actual credential
   - **Environments**: Check all three boxes (Production, Preview, Development)

3. **Add these 7 variables:**

   ```
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_URL
   SUPABASE_SERVICE_ROLE_KEY
   AIRTABLE_PAT
   AIRTABLE_BASE_ID
   WEBHOOK_SECRET
   ```

4. **Click "Deploy"** at the bottom

### Method 2: After Deployment

1. **Go to your project dashboard**
   - Visit: https://vercel.com/dashboard
   - Click on your project name

2. **Navigate to Settings**
   - Click "Settings" tab (top navigation)
   - Click "Environment Variables" (left sidebar)

3. **Add each variable:**
   - Click "Add New" button
   - Enter Name and Value
   - Select all environments
   - Click "Save"

4. **Redeploy (IMPORTANT!):**
   - Go to "Deployments" tab
   - Click "..." menu on latest deployment
   - Click "Redeploy"
   - Confirm

## 📍 Where to Find Each Credential

### Supabase Credentials

**Location:** Supabase Dashboard → Your Project → Settings → API

1. **NEXT_PUBLIC_SUPABASE_URL** and **SUPABASE_URL**
   - Copy the "Project URL" (e.g., `https://xxxxx.supabase.co`)

2. **NEXT_PUBLIC_SUPABASE_ANON_KEY**
   - Copy the "anon public" key

3. **SUPABASE_SERVICE_ROLE_KEY**
   - Copy the "service_role" key
   - ⚠️ **Keep this secret!** Never expose to frontend

### Airtable Credentials

**Location:** Airtable Account Settings

1. **AIRTABLE_PAT** (Personal Access Token)
   - Go to: https://airtable.com/account
   - Scroll to "Developer options"
   - Click "Create new token"
   - Name it (e.g., "Sales Dashboard")
   - Select scopes: `data.records:read`, `schema.bases:read`
   - Copy the token (starts with `pat_`)

2. **AIRTABLE_BASE_ID**
   - Open your Airtable base
   - Look at URL: `https://airtable.com/appXXXXXXXXXXXX/...`
   - Copy the part after `/app` (starts with `app`)

### Webhook Secret

**Generate yourself:**
- Any random string (e.g., `my-secret-webhook-key-2024`)
- Use the same value in Vercel and Airtable automation

## ✅ Checklist

Before deploying, make sure you have:

- [ ] All 7 environment variables ready
- [ ] Supabase project created
- [ ] Airtable PAT created
- [ ] Airtable Base ID copied
- [ ] Webhook secret generated
- [ ] Code pushed to GitHub
- [ ] Vercel account connected to GitHub

After deployment:

- [ ] All variables added to Vercel
- [ ] Variables added to all 3 environments
- [ ] Project redeployed after adding variables
- [ ] Initial sync run (`npm run sync`)
- [ ] Site loads without errors
- [ ] Data visible on dashboard

## 🔧 Post-Deployment Steps

1. **Run Initial Sync:**
   ```bash
   # Install Vercel CLI
   npm i -g vercel
   
   # Login and link
   vercel login
   vercel link
   
   # Pull env vars
   vercel env pull .env.local
   
   # Run sync
   npm run sync
   ```

2. **Update Airtable Webhook URL:**
   - In Airtable automation, update webhook URL to:
   - `https://your-app.vercel.app/api/webhook`

3. **Test the deployment:**
   - Visit your live site
   - Check that data loads
   - Test dark mode toggle
   - Verify navigation works

## 🆘 Common Issues

**"env is missing" error:**
- Add all 7 variables
- Check all 3 environments are selected
- Redeploy after adding

**Build succeeds but site shows errors:**
- Check browser console
- Verify all variables are correct
- Run initial sync

**Data not showing:**
- Run `npm run sync` to populate database
- Check Supabase connection
- Verify RLS policies allow read access

