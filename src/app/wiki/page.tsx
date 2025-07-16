'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PlusCircle, Search, FileText, Settings, Home, LogOut, Tag, Shield, Eye, Plus, X, Menu, Image as ImageIcon, Wifi, WifiOff, HardDrive } from 'lucide-react'
import { League_Spartan } from 'next/font/google'
import WikiEditor from '@/components/WikiEditor'
import WikiViewer from '@/components/WikiViewer'
import Gallery from '@/components/Gallery'
import CDNManager from '@/components/CDNManager'
import { logActivity, isPageInvincible } from '@/utils/activityLogger'
import { useWikiPages, useCategories, generateUniqueId, isDuplicateTitle, debugDatabase } from '@/utils/supabaseStorage'
import { isSupabaseConfigured } from '@/utils/supabase'

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
  const { pages, isLoading: pagesLoading, error: pagesError, savePage, deletePage, refreshPages } = useWikiPages()
  const { categoryList: categories, isLoading: categoriesLoading, error: categoriesError, saveCategory, deleteCategory } = useCategories()
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
  const [isSupabaseEnabled] = useState(isSupabaseConfigured())
  const [showCDNManager, setShowCDNManager] = useState(false)
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
    const { rateLimitsStorage } = await import('../../utils/supabaseStorage')
    const data = await rateLimitsStorage.get(userIP)
    
    if (!data) {
      return { attempts: 0, lastAttempt: 0, lockoutUntil: 0, userIP }
    }
    
    return { ...data, userIP }
  }

  const updateRateLimitData = async (attempts: number, lockoutUntil: number = 0) => {
    const userIP = await getUserIdentifier()
    const { rateLimitsStorage } = await import('../../utils/supabaseStorage')
    
    await rateLimitsStorage.update(userIP, attempts, lockoutUntil)
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

      const { visitorLogsStorage } = await import('../../utils/supabaseStorage')
      await visitorLogsStorage.save(newLog)
    } catch (error) {
      console.error('Failed to log visit:', error)
    }
  }

  // Initialize data after access is verified
  useEffect(() => {
    if (!userRole) return
    
    // Set loading based on supabase storage loading states
    setIsLoading(pagesLoading || categoriesLoading)
    
    // Set initial page when pages are loaded
    if (!pagesLoading && pages.length > 0 && !currentPage) {
      setCurrentPage(pages[0])
    }

    // Log visit
    logVisit('/wiki', 'Wiki')
  }, [userRole, pagesLoading, categoriesLoading, pages.length, currentPage])

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
      
      // Save using supabase storage
      const savedPage = await savePage(updatedPage, false)
      if (savedPage) {
        setCurrentPage(savedPage)
        // Log the edit activity
        await logActivity('edit', currentPage.id, pageData.title, userRole)
      }
    } else {
      // Check for duplicate title
      if (isDuplicateTitle(pages, pageData.title)) {
        alert('A page with this title already exists. Please choose a different title.')
        return
      }
      
      // Create new page with unique ID
      const newPageId = generateUniqueId('page')
      console.log('=== NEW PAGE CREATION ===')
      console.log('Generated new page ID:', newPageId)
      console.log('Page data:', pageData)
      console.log('Current pages:', pages.map(p => ({ id: p.id, title: p.title })))
      
      const newPage: WikiPage = {
        id: newPageId,
        ...pageData,
        lastModified: new Date().toISOString(),
        createdBy: userRole || 'admin'
      }
      
      console.log('New page object:', newPage)
      console.log('=== END NEW PAGE CREATION ===')
      
      // Save using supabase storage
      const savedPage = await savePage(newPage, true)
      if (savedPage) {
        setCurrentPage(savedPage)
        // Log the creation activity
        await logActivity('create', newPage.id, pageData.title, userRole)
        
        // Debug database state
        console.log('=== AFTER CREATING PAGE ===')
        await debugDatabase()
      }
    }
    setIsEditing(false)
  }

  const handleDeletePage = async (pageId: string) => {
    if (userRole !== 'admin' && userRole !== 'super-admin') return
    
    // Check if page is invincible (protected)
    if (await isPageInvincible(pageId)) {
      alert('This page is protected and cannot be deleted by regular admins. Contact a super admin to remove this protection.')
      return
    }
    
    // Find the page to get its title for logging
    const pageToDelete = pages.find(p => p.id === pageId)
    const pageTitle = pageToDelete?.title || 'Unknown Page'
    
    // Delete using supabase storage
    const success = await deletePage(pageId)
    if (success) {
      // Log the deletion activity
      await logActivity('delete', pageId, pageTitle, userRole)
      
      if (currentPage?.id === pageId) {
        setCurrentPage(pages.length > 0 ? pages[0] : null)
      }
    }
    setIsEditing(false)
  }

  const handleCreateNewPage = () => {
    if (userRole !== 'admin' && userRole !== 'super-admin') return
    setCurrentPage(null)
    setIsEditing(true)
  }

  const handleAddCategory = async () => {
    if ((userRole !== 'admin' && userRole !== 'super-admin') || !newCategoryName.trim()) return

    const newCategory: Category = {
      id: Date.now().toString(),
      name: newCategoryName.trim(),
      color: newCategoryColor
    }

    // Save using supabase storage
    const savedCategory = await saveCategory(newCategory)
    if (savedCategory) {
      setNewCategoryName('')
      setShowCategoryManager(false)
    }
  }

  const handleDeleteCategory = async (categoryId: string) => {
    if (userRole !== 'admin' && userRole !== 'super-admin') return

    // Delete using supabase storage
    const success = await deleteCategory(categoryId)
    if (success) {
      // Reset pages in deleted category to 'general' (this needs to be handled by updating each page)
      // For now, we'll just delete the category and let users manually reassign pages
    }
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

                  {/* CDN Manager Button */}
                  <button
                    onClick={() => setShowCDNManager(true)}
                    className="flex items-center space-x-1 md:space-x-2 px-2 md:px-3 py-2 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-lg hover:from-orange-700 hover:to-red-700 transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-orange-500/25 text-sm"
                  >
                    <HardDrive className="w-4 h-4" />
                    <span className="hidden sm:inline">CDN</span>
                    <span className="sm:hidden">CDN</span>
                  </button>

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
                  
                  {/* Refresh button for admins */}
                  <button
                    onClick={refreshPages}
                    className="flex items-center space-x-1 md:space-x-2 px-2 md:px-3 py-2 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg hover:from-gray-700 hover:to-gray-800 transition-all duration-300 hover:scale-105 shadow-lg text-sm"
                  >
                    <WifiOff className="w-4 h-4" />
                    <span className="hidden sm:inline">Refresh</span>
                  </button>
                </>
              )} 

              {/* Gallery/Wiki toggle for viewers */}
              {userRole === 'viewer' && (
                <>
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

                  {/* CDN Manager Button for Viewers */}
                  <button
                    onClick={() => setShowCDNManager(true)}
                    className="flex items-center space-x-1 md:space-x-2 px-2 md:px-3 py-2 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-lg hover:from-orange-700 hover:to-red-700 transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-orange-500/25 text-sm"
                  >
                    <HardDrive className="w-4 h-4" />
                    <span className="hidden sm:inline">CDN</span>
                    <span className="sm:hidden">CDN</span>
                  </button>
                  
                  {/* Refresh button for viewers */}
                  <button
                    onClick={refreshPages}
                    className="flex items-center space-x-1 md:space-x-2 px-2 md:px-3 py-2 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg hover:from-gray-700 hover:to-gray-800 transition-all duration-300 hover:scale-105 shadow-lg text-sm"
                  >
                    <WifiOff className="w-4 h-4" />
                    <span className="hidden sm:inline">Refresh</span>
                  </button>
                </>
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

                {/* Storage Status */}
                <div className={`mb-4 p-2 rounded-lg text-xs ${
                  isSupabaseEnabled 
                    ? 'bg-green-900/30 border border-green-500/30 text-green-300' 
                    : 'bg-yellow-900/30 border border-yellow-500/30 text-yellow-300'
                }`}>
                  <div className="flex items-center space-x-2">
                    {isSupabaseEnabled ? (
                      <Wifi className="w-3 h-3" />
                    ) : (
                      <WifiOff className="w-3 h-3" />
                    )}
                    <span className="font-medium">
                      {isSupabaseEnabled ? 'Shared Storage' : 'Local Only'}
                    </span>
                  </div>
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
                  {categories.map((category: Category) => (
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
                    {categories.map((category: Category) => (
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
                  const category = categories.find((c: Category) => c.id === page.category)
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
                  {pages.length === 0 ? (
                    <>
                      <h2 className="text-xl font-medium mb-2 text-gray-300">Welcome to your wiki!</h2>
                      <p className="mb-4 text-gray-400">You haven't created any pages yet. Get started by creating your first page!</p>
                      {(userRole === 'admin' || userRole === 'super-admin') && (
                        <button
                          onClick={() => setIsEditing(true)}
                          className="inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-purple-500/25"
                        >
                          <PlusCircle className="w-5 h-5" />
                          <span>Create Your First Page</span>
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <h2 className="text-xl font-medium mb-2 text-gray-300">No page selected</h2>
                      <p className="mb-4 text-gray-400">Select a page from the sidebar or create a new one</p>
                      {(userRole === 'admin' || userRole === 'super-admin') && (
                        <button
                          onClick={() => setIsEditing(true)}
                          className="inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-purple-500/25"
                        >
                          <PlusCircle className="w-5 h-5" />
                          <span>Create New Page</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
      
      {/* CDN Manager Modal */}
      <CDNManager 
        isOpen={showCDNManager} 
        onClose={() => setShowCDNManager(false)} 
      />
    </div>
  )
}
