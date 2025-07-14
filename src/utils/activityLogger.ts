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
    // Try to get IP from external service
    const response = await fetch('https://api.ipify.org?format=json')
    if (response.ok) {
      const data = await response.json()
      return data.ip || '127.0.0.1'
    }
  } catch (error) {
    console.log('Could not get external IP, using local fallback')
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
    
    const response = await fetch(`https://ipapi.co/${ip}/json/`)
    if (response.ok) {
      const data = await response.json()
      return data.country_name || 'Unknown'
    }
  } catch (error) {
    console.error('Failed to get country for IP:', error)
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
    const { activityLogsStorage } = await import('./allDataStorage')
    const ip = await getClientIP()
    const country = await getCountryFromIP(ip)
    
    const activityLog: ActivityLog = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      action,
      pageId,
      pageTitle,
      userRole,
      ip,
      country,
      userAgent: navigator.userAgent
    }

    // Save using hybrid storage
    await activityLogsStorage.save(activityLog)
    
    console.log(`Activity logged: ${action} on "${pageTitle}" by ${userRole} from ${country} (${ip})`)
  } catch (error) {
    console.error('Failed to log activity:', error)
  }
}

// Function to check if a page is invincible (protected from deletion)
export async function isPageInvincible(pageId: string): Promise<boolean> {
  try {
    const { invinciblePagesStorage } = await import('./allDataStorage')
    return await invinciblePagesStorage.isInvincible(pageId)
  } catch (error) {
    console.error('Failed to check page invincibility:', error)
    return false
  }
}

// Function to get all activity logs (for admin panel)
export async function getAllActivityLogs(): Promise<ActivityLog[]> {
  try {
    const { activityLogsStorage } = await import('./allDataStorage')
    return await activityLogsStorage.getAll()
  } catch (error) {
    console.error('Failed to get activity logs:', error)
    return []
  }
}
