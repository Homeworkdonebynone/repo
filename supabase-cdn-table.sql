-- Supabase table for CDN file metadata
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS cdn_files (
  id TEXT PRIMARY KEY,
  originalName TEXT NOT NULL,
  fileName TEXT NOT NULL,
  size BIGINT NOT NULL,
  mimeType TEXT NOT NULL,
  uploadDate TIMESTAMP WITH TIME ZONE NOT NULL,
  expiryDate TIMESTAMP WITH TIME ZONE NOT NULL,
  githubUrl TEXT NOT NULL,
  compressed BOOLEAN DEFAULT false,
  compressionRatio INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_cdn_files_filename ON cdn_files(fileName);
CREATE INDEX IF NOT EXISTS idx_cdn_files_expiry ON cdn_files(expiryDate);
CREATE INDEX IF NOT EXISTS idx_cdn_files_upload_date ON cdn_files(uploadDate DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE cdn_files ENABLE ROW LEVEL SECURITY;

-- Allow public read access (since files are meant to be shared)
CREATE POLICY "Allow public read access" ON cdn_files
  FOR SELECT USING (true);

-- Allow insert/update/delete for authenticated users only
-- Note: Adjust this policy based on your authentication setup
CREATE POLICY "Allow authenticated users to manage files" ON cdn_files
  FOR ALL USING (true);

-- Grant permissions
GRANT ALL ON cdn_files TO authenticated;
GRANT SELECT ON cdn_files TO anon;
