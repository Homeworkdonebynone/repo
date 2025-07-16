import { isSupabaseConfigured, activityLogs, invinciblePages } from './supabase'

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

// Get IP address from various sources
async function getClientIP(): Promise<string> {
  try {
    // Try to get IP from external service with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000) // 3 second timeout
    
    const response = await fetch('https://api.ipify.org?format=json', {
      signal: controller.signal,
      mode: 'cors'
    })
    
    clearTimeout(timeoutId)
    
    if (response.ok) {
      const data = await response.json()
      return data.ip || '127.0.0.1'
    }
  } catch (error) {
    console.log('Could not get external IP (likely blocked by security software), using local fallback')
  }
  
  // Fallback to local IP detection
  return '127.0.0.1'
}

// Get country from IP address
async function getCountryFromIP(ip: string): Promise<string> {
  try {
    if (ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
      return 'Local Network'
    }
    
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

// Generate a simple device/browser fingerprint as backup for IP
function generateFingerprint(): string {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.textBaseline = 'top'
    ctx.font = '14px Arial'
    ctx.fillText('Device fingerprint', 2, 2)
    return canvas.toDataURL().slice(-10)
  }
  return Math.random().toString(36).substr(2, 9)
}

// Main logging function
export async function logActivity(
  action: 'create' | 'edit' | 'delete',
  pageId: string,
  pageTitle: string,
  userRole: 'viewer' | 'admin' | 'super-admin'
): Promise<void> {
  try {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, skipping activity logging')
      return
    }

    // Try to get IP and country, but don't let failures block the logging
    let ip = '127.0.0.1'
    let country = 'Unknown'
    
    try {
      ip = await getClientIP()
      country = await getCountryFromIP(ip)
    } catch (error) {
      console.warn('Failed to get IP/country info, using defaults:', error instanceof Error ? error.message : 'Unknown error')
      // Use defaults already set above
    }
    
    const activityLog = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      action,
      page_id: pageId,
      page_title: pageTitle,
      user_role: userRole,
      ip: ip,
      country: country,
      user_agent: navigator.userAgent
    }

    await activityLogs.create(activityLog)
    console.log(`Activity logged: ${action} on "${pageTitle}" by ${userRole} from ${country} (${ip})`)
  } catch (error) {
    console.error('Error logging activity:', error)
    // Don't throw the error - logging failures shouldn't break the main functionality
  }
}

// Function to check if a page is invincible (protected from deletion)
export async function isPageInvincible(pageId: string): Promise<boolean> {
  try {
    if (!isSupabaseConfigured()) {
      return false
    }
    
    const invinciblePagesData = await invinciblePages.getAll()
    return invinciblePagesData.some(page => page.page_id === pageId)
  } catch (error) {
    console.error('Failed to check page invincibility:', error)
    return false
  }
}

// Function to get all activity logs (for admin panel)
export async function getAllActivityLogs(): Promise<ActivityLog[]> {
  try {
    const { activityLogsStorage } = await import('./supabaseStorage')
    return await activityLogsStorage.getAll()
  } catch (error) {
    console.error('Failed to get activity logs:', error)
    return []
  }
}
