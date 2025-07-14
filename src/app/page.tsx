'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { League_Spartan } from 'next/font/google'

const leagueSpartan = League_Spartan({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-league-spartan',
})

export default function ComingSoonPage() {
  const [clickCount, setClickCount] = useState(0)
  const [showAccessCode, setShowAccessCode] = useState(false)
  const [accessCode, setAccessCode] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [rateLimitError, setRateLimitError] = useState('')
  const [lockoutRemaining, setLockoutRemaining] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  // Check if user is already authenticated
  useEffect(() => {
    checkAuthStatus()
  }, [])

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/auth')
      const data = await response.json()
      
      if (data.authenticated) {
        if (data.role === 'super-admin') {
          router.push('/admin')
        } else {
          router.push('/wiki')
        }
        return
      }
    } catch (error) {
      console.error('Auth check failed:', error)
    } finally {
      setIsLoading(false)
    }
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
    const newAttempts = attempts + 1
    const now = Date.now()
    
    if (newAttempts >= 5) {
      const lockoutTime = now + (newAttempts - 4) * 60 * 1000
      await updateRateLimitData(newAttempts, lockoutTime)
      return Math.ceil((lockoutTime - now) / 1000)
    } else {
      await updateRateLimitData(newAttempts)
      return 0
    }
  }

  const recordSuccessfulAttempt = async () => {
    await updateRateLimitData(0) // Reset on successful login
  }

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

  // Debug: Check if we're coming back from wiki
  useEffect(() => {
    const checkInitialState = async () => {
      const currentAccess = localStorage.getItem('dorps-access')
      if (currentAccess) {
        console.log('Homepage: Found existing access code on load:', currentAccess)
        // If we have a valid access code but we're on homepage, something went wrong
        console.log('Homepage: We have access but are on homepage - this suggests a redirect loop')
      }

      // Check for rate limit error from URL
      const urlParams = new URLSearchParams(window.location.search)
      const error = urlParams.get('error')
      const time = urlParams.get('time')
      const ipParam = urlParams.get('ip')
      
      if (error === 'rate-limited' && time) {
        setLockoutRemaining(parseInt(time))
        setRateLimitError(`Too many failed attempts${ipParam ? ` from IP ${decodeURIComponent(ipParam)}` : ''}. Please wait ${time} seconds before trying again.`)
        setShowAccessCode(true)
        
        // Start countdown
        const countdown = setInterval(() => {
          setLockoutRemaining(prev => {
            if (prev <= 1) {
              setRateLimitError('')
              clearInterval(countdown)
              return 0
            }
            setRateLimitError(`Too many failed attempts${ipParam ? ` from IP ${decodeURIComponent(ipParam)}` : ''}. Please wait ${prev - 1} seconds before trying again.`)
            return prev - 1
          })
        }, 1000)
        
        return () => clearInterval(countdown)
      }

      // Check current rate limit status
      const rateLimit = await isRateLimited()
      if (rateLimit.limited) {
        setLockoutRemaining(rateLimit.remainingTime)
        setRateLimitError(`Too many failed attempts from IP ${rateLimit.userIP}. Please wait ${rateLimit.remainingTime} seconds before trying again.`)
        setShowAccessCode(true)
        
        // Start countdown
        const countdown = setInterval(async () => {
          const currentLimit = await isRateLimited()
          if (!currentLimit.limited) {
            setRateLimitError('')
            setLockoutRemaining(0)
            clearInterval(countdown)
          } else {
            setLockoutRemaining(currentLimit.remainingTime)
            setRateLimitError(`Too many failed attempts from IP ${currentLimit.userIP}. Please wait ${currentLimit.remainingTime} seconds before trying again.`)
          }
        }, 1000)
        
        return () => clearInterval(countdown)
      }

      // Log visitor
      logVisit('/', 'Homepage')
    }

    checkInitialState()
  }, [])

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

  const updateAccessCodeUsage = (accessCode: string) => {
    try {
      const savedCodes = localStorage.getItem('dorps-access-codes')
      if (savedCodes) {
        const codes = JSON.parse(savedCodes)
        const updatedCodes = codes.map((code: any) => {
          if (code.code === accessCode) {
            return {
              ...code,
              usageCount: (code.usageCount || 0) + 1,
              lastUsed: new Date().toISOString()
            }
          }
          return code
        })
        localStorage.setItem('dorps-access-codes', JSON.stringify(updatedCodes))
      }
    } catch (error) {
      console.error('Failed to update access code usage:', error)
    }
  }

  const handleClick = () => {
    setClickCount(prev => prev + 1)
    
    if (clickCount + 1 >= 5) {
      setShowAccessCode(true)
    }
  }

  const handleAccessCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (isSubmitting) return
    
    setIsSubmitting(true)
    setLoginError('')
    setRateLimitError('')
    
    try {
      // Get browser fingerprint for additional security
      const fingerprint = await getUserIdentifier()
      
      // Call the secure authentication API
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: accessCode,
          fingerprint: fingerprint
        })
      })
      
      const data = await response.json()
      
      if (response.ok && data.success) {
        // Authentication successful
        updateAccessCodeUsage(accessCode)
        
        // Redirect based on role
        if (data.role === 'super-admin') {
          window.location.href = '/admin'
        } else {
          window.location.href = '/wiki'
        }
      } else {
        // Authentication failed
        if (response.status === 429) {
          // Rate limited
          setRateLimitError(data.error)
          if (data.lockoutTime) {
            setLockoutRemaining(data.lockoutTime)
            
            // Start countdown
            const countdown = setInterval(() => {
              setLockoutRemaining(prev => {
                if (prev <= 1) {
                  setRateLimitError('')
                  clearInterval(countdown)
                  return 0
                }
                return prev - 1
              })
            }, 1000)
          }
        } else {
          // Invalid credentials
          setLoginError(data.error || 'Invalid access code')
        }
        
        setAccessCode('')
      }
    } catch (error) {
      console.error('Authentication error:', error)
      setLoginError('Connection error. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={`min-h-screen bg-black flex items-center justify-center p-4 ${leagueSpartan.className}`}>
      <div className="max-w-md w-full text-center">
        {isLoading ? (
          <div className="space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
            <p className="text-white">Checking authentication...</p>
          </div>
        ) : !showAccessCode ? (
          <div className="space-y-4">
            <h1 
              className="text-6xl font-bold text-white select-none"
              onClick={handleClick}
            >
              Coming Soon
            </h1>
            <p className="text-xl text-white font-medium">
              This page will launch soon
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <form onSubmit={handleAccessCodeSubmit} className="space-y-4">
              <input
                type="password"
                placeholder="Access Code"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white disabled:opacity-50"
                disabled={isSubmitting || lockoutRemaining > 0}
                autoFocus
              />
              {rateLimitError && (
                <div className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                    <span>{rateLimitError}</span>
                  </div>
                </div>
              )}
              {loginError && !rateLimitError && (
                <div className="text-yellow-400 text-sm bg-yellow-900/20 border border-yellow-800 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                    <span>{loginError}</span>
                  </div>
                </div>
              )}
              <button
                type="submit"
                disabled={isSubmitting || !accessCode.trim() || lockoutRemaining > 0}
                className="w-full px-6 py-3 bg-white hover:bg-gray-200 text-black rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Verifying...' : lockoutRemaining > 0 ? `Locked (${lockoutRemaining}s)` : 'Enter'}
              </button>
              
              {!rateLimitError && !loginError && (
                <p className="text-gray-400 text-xs text-center">
                  After 5 failed attempts, access will be temporarily locked
                </p>
              )}
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
