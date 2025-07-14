// Client-side authentication fallback for static export
// This is a simplified version without server-side security

interface StaticAuth {
  role: 'admin' | 'viewer' | null
  authenticated: boolean
}

// Simple client-side password check (NOT SECURE - for demo only)
const STATIC_PASSWORDS = {
  'admin@dorps2025': 'admin',
  'viewer@1424': 'viewer'
}

export class StaticAuthManager {
  private static instance: StaticAuthManager
  private auth: StaticAuth = { role: null, authenticated: false }

  static getInstance(): StaticAuthManager {
    if (!StaticAuthManager.instance) {
      StaticAuthManager.instance = new StaticAuthManager()
    }
    return StaticAuthManager.instance
  }

  authenticate(password: string): StaticAuth {
    const role = STATIC_PASSWORDS[password as keyof typeof STATIC_PASSWORDS]
    
    if (role) {
      this.auth = { role: role as 'admin' | 'viewer', authenticated: true }
      localStorage.setItem('dorps-static-auth', JSON.stringify(this.auth))
      return this.auth
    }
    
    return { role: null, authenticated: false }
  }

  getAuth(): StaticAuth {
    if (this.auth.authenticated) return this.auth
    
    try {
      const stored = localStorage.getItem('dorps-static-auth')
      if (stored) {
        this.auth = JSON.parse(stored)
      }
    } catch (error) {
      console.error('Failed to load auth:', error)
    }
    
    return this.auth
  }

  logout(): void {
    this.auth = { role: null, authenticated: false }
    localStorage.removeItem('dorps-static-auth')
  }

  isStaticMode(): boolean {
    return typeof window !== 'undefined' && !window.location.host.includes('localhost')
  }
}
