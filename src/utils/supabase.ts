import { createClient } from '@supabase/supabase-js'

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Create Supabase client
export const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null

// Check if Supabase is configured
export const isSupabaseConfigured = () => {
  return supabase !== null
}

// Database types
export interface WikiPageDB {
  id: string
  title: string
  content: string
  last_modified: string
  category: string
  created_by: string
  created_at?: string
  updated_at?: string
}

export interface GalleryItemDB {
  id: string
  type: 'image' | 'video'
  url: string
  title: string
  description: string
  thumbnail_url?: string
  added_by: string
  added_at: string
  created_at?: string
  updated_at?: string
}

export interface CategoryDB {
  id: string
  name: string
  color: string
  created_at?: string
  updated_at?: string
}

export interface VisitorLogDB {
  id: string
  timestamp: string
  country: string
  ip: string
  user_agent: string
  page: string
  created_at?: string
}

export interface ActivityLogDB {
  id: string
  timestamp: string
  action: 'create' | 'edit' | 'delete'
  page_id: string
  page_title: string
  user_role: 'viewer' | 'admin' | 'super-admin'
  ip: string
  country: string
  user_agent: string
  created_at?: string
}

export interface InvinciblePageDB {
  page_id: string
  created_by: string
  created_at?: string
}

export interface RateLimitDB {
  ip: string
  attempts: number
  last_attempt: string
  lockout_until?: string
  created_at?: string
  updated_at?: string
}

// Wiki Pages API
export const wikiPages = {
  async getAll(): Promise<WikiPageDB[]> {
    if (!supabase) return []
    const { data, error } = await supabase
      .from('wiki_pages')
      .select('*')
      .order('last_modified', { ascending: false })
    
    if (error) {
      console.error('Error fetching wiki pages:', error)
      return []
    }
    return data || []
  },

  async create(page: Omit<WikiPageDB, 'created_at' | 'updated_at'>): Promise<WikiPageDB | null> {
    if (!supabase) return null
    
    console.log('Creating page in database:', page)
    
    const { data, error } = await supabase
      .from('wiki_pages')
      .insert([page])
      .select()
      .single()
    
    if (error) {
      console.error('Error creating wiki page:', error)
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      })
      return null
    }
    
    console.log('Page created successfully:', data)
    return data
  },

  async update(id: string, updates: Partial<WikiPageDB>): Promise<WikiPageDB | null> {
    if (!supabase) return null
    const { data, error } = await supabase
      .from('wiki_pages')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      console.error('Error updating wiki page:', error)
      return null
    }
    return data
  },

  async delete(id: string): Promise<boolean> {
    if (!supabase) return false
    const { error } = await supabase
      .from('wiki_pages')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error('Error deleting wiki page:', error)
      return false
    }
    return true
  }
}

// Gallery Items API
export const galleryItems = {
  async getAll(): Promise<GalleryItemDB[]> {
    if (!supabase) return []
    const { data, error } = await supabase
      .from('gallery_items')
      .select('*')
      .order('added_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching gallery items:', error)
      return []
    }
    return data || []
  },

  async create(item: Omit<GalleryItemDB, 'created_at' | 'updated_at'>): Promise<GalleryItemDB | null> {
    if (!supabase) return null
    const { data, error } = await supabase
      .from('gallery_items')
      .insert([item])
      .select()
      .single()
    
    if (error) {
      console.error('Error creating gallery item:', error)
      return null
    }
    return data
  },

  async delete(id: string): Promise<boolean> {
    if (!supabase) return false
    const { error } = await supabase
      .from('gallery_items')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error('Error deleting gallery item:', error)
      return false
    }
    return true
  }
}

// Visitor Logs API
export const visitorLogs = {
  async getAll(): Promise<VisitorLogDB[]> {
    if (!supabase) return []
    const { data, error } = await supabase
      .from('visitor_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100)
    
    if (error) {
      console.error('Error fetching visitor logs:', error)
      return []
    }
    return data || []
  },

  async create(log: Omit<VisitorLogDB, 'created_at'>): Promise<VisitorLogDB | null> {
    if (!supabase) return null
    const { data, error } = await supabase
      .from('visitor_logs')
      .insert([log])
      .select()
      .single()
    
    if (error) {
      console.error('Error creating visitor log:', error)
      return null
    }
    return data
  },

  async clear(): Promise<boolean> {
    if (!supabase) return false
    const { error } = await supabase
      .from('visitor_logs')
      .delete()
      .neq('id', '') // Delete all records
    
    if (error) {
      console.error('Error clearing visitor logs:', error)
      return false
    }
    return true
  }
}

// Activity Logs API
export const activityLogs = {
  async getAll(): Promise<ActivityLogDB[]> {
    if (!supabase) return []
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(500)
    
    if (error) {
      console.error('Error fetching activity logs:', error)
      return []
    }
    return data || []
  },

  async create(log: Omit<ActivityLogDB, 'created_at'>): Promise<ActivityLogDB | null> {
    if (!supabase) return null
    const { data, error } = await supabase
      .from('activity_logs')
      .insert([log])
      .select()
      .single()
    
    if (error) {
      console.error('Error creating activity log:', error)
      return null
    }
    return data
  }
}

// Invincible Pages API
export const invinciblePages = {
  async getAll(): Promise<InvinciblePageDB[]> {
    if (!supabase) return []
    const { data, error } = await supabase
      .from('invincible_pages')
      .select('*')
    
    if (error) {
      console.error('Error fetching invincible pages:', error)
      return []
    }
    return data || []
  },

  async add(pageId: string, createdBy: string = 'super-admin'): Promise<InvinciblePageDB | null> {
    if (!supabase) return null
    const { data, error } = await supabase
      .from('invincible_pages')
      .insert([{ page_id: pageId, created_by: createdBy }])
      .select()
      .single()
    
    if (error) {
      console.error('Error adding invincible page:', error)
      return null
    }
    return data
  },

  async remove(pageId: string): Promise<boolean> {
    if (!supabase) return false
    const { error } = await supabase
      .from('invincible_pages')
      .delete()
      .eq('page_id', pageId)
    
    if (error) {
      console.error('Error removing invincible page:', error)
      return false
    }
    return true
  },

  async isInvincible(pageId: string): Promise<boolean> {
    if (!supabase) return false
    const { data, error } = await supabase
      .from('invincible_pages')
      .select('page_id')
      .eq('page_id', pageId)
      .single()
    
    if (error) return false
    return !!data
  }
}

// Rate Limits API
export const rateLimits = {
  async get(ip: string): Promise<RateLimitDB | null> {
    if (!supabase) return null
    const { data, error } = await supabase
      .from('rate_limits')
      .select('*')
      .eq('ip', ip)
      .single()
    
    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('Error fetching rate limit:', error)
      return null
    }
    return data
  },

  async update(ip: string, attempts: number, lockoutUntil?: string): Promise<RateLimitDB | null> {
    if (!supabase) return null
    const updateData: any = {
      ip,
      attempts,
      last_attempt: new Date().toISOString()
    }
    
    if (lockoutUntil) {
      updateData.lockout_until = lockoutUntil
    }

    const { data, error } = await supabase
      .from('rate_limits')
      .upsert([updateData])
      .select()
      .single()
    
    if (error) {
      console.error('Error updating rate limit:', error)
      return null
    }
    return data
  },

  async clear(ip?: string): Promise<boolean> {
    if (!supabase) return false
    
    let query = supabase.from('rate_limits').delete()
    
    if (ip) {
      query = query.eq('ip', ip)
    } else {
      query = query.neq('ip', '') // Delete all
    }
    
    const { error } = await query
    
    if (error) {
      console.error('Error clearing rate limits:', error)
      return false
    }
    return true
  },

  async getAll(): Promise<RateLimitDB[]> {
    if (!supabase) return []
    const { data, error } = await supabase
      .from('rate_limits')
      .select('*')
      .order('last_attempt', { ascending: false })
    
    if (error) {
      console.error('Error fetching all rate limits:', error)
      return []
    }
    return data || []
  }
}

// Categories API
export const categories = {
  async getAll(): Promise<CategoryDB[]> {
    if (!supabase) return []
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true })
    
    if (error) {
      console.error('Error fetching categories:', error)
      return []
    }
    return data || []
  },

  async create(category: Omit<CategoryDB, 'created_at' | 'updated_at'>): Promise<CategoryDB | null> {
    if (!supabase) return null
    const { data, error } = await supabase
      .from('categories')
      .insert([category])
      .select()
      .single()
    
    if (error) {
      console.error('Error creating category:', error)
      return null
    }
    return data
  },

  async delete(id: string): Promise<boolean> {
    if (!supabase) return false
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error('Error deleting category:', error)
      return false
    }
    return true
  }
}

// Fallback storage utilities (localStorage with sync)
export const localStorage_fallback = {
  async syncWikiPages(localPages: any[]): Promise<void> {
    if (!isSupabaseConfigured()) return
    
    // Get pages from Supabase
    const remotePages = await wikiPages.getAll()
    
    // Merge local and remote pages (remote takes priority for conflicts)
    const mergedPages = [...localPages]
    
    for (const remotePage of remotePages) {
      const localIndex = mergedPages.findIndex(p => p.id === remotePage.id)
      if (localIndex >= 0) {
        // Update local page if remote is newer
        const localDate = new Date(mergedPages[localIndex].lastModified || mergedPages[localIndex].last_modified)
        const remoteDate = new Date(remotePage.last_modified)
        if (remoteDate > localDate) {
          mergedPages[localIndex] = {
            id: remotePage.id,
            title: remotePage.title,
            content: remotePage.content,
            lastModified: remotePage.last_modified,
            category: remotePage.category,
            createdBy: remotePage.created_by
          }
        }
      } else {
        // Add remote page to local
        mergedPages.push({
          id: remotePage.id,
          title: remotePage.title,
          content: remotePage.content,
          lastModified: remotePage.last_modified,
          category: remotePage.category,
          createdBy: remotePage.created_by
        })
      }
    }
    
    // Save merged pages to localStorage
    localStorage.setItem('dorps-wiki-pages', JSON.stringify(mergedPages))
  },

  async syncGalleryItems(localItems: any[]): Promise<void> {
    if (!isSupabaseConfigured()) return
    
    // Get items from Supabase
    const remoteItems = await galleryItems.getAll()
    
    // Convert remote items to local format and merge
    const mergedItems = [...localItems]
    
    for (const remoteItem of remoteItems) {
      const localIndex = mergedItems.findIndex(i => i.id === remoteItem.id)
      if (localIndex >= 0) {
        // Update local item if remote exists
        mergedItems[localIndex] = {
          id: remoteItem.id,
          type: remoteItem.type,
          url: remoteItem.url,
          title: remoteItem.title,
          description: remoteItem.description,
          thumbnailUrl: remoteItem.thumbnail_url,
          addedBy: remoteItem.added_by,
          addedAt: remoteItem.added_at
        }
      } else {
        // Add remote item to local
        mergedItems.push({
          id: remoteItem.id,
          type: remoteItem.type,
          url: remoteItem.url,
          title: remoteItem.title,
          description: remoteItem.description,
          thumbnailUrl: remoteItem.thumbnail_url,
          addedBy: remoteItem.added_by,
          addedAt: remoteItem.added_at
        })
      }
    }
    
    // Save merged items to localStorage
    localStorage.setItem('dorps-gallery-items', JSON.stringify(mergedItems))
  }
}
