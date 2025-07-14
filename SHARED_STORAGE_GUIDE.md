# Shared Storage Setup Guide

## The Problem

Currently, your wiki pages and gallery items are stored in **localStorage**, which means:
- ❌ Each user only sees their own content
- ❌ Content is tied to a specific browser/device
- ❌ No collaboration between users
- ❌ Data loss if browser storage is cleared

## The Solution

I've implemented **hybrid storage** that supports both localStorage and shared cloud storage via Supabase.

## Option 1: Quick Setup with Supabase (Recommended)

### 1. Create Free Supabase Account
1. Go to [https://supabase.com](https://supabase.com)
2. Sign up for free (500MB database, plenty for a wiki)
3. Create a new project
4. Wait 2-3 minutes for initialization

### 2. Get Your Credentials
1. In Supabase dashboard: **Settings** → **API**
2. Copy your **Project URL** and **anon public key**

### 3. Configure Your App
Add these to your `.env.local` file:
```bash
# Add these lines to your existing .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...your-key-here
```

### 4. Setup Database
1. In Supabase: **SQL Editor**
2. Copy and run the SQL from `SUPABASE_SETUP.md`
3. This creates the necessary tables

### 5. Deploy to Vercel
1. Add the same environment variables in Vercel dashboard
2. Redeploy your app

## What Happens After Setup?

### ✅ Shared Storage Active
- 🌐 All users see the same wiki pages and gallery
- ☁️ Data stored in the cloud (Supabase PostgreSQL)
- 🔄 Real-time synchronization between users
- 📱 Access from any device
- 🔒 Secure and persistent storage

### 📊 Storage Status Indicators
- **Green "Shared Storage"**: Supabase is working
- **Yellow "Local Only"**: Using localStorage fallback

## Migration Process

When you first add Supabase credentials:
1. **Automatic sync**: Existing localStorage data uploads to Supabase
2. **No data loss**: All your current content is preserved
3. **Instant sharing**: Other users immediately see the content

## Option 2: Keep Local Storage

If you prefer to keep things simple:
- No setup required
- Each user has private content
- Good for personal use or testing

## Option 3: Alternative Backends

The storage system is designed to be flexible. You can easily implement:
- **Firebase Firestore**
- **MongoDB Atlas**
- **PlanetScale**
- **Custom REST API**

The interface is in `src/utils/hybridStorage.ts` and can be adapted for any backend.

## Troubleshooting

### "Nothing appears after setup"
- Check environment variables are correct
- Verify SQL schema was run successfully
- Check browser console for errors

### "Mixed content issues"
- Ensure your Supabase URL uses HTTPS
- Check that anon key is correct

### "Build fails"
- Supabase dependencies are already installed
- Run `npm run build` to verify

## Cost

**Supabase Free Tier:**
- 500MB database storage
- 5GB bandwidth/month
- 50,000 requests/month
- Perfect for personal wikis

**Paid tiers** start at $25/month for unlimited usage.

## Next Steps

1. Follow the Supabase setup above
2. Test by creating a wiki page
3. Check that other users can see it
4. Enjoy shared collaboration! 🎉

## Support

If you need help with setup:
1. Check `SUPABASE_SETUP.md` for detailed SQL instructions
2. Verify your environment variables
3. Test locally with `npm run dev` before deploying
