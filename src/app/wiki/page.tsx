'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PlusCircle, Search, FileText, Settings, Home, LogOut, Tag, Shield, Eye, Plus, X, Menu, Image as ImageIcon } from 'lucide-react'
import { League_Spartan } from 'next/font/google'
import WikiEditor from '@/components/WikiEditor'
import WikiViewer from '@/components/WikiViewer'
import Gallery from '@/components/Gallery'
import { logActivity, isPageInvincible } from '@/utils/activityLogger'

const leagueSpartan = League_Spartan({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-league-spartan',
})

type UserRole = 'viewer' | 'admin' | 'super-admin'

interface WikiPage {
  id: string
  title: string
  content: string
  lastModified: string
  category: string
  createdBy: UserRole
}

interface Category {
  id: string
  name: string
  color: string
}

export default function WikiPage() {
  const [pages, setPages] = useState<WikiPage[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [currentPage, setCurrentPage] = useState<WikiPage | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showCategoryManager, setShowCategoryManager] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState('#8B5CF6')
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentView, setCurrentView] = useState<'wiki' | 'gallery'>('wiki')
  const router = useRouter()

  // Simple hash function for basic obfuscation
  const hashCode = (str: string) => {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString(16)
  }

  // Get user IP address (fallback to fingerprint if IP not available)
  const getUserIdentifier = async () => {
    try {
      // Try to get real IP from external service
      const response = await fetch('https://api.ipify.org?format=json')
      const data = await response.json()
      return data.ip
    } catch (error) {
      // Fallback to browser fingerprint
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.textBaseline = 'top'
        ctx.font = '14px Arial'
        ctx.fillText('Browser fingerprint', 2, 2)
        const fingerprint = canvas.toDataURL()
        return btoa(fingerprint + navigator.userAgent + screen.width + screen.height).substring(0, 12)
      }
      // Ultimate fallback
      return btoa(navigator.userAgent + screen.width + screen.height + Date.now().toString()).substring(0, 12)
    }
  }

  // Rate limiting functions with IP-based restrictions
  const getRateLimitData = async () => {
    const userIP = await getUserIdentifier()
    const allData = JSON.parse(localStorage.getItem('dorps-rate-limit-ips') || '{}')
    
    if (!allData[userIP]) {
      return { attempts: 0, lastAttempt: 0, lockoutUntil: 0, userIP }
    }
    
    return { ...allData[userIP], userIP }
  }

  const updateRateLimitData = async (attempts: number, lockoutUntil: number = 0) => {
    const userIP = await getUserIdentifier()
    const allData = JSON.parse(localStorage.getItem('dorps-rate-limit-ips') || '{}')
    
    allData[userIP] = {
      attempts,
      lastAttempt: Date.now(),
      lockoutUntil,
      timestamp: new Date().toISOString()
    }
    
    // Clean up old entries (older than 24 hours)
    const now = Date.now()
    Object.keys(allData).forEach(ip => {
      if (now - allData[ip].lastAttempt > 24 * 60 * 60 * 1000) {
        delete allData[ip]
      }
    })
    
    localStorage.setItem('dorps-rate-limit-ips', JSON.stringify(allData))
    
    // Also update legacy storage for backwards compatibility
    localStorage.setItem('dorps-rate-limit', JSON.stringify({
      attempts,
      lastAttempt: Date.now(),
      lockoutUntil
    }))
  }

  const isRateLimited = async () => {
    const { attempts, lastAttempt, lockoutUntil, userIP } = await getRateLimitData()
    const now = Date.now()
    
    console.log(`Rate limit check for IP: ${userIP}, attempts: ${attempts}, lockout: ${lockoutUntil}`)
    
    // Check if still in lockout period
    if (lockoutUntil > now) {
      return { limited: true, remainingTime: Math.ceil((lockoutUntil - now) / 1000), userIP }
    }
    
    // If lockout period has ended, reset attempts
    if (lockoutUntil > 0 && lockoutUntil <= now) {
      await updateRateLimitData(0)
      return { limited: false, remainingTime: 0, userIP }
    }
    
    // Reset attempts after 15 minutes of no activity
    if (now - lastAttempt > 15 * 60 * 1000) {
      await updateRateLimitData(0)
      return { limited: false, remainingTime: 0, userIP }
    }
    
    // Rate limit after 5 failed attempts
    if (attempts >= 5) {
      const lockoutTime = now + (attempts - 4) * 60 * 1000 // Exponential backoff: 1min, 2min, 3min...
      await updateRateLimitData(attempts, lockoutTime)
      return { limited: true, remainingTime: Math.ceil((lockoutTime - now) / 1000), userIP }
    }
    
    return { limited: false, remainingTime: 0, userIP }
  }

  const recordFailedAttempt = async () => {
    const { attempts } = await getRateLimitData()
    await updateRateLimitData(attempts + 1)
  }

  const recordSuccessfulAttempt = async () => {
    await updateRateLimitData(0) // Reset on successful login
  }

  // Check access on mount
  useEffect(() => {
    checkAuthAndLoadData()
  }, [])

  const checkAuthAndLoadData = async () => {
    try {
      const response = await fetch('/api/auth')
      const data = await response.json()
      
      if (!data.authenticated) {
        window.location.href = '/'
        return
      }
      
      setUserRole(data.role)
      setIsLoading(false)
      
      // Log visit
      logVisit('/wiki', 'Wiki')
    } catch (error) {
      console.error('Auth check failed:', error)
      window.location.href = '/'
    }
  }

  const getCountryFromIP = async (ip: string): Promise<string> => {
    try {
      // In a real application, you'd use a proper IP geolocation service
      // For demo purposes, we'll simulate this
      if (ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
        return 'Local Network'
      }
      
      // You could integrate with services like ipapi.co, ipinfo.io, etc.
      // Add timeout and better error handling for security software blocking
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000) // 3 second timeout
      
      const response = await fetch(`https://ipapi.co/${ip}/json/`, {
        signal: controller.signal,
        mode: 'cors'
      })
      
      clearTimeout(timeoutId)
      
      if (response.ok) {
        const data = await response.json()
        return data.country_name || 'Unknown'
      }
    } catch (error) {
      console.warn('IP geolocation service unavailable (likely blocked by security software):', error instanceof Error ? error.message : 'Unknown error')
      // Don't log the full error as it's expected in some environments
    }
    return 'Unknown'
  }

  const logVisit = async (page: string, title: string) => {
    try {
      // Get real IP address
      const userIP = await getUserIdentifier()
      // Get country from IP
      const country = await getCountryFromIP(userIP)
      
      const newLog = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        country: country,
        ip: userIP,
        userAgent: navigator.userAgent,
        page: `${page} (${title})`
      }

      const currentLogs = JSON.parse(localStorage.getItem('dorps-visitor-logs') || '[]')
      const updatedLogs = [newLog, ...currentLogs].slice(0, 100)
      localStorage.setItem('dorps-visitor-logs', JSON.stringify(updatedLogs))
    } catch (error) {
      console.error('Failed to log visit:', error)
    }
  }

  // Initialize data after access is verified
  useEffect(() => {
    if (!userRole || isLoading) return

    // Load categories from localStorage
    const savedCategories = localStorage.getItem('dorps-wiki-categories')
    if (savedCategories) {
      setCategories(JSON.parse(savedCategories))
    } else {
      // Create default categories
      const defaultCategories: Category[] = [
        { id: 'general', name: 'General', color: '#8B5CF6' },
        { id: 'jokes', name: 'Inside Jokes', color: '#F59E0B' },
        { id: 'members', name: 'Members', color: '#10B981' },
        { id: 'adventures', name: 'Adventures', color: '#EF4444' },
        { id: 'quotes', name: 'Quotes', color: '#3B82F6' }
      ]
      setCategories(defaultCategories)
      localStorage.setItem('dorps-wiki-categories', JSON.stringify(defaultCategories))
    }

    // Load pages from localStorage
    const savedPages = localStorage.getItem('dorps-wiki-pages')
    if (savedPages) {
      const parsedPages = JSON.parse(savedPages)
      const updatedPages = parsedPages.map((page: any) => ({
        ...page,
        category: page.category || 'general',
        createdBy: page.createdBy || 'admin'
      }))
      setPages(updatedPages)
      if (updatedPages.length > 0) {
        setCurrentPage(updatedPages[0])
      }
    } else {
      // Create welcome page
      const welcomePage: WikiPage = {
        id: 'welcome',
        title: 'Welcome to The Dorps Wiki',
        content: `# Welcome to The Dorps Wiki! 🎭

This is your secret knowledge base. Here you can:

- 📚 Create and edit wiki pages
- 🏷️ Organize content with categories  
- 🔍 Search through all content
- 🎨 Customize with different themes

## Getting Started

${(userRole === 'admin' || userRole === 'super-admin') ? 
  'As an **admin**, you can create, edit, and delete pages and categories.' : 
  'As a **viewer**, you can read all content but cannot make changes.'
}

Click the "➕ New Page" button to create your first page!

---
*Last updated: ${new Date().toLocaleDateString()}*`,
        lastModified: new Date().toISOString(),
        category: 'general',
        createdBy: 'admin'
      }
      setPages([welcomePage])
      setCurrentPage(welcomePage)
      localStorage.setItem('dorps-wiki-pages', JSON.stringify([welcomePage]))
    }
  }, [userRole, isLoading])

  const handleLogout = async () => {
    try {
      await fetch('/api/auth', { method: 'DELETE' })
      localStorage.removeItem('dorps-access') // Keep for backward compatibility
      window.location.href = '/'
    } catch (error) {
      console.error('Logout error:', error)
      // Fallback to local logout
      localStorage.removeItem('dorps-access')
      window.location.href = '/'
    }
  }

  const handleSavePage = async (pageData: { title: string; content: string; category: string }) => {
    if (userRole !== 'admin' && userRole !== 'super-admin') return

    if (currentPage) {
      // Update existing page
      const updatedPage = {
        ...currentPage,
        ...pageData,
        lastModified: new Date().toISOString()
      }
      const updatedPages = pages.map(p => p.id === currentPage.id ? updatedPage : p)
      setPages(updatedPages)
      setCurrentPage(updatedPage)
      localStorage.setItem('dorps-wiki-pages', JSON.stringify(updatedPages))
      
      // Log the edit activity
      await logActivity('edit', currentPage.id, pageData.title, userRole)
    } else {
      // Create new page
      const newPage: WikiPage = {
        id: Date.now().toString(),
        ...pageData,
        lastModified: new Date().toISOString(),
        createdBy: userRole || 'admin'
      }
      const updatedPages = [...pages, newPage]
      setPages(updatedPages)
      setCurrentPage(newPage)
      localStorage.setItem('dorps-wiki-pages', JSON.stringify(updatedPages))
      
      // Log the creation activity
      await logActivity('create', newPage.id, pageData.title, userRole)
    }
    setIsEditing(false)
  }

  const handleDeletePage = async (pageId: string) => {
    if (userRole !== 'admin' && userRole !== 'super-admin') return
    
    // Check if page is invincible (protected)
    if (isPageInvincible(pageId)) {
      alert('This page is protected and cannot be deleted by regular admins. Contact a super admin to remove this protection.')
      return
    }
    
    // Find the page to get its title for logging
    const pageToDelete = pages.find(p => p.id === pageId)
    const pageTitle = pageToDelete?.title || 'Unknown Page'
    
    const updatedPages = pages.filter(p => p.id !== pageId)
    setPages(updatedPages)
    localStorage.setItem('dorps-wiki-pages', JSON.stringify(updatedPages))
    
    // Log the deletion activity
    await logActivity('delete', pageId, pageTitle, userRole)
    
    if (currentPage?.id === pageId) {
      setCurrentPage(updatedPages.length > 0 ? updatedPages[0] : null)
    }
    setIsEditing(false)
  }

  const handleCreateNewPage = () => {
    if (userRole !== 'admin' && userRole !== 'super-admin') return
    setCurrentPage(null)
    setIsEditing(true)
  }

  const handleAddCategory = () => {
    if ((userRole !== 'admin' && userRole !== 'super-admin') || !newCategoryName.trim()) return

    const newCategory: Category = {
      id: Date.now().toString(),
      name: newCategoryName.trim(),
      color: newCategoryColor
    }

    const updatedCategories = [...categories, newCategory]
    setCategories(updatedCategories)
    localStorage.setItem('dorps-wiki-categories', JSON.stringify(updatedCategories))
    setNewCategoryName('')
    setShowCategoryManager(false)
  }

  const handleDeleteCategory = (categoryId: string) => {
    if (userRole !== 'admin' && userRole !== 'super-admin') return

    const updatedCategories = categories.filter(c => c.id !== categoryId)
    setCategories(updatedCategories)
    localStorage.setItem('dorps-wiki-categories', JSON.stringify(updatedCategories))
    
    // Reset pages in deleted category to 'general'
    const updatedPages = pages.map(p => 
      p.category === categoryId ? { ...p, category: 'general' } : p
    )
    setPages(updatedPages)
    localStorage.setItem('dorps-wiki-pages', JSON.stringify(updatedPages))
  }

  const filteredPages = pages.filter(page => {
    const matchesSearch = page.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         page.content.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || page.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  if (isLoading) {
    return (
      <div className={`min-h-screen bg-gray-900 flex items-center justify-center ${leagueSpartan.className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto mb-4"></div>
          <p className="text-gray-300">Loading...</p>
        </div>
      </div>
    )
  }

  if (!userRole) {
    return null
  }

  return (
    <div className={`min-h-screen bg-gray-900 text-white ${leagueSpartan.className}`} style={{ position: 'relative' }}>
      {/* Header */}
      <header className="sticky-header sticky top-0 bg-gray-800 border-b border-gray-700 z-[60] backdrop-blur-sm">
        <div className="px-2 sm:px-4 lg:px-8 py-3 md:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 md:space-x-4 min-w-0 flex-1">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-md text-gray-400 hover:text-gray-300 hover:bg-gray-700 transition-all duration-300 hover:scale-110 flex-shrink-0"
              >
                <div className={`transition-transform duration-300 ${sidebarOpen ? 'rotate-0' : 'rotate-180'}`}>
                  <Menu className="w-5 h-5" />
                </div>
              </button>
              <h1 className="text-lg md:text-2xl font-bold text-white animate-pulse truncate">The Dorps Wiki</h1>
              <div className="flex items-center space-x-2 flex-shrink-0">
                <div className={`px-2 py-1 rounded-full text-xs font-medium transition-all duration-300 hover:scale-105 ${
                  userRole === 'super-admin' 
                    ? 'bg-purple-900 text-purple-200 shadow-lg shadow-purple-500/20' 
                    : userRole === 'admin'
                    ? 'bg-blue-900 text-blue-200 shadow-lg shadow-blue-500/20'
                    : 'bg-green-900 text-green-200 shadow-lg shadow-green-500/20'
                }`}>
                  {userRole === 'super-admin' ? (
                    <>
                      <Shield className="w-3 h-3 inline mr-1" />
                      <span className="hidden sm:inline">Super Admin</span>
                      <span className="sm:hidden">S.Admin</span>
                    </>
                  ) : userRole === 'admin' ? (
                    <>
                      <Shield className="w-3 h-3 inline mr-1" />
                      <span className="hidden sm:inline">Admin</span>
                      <span className="sm:hidden">Admin</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3 h-3 inline mr-1" />
                      <span className="hidden sm:inline">Viewer</span>
                      <span className="sm:hidden">View</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 md:space-x-4">
              {(userRole === 'admin' || userRole === 'super-admin') && (
                <>
                  {/* Show admin panel button only for super admins */}
                  {userRole === 'super-admin' && (
                    <button
                      onClick={() => window.location.href = '/admin'}
                      className="flex items-center space-x-1 md:space-x-2 px-2 md:px-3 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-purple-500/25 text-sm"
                    >
                      <Shield className="w-4 h-4" />
                      <span className="hidden sm:inline">Admin Panel</span>
                      <span className="sm:hidden">Admin</span>
                    </button>
                  )}

                  {/* Gallery/Wiki toggle */}
                  <button
                    onClick={() => setCurrentView(currentView === 'wiki' ? 'gallery' : 'wiki')}
                    className={`flex items-center space-x-1 md:space-x-2 px-2 md:px-3 py-2 rounded-lg transition-all duration-300 hover:scale-105 shadow-lg text-sm ${
                      currentView === 'gallery'
                        ? 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 hover:shadow-blue-500/25'
                        : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 hover:shadow-indigo-500/25'
                    } text-white`}
                  >
                    {currentView === 'gallery' ? (
                      <>
                        <FileText className="w-4 h-4" />
                        <span className="hidden sm:inline">Wiki</span>
                        <span className="sm:hidden">Wiki</span>
                      </>
                    ) : (
                      <>
                        <ImageIcon className="w-4 h-4" />
                        <span className="hidden sm:inline">Gallery</span>
                        <span className="sm:hidden">Gallery</span>
                      </>
                    )}
                  </button>
                  
                  {currentView === 'wiki' && (
                    <button
                      onClick={handleCreateNewPage}
                      className="flex items-center space-x-1 md:space-x-2 px-2 md:px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-green-500/25 text-sm"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span className="hidden sm:inline">New Page</span>
                      <span className="sm:hidden">New</span>
                    </button>
                  )}
                </>
              )} 

              {/* Gallery/Wiki toggle for viewers */}
              {userRole === 'viewer' && (
                <button
                  onClick={() => setCurrentView(currentView === 'wiki' ? 'gallery' : 'wiki')}
                  className={`flex items-center space-x-1 md:space-x-2 px-2 md:px-3 py-2 rounded-lg transition-all duration-300 hover:scale-105 shadow-lg text-sm ${
                    currentView === 'gallery'
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 hover:shadow-blue-500/25'
                      : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 hover:shadow-indigo-500/25'
                  } text-white`}
                >
                  {currentView === 'gallery' ? (
                    <>
                      <FileText className="w-4 h-4" />
                      <span className="hidden sm:inline">Wiki</span>
                      <span className="sm:hidden">Wiki</span>
                    </>
                  ) : (
                    <>
                      <ImageIcon className="w-4 h-4" />
                      <span className="hidden sm:inline">Gallery</span>
                      <span className="sm:hidden">Gallery</span>
                    </>
                  )}
                </button>
              )}
              
              <button
                onClick={handleLogout}
                className="flex items-center space-x-1 md:space-x-2 px-2 md:px-3 py-2 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-lg hover:from-red-700 hover:to-rose-700 transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-red-500/25 text-sm"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
                <span className="sm:hidden">Exit</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex relative">
        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden transition-opacity duration-300"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={`${sidebarOpen ? 'fixed lg:sticky lg:top-16' : 'hidden'} top-0 left-0 z-40 h-screen lg:h-[calc(100vh-4rem)] bg-gray-800 border-r border-gray-700 transition-all duration-500 ease-in-out transform ${
          sidebarOpen 
            ? 'translate-x-0 w-80 opacity-100' 
            : '-translate-x-full w-0 opacity-0'
        } backdrop-blur-xl bg-gray-800/95`}>
          <div className="h-full flex flex-col">
            {/* Header space for mobile */}
            <div className="h-16 lg:h-0 flex-shrink-0"></div>
            
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
              <div className={`p-4 transition-all duration-300 ${sidebarOpen ? 'opacity-100 animate-fade-in-up' : 'opacity-0'}`}>
                {/* Search */}
                <div className="relative mb-4 group">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 transition-colors group-focus-within:text-purple-400" />
                  <input
                    type="text"
                    placeholder="Search pages..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-700/50 backdrop-blur-sm border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 hover:bg-gray-700/70"
                  />
                </div>

              {/* Category Filter */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-300">Category</label>
                  {(userRole === 'admin' || userRole === 'super-admin') && (
                    <button
                      onClick={() => setShowCategoryManager(!showCategoryManager)}
                      className="text-purple-400 hover:text-purple-300"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="all">All Categories</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category Manager */}
              {showCategoryManager && (userRole === 'admin' || userRole === 'super-admin') && (
                <div className="mb-4 p-3 bg-gray-700 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-300 mb-2">Manage Categories</h3>
                  
                  {/* Add Category */}
                  <div className="space-y-2 mb-3">
                    <input
                      type="text"
                      placeholder="Category name..."
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="w-full px-2 py-1 bg-gray-600 border border-gray-500 rounded text-sm text-white placeholder-gray-400"
                    />
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        value={newCategoryColor}
                        onChange={(e) => setNewCategoryColor(e.target.value)}
                        className="w-8 h-6 border border-gray-500 rounded"
                      />
                      <button
                        onClick={handleAddCategory}
                        disabled={!newCategoryName.trim()}
                        className="flex-1 px-2 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 disabled:opacity-50"
                      >
                        <Plus className="w-3 h-3 inline mr-1" />
                        Add
                      </button>
                    </div>
                  </div>

                  {/* Category List */}
                  <div className="space-y-1">
                    {categories.map(category => (
                      <div key={category.id} className="flex items-center justify-between py-1">
                        <div className="flex items-center space-x-2">
                          <div 
                            className="w-3 h-3 rounded"
                            style={{ backgroundColor: category.color }}
                          />
                          <span className="text-sm text-gray-300">{category.name}</span>
                        </div>
                        {category.id !== 'general' && (
                          <button
                            onClick={() => handleDeleteCategory(category.id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pages List */}
              <div className="space-y-1">
                <div className="text-sm font-medium text-gray-300 mb-2">
                  Pages ({filteredPages.length})
                </div>
                {filteredPages.map(page => {
                  const category = categories.find(c => c.id === page.category)
                  return (
                    <button
                      key={page.id}
                      onClick={() => {
                        setCurrentPage(page)
                        setIsEditing(false)
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                        currentPage?.id === page.id
                          ? 'bg-purple-800 text-purple-200 border border-purple-600'
                          : 'hover:bg-gray-700 text-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{page.title}</div>
                          <div className="flex items-center space-x-2 mt-1">
                            {category && (
                              <div className="flex items-center space-x-1">
                                <Tag className="w-3 h-3" style={{ color: category.color }} />
                                <span className="text-xs text-gray-400">{category.name}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
                
                {filteredPages.length === 0 && (
                  <div className="text-center text-gray-400 py-8">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No pages found</p>
                  </div>
                )}
              </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className={`flex-1 transition-all duration-500 ease-in-out ${
          sidebarOpen ? 'lg:ml-0' : 'ml-0'
        }`}>
          {currentView === 'gallery' ? (
            <Gallery userRole={userRole} />
          ) : (
            <div className="p-4 md:p-6 bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 min-h-screen animate-fade-in">
              {isEditing ? (
                <div className="animate-slide-in-right max-w-full">
                  <WikiEditor
                    page={currentPage || {
                      id: '',
                      title: '',
                      content: '',
                      lastModified: new Date().toISOString(),
                      category: 'general',
                      createdBy: userRole || 'admin'
                    }}
                    categories={categories}
                    onSave={(page: any) => {
                      handleSavePage({
                        title: page.title,
                        content: page.content,
                        category: page.category
                      })
                    }}
                    onCancel={() => setIsEditing(false)}
                  />
                </div>
              ) : currentPage ? (
                <div className="animate-slide-in-left max-w-full">
                  <WikiViewer
                    page={currentPage}
                    categories={categories}
                    onEdit={() => setIsEditing(true)}
                    onDelete={() => handleDeletePage(currentPage.id)}
                    userRole={userRole}
                  />
                </div>
              ) : (
                <div className="text-center text-gray-400 py-16 animate-fade-in-up">
                  <div className="relative">
                    <FileText className="w-16 h-16 mx-auto mb-4 opacity-50 animate-pulse" />
                    <div className="absolute inset-0 w-16 h-16 mx-auto animate-ping">
                      <FileText className="w-16 h-16 opacity-20" />
                    </div>
                  </div>
                  <h2 className="text-xl font-medium mb-2 text-gray-300">No page selected</h2>
                  <p className="mb-4 text-gray-400">Select a page from the sidebar or create a new one</p>
                  {(userRole === 'admin' || userRole === 'super-admin') && (
                    <button
                      onClick={handleCreateNewPage}
                      className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-purple-500/25"
                    >
                      Create New Page
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
