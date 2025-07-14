// Direct client-side upload to GitHub Releases
// Bypasses Vercel's 4.5MB limit

import { Octokit } from '@octokit/rest'

interface DirectUploadResult {
  success: boolean
  githubUrl?: string
  error?: string
}

export async function uploadDirectToGitHub(
  file: File,
  githubToken: string,
  owner: string,
  repo: string
): Promise<DirectUploadResult> {
  try {
    const octokit = new Octokit({ auth: githubToken })
    
    // Generate unique filename
    const fileId = Date.now().toString()
    const ext = file.name.split('.').pop() || ''
    const fileName = `${fileId}.${ext}`
    
    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const fileBuffer = new Uint8Array(arrayBuffer)
    
    // Get or create release
    const releaseTag = 'cdn-files'
    let release
    
    try {
      release = await octokit.rest.repos.getReleaseByTag({
        owner,
        repo,
        tag: releaseTag
      })
    } catch (error) {
      release = await octokit.rest.repos.createRelease({
        owner,
        repo,
        tag_name: releaseTag,
        name: 'CDN Files',
        body: 'Direct uploaded files for CDN'
      })
    }
    
    // Upload file as release asset
    const asset = await octokit.rest.repos.uploadReleaseAsset({
      owner,
      repo,
      release_id: release.data.id,
      name: fileName,
      data: fileBuffer as any
    })
    
    return {
      success: true,
      githubUrl: asset.data.browser_download_url
    }
  } catch (error) {
    console.error('Direct GitHub upload error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    }
  }
}

// Save metadata to Supabase after successful upload
export async function saveFileMetadata(
  fileId: string,
  originalName: string,
  fileName: string,
  size: number,
  mimeType: string,
  githubUrl: string,
  supabaseUrl: string,
  supabaseKey: string
) {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    const now = new Date()
    const expiryDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000) // 14 days
    
    const { error } = await supabase
      .from('cdn_files')
      .insert([{
        id: fileId,
        originalName,
        fileName,
        size,
        mimeType,
        uploadDate: now.toISOString(),
        expiryDate: expiryDate.toISOString(),
        githubUrl
      }])
    
    if (error) throw error
    return { success: true }
  } catch (error) {
    console.error('Failed to save metadata:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
