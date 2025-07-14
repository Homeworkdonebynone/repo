import { NextRequest, NextResponse } from 'next/server'
import { Octokit } from '@octokit/rest'
import { createClient } from '@supabase/supabase-js'
import { writeFile, readFile, unlink, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const CHUNK_SIZE = 3.5 * 1024 * 1024 // 3.5MB chunks (safe for 4.5MB limit)

// GitHub and Supabase config
const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const GITHUB_OWNER = process.env.GITHUB_OWNER
const GITHUB_REPO = process.env.GITHUB_REPO

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

const octokit = GITHUB_TOKEN ? new Octokit({ auth: GITHUB_TOKEN }) : null

interface ChunkMetadata {
  uploadId: string
  fileName: string
  totalChunks: number
  uploadedChunks: number[]
  originalSize: number
  mimeType: string
  originalName: string
}

// In-memory storage for upload metadata (in production, use Redis)
const uploadRegistry = new Map<string, ChunkMetadata>()

// Get temp directory for chunks
const getTempDir = (uploadId: string) => join(tmpdir(), 'cdn-chunks', uploadId)

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    
    if (!action) {
      // Check if it's a chunk upload (FormData)
      const contentType = request.headers.get('content-type')
      if (contentType?.includes('multipart/form-data')) {
        return await uploadChunk(request)
      }
      
      // Otherwise it's a JSON action
      const body = await request.json()
      if (body.action === 'init') {
        return await initializeUpload(body)
      } else if (body.action === 'complete') {
        return await completeUpload(body)
      }
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Chunked upload error:', error)
    return NextResponse.json({ 
      error: 'Upload failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}

async function initializeUpload(body: any) {
  const { fileName, fileSize, mimeType, totalChunks } = body
  
  if (!fileName || !fileSize || !totalChunks) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  
  const uploadId = Date.now().toString()
  const tempDir = getTempDir(uploadId)
  
  // Create temp directory
  await mkdir(tempDir, { recursive: true })
  
  // Store upload metadata
  const metadata: ChunkMetadata = {
    uploadId,
    fileName,
    totalChunks,
    uploadedChunks: [],
    originalSize: fileSize,
    mimeType: mimeType || 'application/octet-stream',
    originalName: fileName
  }
  
  uploadRegistry.set(uploadId, metadata)
  
  return NextResponse.json({
    success: true,
    uploadId,
    totalChunks,
    chunkSize: CHUNK_SIZE
  })
}

async function uploadChunk(request: NextRequest) {
  const formData = await request.formData()
  const chunk = formData.get('chunk') as File
  const uploadId = formData.get('uploadId') as string
  const chunkIndex = parseInt(formData.get('chunkIndex') as string)
  
  if (!chunk || !uploadId || isNaN(chunkIndex)) {
    return NextResponse.json({ error: 'Missing chunk, uploadId, or chunkIndex' }, { status: 400 })
  }
  
  const metadata = uploadRegistry.get(uploadId)
  if (!metadata) {
    return NextResponse.json({ error: 'Upload session not found' }, { status: 404 })
  }
  
  try {
    // Save chunk to temp file
    const tempDir = getTempDir(uploadId)
    const chunkPath = join(tempDir, `chunk_${chunkIndex}`)
    const chunkBuffer = Buffer.from(await chunk.arrayBuffer())
    
    await writeFile(chunkPath, chunkBuffer)
    
    // Track uploaded chunk
    if (!metadata.uploadedChunks.includes(chunkIndex)) {
      metadata.uploadedChunks.push(chunkIndex)
    }
    
    return NextResponse.json({
      success: true,
      chunkIndex,
      uploadId,
      uploadedChunks: metadata.uploadedChunks.length,
      totalChunks: metadata.totalChunks
    })
  } catch (error) {
    console.error('Chunk upload error:', error)
    return NextResponse.json({ error: 'Failed to save chunk' }, { status: 500 })
  }
}

async function completeUpload(body: any) {
  const { uploadId, originalName, mimeType, totalSize } = body
  
  const metadata = uploadRegistry.get(uploadId)
  if (!metadata) {
    return NextResponse.json({ error: 'Upload session not found' }, { status: 404 })
  }
  
  // Check if all chunks are uploaded
  if (metadata.uploadedChunks.length !== metadata.totalChunks) {
    return NextResponse.json({ 
      error: `Missing chunks. Got ${metadata.uploadedChunks.length}, expected ${metadata.totalChunks}` 
    }, { status: 400 })
  }
  
  try {
    // Merge chunks
    const tempDir = getTempDir(uploadId)
    const mergedChunks: Buffer[] = []
    
    // Read chunks in order
    for (let i = 0; i < metadata.totalChunks; i++) {
      const chunkPath = join(tempDir, `chunk_${i}`)
      const chunkBuffer = await readFile(chunkPath)
      mergedChunks.push(chunkBuffer)
    }
    
    const finalBuffer = Buffer.concat(mergedChunks)
    
    // Generate final filename
    const fileId = uploadId
    const ext = originalName.split('.').pop() || ''
    const finalFileName = `${fileId}.${ext}`
    
    // Upload to GitHub
    if (!octokit || !GITHUB_OWNER || !GITHUB_REPO) {
      throw new Error('GitHub configuration missing')
    }
    
    // Get or create release
    const releaseTag = 'cdn-files'
    let release
    
    try {
      release = await octokit.rest.repos.getReleaseByTag({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        tag: releaseTag
      })
    } catch (error) {
      release = await octokit.rest.repos.createRelease({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        tag_name: releaseTag,
        name: 'CDN Files',
        body: 'Chunked uploaded files for CDN'
      })
    }
    
    // Upload merged file to GitHub
    const asset = await octokit.rest.repos.uploadReleaseAsset({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      release_id: release.data.id,
      name: finalFileName,
      data: finalBuffer as any
    })
    
    // Save metadata to Supabase
    if (supabase) {
      const now = new Date()
      const expiryDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000) // 14 days
      
      await supabase
        .from('cdn_files')
        .insert([{
          id: fileId,
          originalName,
          fileName: finalFileName,
          size: finalBuffer.length,
          mimeType,
          uploadDate: now.toISOString(),
          expiryDate: expiryDate.toISOString(),
          githubUrl: asset.data.browser_download_url
        }])
    }
    
    // Cleanup: Remove temp files and registry entry
    try {
      for (let i = 0; i < metadata.totalChunks; i++) {
        const chunkPath = join(tempDir, `chunk_${i}`)
        if (existsSync(chunkPath)) {
          await unlink(chunkPath)
        }
      }
      // Remove temp directory (if empty)
      try {
        await unlink(tempDir)
      } catch (e) {
        // Directory might not be empty, that's ok
      }
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError)
    }
    
    uploadRegistry.delete(uploadId)
    
    return NextResponse.json({
      success: true,
      file: {
        id: fileId,
        originalName,
        fileName: finalFileName,
        size: finalBuffer.length,
        mimeType,
        githubUrl: asset.data.browser_download_url
      },
      message: 'Chunked upload completed successfully'
    })
    
  } catch (error) {
    console.error('Complete upload error:', error)
    
    // Cleanup on error
    try {
      const tempDir = getTempDir(uploadId)
      for (let i = 0; i < metadata.totalChunks; i++) {
        const chunkPath = join(tempDir, `chunk_${i}`)
        if (existsSync(chunkPath)) {
          await unlink(chunkPath)
        }
      }
      uploadRegistry.delete(uploadId)
    } catch (cleanupError) {
      console.error('Error cleanup failed:', cleanupError)
    }
    
    return NextResponse.json({ 
      error: 'Failed to complete upload',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
