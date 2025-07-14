# CDN System Documentation

## Overview

The Dorps Wiki now includes a complete CDN (Content Delivery Network) system that uploads files directly to **GitHub Releases** for hosting, with no local storage. All files are stored and served from GitHub Releases.

## Features

- 🚀 **500MB file upload limit**
- 🎥 **Automatic video compression** (20% reduction for large videos)
- 🖼️ **Image compression** for files over 1MB
- ⏰ **Auto-deletion after 14 days** (from file registry)
- 🔗 **Direct GitHub Releases URLs**
- 📱 **Custom video player with embeddable links**
- ☁️ **100% GitHub-hosted** (no local storage)

## Features

### File Upload & Management
- Drag & drop or browse to upload files
- Support for all file types (images, videos, documents, etc.)
- Real-time upload progress
- File compression for optimization
- File list with expiry countdown
- One-click file deletion (from registry)

### Video Features
- Custom video player at `/player/{videoId}`
- Discord-friendly embed support
- Download and sharing options
- Compression for videos > 50MB
- Open Graph meta tags for social media

### CDN Integration
- **GitHub Releases storage** (REQUIRED)
- **Supabase metadata storage** (for file registry)
- Direct file serving via GitHub URLs
- Custom redirect through `/api/files/{filename}`

## Setup Instructions

### 1. GitHub Releases Setup (REQUIRED)
The CDN requires GitHub environment variables to function:

1. **Create a GitHub Personal Access Token:**
   - Go to GitHub Settings > Developer settings > Personal access tokens
   - Click "Generate new token (classic)"
   - Select the `repo` scope (full control of private repositories)
   - Copy the generated token

2. **Set up a GitHub repository:**
   - Create a new repository or use an existing one
   - The repository will store uploaded files as release assets

3. **Configure environment variables:**
   Add these to your `.env.local` file:
   ```bash
   GITHUB_TOKEN=your_github_personal_access_token_here
   GITHUB_OWNER=your_github_username
   GITHUB_REPO=your_repository_name
   ```

### 2. Supabase Setup (REQUIRED for metadata)
1. Create a Supabase project at https://supabase.com
2. Run the SQL script in `supabase-cdn-table.sql` to create the `cdn_files` table
3. Add Supabase credentials to `.env.local`:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

### 3. Deploy with environment variables
For Vercel deployment, add all environment variables in your Vercel dashboard.

## How It Works

### File Upload Process
1. User uploads file via CDN manager
2. File is processed in memory (compressed if needed)
3. File is uploaded directly to GitHub Releases
4. File metadata stored in Supabase
5. User gets shareable GitHub URLs

### Auto-Deletion
- Files automatically expire after 14 days
- Cleanup removes entries from Supabase registry
- Files remain on GitHub but won't be listed in CDN
- Manual cleanup of GitHub files can be done via GitHub UI

### File Serving
- Direct access: GitHub Releases URL
- Custom redirect: `/api/files/{filename}` → GitHub URL
- Video player: `/player/{videoId}` (for videos only)

## Usage

### Accessing the CDN Manager
1. Log in to the wiki with admin or super-admin privileges
2. Click the "CDN" button in the header (orange button)
3. Upload files via drag & drop or browse

### File Management
- **View**: Click "View" to open file or video player
- **Download**: Click "Download" for direct file download
- **Copy Link**: Copy redirect URL to clipboard
- **Player Link**: (Videos only) Copy embeddable player URL
- **GitHub**: Direct GitHub Releases URL
- **Delete**: Remove from registry (GitHub file persists)

### Sharing Files
- **Redirect Link**: `yoursite.com/api/files/{filename}` → GitHub URL
- **Direct Link**: `github.com/owner/repo/releases/download/cdn-files/{filename}`
- **Video Player**: `yoursite.com/player/{videoId}`

## Technical Details

### File Compression
- **Videos**: Uses FFmpeg with H.264 encoding, CRF 23, max 1080p
- **Images**: Uses Sharp with 80% quality, progressive JPEG
- **Compression Target**: ~20% file size reduction
- **Processing**: All done in memory, no temp files

### Storage Structure
- **GitHub Releases**: All files stored as release assets under tag `cdn-files`
- **Supabase**: File metadata, expiry tracking, registry
- **No Local Storage**: Files never touch the server filesystem

### API Endpoints
- `POST /api/upload` - Upload file to GitHub + save metadata
- `GET /api/upload` - List all files from Supabase
- `DELETE /api/upload?id={fileId}` - Delete from registry only
- `GET /api/files/{filename}` - Redirect to GitHub URL

### Security Features
- File size validation (500MB limit)
- File type detection and validation
- Automatic cleanup of expired registry entries
- Files served directly from GitHub (CDN benefits)

## Environment Variables Required

```bash
# GitHub Releases (REQUIRED)
GITHUB_TOKEN=your_github_personal_access_token
GITHUB_OWNER=your_github_username
GITHUB_REPO=your_repository_name

# Supabase (REQUIRED for metadata)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional: Other wiki environment variables
JWT_SECRET=your-jwt-secret
ADMIN_PASSWORD_HASH=your-admin-hash
VIEWER_PASSWORD_HASH=your-viewer-hash
```

## Troubleshooting

### GitHub Upload Fails
1. **Check environment variables**: Ensure all GitHub vars are set
2. **Token permissions**: Verify token has `repo` scope
3. **Repository access**: Ensure token can access the repository
4. **Rate limits**: GitHub has API rate limits
5. **File size**: GitHub has 2GB limit for release assets

### File Not Found
1. **Check Supabase**: File metadata might be missing
2. **Check expiry**: File might have expired from registry
3. **GitHub connectivity**: Direct GitHub URL should still work
4. **Permissions**: Repository might be private

### Video Compression Issues
1. **FFmpeg**: Ensure FFmpeg is available in environment
2. **Memory**: Large video compression requires RAM
3. **Timeout**: Large files may timeout on serverless platforms
4. **Format support**: Some video formats may not be supported

## Integration Examples

### Discord Embeds
Videos uploaded to the CDN automatically support Discord embeds:
```
https://yoursite.com/player/1234567890
```

### Direct GitHub Access
Any file can be accessed directly from GitHub:
```
https://github.com/owner/repo/releases/download/cdn-files/1234567890.jpg
```

### Custom Redirect
Access via your domain (redirects to GitHub):
```
https://yoursite.com/api/files/1234567890.jpg
```

## Performance Considerations

- **GitHub CDN**: Files served from GitHub's global CDN
- **No server storage**: Reduces server disk usage to zero
- **Memory usage**: File compression happens in memory
- **API limits**: GitHub has rate limits for uploads
- **Bandwidth**: All file serving happens via GitHub

## Security Notes

- **Public access**: All files are publicly accessible via GitHub
- **No authentication**: File access doesn't require login
- **Expiry tracking**: Only registry entries expire, not GitHub files
- **Token security**: Keep GitHub token secure and scoped properly
- **Repository visibility**: Consider using private repos for sensitive files

## Benefits of GitHub-Only Approach

1. **Zero local storage**: No server disk usage
2. **Global CDN**: GitHub's worldwide content delivery
3. **High availability**: GitHub's infrastructure reliability
4. **Large file support**: Up to 2GB per file on GitHub
5. **Version control**: Files are tracked in release history
6. **Cost effective**: No additional CDN costs
7. **Backup included**: Files are automatically backed up
8. **Direct access**: Files accessible even if your app is down

## Limitations

1. **GitHub dependency**: Requires GitHub account and repository
2. **Public files**: All files are publicly accessible
3. **API limits**: GitHub rate limiting may affect bulk uploads
4. **No real deletion**: Files persist on GitHub after "deletion"
5. **Processing time**: Large video compression may be slow
6. **Memory usage**: All processing happens in RAM
