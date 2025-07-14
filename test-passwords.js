const crypto = require('crypto')

// Hashes from .env.local
const ADMIN_PASSWORD_HASH = 'f738fbe86b5529f9c2d285e9084fe418499cc3df61360c88a2ab1b224b1c7da8:409705410e49aa37d677509769f8c7b5e1a84b446940aae31d97c533b95d0b27e768dd3d115f30bef8ff79471a321da2ab250287555fefad460ac02ade37e0e40'
const VIEWER_PASSWORD_HASH = '63bac17193ee4cd9d674c21ef7d4ec75bc70072096c945fc1ae6cb70b77ba111:45dc1c06129eb1c8b9c32889941b1d0c5a3d7b782a1c94a8000da487711eab0c32d7ab1bb07e41fc80ce332e7e2ce73a518f751b7fe8c0c0c3427ec58cc21cb71'

// Parse stored hash format: salt:hash
function parseStoredHash(stored) {
  const parts = stored.split(':')
  if (parts.length !== 2) return null
  return { salt: parts[0], hash: parts[1] }
}

// Strong password hashing with salt
function hashPassword(password, salt) {
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex')
  return hash
}

// Verify password against hash
function verifyPassword(password, storedHash, salt) {
  const hash = hashPassword(password, salt)
  return hash === storedHash
}

// Test common passwords
const testPasswords = [
  'admin@dorps2025',
  'd@rps1424',
  'admin',
  'viewer',
  'dorps',
  '123456',
  'password'
]

console.log('Testing passwords against stored hashes...\n')

const adminHashData = parseStoredHash(ADMIN_PASSWORD_HASH)
const viewerHashData = parseStoredHash(VIEWER_PASSWORD_HASH)

console.log('Admin hash data:', adminHashData)
console.log('Viewer hash data:', viewerHashData)
console.log()

for (const testPassword of testPasswords) {
  console.log(`Testing password: "${testPassword}"`)
  
  if (adminHashData) {
    const adminMatch = verifyPassword(testPassword, adminHashData.hash, adminHashData.salt)
    console.log(`  Admin match: ${adminMatch}`)
  }
  
  if (viewerHashData) {
    const viewerMatch = verifyPassword(testPassword, viewerHashData.hash, viewerHashData.salt)
    console.log(`  Viewer match: ${viewerMatch}`)
  }
  
  console.log()
}
