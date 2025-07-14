'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, Users, Key, Trash2, Plus, Globe, Calendar, Eye, LogOut, FileText, Activity, Clock, MapPin } from 'lucide-react'
import { League_Spartan } from 'next/font/google'

const leagueSpartan = League_Spartan({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-league-spartan',
})

interface VisitorLog {
  id: string
  timestamp: string
  country: string
  ip: string
  userAgent: string
  page: string
}

interface CustomUser {
  id: string
  passcode: string
  role: 'admin' | 'viewer'
  createdAt: string
  lastLogin?: string
}

interface WikiPage {
  id: string
  title: string
  content: string
  lastModified: string
  category: string
  createdBy: 'viewer' | 'admin'
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

export default function AdminPanel() {
  const [isLoading, setIsLoading] = useState(true)
  const [userRole, setUserRole] = useState<'super-admin'>('super-admin') // Only super-admin can access
  const [visitorLogs, setVisitorLogs] = useState<VisitorLog[]>([])
  const [customUsers, setCustomUsers] = useState<CustomUser[]>([])
  const [newPasscode, setNewPasscode] = useState('')
  const [newUserRole, setNewUserRole] = useState<'admin' | 'viewer'>('viewer')
  const [activeTab, setActiveTab] = useState<'visitors' | 'users' | 'ratelimits' | 'invincible' | 'activity'>('visitors')
  const [rateLimitData, setRateLimitData] = useState<any>({})
  const [invinciblePages, setInvinciblePages] = useState<string[]>([])
  const [allPages, setAllPages] = useState<WikiPage[]>([])
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
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

  useEffect(() => {
    checkAuthStatus()
  }, [router])

  useEffect(() => {
    if (userRole === 'super-admin') {
      loadCustomUsers()
    }
  }, [userRole])

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/auth')
      const data = await response.json()
      
      // Only allow super-admin role to access admin panel
      if (!data.authenticated || data.role !== 'super-admin') {
        router.push('/')
        return
      }
      
      // Store user role for conditional features
      setUserRole(data.role)
      
      // Continue with loading admin panel data
      loadAdminData()
    } catch (error) {
      console.error('Auth check failed:', error)
      router.push('/')
    }
  }
  const loadAdminData = async () => {
    try {
      // Import hybrid storage utilities
      const { 
        visitorLogsStorage, 
        rateLimitsStorage, 
        invinciblePagesStorage, 
        activityLogsStorage 
      } = await import('../../utils/allDataStorage')

      // Load visitor logs
      const logs = await visitorLogsStorage.getAll()
      setVisitorLogs(logs)

      // Load rate limit data
      const rateLimits = await rateLimitsStorage.getAll()
      setRateLimitData(rateLimits)

      // Load all wiki pages
      const savedPages = localStorage.getItem('dorps-wiki-pages')
      if (savedPages) {
        setAllPages(JSON.parse(savedPages))
      }

      // Load invincible pages list
      const invinciblePageIds = await invinciblePagesStorage.getAll()
      setInvinciblePages(invinciblePageIds)

      // Load activity logs
      const activityLogsData = await activityLogsStorage.getAll()
      setActivityLogs(activityLogsData)

      // Load custom users (since only super admin can access admin panel)
      loadCustomUsers()

      // Log this admin visit
      logVisit('/admin', 'Admin Panel')

      setIsLoading(false)
    } catch (error) {
      console.error('Error loading admin data:', error)
      setIsLoading(false)
    }
  }

  // Get user IP address (same method as used in homepage)
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

  const logVisit = async (page: string, title: string) => {
    try {
      // Get real IP address
      const userIP = await getUserIdentifier()
      // Get country from IP
      const country = await getCountryFromIP(userIP)
      
      const newLog: VisitorLog = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        country: country,
        ip: userIP,
        userAgent: navigator.userAgent,
        page: `${page} (${title})`
      }

      const { visitorLogsStorage } = await import('../../utils/allDataStorage')
      await visitorLogsStorage.save(newLog)
      
      // Update local state
      setVisitorLogs(prev => [newLog, ...prev].slice(0, 100))
    } catch (error) {
      console.error('Failed to log visit:', error)
    }
  }

  const clearRateLimit = async (ip: string) => {
    const { rateLimitsStorage } = await import('../../utils/allDataStorage')
    await rateLimitsStorage.clear(ip)
    
    const updatedData = { ...rateLimitData }
    delete updatedData[ip]
    setRateLimitData(updatedData)
  }

  const clearAllRateLimits = async () => {
    const { rateLimitsStorage } = await import('../../utils/allDataStorage')
    await rateLimitsStorage.clear()
    
    setRateLimitData({})
  }

  const toggleInvinciblePage = async (pageId: string) => {
    const { invinciblePagesStorage } = await import('../../utils/allDataStorage')
    const isCurrentlyInvincible = invinciblePages.includes(pageId)
    
    await invinciblePagesStorage.toggle(pageId, !isCurrentlyInvincible, 'super-admin')
    
    const updatedInvinciblePages = isCurrentlyInvincible
      ? invinciblePages.filter(id => id !== pageId)
      : [...invinciblePages, pageId]
    
    setInvinciblePages(updatedInvinciblePages)
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

  const handleLogout = async () => {
    try {
      await fetch('/api/auth', { method: 'DELETE' })
      localStorage.removeItem('dorps-access') // Keep for backward compatibility
      router.push('/')
    } catch (error) {
      console.error('Logout error:', error)
      // Fallback to local logout
      localStorage.removeItem('dorps-access')
      router.push('/')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getCountryFlag = (country: string) => {
    // Simple country to flag mapping (extend as needed)
    const flags: { [key: string]: string } = {
      'United States': '🇺🇸',
      'United Kingdom': '🇬🇧',
      'Canada': '🇨🇦',
      'Germany': '🇩🇪',
      'France': '🇫🇷',
      'Unknown': '🌍'
    }
    return flags[country] || '🌍'
  }

  const clearVisitorLogs = async () => {
    const { visitorLogsStorage } = await import('../../utils/allDataStorage')
    await visitorLogsStorage.clear()
    
    setVisitorLogs([])
  }

  // User management functions (super admin only)
  const loadCustomUsers = async () => {
    try {
      const response = await fetch('/api/users')
      if (response.ok) {
        const data = await response.json()
        setCustomUsers(data.users || [])
      }
    } catch (error) {
      console.error('Failed to load custom users:', error)
    }
  }

  const createUser = async () => {
    if (!newPasscode.trim()) return
    
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passcode: newPasscode.trim(),
          role: newUserRole
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        alert(`User with passcode "${newPasscode}" created successfully!`)
        setNewPasscode('')
        setNewUserRole('viewer')
        loadCustomUsers() // Refresh the list
      } else {
        const error = await response.json()
        alert(`Failed to create user: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to create user:', error)
      alert('Failed to create user')
    }
  }

  const deleteUser = async (userId: string, passcode: string) => {
    if (!confirm(`Are you sure you want to delete user with passcode "${passcode}"? This action cannot be undone.`)) {
      return
    }
    
    try {
      const response = await fetch('/api/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })
      
      if (response.ok) {
        alert(`User with passcode "${passcode}" deleted successfully!`)
        loadCustomUsers() // Refresh the list
      } else {
        const error = await response.json()
        alert(`Failed to delete user: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to delete user:', error)
      alert('Failed to delete user')
    }
  }

  // ... existing code ...

  if (isLoading) {
    return (
      <div className={`min-h-screen bg-gray-900 flex items-center justify-center ${leagueSpartan.className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto mb-4"></div>
          <p className="text-gray-300">Loading admin panel...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen bg-gray-900 text-white ${leagueSpartan.className}`}>
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Shield className="w-8 h-8 text-purple-400" />
              <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
              <div className="px-3 py-1 rounded-full text-sm font-medium bg-purple-900 text-purple-200">
                Super Admin
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/wiki')}
                className="flex items-center space-x-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg"
              >
                <Eye className="w-4 h-4" />
                <span>View Wiki</span>
              </button>
              
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 overflow-x-auto">
            <button
              onClick={() => setActiveTab('visitors')}
              className={`py-4 px-2 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'visitors'
                  ? 'border-purple-500 text-purple-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              <Users className="w-4 h-4 inline mr-2" />
              Visitor Tracking
            </button>
            {(
              <button
                onClick={() => setActiveTab('users')}
                className={`py-4 px-2 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'users'
                    ? 'border-purple-500 text-purple-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300'
                }`}
              >
                <Users className="w-4 h-4 inline mr-2" />
                User Management
              </button>
            )}
            <button
              onClick={() => setActiveTab('ratelimits')}
              className={`py-4 px-2 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'ratelimits'
                  ? 'border-purple-500 text-purple-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              <Shield className="w-4 h-4 inline mr-2" />
              Rate Limits
            </button>
            <button
              onClick={() => setActiveTab('invincible')}
              className={`py-4 px-2 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'invincible'
                  ? 'border-purple-500 text-purple-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              <FileText className="w-4 h-4 inline mr-2" />
              Invincible Pages
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`py-4 px-2 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'activity'
                  ? 'border-purple-500 text-purple-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              <Activity className="w-4 h-4 inline mr-2" />
              Activity Logs
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'visitors' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Recent Visitors</h2>
              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-400">
                  Total visits: {visitorLogs.length}
                </div>
                {visitorLogs.length > 0 && (
                  <button
                    onClick={clearVisitorLogs}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
                    title="Clear all visitor logs"
                  >
                    Clear Logs
                  </button>
                )}
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Location
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Page
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        User Agent
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {visitorLogs.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-4 text-center text-gray-400">
                          No visitors recorded yet
                        </td>
                      </tr>
                    ) : (
                      visitorLogs.map((log) => (
                        <tr key={log.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                            {formatDate(log.timestamp)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                            <div className="flex items-center space-x-2">
                              <span>{getCountryFlag(log.country)}</span>
                              <span>{log.country}</span>
                              <span className="text-gray-500">({log.ip})</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                            {log.page}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-300 max-w-xs truncate">
                            {log.userAgent}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">User Management</h2>
              <span className="text-sm text-purple-400">Super Admin Only</span>
            </div>

            {/* Create New User */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-medium text-white mb-4">Create New User</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Passcode
                  </label>
                  <input
                    type="text"
                    value={newPasscode}
                    onChange={(e) => setNewPasscode(e.target.value)}
                    placeholder="Enter passcode"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Role
                  </label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as 'admin' | 'viewer')}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={createUser}
                    disabled={!newPasscode.trim()}
                    className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create User
                  </button>
                </div>
              </div>
            </div>

            {/* Built-in Users */}
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-700">
                <h3 className="text-lg font-medium text-white">Built-in Users</h3>
                <p className="text-sm text-gray-400">Default users available on all deployments</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-700">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Passcode
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-white">••••••••••••••</div>
                        <div className="text-xs text-gray-400">Super Admin Password</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-900 text-purple-200">
                          super-admin
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        Environment Variable
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-900 text-green-200">
                          Active
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-white">admin@d@rps</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-900 text-blue-200">
                          admin
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        Hardcoded
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-900 text-green-200">
                          Active
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-white">visitor@1424</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-900 text-green-200">
                          viewer
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        Hardcoded
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-900 text-green-200">
                          Active
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Users List */}
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-700">
                <h3 className="text-lg font-medium text-white">Custom Users</h3>
                <p className="text-sm text-gray-400">Manage admin and viewer users</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-700">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Passcode
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Last Login
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-gray-800 divide-y divide-gray-700">
                    {customUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 text-center text-gray-400">
                          No custom users created yet
                        </td>
                      </tr>
                    ) : (
                      customUsers.map((user) => (
                        <tr key={user.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-white">{user.passcode}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              user.role === 'admin' 
                                ? 'bg-purple-900 text-purple-200' 
                                : 'bg-blue-900 text-blue-200'
                            }`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                            {formatDate(user.createdAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                            {user.lastLogin ? formatDate(user.lastLogin) : 'Never'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                            <button
                              onClick={() => deleteUser(user.id, user.passcode)}
                              className="text-red-400 hover:text-red-300"
                              title="Delete user"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Role Explanation */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-medium text-white mb-4">Role Permissions</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-purple-900/20 rounded-lg border border-purple-700">
                  <h4 className="font-medium text-purple-300 mb-2">Super Admin</h4>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>• All admin permissions</li>
                    <li>• Create/delete users</li>
                    <li>• Manage invincible pages</li>
                    <li>• View activity logs</li>
                    <li>• Access all admin features</li>
                  </ul>
                </div>
                <div className="p-4 bg-blue-900/20 rounded-lg border border-blue-700">
                  <h4 className="font-medium text-blue-300 mb-2">Admin</h4>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>• Create/edit/delete pages</li>
                    <li>• Manage gallery</li>
                    <li>• View visitor logs</li>
                    <li>• View rate limits</li>
                  </ul>
                </div>
                <div className="p-4 bg-green-900/20 rounded-lg border border-green-700">
                  <h4 className="font-medium text-green-300 mb-2">Viewer</h4>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>• View wiki pages</li>
                    <li>• View gallery</li>
                    <li>• Read-only access</li>
                    <li>• No editing permissions</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ratelimits' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">IP-Based Rate Limiting</h2>
              <button
                onClick={clearAllRateLimits}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Clear All Rate Limits
              </button>
            </div>

            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        IP Address
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Failed Attempts
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Last Attempt
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {Object.keys(rateLimitData).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 text-center text-gray-400">
                          No rate limit data recorded
                        </td>
                      </tr>
                    ) : (
                      Object.entries(rateLimitData).map(([ip, data]: [string, any]) => {
                        const now = Date.now()
                        const isLocked = data.lockoutUntil > now
                        const remainingTime = isLocked ? Math.ceil((data.lockoutUntil - now) / 1000) : 0
                        
                        return (
                          <tr key={ip}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-300">
                              {ip}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                              {data.attempts}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {isLocked ? (
                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-900 text-red-200">
                                  Locked ({remainingTime}s)
                                </span>
                              ) : data.attempts >= 3 ? (
                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-900 text-yellow-200">
                                  Warning
                                </span>
                              ) : (
                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-900 text-green-200">
                                  Normal
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                              {new Date(data.lastAttempt).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                              <button
                                onClick={() => clearRateLimit(ip)}
                                className="text-blue-400 hover:text-blue-300"
                                title="Clear rate limit for this IP"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-medium text-white mb-4">Rate Limiting Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
                <div>
                  <h4 className="font-medium text-white mb-2">Current Settings:</h4>
                  <ul className="space-y-1">
                    <li>• Maximum failed attempts: 5</li>
                    <li>• Lockout duration: Exponential (1min, 2min, 3min...)</li>
                    <li>• Auto-reset after: 15 minutes of inactivity</li>
                    <li>• IP detection: External API + browser fingerprint fallback</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-white mb-2">Status Legend:</h4>
                  <ul className="space-y-1">
                    <li>• <span className="text-green-400">Normal</span>: 0-2 failed attempts</li>
                    <li>• <span className="text-yellow-400">Warning</span>: 3-4 failed attempts</li>
                    <li>• <span className="text-red-400">Locked</span>: 5+ failed attempts (temporary ban)</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'invincible' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Invincible Pages Management</h2>
              <div className="text-sm text-gray-400">
                Protected pages: {invinciblePages.length}
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-medium text-white mb-4">What are Invincible Pages?</h3>
              <p className="text-gray-300 mb-4">
                Invincible pages are protected from deletion by regular admins. Only super admins can delete these pages. 
                This feature helps protect important documentation, guidelines, or critical information from accidental deletion.
              </p>
            </div>

            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Page Title
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Last Modified
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Created By
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {allPages.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 text-center text-gray-400">
                          No pages found
                        </td>
                      </tr>
                    ) : (
                      allPages.map((page) => {
                        const isInvincible = invinciblePages.includes(page.id)
                        return (
                          <tr key={page.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                              <div className="flex items-center space-x-2">
                                <FileText className="w-4 h-4 text-gray-400" />
                                <span className="font-medium">{page.title}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                              {formatDate(page.lastModified)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                page.createdBy === 'admin' 
                                  ? 'bg-purple-900 text-purple-200' 
                                  : 'bg-blue-900 text-blue-200'
                              }`}>
                                {page.createdBy}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                isInvincible
                                  ? 'bg-green-900 text-green-200'
                                  : 'bg-gray-700 text-gray-300'
                              }`}>
                                {isInvincible ? 'Invincible' : 'Normal'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                              <button
                                onClick={() => toggleInvinciblePage(page.id)}
                                className={`px-3 py-1 rounded-lg text-xs font-medium ${
                                  isInvincible
                                    ? 'bg-red-600 hover:bg-red-700 text-white'
                                    : 'bg-green-600 hover:bg-green-700 text-white'
                                }`}
                              >
                                {isInvincible ? 'Remove Protection' : 'Make Invincible'}
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Activity Logs</h2>
              <div className="text-sm text-gray-400">
                Total activities: {activityLogs.length}
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        <Clock className="w-4 h-4 inline mr-1" />
                        Timestamp
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Action
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Page
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        <MapPin className="w-4 h-4 inline mr-1" />
                        Location
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {activityLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 text-center text-gray-400">
                          No activity logs recorded yet
                        </td>
                      </tr>
                    ) : (
                      activityLogs
                        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                        .map((log) => (
                          <tr key={log.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                              {formatDate(log.timestamp)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                log.action === 'create' 
                                  ? 'bg-green-900 text-green-200'
                                  : log.action === 'edit'
                                  ? 'bg-blue-900 text-blue-200'
                                  : 'bg-red-900 text-red-200'
                              }`}>
                                {log.action}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                              <div className="flex items-center space-x-2">
                                <FileText className="w-4 h-4 text-gray-400" />
                                <span>{log.pageTitle}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                log.userRole === 'admin' 
                                  ? 'bg-purple-900 text-purple-200' 
                                  : 'bg-blue-900 text-blue-200'
                              }`}>
                                {log.userRole}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                              <div className="flex items-center space-x-2">
                                <span>{getCountryFlag(log.country)}</span>
                                <span>{log.country}</span>
                                <span className="text-gray-500">({log.ip})</span>
                              </div>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-medium text-white mb-4">Activity Log Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
                <div>
                  <h4 className="font-medium text-white mb-2">Tracked Actions:</h4>
                  <ul className="space-y-1">
                    <li>• <span className="text-green-400">Create</span>: New page creation</li>
                    <li>• <span className="text-blue-400">Edit</span>: Page content modification</li>
                    <li>• <span className="text-red-400">Delete</span>: Page removal</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-white mb-2">Collected Data:</h4>
                  <ul className="space-y-1">
                    <li>• Timestamp of action</li>
                    <li>• User role (admin/viewer)</li>
                    <li>• IP address and country</li>
                    <li>• User agent information</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
