import { useState, useEffect } from 'react'
import { isSupabaseConfigured, wikiPages, galleryItems, categories, rateLimits, visitorLogs, invinciblePages, activityLogs } from './supabase'

type UserRole = 'viewer' | 'admin' | 'super-admin'

// Utility function to generate unique IDs
function generateUniqueId(prefix: string = 'page'): string {
  // Use crypto.randomUUID() if available, otherwise fallback to timestamp + random
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`
  }
  // More robust fallback with higher entropy
  const timestamp = Date.now().toString(36)
  const random1 = Math.random().toString(36).substr(2, 9)
  const random2 = Math.random().toString(36).substr(2, 9)
  const performanceNow = performance.now().toString(36).replace('.', '')
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent.slice(-5) : 'xxxxx'
  const randomBytes = new Uint8Array(4)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomBytes)
  }
  const cryptoRandom = randomBytes.length > 0 ? Array.from(randomBytes).map(b => b.toString(36)).join('') : ''
  
  return `${prefix}-${timestamp}-${random1}-${random2}-${performanceNow}-${userAgent}-${cryptoRandom}`
}

// Utility function to check if a page with the same title already exists
function isDuplicateTitle(pages: WikiPage[], title: string, excludeId?: string): boolean {
  return pages.some(page => page.title.toLowerCase() === title.toLowerCase() && page.id !== excludeId)
}

interface WikiPage {
  id: string
  title: string
  content: string
  lastModified: string
  category: string
  createdBy: UserRole
}

interface GalleryItem {
  id: string
  type: 'image' | 'video'
  url: string
  title: string
  description: string
  thumbnailUrl?: string
  addedBy: string
  addedAt: string
}

interface Category {
  id: string
  name: string
  color: string
}

// Custom hook for wiki pages - Supabase only
export function useWikiPages() {
  const [pages, setPages] = useState<WikiPage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load pages on mount
  useEffect(() => {
    loadPages()
  }, [])

  const loadPages = async () => {
    if (!isSupabaseConfigured()) {
      setError('Supabase is not configured')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    
    try {
      console.log('Loading pages from database...')
      const remotePages = await wikiPages.getAll()
      console.log('Loaded pages from database:', remotePages.length)
      
      // Convert remote pages to local format
      const convertedPages = remotePages.map(page => ({
        id: page.id,
        title: page.title,
        content: page.content,
        lastModified: page.last_modified,
        category: page.category,
        createdBy: page.created_by as UserRole
      }))

      console.log('Converted pages:', convertedPages.map(p => ({ id: p.id, title: p.title })))
      setPages(convertedPages)
    } catch (error) {
      console.error('Error loading pages:', error)
      setError('Failed to load pages from database')
    } finally {
      setIsLoading(false)
    }
  }

  const savePage = async (page: WikiPage, isNew: boolean = false) => {
    if (!isSupabaseConfigured()) {
      setError('Supabase is not configured')
      return null
    }

    try {
      console.log(`Saving page: ${page.title} (ID: ${page.id}, isNew: ${isNew})`)
      
      let success = false
      
      if (isNew) {
        console.log('Creating new page:', page)
        const result = await wikiPages.create({
          id: page.id,
          title: page.title,
          content: page.content,
          last_modified: page.lastModified,
          category: page.category,
          created_by: page.createdBy
        })
        console.log('Create result:', result)
        success = result !== null
      } else {
        console.log('Updating existing page:', page.id)
        const result = await wikiPages.update(page.id, {
          title: page.title,
          content: page.content,
          last_modified: page.lastModified,
          category: page.category
        })
        success = result !== null
      }

      if (!success) {
        throw new Error('Failed to save page to database')
      }

      // Update local state
      if (isNew) {
        console.log('Adding new page to local state')
        setPages(prev => {
          console.log('Previous pages:', prev.length, 'Adding:', page.title)
          return [page, ...prev]
        })
      } else {
        console.log('Updating existing page in local state')
        setPages(prev => prev.map(p => p.id === page.id ? page : p))
      }

      console.log('Page saved successfully:', page.title)
      return page
    } catch (error) {
      console.error('Error saving page:', error)
      setError(`Failed to save page: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return null
    }
  }

  const deletePage = async (pageId: string) => {
    if (!isSupabaseConfigured()) {
      setError('Supabase is not configured')
      return false
    }

    try {
      console.log(`Deleting page with ID: ${pageId}`)
      
      // Find the page to get its title for logging
      const pageToDelete = pages.find(p => p.id === pageId)
      const pageTitle = pageToDelete?.title || 'Unknown Page'
      
      console.log(`Deleting page: ${pageTitle} (ID: ${pageId})`)
      
      const success = await wikiPages.delete(pageId)
      if (!success) {
        throw new Error('Failed to delete page from database')
      }

      // Update local state
      console.log('Removing page from local state')
      setPages(prev => {
        const filtered = prev.filter(p => p.id !== pageId)
        console.log(`Pages after deletion: ${filtered.length} (removed: ${pageTitle})`)
        return filtered
      })
      
      // Refresh from database to ensure consistency
      setTimeout(() => {
        loadPages()
      }, 500)
      
      console.log('Page deleted successfully:', pageTitle)
      return true
    } catch (error) {
      console.error('Error deleting page:', error)
      setError('Failed to delete page')
      return false
    }
  }

  const refreshPages = async () => {
    console.log('Refreshing page list from database')
    await loadPages()
  }

  const clearError = () => {
    setError(null)
  }

  return {
    pages,
    isLoading,
    error,
    savePage,
    deletePage,
    refreshPages,
    clearError
  }
}

// Custom hook for gallery items - Supabase only
export function useGalleryItems() {
  const [items, setItems] = useState<GalleryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load items on mount
  useEffect(() => {
    loadItems()
  }, [])

  const loadItems = async () => {
    if (!isSupabaseConfigured()) {
      setError('Supabase is not configured')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    
    try {
      const remoteItems = await galleryItems.getAll()
      
      // Convert remote items to local format
      const convertedItems = remoteItems.map(item => ({
        id: item.id,
        type: item.type,
        url: item.url,
        title: item.title,
        description: item.description,
        thumbnailUrl: item.thumbnail_url,
        addedBy: item.added_by,
        addedAt: item.added_at
      }))

      setItems(convertedItems)
    } catch (error) {
      console.error('Error loading gallery items:', error)
      setError('Failed to load gallery items from database')
    } finally {
      setIsLoading(false)
    }
  }

  const saveItem = async (item: GalleryItem, isNew: boolean = false) => {
    if (!isSupabaseConfigured()) {
      setError('Supabase is not configured')
      return null
    }

    try {
      let success = false
      
      if (isNew) {
        const result = await galleryItems.create({
          id: item.id,
          type: item.type,
          url: item.url,
          title: item.title,
          description: item.description,
          thumbnail_url: item.thumbnailUrl,
          added_by: item.addedBy,
          added_at: item.addedAt
        })
        success = result !== null
      } else {
        // Gallery items don't have an update method in the current implementation
        // We'll need to delete and recreate for updates
        const deleteSuccess = await galleryItems.delete(item.id)
        if (deleteSuccess) {
          const result = await galleryItems.create({
            id: item.id,
            type: item.type,
            url: item.url,
            title: item.title,
            description: item.description,
            thumbnail_url: item.thumbnailUrl,
            added_by: item.addedBy,
            added_at: item.addedAt
          })
          success = result !== null
        }
      }

      if (!success) {
        throw new Error('Failed to save gallery item to database')
      }

      // Update local state
      if (isNew) {
        setItems(prev => [item, ...prev])
      } else {
        setItems(prev => prev.map(i => i.id === item.id ? item : i))
      }

      return item
    } catch (error) {
      console.error('Error saving gallery item:', error)
      setError('Failed to save gallery item')
      return null
    }
  }

  const deleteItem = async (itemId: string) => {
    if (!isSupabaseConfigured()) {
      setError('Supabase is not configured')
      return false
    }

    try {
      const success = await galleryItems.delete(itemId)
      if (!success) {
        throw new Error('Failed to delete gallery item from database')
      }

      // Update local state
      setItems(prev => prev.filter(i => i.id !== itemId))
      return true
    } catch (error) {
      console.error('Error deleting gallery item:', error)
      setError('Failed to delete gallery item')
      return false
    }
  }

  const refreshItems = async () => {
    await loadItems()
  }

  return {
    items,
    isLoading,
    error,
    saveItem,
    deleteItem,
    refreshItems
  }
}

// Custom hook for categories - Supabase only
export function useCategories() {
  const [categoryList, setCategoryList] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Default categories
  const defaultCategories: Category[] = [
    { id: 'general', name: 'General', color: '#8B5CF6' },
    { id: 'jokes', name: 'Inside Jokes', color: '#F59E0B' },
    { id: 'members', name: 'Members', color: '#10B981' },
    { id: 'adventures', name: 'Adventures', color: '#EF4444' },
    { id: 'quotes', name: 'Quotes', color: '#3B82F6' }
  ]

  // Load categories on mount
  useEffect(() => {
    loadCategories()
  }, [])

  const loadCategories = async () => {
    if (!isSupabaseConfigured()) {
      setError('Supabase is not configured')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    
    try {
      const remoteCategories = await categories.getAll()
      
      if (remoteCategories.length === 0) {
        // Initialize with default categories
        for (const category of defaultCategories) {
          await categories.create(category)
        }
        setCategoryList(defaultCategories)
      } else {
        setCategoryList(remoteCategories)
      }
    } catch (error) {
      console.error('Error loading categories:', error)
      setError('Failed to load categories from database')
    } finally {
      setIsLoading(false)
    }
  }

  const saveCategory = async (category: Category, isNew: boolean = false) => {
    if (!isSupabaseConfigured()) {
      setError('Supabase is not configured')
      return null
    }

    try {
      let success = false
      
      if (isNew) {
        const result = await categories.create(category)
        success = result !== null
      } else {
        // Categories don't have an update method in the current implementation
        // We'll need to delete and recreate for updates
        const deleteSuccess = await categories.delete(category.id)
        if (deleteSuccess) {
          const result = await categories.create(category)
          success = result !== null
        }
      }

      if (!success) {
        throw new Error('Failed to save category to database')
      }

      // Update local state
      if (isNew) {
        setCategoryList(prev => [...prev, category])
      } else {
        setCategoryList(prev => prev.map(c => c.id === category.id ? category : c))
      }

      return category
    } catch (error) {
      console.error('Error saving category:', error)
      setError('Failed to save category')
      return null
    }
  }

  const deleteCategory = async (categoryId: string) => {
    if (!isSupabaseConfigured()) {
      setError('Supabase is not configured')
      return false
    }

    try {
      const success = await categories.delete(categoryId)
      if (!success) {
        throw new Error('Failed to delete category from database')
      }

      // Update local state
      setCategoryList(prev => prev.filter(c => c.id !== categoryId))
      return true
    } catch (error) {
      console.error('Error deleting category:', error)
      setError('Failed to delete category')
      return false
    }
  }

  const refreshCategories = async () => {
    await loadCategories()
  }

  return {
    categoryList,
    isLoading,
    error,
    saveCategory,
    deleteCategory,
    refreshCategories
  }
}

// Rate Limits Storage API
export const rateLimitsStorage = {
  async get(ip: string) {
    const data = await rateLimits.get(ip)
    if (!data) return null
    
    return {
      attempts: data.attempts,
      lastAttempt: new Date(data.last_attempt).getTime(),
      lockoutUntil: data.lockout_until ? new Date(data.lockout_until).getTime() : 0,
      userIP: data.ip
    }
  },

  async update(ip: string, attempts: number, lockoutUntil: number = 0) {
    const lockoutUntilDate = lockoutUntil > 0 ? new Date(lockoutUntil).toISOString() : undefined
    return await rateLimits.update(ip, attempts, lockoutUntilDate)
  },

  async clear(ip?: string) {
    return await rateLimits.clear(ip)
  },

  async getAll() {
    return await rateLimits.getAll()
  }
}

// Visitor Logs Storage API
export const visitorLogsStorage = {
  async save(log: {
    timestamp: string
    country: string
    ip: string
    userAgent: string
    page: string
  }) {
    return await visitorLogs.create({
      id: generateUniqueId('log'),
      timestamp: log.timestamp,
      country: log.country,
      ip: log.ip,
      user_agent: log.userAgent,
      page: log.page
    })
  },

  async getAll() {
    return await visitorLogs.getAll()
  },

  async clear() {
    return await visitorLogs.clear()
  }
}

// Invincible Pages Storage API
export const invinciblePagesStorage = {
  async getAll() {
    return await invinciblePages.getAll()
  },

  async add(pageId: string, createdBy: string = 'super-admin') {
    return await invinciblePages.add(pageId, createdBy)
  },

  async remove(pageId: string) {
    return await invinciblePages.remove(pageId)
  },

  async isInvincible(pageId: string) {
    return await invinciblePages.isInvincible(pageId)
  },

  async toggle(pageId: string) {
    const isCurrentlyInvincible = await invinciblePages.isInvincible(pageId)
    
    if (isCurrentlyInvincible) {
      await invinciblePages.remove(pageId)
      return false
    } else {
      await invinciblePages.add(pageId)
      return true
    }
  }
}

// Activity Logs Storage API
export const activityLogsStorage = {
  async getAll() {
    const logs = await activityLogs.getAll()
    return logs.map(log => ({
      id: log.id,
      timestamp: log.timestamp,
      action: log.action,
      pageId: log.page_id,
      pageTitle: log.page_title,
      userRole: log.user_role,
      ip: log.ip,
      country: log.country,
      userAgent: log.user_agent
    }))
  },

  async save(log: {
    timestamp: string
    action: 'create' | 'edit' | 'delete'
    pageId: string
    pageTitle: string
    userRole: 'viewer' | 'admin' | 'super-admin'
    ip: string
    country: string
    userAgent: string
  }) {
    return await activityLogs.create({
      id: generateUniqueId('activity'),
      timestamp: log.timestamp,
      action: log.action,
      page_id: log.pageId,
      page_title: log.pageTitle,
      user_role: log.userRole,
      ip: log.ip,
      country: log.country,
      user_agent: log.userAgent
    })
  }
}

// Debug function to check database state
export const debugDatabase = async () => {
  console.log('=== DATABASE DEBUG ===')
  try {
    const pages = await wikiPages.getAll()
    console.log('All pages in database:', pages.map(p => ({ id: p.id, title: p.title })))
    
    const invincibleData = await invinciblePages.getAll()
    console.log('All invincible pages:', invincibleData.map(p => ({ page_id: p.page_id, created_by: p.created_by })))
    
    return { pages, invincibleData }
  } catch (error) {
    console.error('Error debugging database:', error)
    return null
  }
}

// Export utility functions
export { generateUniqueId, isDuplicateTitle }
