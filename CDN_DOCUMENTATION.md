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
- One-click file deletion

### Video Features
- Custom video player at `/player/{videoId}`
- Discord-friendly embed support
- Download and sharing options
- Compression for videos > 50MB
- Open Graph meta tags for social media

### CDN Integration
- Local file storage in `/uploads` directory
- Optional GitHub Releases backup
- Direct file serving at `/api/files/{filename}`
- File registry with metadata tracking

## Setup Instructions

### 1. Basic Setup (Local Storage Only)
The CDN works out of the box with local file storage. No additional configuration needed.

### 2. GitHub Releases Integration (Optional)
To enable automatic backup to GitHub Releases:

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
   ```

4. **Deploy with environment variables:**
   For Vercel deployment, add these as environment variables in your Vercel dashboard.

## How It Works

### File Upload Process
1. User uploads file via CDN manager
2. File is saved to local `/uploads` directory
3. If file is large:
   - Videos > 50MB: Compressed using FFmpeg
   - Images > 1MB: Compressed using Sharp
4. File metadata stored in registry.json
5. If GitHub configured: File uploaded to GitHub Releases
6. User gets shareable links

### Auto-Deletion
- Files automatically expire after 14 days
- Cleanup runs on each API call
- Expired files removed from both local storage and registry

### File Serving
- Direct access: `/api/files/{filename}`
- Video player: `/player/{videoId}` (for videos only)
- GitHub backup: Direct GitHub Releases URL (if configured)

## Usage

### Accessing the CDN Manager
1. Log in to the wiki with admin or super-admin privileges
2. Click the "CDN" button in the header (orange button)
3. Upload files via drag & drop or browse

### File Management
- **View**: Click "View" to open file or video player
- **Download**: Click "Download" for direct file download
- **Copy Link**: Copy direct file URL to clipboard
- **Player Link**: (Videos only) Copy embeddable player URL
- **Delete**: Remove file immediately

### Sharing Files
- **Direct Link**: `yoursite.com/api/files/{filename}`
- **Video Player**: `yoursite.com/player/{videoId}`
- **GitHub Backup**: Direct GitHub Releases URL (if configured)

## Technical Details

### File Compression
- **Videos**: Uses FFmpeg with H.264 encoding, CRF 23, max 1080p
- **Images**: Uses Sharp with 80% quality, progressive JPEG
- **Compression Target**: ~20% file size reduction

### Storage Structure
```
uploads/
├── registry.json          # File metadata database
├── {timestamp}.{ext}      # Original uploaded files
└── {timestamp}_compressed.{ext}  # Compressed versions
```

### API Endpoints
- `POST /api/upload` - Upload new file
- `GET /api/upload` - List all files
- `DELETE /api/upload?id={fileId}` - Delete specific file
- `GET /api/files/{filename}` - Serve file content

### Security Features
- File size validation (500MB limit)
- File type detection and validation
- Automatic cleanup of expired files
- Secure file serving with proper MIME types

## Troubleshooting

### GitHub Upload Not Working
1. Check environment variables are set correctly
2. Verify GitHub token has `repo` scope
3. Check console logs for detailed error messages
4. Ensure repository exists and token has access

### File Upload Fails
1. Check file size (max 500MB)
2. Ensure `/uploads` directory is writable
3. Check disk space availability
4. Verify FFmpeg is properly installed for video compression

### Video Compression Issues
1. FFmpeg binary must be available
2. Check supported video formats
3. Large videos may take time to process
4. Check server memory/CPU resources

## Integration Examples

### Discord Embeds
Videos uploaded to the CDN automatically support Discord embeds:
```
https://yoursite.com/player/1234567890
```

### Direct File Access
Any file can be accessed directly:
```
https://yoursite.com/api/files/1234567890.jpg
```

### GitHub Backup URLs
When GitHub integration is enabled:
```
https://github.com/owner/repo/releases/download/cdn-files/1234567890.mp4
```

## Performance Considerations

- Large video compression is CPU intensive
- Consider server resources for concurrent uploads
- GitHub Releases has rate limits for API calls
- Local storage cleanup runs automatically but may impact performance

## Security Notes

- All files are publicly accessible once uploaded
- No authentication required for file access
- Files auto-expire for security (14 days)
- GitHub tokens should be kept secure
- Consider implementing additional access controls if needed

## Future Enhancements

Potential improvements for the CDN system:
- User-specific file management
- Custom expiry times
- File access analytics
- Integration with cloud storage (S3, Cloudflare R2)
- Batch upload support
- File preview generation
- Enhanced video player controls
- Live streaming support
