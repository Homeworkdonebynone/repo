import { useState, useEffect } from 'react'
import { 
  isSupabaseConfigured, 
  wikiPages, 
  galleryItems, 
  categories, 
  visitorLogs, 
  activityLogs, 
  invinciblePages, 
  rateLimits,
  type VisitorLogDB,
  type ActivityLogDB,
  type RateLimitDB
} from './supabase'

type UserRole = 'viewer' | 'admin' | 'super-admin'

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

interface VisitorLog {
  id: string
  timestamp: string
  country: string
  ip: string
  userAgent: string
  page: string
}

interface ActivityLog {
  id: string
  timestamp: string
  action: 'create' | 'edit' | 'delete'
  pageId: string
  pageTitle: string
  userRole: 'viewer' | 'admin' | 'super-admin'
  ip: string
  country: string
  userAgent: string
}

// Enhanced hybrid storage hooks that work with all data types

// Custom hook for wiki pages with hybrid storage
export function useWikiPages() {
  const [pages, setPages] = useState<WikiPage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSupabaseEnabled] = useState(isSupabaseConfigured())

  // Load pages on mount
  useEffect(() => {
    loadPages()
  }, [])

  const loadPages = async () => {
    setIsLoading(true)
    try {
      if (isSupabaseEnabled) {
        // Load from Supabase first, then sync with localStorage
        const remotePages = await wikiPages.getAll()
        const localPagesStr = localStorage.getItem('dorps-wiki-pages')
        const localPages = localPagesStr ? JSON.parse(localPagesStr) : []

        // Convert remote pages to local format
        const convertedRemotePages = remotePages.map(page => ({
          id: page.id,
          title: page.title,
          content: page.content,
          lastModified: page.last_modified,
          category: page.category,
          createdBy: page.created_by as UserRole
        }))

        // Merge and use most recent data
        const mergedPages = [...localPages]
        for (const remotePage of convertedRemotePages) {
          const localIndex = mergedPages.findIndex(p => p.id === remotePage.id)
          if (localIndex >= 0) {
            // Use the more recent version
            const localDate = new Date(mergedPages[localIndex].lastModified)
            const remoteDate = new Date(remotePage.lastModified)
            if (remoteDate > localDate) {
              mergedPages[localIndex] = remotePage
            }
          } else {
            mergedPages.push(remotePage)
          }
        }

        // Upload any local-only pages to Supabase
        for (const localPage of localPages) {
          const exists = convertedRemotePages.find(p => p.id === localPage.id)
          if (!exists) {
            await wikiPages.create({
              id: localPage.id,
              title: localPage.title,
              content: localPage.content,
              last_modified: localPage.lastModified,
              category: localPage.category,
              created_by: localPage.createdBy
            })
          }
        }

        setPages(mergedPages)
        localStorage.setItem('dorps-wiki-pages', JSON.stringify(mergedPages))
      } else {
        // Use localStorage only
        const savedPages = localStorage.getItem('dorps-wiki-pages')
        if (savedPages) {
          const parsedPages = JSON.parse(savedPages)
          const updatedPages = parsedPages.map((page: any) => ({
            ...page,
            category: page.category || 'general',
            createdBy: page.createdBy || 'admin'
          }))
          setPages(updatedPages)
        }
      }
    } catch (error) {
      console.error('Error loading pages:', error)
      // Fallback to localStorage on error
      const savedPages = localStorage.getItem('dorps-wiki-pages')
      if (savedPages) {
        setPages(JSON.parse(savedPages))
      }
    }
    setIsLoading(false)
  }

  const savePage = async (page: WikiPage, isNew: boolean = false) => {
    try {
      let updatedPages: WikiPage[]
      
      if (isNew) {
        updatedPages = [page, ...pages]
      } else {
        updatedPages = pages.map(p => p.id === page.id ? page : p)
      }

      // Save to localStorage first
      setPages(updatedPages)
      localStorage.setItem('dorps-wiki-pages', JSON.stringify(updatedPages))

      // Save to Supabase if enabled
      if (isSupabaseEnabled) {
        if (isNew) {
          await wikiPages.create({
            id: page.id,
            title: page.title,
            content: page.content,
            last_modified: page.lastModified,
            category: page.category,
            created_by: page.createdBy
          })
        } else {
          await wikiPages.update(page.id, {
            title: page.title,
            content: page.content,
            last_modified: page.lastModified,
            category: page.category
          })
        }
      }

      return page
    } catch (error) {
      console.error('Error saving page:', error)
      return null
    }
  }

  const deletePage = async (pageId: string) => {
    try {
      const updatedPages = pages.filter(p => p.id !== pageId)
      
      // Remove from localStorage
      setPages(updatedPages)
      localStorage.setItem('dorps-wiki-pages', JSON.stringify(updatedPages))

      // Remove from Supabase if enabled
      if (isSupabaseEnabled) {
        await wikiPages.delete(pageId)
      }

      return true
    } catch (error) {
      console.error('Error deleting page:', error)
      return false
    }
  }

  return {
    pages,
    isLoading,
    isSupabaseEnabled,
    savePage,
    deletePage,
    refreshPages: loadPages
  }
}

// Custom hook for gallery items with hybrid storage
export function useGalleryItems() {
  const [items, setItems] = useState<GalleryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSupabaseEnabled] = useState(isSupabaseConfigured())

  useEffect(() => {
    loadItems()
  }, [])

  const loadItems = async () => {
    setIsLoading(true)
    try {
      if (isSupabaseEnabled) {
        const remoteItems = await galleryItems.getAll()
        const localItemsStr = localStorage.getItem('dorps-gallery-items')
        const localItems = localItemsStr ? JSON.parse(localItemsStr) : []

        const convertedRemoteItems = remoteItems.map(item => ({
          id: item.id,
          type: item.type,
          url: item.url,
          title: item.title,
          description: item.description,
          thumbnailUrl: item.thumbnail_url,
          addedBy: item.added_by,
          addedAt: item.added_at
        }))

        const mergedItems = [...localItems]
        for (const remoteItem of convertedRemoteItems) {
          const localIndex = mergedItems.findIndex(i => i.id === remoteItem.id)
          if (localIndex >= 0) {
            mergedItems[localIndex] = remoteItem
          } else {
            mergedItems.push(remoteItem)
          }
        }

        for (const localItem of localItems) {
          const exists = convertedRemoteItems.find(i => i.id === localItem.id)
          if (!exists) {
            await galleryItems.create({
              id: localItem.id,
              type: localItem.type,
              url: localItem.url,
              title: localItem.title,
              description: localItem.description,
              thumbnail_url: localItem.thumbnailUrl,
              added_by: localItem.addedBy,
              added_at: localItem.addedAt
            })
          }
        }

        setItems(mergedItems)
        localStorage.setItem('dorps-gallery-items', JSON.stringify(mergedItems))
      } else {
        const savedItems = localStorage.getItem('dorps-gallery-items')
        if (savedItems) {
          setItems(JSON.parse(savedItems))
        }
      }
    } catch (error) {
      console.error('Error loading gallery items:', error)
      const savedItems = localStorage.getItem('dorps-gallery-items')
      if (savedItems) {
        setItems(JSON.parse(savedItems))
      }
    }
    setIsLoading(false)
  }

  const saveItem = async (item: GalleryItem) => {
    try {
      const updatedItems = [item, ...items]
      
      setItems(updatedItems)
      localStorage.setItem('dorps-gallery-items', JSON.stringify(updatedItems))

      if (isSupabaseEnabled) {
        await galleryItems.create({
          id: item.id,
          type: item.type,
          url: item.url,
          title: item.title,
          description: item.description,
          thumbnail_url: item.thumbnailUrl,
          added_by: item.addedBy,
          added_at: item.addedAt
        })
      }

      return item
    } catch (error) {
      console.error('Error saving gallery item:', error)
      return null
    }
  }

  const deleteItem = async (itemId: string) => {
    try {
      const updatedItems = items.filter(i => i.id !== itemId)
      
      setItems(updatedItems)
      localStorage.setItem('dorps-gallery-items', JSON.stringify(updatedItems))

      if (isSupabaseEnabled) {
        await galleryItems.delete(itemId)
      }

      return true
    } catch (error) {
      console.error('Error deleting gallery item:', error)
      return false
    }
  }

  return {
    items,
    isLoading,
    isSupabaseEnabled,
    saveItem,
    deleteItem,
    refreshItems: loadItems
  }
}

// Custom hook for categories with hybrid storage
export function useCategories() {
  const [categoryList, setCategoryList] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSupabaseEnabled] = useState(isSupabaseConfigured())

  const defaultCategories: Category[] = [
    { id: 'general', name: 'General', color: '#8B5CF6' },
    { id: 'jokes', name: 'Inside Jokes', color: '#F59E0B' },
    { id: 'members', name: 'Members', color: '#10B981' },
    { id: 'adventures', name: 'Adventures', color: '#EF4444' },
    { id: 'quotes', name: 'Quotes', color: '#3B82F6' }
  ]

  useEffect(() => {
    loadCategories()
  }, [])

  const loadCategories = async () => {
    setIsLoading(true)
    try {
      if (isSupabaseEnabled) {
        const remoteCategories = await categories.getAll()
        
        if (remoteCategories.length === 0) {
          for (const category of defaultCategories) {
            await categories.create(category)
          }
          setCategoryList(defaultCategories)
        } else {
          setCategoryList(remoteCategories)
        }

        localStorage.setItem('dorps-wiki-categories', JSON.stringify(remoteCategories.length > 0 ? remoteCategories : defaultCategories))
      } else {
        const savedCategories = localStorage.getItem('dorps-wiki-categories')
        if (savedCategories) {
          setCategoryList(JSON.parse(savedCategories))
        } else {
          setCategoryList(defaultCategories)
          localStorage.setItem('dorps-wiki-categories', JSON.stringify(defaultCategories))
        }
      }
    } catch (error) {
      console.error('Error loading categories:', error)
      const savedCategories = localStorage.getItem('dorps-wiki-categories')
      if (savedCategories) {
        setCategoryList(JSON.parse(savedCategories))
      } else {
        setCategoryList(defaultCategories)
      }
    }
    setIsLoading(false)
  }

  const saveCategory = async (category: Category) => {
    try {
      const updatedCategories = [...categoryList, category]
      
      setCategoryList(updatedCategories)
      localStorage.setItem('dorps-wiki-categories', JSON.stringify(updatedCategories))

      if (isSupabaseEnabled) {
        await categories.create(category)
      }

      return category
    } catch (error) {
      console.error('Error saving category:', error)
      return null
    }
  }

  const deleteCategory = async (categoryId: string) => {
    try {
      const updatedCategories = categoryList.filter(c => c.id !== categoryId)
      
      setCategoryList(updatedCategories)
      localStorage.setItem('dorps-wiki-categories', JSON.stringify(updatedCategories))

      if (isSupabaseEnabled) {
        await categories.delete(categoryId)
      }

      return true
    } catch (error) {
      console.error('Error deleting category:', error)
      return false
    }
  }

  return {
    categories: categoryList,
    isLoading,
    isSupabaseEnabled,
    saveCategory,
    deleteCategory,
    refreshCategories: loadCategories
  }
}

// Hybrid storage functions for other data types (no hooks needed)

// Visitor Logs Storage
export const visitorLogsStorage = {
  async save(log: VisitorLog): Promise<void> {
    try {
      // Always save to localStorage first
      const currentLogs = JSON.parse(localStorage.getItem('dorps-visitor-logs') || '[]')
      const updatedLogs = [log, ...currentLogs].slice(0, 100)
      localStorage.setItem('dorps-visitor-logs', JSON.stringify(updatedLogs))

      // Save to Supabase if enabled
      if (isSupabaseConfigured()) {
        await visitorLogs.create({
          id: log.id,
          timestamp: log.timestamp,
          country: log.country,
          ip: log.ip,
          user_agent: log.userAgent,
          page: log.page
        })
      }
    } catch (error) {
      console.error('Error saving visitor log:', error)
    }
  },

  async getAll(): Promise<VisitorLog[]> {
    try {
      if (isSupabaseConfigured()) {
        const remoteLogs = await visitorLogs.getAll()
        const convertedLogs = remoteLogs.map(log => ({
          id: log.id,
          timestamp: log.timestamp,
          country: log.country,
          ip: log.ip,
          userAgent: log.user_agent,
          page: log.page
        }))
        
        // Update localStorage with remote data
        localStorage.setItem('dorps-visitor-logs', JSON.stringify(convertedLogs))
        return convertedLogs
      } else {
        // Fallback to localStorage
        const savedLogs = localStorage.getItem('dorps-visitor-logs')
        return savedLogs ? JSON.parse(savedLogs) : []
      }
    } catch (error) {
      console.error('Error loading visitor logs:', error)
      const savedLogs = localStorage.getItem('dorps-visitor-logs')
      return savedLogs ? JSON.parse(savedLogs) : []
    }
  },

  async clear(): Promise<void> {
    try {
      localStorage.setItem('dorps-visitor-logs', JSON.stringify([]))
      
      if (isSupabaseConfigured()) {
        await visitorLogs.clear()
      }
    } catch (error) {
      console.error('Error clearing visitor logs:', error)
    }
  }
}

// Activity Logs Storage
export const activityLogsStorage = {
  async save(log: ActivityLog): Promise<void> {
    try {
      // Always save to localStorage first
      const currentLogs = JSON.parse(localStorage.getItem('dorps-activity-logs') || '[]')
      const updatedLogs = [log, ...currentLogs].slice(0, 500)
      localStorage.setItem('dorps-activity-logs', JSON.stringify(updatedLogs))

      // Save to Supabase if enabled
      if (isSupabaseConfigured()) {
        await activityLogs.create({
          id: log.id,
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
    } catch (error) {
      console.error('Error saving activity log:', error)
    }
  },

  async getAll(): Promise<ActivityLog[]> {
    try {
      if (isSupabaseConfigured()) {
        const remoteLogs = await activityLogs.getAll()
        const convertedLogs = remoteLogs.map(log => ({
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
        
        localStorage.setItem('dorps-activity-logs', JSON.stringify(convertedLogs))
        return convertedLogs
      } else {
        const savedLogs = localStorage.getItem('dorps-activity-logs')
        return savedLogs ? JSON.parse(savedLogs) : []
      }
    } catch (error) {
      console.error('Error loading activity logs:', error)
      const savedLogs = localStorage.getItem('dorps-activity-logs')
      return savedLogs ? JSON.parse(savedLogs) : []
    }
  }
}

// Invincible Pages Storage
export const invinciblePagesStorage = {
  async toggle(pageId: string, isInvincible: boolean, createdBy: string = 'super-admin'): Promise<void> {
    try {
      // Update localStorage
      const currentPages = JSON.parse(localStorage.getItem('dorps-invincible-pages') || '[]')
      let updatedPages: string[]
      
      if (isInvincible) {
        updatedPages = [...currentPages, pageId]
      } else {
        updatedPages = currentPages.filter((id: string) => id !== pageId)
      }
      
      localStorage.setItem('dorps-invincible-pages', JSON.stringify(updatedPages))

      // Update Supabase if enabled
      if (isSupabaseConfigured()) {
        if (isInvincible) {
          await invinciblePages.add(pageId, createdBy)
        } else {
          await invinciblePages.remove(pageId)
        }
      }
    } catch (error) {
      console.error('Error toggling invincible page:', error)
    }
  },

  async getAll(): Promise<string[]> {
    try {
      if (isSupabaseConfigured()) {
        const remotePages = await invinciblePages.getAll()
        const pageIds = remotePages.map(p => p.page_id)
        
        localStorage.setItem('dorps-invincible-pages', JSON.stringify(pageIds))
        return pageIds
      } else {
        const savedPages = localStorage.getItem('dorps-invincible-pages')
        return savedPages ? JSON.parse(savedPages) : []
      }
    } catch (error) {
      console.error('Error loading invincible pages:', error)
      const savedPages = localStorage.getItem('dorps-invincible-pages')
      return savedPages ? JSON.parse(savedPages) : []
    }
  },

  async isInvincible(pageId: string): Promise<boolean> {
    try {
      if (isSupabaseConfigured()) {
        return await invinciblePages.isInvincible(pageId)
      } else {
        const savedPages = JSON.parse(localStorage.getItem('dorps-invincible-pages') || '[]')
        return savedPages.includes(pageId)
      }
    } catch (error) {
      console.error('Error checking invincible page:', error)
      return false
    }
  }
}

// Rate Limiting Storage
export const rateLimitsStorage = {
  async get(ip: string): Promise<{ attempts: number; lastAttempt: number; lockoutUntil: number } | null> {
    try {
      if (isSupabaseConfigured()) {
        const rateLimit = await rateLimits.get(ip)
        if (rateLimit) {
          return {
            attempts: rateLimit.attempts,
            lastAttempt: new Date(rateLimit.last_attempt).getTime(),
            lockoutUntil: rateLimit.lockout_until ? new Date(rateLimit.lockout_until).getTime() : 0
          }
        }
        return null
      } else {
        const allData = JSON.parse(localStorage.getItem('dorps-rate-limit-ips') || '{}')
        return allData[ip] || null
      }
    } catch (error) {
      console.error('Error getting rate limit:', error)
      return null
    }
  },

  async update(ip: string, attempts: number, lockoutUntil: number = 0): Promise<void> {
    try {
      // Update localStorage
      const allData = JSON.parse(localStorage.getItem('dorps-rate-limit-ips') || '{}')
      allData[ip] = {
        attempts,
        lastAttempt: Date.now(),
        lockoutUntil,
        timestamp: new Date().toISOString()
      }
      localStorage.setItem('dorps-rate-limit-ips', JSON.stringify(allData))

      // Update Supabase if enabled
      if (isSupabaseConfigured()) {
        await rateLimits.update(
          ip, 
          attempts, 
          lockoutUntil > 0 ? new Date(lockoutUntil).toISOString() : undefined
        )
      }
    } catch (error) {
      console.error('Error updating rate limit:', error)
    }
  },

  async clear(ip?: string): Promise<void> {
    try {
      if (ip) {
        // Clear specific IP
        const allData = JSON.parse(localStorage.getItem('dorps-rate-limit-ips') || '{}')
        delete allData[ip]
        localStorage.setItem('dorps-rate-limit-ips', JSON.stringify(allData))
      } else {
        // Clear all
        localStorage.setItem('dorps-rate-limit-ips', JSON.stringify({}))
      }

      if (isSupabaseConfigured()) {
        await rateLimits.clear(ip)
      }
    } catch (error) {
      console.error('Error clearing rate limits:', error)
    }
  },

  async getAll(): Promise<any> {
    try {
      if (isSupabaseConfigured()) {
        const remoteLimits = await rateLimits.getAll()
        const converted: any = {}
        
        for (const limit of remoteLimits) {
          converted[limit.ip] = {
            attempts: limit.attempts,
            lastAttempt: new Date(limit.last_attempt).getTime(),
            lockoutUntil: limit.lockout_until ? new Date(limit.lockout_until).getTime() : 0,
            timestamp: limit.updated_at || limit.created_at
          }
        }
        
        localStorage.setItem('dorps-rate-limit-ips', JSON.stringify(converted))
        return converted
      } else {
        return JSON.parse(localStorage.getItem('dorps-rate-limit-ips') || '{}')
      }
    } catch (error) {
      console.error('Error getting all rate limits:', error)
      return JSON.parse(localStorage.getItem('dorps-rate-limit-ips') || '{}')
    }
  }
}
