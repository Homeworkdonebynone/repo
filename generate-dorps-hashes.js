const crypto = require('crypto')

function hashPassword(password) {
  const salt = crypto.randomBytes(32).toString('hex')
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex')
  return `${salt}:${hash}`
}

// Generate hashes for the standard dorps wiki passwords
const adminPassword = 'admin@dorps2025'
const viewerPassword = 'viewer@1424'

const adminHash = hashPassword(adminPassword)
const viewerHash = hashPassword(viewerPassword)
const jwtSecret = crypto.randomBytes(64).toString('hex')

console.log('Generated secure hashes for dorps wiki:')
console.log('')
console.log('# Secure Authentication Configuration (SERVER-SIDE ONLY)')
console.log(`ADMIN_PASSWORD_HASH=${adminHash}`)
console.log(`VIEWER_PASSWORD_HASH=${viewerHash}`)
console.log(`JWT_SECRET=${jwtSecret}`)
console.log('')
console.log('Admin password: admin@dorps2025')
console.log('Viewer password: viewer@1424')
