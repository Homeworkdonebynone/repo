import { useState, useEffect } from 'react'
import { isSupabaseConfigured, wikiPages, galleryItems, categories, localStorage_fallback } from './supabase'

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

  // Load items on mount
  useEffect(() => {
    loadItems()
  }, [])

  const loadItems = async () => {
    setIsLoading(true)
    try {
      if (isSupabaseEnabled) {
        // Load from Supabase first, then sync with localStorage
        const remoteItems = await galleryItems.getAll()
        const localItemsStr = localStorage.getItem('dorps-gallery-items')
        const localItems = localItemsStr ? JSON.parse(localItemsStr) : []

        // Convert remote items to local format
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

        // Merge items (remote takes priority)
        const mergedItems = [...localItems]
        for (const remoteItem of convertedRemoteItems) {
          const localIndex = mergedItems.findIndex(i => i.id === remoteItem.id)
          if (localIndex >= 0) {
            mergedItems[localIndex] = remoteItem
          } else {
            mergedItems.push(remoteItem)
          }
        }

        // Upload any local-only items to Supabase
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
        // Use localStorage only
        const savedItems = localStorage.getItem('dorps-gallery-items')
        if (savedItems) {
          setItems(JSON.parse(savedItems))
        }
      }
    } catch (error) {
      console.error('Error loading gallery items:', error)
      // Fallback to localStorage on error
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
      
      // Save to localStorage first
      setItems(updatedItems)
      localStorage.setItem('dorps-gallery-items', JSON.stringify(updatedItems))

      // Save to Supabase if enabled
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
      
      // Remove from localStorage
      setItems(updatedItems)
      localStorage.setItem('dorps-gallery-items', JSON.stringify(updatedItems))

      // Remove from Supabase if enabled
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
    setIsLoading(true)
    try {
      if (isSupabaseEnabled) {
        // Load from Supabase
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

        localStorage.setItem('dorps-wiki-categories', JSON.stringify(remoteCategories.length > 0 ? remoteCategories : defaultCategories))
      } else {
        // Use localStorage only
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
      // Fallback to localStorage or defaults
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
      
      // Save to localStorage first
      setCategoryList(updatedCategories)
      localStorage.setItem('dorps-wiki-categories', JSON.stringify(updatedCategories))

      // Save to Supabase if enabled
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
      
      // Remove from localStorage
      setCategoryList(updatedCategories)
      localStorage.setItem('dorps-wiki-categories', JSON.stringify(updatedCategories))

      // Remove from Supabase if enabled
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
