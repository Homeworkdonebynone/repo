import { NextRequest, NextResponse } from 'next/server'
import { Octokit } from '@octokit/rest'
import { createClient } from '@supabase/supabase-js'

// This endpoint acts as a secure proxy for large file uploads
// Client sends file directly, server handles GitHub upload with private tokens

const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const GITHUB_OWNER = process.env.GITHUB_OWNER
const GITHUB_REPO = process.env.GITHUB_REPO

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

const octokit = GITHUB_TOKEN ? new Octokit({ auth: GITHUB_TOKEN }) : null

export async function POST(request: NextRequest) {
  try {
    if (!octokit || !GITHUB_OWNER || !GITHUB_REPO) {
      return NextResponse.json({ 
        error: 'GitHub configuration missing' 
      }, { status: 500 })
    }

    // Get file from request body as stream
    const contentLength = request.headers.get('content-length')
    const fileName = request.headers.get('x-filename') || 'file'
    const mimeType = request.headers.get('content-type') || 'application/octet-stream'
    const originalName = request.headers.get('x-original-name') || fileName

    if (!contentLength) {
      return NextResponse.json({ 
        error: 'Content-Length header required' 
      }, { status: 400 })
    }

    const fileSize = parseInt(contentLength)
    const maxSize = 2 * 1024 * 1024 * 1024 // 2GB (GitHub's actual limit)
    
    if (fileSize > maxSize) {
      return NextResponse.json({ 
        error: 'File too large. Maximum size is 2GB.' 
      }, { status: 413 })
    }

    // Read the file buffer
    const buffer = Buffer.from(await request.arrayBuffer())
    
    // Generate unique filename
    const fileId = Date.now().toString()
    const ext = originalName.split('.').pop() || ''
    const uniqueFileName = `${fileId}.${ext}`

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
        body: 'Direct uploaded files for CDN'
      })
    }

    // Upload to GitHub
    const asset = await octokit.rest.repos.uploadReleaseAsset({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      release_id: release.data.id,
      name: uniqueFileName,
      data: buffer as any
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
          fileName: uniqueFileName,
          size: fileSize,
          mimeType,
          uploadDate: now.toISOString(),
          expiryDate: expiryDate.toISOString(),
          githubUrl: asset.data.browser_download_url
        }])
    }

    return NextResponse.json({
      success: true,
      file: {
        id: fileId,
        originalName,
        fileName: uniqueFileName,
        size: fileSize,
        mimeType,
        githubUrl: asset.data.browser_download_url
      },
      message: 'File uploaded successfully'
    })

  } catch (error) {
    console.error('Direct upload error:', error)
    return NextResponse.json({ 
      error: 'Upload failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}
