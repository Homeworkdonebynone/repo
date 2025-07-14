# Supabase Setup Guide

## What is Supabase?

Supabase is a free (with paid tiers) Firebase alternative that provides a PostgreSQL database, authentication, real-time subscriptions, and more. We're using it to enable shared storage so all users see the same wiki pages and gallery items.

## Setting Up Supabase

### 1. Create a Supabase Account

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up for a free account
3. Create a new project
4. Choose a region closest to your users
5. Wait for the project to initialize (2-3 minutes)

### 2. Get Your Project Credentials

1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (starts with `https://`)
   - **anon public** key (starts with `eyJ`)

### 3. Add to Your Environment Variables

Add these to your `.env.local` file:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://hhhwbwvvrgzwvnxalhfy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhoaHdid3Z2cmd6d3ZueGFsaGZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0ODMzMjEsImV4cCI6MjA2ODA1OTMyMX0.nkF4sPrlt3_LBEFfKZc5drkQjbXkFVDMCbJ9G6FGYD8
```

For Vercel deployment, add these in your Vercel dashboard under **Settings** → **Environment Variables**.

### 4. Create Database Tables

In your Supabase dashboard, go to **SQL Editor** and run this script:

```sql
-- Enable Row Level Security (RLS) for all tables
-- Note: Since we're using anon access, we'll allow all operations for simplicity
-- In production, you might want more restrictive policies

-- Create wiki_pages table
CREATE TABLE wiki_pages (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  last_modified TIMESTAMP WITH TIME ZONE NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  created_by TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create gallery_items table  
CREATE TABLE gallery_items (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('image', 'video')),
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  thumbnail_url TEXT,
  added_by TEXT NOT NULL DEFAULT 'admin',
  added_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create categories table
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#8B5CF6',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create visitor_logs table
CREATE TABLE visitor_logs (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  country TEXT DEFAULT 'Unknown',
  ip TEXT NOT NULL,
  user_agent TEXT DEFAULT '',
  page TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create activity_logs table
CREATE TABLE activity_logs (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'edit', 'delete')),
  page_id TEXT NOT NULL,
  page_title TEXT NOT NULL,
  user_role TEXT NOT NULL CHECK (user_role IN ('viewer', 'admin', 'super-admin')),
  ip TEXT NOT NULL,
  country TEXT DEFAULT 'Unknown',
  user_agent TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create invincible_pages table (pages protected from deletion)
CREATE TABLE invincible_pages (
  page_id TEXT PRIMARY KEY,
  created_by TEXT NOT NULL DEFAULT 'super-admin',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create rate_limits table (for IP-based rate limiting)
CREATE TABLE rate_limits (
  ip TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt TIMESTAMP WITH TIME ZONE NOT NULL,
  lockout_until TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default categories
INSERT INTO categories (id, name, color) VALUES
  ('general', 'General', '#8B5CF6'),
  ('jokes', 'Inside Jokes', '#F59E0B'),
  ('members', 'Members', '#10B981'),
  ('adventures', 'Adventures', '#EF4444'),
  ('quotes', 'Quotes', '#3B82F6')
ON CONFLICT (id) DO NOTHING;

-- Enable RLS for all tables
ALTER TABLE wiki_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitor_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE invincible_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all operations for anon users)
-- In production, you'd want more restrictive policies based on authentication

-- Wiki pages policies
CREATE POLICY "Allow all operations on wiki_pages" ON wiki_pages
  FOR ALL USING (true) WITH CHECK (true);

-- Gallery items policies  
CREATE POLICY "Allow all operations on gallery_items" ON gallery_items
  FOR ALL USING (true) WITH CHECK (true);

-- Categories policies
CREATE POLICY "Allow all operations on categories" ON categories
  FOR ALL USING (true) WITH CHECK (true);

-- Visitor logs policies
CREATE POLICY "Allow all operations on visitor_logs" ON visitor_logs
  FOR ALL USING (true) WITH CHECK (true);

-- Activity logs policies
CREATE POLICY "Allow all operations on activity_logs" ON activity_logs
  FOR ALL USING (true) WITH CHECK (true);

-- Invincible pages policies
CREATE POLICY "Allow all operations on invincible_pages" ON invincible_pages
  FOR ALL USING (true) WITH CHECK (true);

-- Rate limits policies
CREATE POLICY "Allow all operations on rate_limits" ON rate_limits
  FOR ALL USING (true) WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX idx_wiki_pages_last_modified ON wiki_pages(last_modified DESC);
CREATE INDEX idx_wiki_pages_category ON wiki_pages(category);
CREATE INDEX idx_gallery_items_added_at ON gallery_items(added_at DESC);
CREATE INDEX idx_gallery_items_type ON gallery_items(type);
CREATE INDEX idx_visitor_logs_timestamp ON visitor_logs(timestamp DESC);
CREATE INDEX idx_visitor_logs_ip ON visitor_logs(ip);
CREATE INDEX idx_activity_logs_timestamp ON activity_logs(timestamp DESC);
CREATE INDEX idx_activity_logs_page_id ON activity_logs(page_id);
CREATE INDEX idx_rate_limits_ip ON rate_limits(ip);
CREATE INDEX idx_rate_limits_last_attempt ON rate_limits(last_attempt DESC);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers to auto-update the updated_at column
CREATE TRIGGER update_wiki_pages_updated_at BEFORE UPDATE ON wiki_pages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gallery_items_updated_at BEFORE UPDATE ON gallery_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rate_limits_updated_at BEFORE UPDATE ON rate_limits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create a view for recent activity (useful for admin panel)
CREATE VIEW recent_activity AS
SELECT 
  al.id,
  al.timestamp,
  al.action,
  al.page_title,
  al.user_role,
  al.ip,
  al.country,
  wp.title as current_page_title
FROM activity_logs al
LEFT JOIN wiki_pages wp ON al.page_id = wp.id
ORDER BY al.timestamp DESC
LIMIT 100;

-- Create a view for visitor statistics
CREATE VIEW visitor_stats AS
SELECT 
  DATE(timestamp) as visit_date,
  COUNT(*) as total_visits,
  COUNT(DISTINCT ip) as unique_visitors,
  array_agg(DISTINCT country) as countries
FROM visitor_logs
GROUP BY DATE(timestamp)
ORDER BY visit_date DESC;
```

### 5. Test Your Setup

1. Restart your development server: `npm run dev`
2. Open your wiki app
3. Try creating a new wiki page or gallery item
4. Check your Supabase dashboard → **Table Editor** to see if the data appears

## How It Works

### Storage Modes

The app now supports two storage modes:

1. **localStorage Only** (default if Supabase not configured)
   - Each user sees only their own content
   - Data stored in browser localStorage
   - No sharing between users or devices

2. **Supabase Shared Storage** (when configured)
   - All users see the same content
   - Data stored in Supabase PostgreSQL database
   - Real-time sharing between all users and devices
   - Automatic fallback to localStorage if Supabase is unavailable

### Data Migration

When you first configure Supabase:
- Existing localStorage data will be automatically synced to Supabase
- Remote data takes priority in case of conflicts
- The sync happens automatically when the app loads

### Troubleshooting

#### "No data appearing in Supabase"
- Check your environment variables are correct
- Verify the SQL schema was executed successfully
- Check browser console for error messages

#### "RLS Policy Error"
- Make sure you ran the full SQL script including the policies
- Verify RLS is enabled on all tables

#### "Connection Issues"
- Check your Supabase project URL and anon key
- Ensure your project is not paused (free tier pauses after inactivity)

## Cost Considerations

### Free Tier Limits (as of 2024)
- **Database**: 500MB storage
- **Bandwidth**: 5GB/month
- **Requests**: 50,000/month
- **Storage**: 1GB

These limits are more than sufficient for a personal wiki with moderate usage.

### Paid Tiers
Start at $25/month for unlimited usage and additional features.

## Security Notes

- The current setup uses anon access for simplicity
- In production, consider implementing proper user authentication
- Row Level Security (RLS) policies can be enhanced for better security
- The anon key is safe to expose publicly (it's designed for client-side use)

## Alternative Backends

If you prefer not to use Supabase, the storage abstraction makes it easy to implement other backends:
- Firebase Firestore
- MongoDB Atlas
- PlanetScale
- Neon
- Custom REST API

The storage interface in `src/utils/supabase.ts` can be adapted for any backend.
