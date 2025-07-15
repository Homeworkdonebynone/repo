# Migration to Google Cloud Storage

## Setup Steps

### 1. Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Cloud Storage API

### 2. Create Storage Bucket
1. Go to Cloud Storage → Buckets
2. Create new bucket:
   - Name: `dorps-wiki-cdn` (or your preferred name)
   - Location: Choose region closest to your users
   - Storage class: Standard
   - Access control: Fine-grained (recommended)
   - Public access: Allow (for CDN access)

### 3. Create Service Account
1. Go to IAM & Admin → Service Accounts
2. Create new service account:
   - Name: `dorps-wiki-storage`
   - Role: Storage Admin (or Storage Object Admin)
3. Create and download JSON key file
4. Store key file securely (don't commit to git!)

### 4. Set Bucket Permissions
1. Go to your bucket → Permissions
2. Add principal: `allUsers`
3. Role: Storage Object Viewer
4. This allows public read access to files

### 5. Environment Variables
Add to your `.env.local`:
```
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_BUCKET_NAME=dorps-wiki-cdn
GOOGLE_CLOUD_KEY_FILE=path/to/service-account-key.json
```

## Cost Estimation

### Storage Costs
- Standard: $0.020/GB/month
- First 5GB free

### Transfer Costs
- First 1TB: $0.12/GB
- Next 9TB: $0.11/GB

### Examples
- 10GB storage + 50GB downloads = ~$6.40/month
- 50GB storage + 200GB downloads = ~$25/month

## Migration Benefits
- No GitHub releases cluttering your repo
- Proper CDN with global edge locations
- Better performance and reliability
- More professional solution
- Supports larger files if needed later
