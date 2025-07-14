import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

// Server-side only environment variables (no NEXT_PUBLIC_ prefix)
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH
const VIEWER_PASSWORD_HASH = process.env.VIEWER_PASSWORD_HASH
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production'

// Rate limiting storage (in production, use Redis or database)
const rateLimitStore = new Map<string, { attempts: number; lastAttempt: number; lockoutUntil: number }>()

// Simple JWT creation
function createJWT(payload: any, expiresIn: string = '24h'): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payloadStr = Buffer.from(JSON.stringify({
    ...payload,
    exp: Math.floor(Date.now() / 1000) + (expiresIn === '24h' ? 86400 : 3600),
    iat: Math.floor(Date.now() / 1000)
  })).toString('base64url')
  
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payloadStr}`)
    .digest('base64url')
  
  return `${header}.${payloadStr}.${signature}`
}

// Simple JWT verification
function verifyJWT(token: string): any {
  try {
    const [header, payload, signature] = token.split('.')
    
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url')
    
    if (signature !== expectedSignature) {
      return null
    }
    
    const decodedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString())
    
    // Check expiration
    if (decodedPayload.exp < Math.floor(Date.now() / 1000)) {
      return null
    }
    
    return decodedPayload
  } catch (error) {
    return null
  }
}

// Get client IP address
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const remoteAddr = request.headers.get('x-remote-addr')
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  if (realIP) {
    return realIP
  }
  if (remoteAddr) {
    return remoteAddr
  }
  
  // Fallback to localhost for development
  return '127.0.0.1'
}

// Advanced rate limiting
function checkRateLimit(ip: string): { allowed: boolean; remainingTime?: number } {
  const now = Date.now()
  const data = rateLimitStore.get(ip)
  
  if (!data) {
    rateLimitStore.set(ip, { attempts: 1, lastAttempt: now, lockoutUntil: 0 })
    return { allowed: true }
  }
  
  // Check if still locked out
  if (data.lockoutUntil > now) {
    return { allowed: false, remainingTime: Math.ceil((data.lockoutUntil - now) / 1000) }
  }
  
  // Reset if last attempt was more than 15 minutes ago
  if (now - data.lastAttempt > 15 * 60 * 1000) {
    rateLimitStore.set(ip, { attempts: 1, lastAttempt: now, lockoutUntil: 0 })
    return { allowed: true }
  }
  
  // Increment attempts
  const newAttempts = data.attempts + 1
  let lockoutUntil = 0
  
  // Progressive lockout: 1min, 5min, 15min, 1hour, 6hours
  if (newAttempts >= 5) {
    const lockoutMinutes = Math.min(Math.pow(2, newAttempts - 4) * 1, 360) // Max 6 hours
    lockoutUntil = now + (lockoutMinutes * 60 * 1000)
  }
  
  rateLimitStore.set(ip, { attempts: newAttempts, lastAttempt: now, lockoutUntil })
  
  return { 
    allowed: lockoutUntil === 0, 
    remainingTime: lockoutUntil > 0 ? Math.ceil((lockoutUntil - now) / 1000) : undefined 
  }
}

// Strong password hashing with salt
function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(32).toString('hex')
  const hash = crypto.pbkdf2Sync(password, actualSalt, 100000, 64, 'sha512').toString('hex')
  return { hash, salt: actualSalt }
}

// Verify password against hash
function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  const { hash } = hashPassword(password, salt)
  
  // Ensure both strings are the same length for timing-safe comparison
  if (hash.length !== storedHash.length) {
    return false
  }
  
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'))
}

// Parse stored hash format: salt:hash
function parseStoredHash(stored: string): { salt: string; hash: string } | null {
  const parts = stored.split(':')
  if (parts.length !== 2) return null
  return { salt: parts[0], hash: parts[1] }
}

// Read custom users from file
function readCustomUsers() {
  try {
    const filePath = path.join(process.cwd(), '.custom-users.json')
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8')
      return JSON.parse(data)
    }
  } catch (error) {
    console.error('Error reading custom users:', error)
  }
  return []
}

export async function POST(request: NextRequest) {
  try {
    // Debug: Log environment variables (but not their values for security)
    console.log('Debug: Environment variables status:')
    console.log('ADMIN_PASSWORD_HASH exists:', !!ADMIN_PASSWORD_HASH)
    console.log('VIEWER_PASSWORD_HASH exists:', !!VIEWER_PASSWORD_HASH)
    console.log('ADMIN_PASSWORD_HASH length:', ADMIN_PASSWORD_HASH?.length || 0)
    console.log('VIEWER_PASSWORD_HASH length:', VIEWER_PASSWORD_HASH?.length || 0)
    
    const clientIP = getClientIP(request)
    
    // Check rate limiting
    const rateLimit = checkRateLimit(clientIP)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Too many failed attempts. Please try again later.',
          lockoutTime: rateLimit.remainingTime 
        },
        { status: 429 }
      )
    }
    
    const { password, fingerprint } = await request.json()
    
    if (!password) {
      return NextResponse.json(
        { success: false, error: 'Password is required' },
        { status: 400 }
      )
    }
    
    // Check if environment variables are properly configured
    if (!ADMIN_PASSWORD_HASH || !VIEWER_PASSWORD_HASH) {
      console.error('Authentication environment variables not configured properly')
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 }
      )
    }
    
    let userRole: string | null = null
    
    // PRIORITY 1: Check super admin password first (admin@dorps2025 is super admin)
    const adminHashData = parseStoredHash(ADMIN_PASSWORD_HASH)
    if (adminHashData && verifyPassword(password, adminHashData.hash, adminHashData.salt)) {
      userRole = 'super-admin' // The primary admin password gives super admin privileges
    }
    
    // PRIORITY 2: Check viewer password from environment
    if (!userRole) {
      const viewerHashData = parseStoredHash(VIEWER_PASSWORD_HASH)
      if (viewerHashData && verifyPassword(password, viewerHashData.hash, viewerHashData.salt)) {
        userRole = 'viewer'
      }
    }
    
    // PRIORITY 3: Check custom users created via /api/users (passcode authentication)
    if (!userRole) {
      const customUsers = readCustomUsers()
      for (const user of customUsers) {
        if (user.active) {
          // Use secure password verification like the main admin/viewer passwords
          const userHashData = parseStoredHash(user.passwordHash)
          if (userHashData && verifyPassword(password, userHashData.hash, userHashData.salt)) {
            userRole = user.role
            
            // Update last used timestamp and usage count
            user.lastUsed = new Date().toISOString()
            user.usageCount = (user.usageCount || 0) + 1
            
            // Save updated user data
            try {
              const filePath = path.join(process.cwd(), '.custom-users.json')
              fs.writeFileSync(filePath, JSON.stringify(customUsers, null, 2))
            } catch (error) {
              console.error('Failed to update user login stats:', error)
            }
            
            break
          }
        }
      }
    }
    
    // PRIORITY 4: Check legacy custom admin/viewer codes (deprecated)
    if (!userRole) {
      const savedCodes = JSON.parse(process.env.CUSTOM_ACCESS_CODES || '[]')
      for (const code of savedCodes) {
        if (code.password === password && code.active) {
          userRole = code.role // Can be 'admin' or 'viewer'
          break
        }
      }
    }
    
    if (!userRole) {
      // Invalid password - this counts as a failed attempt
      return NextResponse.json(
        { success: false, error: 'Invalid password' },
        { status: 401 }
      )
    }
    
    // Clear rate limit data on successful authentication
    rateLimitStore.delete(clientIP)
    
    // Create secure JWT token
    const token = createJWT({
      role: userRole,
      ip: clientIP,
      fingerprint: fingerprint || 'unknown',
      loginTime: new Date().toISOString()
    })
    
    // Set secure HTTP-only cookie
    const response = NextResponse.json({
      success: true,
      role: userRole,
      message: `Successfully authenticated as ${userRole.replace('-', ' ')}`
    })
    
    // Set secure cookie with JWT
    response.cookies.set('dorps-auth', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 86400, // 24 hours
      path: '/'
    })
    
    return response
    
  } catch (error) {
    console.error('Authentication error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('dorps-auth')?.value
    
    if (!token) {
      return NextResponse.json({ authenticated: false })
    }
    
    const payload = verifyJWT(token)
    if (!payload) {
      return NextResponse.json({ authenticated: false })
    }
    
    return NextResponse.json({
      authenticated: true,
      role: payload.role,
      loginTime: payload.loginTime
    })
    
  } catch (error) {
    console.error('Token verification error:', error)
    return NextResponse.json({ authenticated: false })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const response = NextResponse.json({ success: true, message: 'Logged out successfully' })
    
    // Clear the authentication cookie
    response.cookies.set('dorps-auth', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/'
    })
    
    return response
    
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
