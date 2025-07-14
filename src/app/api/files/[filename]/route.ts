import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Supabase for metadata storage
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

// In-memory fallback
let fileRegistry: any[] = []

async function getFileByFilename(filename: string) {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('cdn_files')
        .select('*')
        .eq('fileName', filename)
        .single()
      
      if (error) throw error
      return data
    } catch (error) {
      console.error('Failed to fetch from Supabase:', error)
    }
  }
  
  // Fallback to in-memory storage
  return fileRegistry.find(f => f.fileName === filename)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params
    
    if (!filename || filename.includes('..')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
    }
    
    // Find file in registry
    const file = await getFileByFilename(filename)
    
    if (!file || !file.githubUrl) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
    
    // Check if file is expired
    const now = new Date()
    const expiryDate = new Date(file.expiryDate)
    if (expiryDate <= now) {
      return NextResponse.json({ error: 'File has expired' }, { status: 404 })
    }
    
    // Redirect to GitHub URL
    return NextResponse.redirect(file.githubUrl)
    
  } catch (error) {
    console.error('File serving error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
