import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

// TypeScript interfaces
interface CustomUser {
  id: string
  passcode: string // The actual passcode that users will enter
  passwordHash: string // PBKDF2 hash of the passcode
  role: 'admin' | 'viewer'
  active: boolean
  createdAt: string
  lastUsed: string | null
  usageCount: number
}

// Strong password hashing with salt
function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(32).toString('hex')
  const hash = crypto.pbkdf2Sync(password, actualSalt, 100000, 64, 'sha512').toString('hex')
  return { hash, salt: actualSalt }
}

// Verify JWT token from cookie
function verifyJWT(token: string): any {
  try {
    const JWT_SECRET = process.env.JWT_SECRET || 'e773c4a45b0e6a6365b23de4e0f08dd350f8efb27a55870da20831952fa9ec9e2ac31072a21a86d85906a3811bd8d8d90a71a0c8e52583aec40b7c1f0aadb77c'
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

// Read custom users from file
function readCustomUsers(): CustomUser[] {
  try {
    // Check if we're in a serverless environment (like Vercel)
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
      console.warn('User management is not available in serverless environments')
      return []
    }
    
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

// Write custom users to file
function writeCustomUsers(users: CustomUser[]): boolean {
  try {
    // Check if we're in a serverless environment (like Vercel)
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
      console.warn('User management is not available in serverless environments')
      return false
    }
    
    const filePath = path.join(process.cwd(), '.custom-users.json')
    fs.writeFileSync(filePath, JSON.stringify(users, null, 2))
    return true
  } catch (error) {
    console.error('Error writing custom users:', error)
    return false
  }
}

// GET - List all custom users (super admin only)
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('dorps-auth')?.value
    
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    const payload = verifyJWT(token)
    if (!payload || payload.role !== 'super-admin') {
      return NextResponse.json({ error: 'Super admin access required' }, { status: 403 })
    }
    
    const users = readCustomUsers()
    
    // Don't return password hashes in the response
    const safeUsers = users.map((user: CustomUser) => ({
      id: user.id,
      passcode: user.passcode,
      role: user.role,
      active: user.active,
      createdAt: user.createdAt,
      lastUsed: user.lastUsed,
      usageCount: user.usageCount
    }))
    
    return NextResponse.json({ users: safeUsers })
    
  } catch (error) {
    console.error('Error getting users:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create new user (super admin only)
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('dorps-auth')?.value
    
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    const payload = verifyJWT(token)
    if (!payload || payload.role !== 'super-admin') {
      return NextResponse.json({ error: 'Super admin access required' }, { status: 403 })
    }
    
    const { passcode, role } = await request.json()
    
    if (!passcode || !role) {
      return NextResponse.json({ error: 'Passcode and role are required' }, { status: 400 })
    }
    
    if (!['admin', 'viewer'].includes(role)) {
      return NextResponse.json({ error: 'Role must be admin or viewer' }, { status: 400 })
    }
    
    const users = readCustomUsers()
    
    // Check if passcode already exists
    if (users.find((user: CustomUser) => user.passcode === passcode)) {
      return NextResponse.json({ error: 'Passcode already exists' }, { status: 400 })
    }
    
    // Hash the passcode
    const { hash, salt } = hashPassword(passcode)
    
    const newUser: CustomUser = {
      id: crypto.randomUUID(),
      passcode,
      passwordHash: `${salt}:${hash}`,
      role,
      active: true,
      createdAt: new Date().toISOString(),
      lastUsed: null,
      usageCount: 0
    }
    
    users.push(newUser)
    
    if (writeCustomUsers(users)) {
      return NextResponse.json({ 
        success: true, 
        message: 'User created successfully',
        user: {
          id: newUser.id,
          passcode: newUser.passcode,
          role: newUser.role,
          active: newUser.active,
          createdAt: newUser.createdAt
        }
      })
    } else {
      return NextResponse.json({ error: 'Failed to save user' }, { status: 500 })
    }
    
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete user (super admin only)
export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get('dorps-auth')?.value
    
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    const payload = verifyJWT(token)
    if (!payload || payload.role !== 'super-admin') {
      return NextResponse.json({ error: 'Super admin access required' }, { status: 403 })
    }
    
    const { userId } = await request.json()
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }
    
    const users = readCustomUsers()
    const userIndex = users.findIndex((user: CustomUser) => user.id === userId)
    
    if (userIndex === -1) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    
    users.splice(userIndex, 1)
    
    if (writeCustomUsers(users)) {
      return NextResponse.json({ success: true, message: 'User deleted successfully' })
    } else {
      return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
    }
    
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
