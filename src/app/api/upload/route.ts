import { NextRequest, NextResponse } from 'next/server'
import { Octokit } from '@octokit/rest'
import { createClient } from '@supabase/supabase-js'

const MAX_FILE_SIZE = 4 * 1024 * 1024 // 4MB (Vercel Hobby plan limit is 4.5MB, leave some buffer)
const GITHUB_MAX_ASSET_SIZE = 2 * 1024 * 1024 * 1024 // 2GB (GitHub's actual limit)
const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const GITHUB_OWNER = process.env.GITHUB_OWNER
const GITHUB_REPO = process.env.GITHUB_REPO

// Supabase for metadata storage
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

interface UploadedFile {
  id: string
  originalName: string
  fileName: string
  size: number
  mimeType: string
  uploadDate: string
  expiryDate: string
  githubUrl: string
}

// GitHub client - REQUIRED for CDN functionality
if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
  console.error('CDN Error: GitHub environment variables are required!')
  console.error('Please set: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO')
}

const octokit = GITHUB_TOKEN ? new Octokit({ auth: GITHUB_TOKEN }) : null

// Get file registry from Supabase or fallback to in-memory
let fileRegistry: UploadedFile[] = []

async function getFileRegistry(): Promise<UploadedFile[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('cdn_files')
        .select('*')
        .order('uploadDate', { ascending: false })
      
      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Failed to fetch from Supabase:', error)
    }
  }
  
  // Fallback to in-memory storage
  return fileRegistry
}

async function saveFileToRegistry(file: UploadedFile) {
  if (supabase) {
    try {
      const { error } = await supabase
        .from('cdn_files')
        .insert([file])
      
      if (error) throw error
      return
    } catch (error) {
      console.error('Failed to save to Supabase:', error)
    }
  }
  
  // Fallback to in-memory storage
  fileRegistry.push(file)
}

async function deleteFileFromRegistry(fileId: string) {
  if (supabase) {
    try {
      const { error } = await supabase
        .from('cdn_files')
        .delete()
        .eq('id', fileId)
      
      if (error) throw error
      return
    } catch (error) {
      console.error('Failed to delete from Supabase:', error)
    }
  }
  
  // Fallback to in-memory storage
  fileRegistry = fileRegistry.filter(f => f.id !== fileId)
}

// Clean up expired files
async function cleanupExpiredFiles() {
  try {
    const files = await getFileRegistry()
    const now = new Date()
    
    for (const file of files) {
      const expiryDate = new Date(file.expiryDate)
      if (expiryDate <= now) {
        console.log(`Cleaning up expired file: ${file.fileName}`)
        await deleteFileFromRegistry(file.id)
        // Note: We don't delete from GitHub Releases as they don't have auto-expiry
        // Files will remain available via GitHub but won't be listed in our CDN
      }
    }
  } catch (error) {
    console.error('Failed to cleanup expired files:', error)
  }
}

// Upload file to GitHub Releases
async function uploadToGitHub(fileBuffer: Buffer, fileName: string): Promise<string> {
  if (!octokit || !GITHUB_OWNER || !GITHUB_REPO) {
    throw new Error('GitHub credentials not configured. Please set GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO environment variables.')
  }
  
  console.log('Uploading to GitHub:', fileName, 'Size:', fileBuffer.length)
  
  try {
    // Create a release if it doesn't exist
    const releaseTag = 'cdn-files'
    let release
    
    try {
      release = await octokit.rest.repos.getReleaseByTag({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        tag: releaseTag
      })
      console.log('Found existing release:', release.data.id)
    } catch (error) {
      // Release doesn't exist, create it
      console.log('Creating new release for CDN files')
      release = await octokit.rest.repos.createRelease({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        tag_name: releaseTag,
        name: 'CDN Files',
        body: 'Auto-uploaded files for CDN'
      })
      console.log('Created new release:', release.data.id)
    }
    
    // Upload file as release asset
    const asset = await octokit.rest.repos.uploadReleaseAsset({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      release_id: release.data.id,
      name: fileName,
      data: fileBuffer as any
    })
    
    console.log('Successfully uploaded to GitHub:', asset.data.browser_download_url)
    return asset.data.browser_download_url
  } catch (error) {
    console.error('GitHub upload error:', error)
    throw new Error('Failed to upload to GitHub Releases')
  }
}

// Handle file upload
export async function POST(request: NextRequest) {
  try {
    await cleanupExpiredFiles()
    
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    
    if (file.size > MAX_FILE_SIZE) {
      const maxSizeMB = MAX_FILE_SIZE / (1024 * 1024)
      return NextResponse.json({ 
        error: `File too large. Maximum size is ${maxSizeMB}MB on Vercel Hobby plan.`,
        details: `Vercel Hobby plan has a 4.5MB request limit. Upgrade to Pro for 100MB support, or use external file hosting for larger files.`
      }, { status: 413 })
    }
    
    // Get file buffer
    const bytes = await file.arrayBuffer()
    const fileBuffer = Buffer.from(bytes)
    
    // Generate unique filename
    const fileId = Date.now().toString()
    const ext = file.name.split('.').pop() || ''
    const fileName = `${fileId}.${ext}`
    
    // Upload to GitHub Releases
    const githubUrl = await uploadToGitHub(fileBuffer, fileName)
    
    // Create file record
    const now = new Date()
    const expiryDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000) // 14 days
    
    const fileRecord: UploadedFile = {
      id: fileId,
      originalName: file.name,
      fileName: fileName,
      size: fileBuffer.length,
      mimeType: file.type,
      uploadDate: now.toISOString(),
      expiryDate: expiryDate.toISOString(),
      githubUrl
    }
    
    // Save to registry
    await saveFileToRegistry(fileRecord)
    
    return NextResponse.json({
      success: true,
      file: fileRecord,
      message: 'File uploaded successfully'
    })
    
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ 
      error: 'Upload failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}

// Get list of uploaded files
export async function GET() {
  try {
    await cleanupExpiredFiles()
    const files = await getFileRegistry()
    return NextResponse.json({ files })
  } catch (error) {
    console.error('Failed to get files:', error)
    return NextResponse.json({ error: 'Failed to get files' }, { status: 500 })
  }
}

// Delete specific file
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('id')
    
    if (!fileId) {
      return NextResponse.json({ error: 'File ID required' }, { status: 400 })
    }
    
    // Remove from registry (GitHub file will remain but won't be listed)
    await deleteFileFromRegistry(fileId)
    
    return NextResponse.json({ success: true, message: 'File deleted successfully' })
  } catch (error) {
    console.error('Delete error:', error)
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 })
  }
}
