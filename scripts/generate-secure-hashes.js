const crypto = require('crypto')
const readline = require('readline')

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function hashPassword(password) {
  const salt = crypto.randomBytes(32).toString('hex')
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex')
  return `${salt}:${hash}`
}

console.log('🔐 Secure Password Hash Generator for Dorps Wiki')
console.log('='.repeat(50))
console.log('This will generate secure salted hashes for your passwords.')
console.log('The format will be: salt:hash')
console.log('')

rl.question('Enter admin password: ', (adminPassword) => {
  rl.question('Enter viewer password: ', (viewerPassword) => {
    
    const adminHash = hashPassword(adminPassword)
    const viewerHash = hashPassword(viewerPassword)
    
    console.log('')
    console.log('✅ Secure hashes generated!')
    console.log('='.repeat(50))
    console.log('')
    console.log('Add these to your .env.local file:')
    console.log('')
    console.log('# Secure Authentication Configuration (SERVER-SIDE ONLY)')
    console.log(`ADMIN_PASSWORD_HASH=${adminHash}`)
    console.log(`VIEWER_PASSWORD_HASH=${viewerHash}`)
    console.log(`JWT_SECRET=${crypto.randomBytes(64).toString('hex')}`)
    console.log('')
    console.log('⚠️  IMPORTANT SECURITY NOTES:')
    console.log('- These variables do NOT have NEXT_PUBLIC_ prefix (server-side only)')
    console.log('- The JWT_SECRET should be unique and kept secret')
    console.log('- Never commit these values to version control')
    console.log('- Consider using a secure key management service in production')
    console.log('')
    console.log('🔒 These hashes use PBKDF2 with 100,000 iterations and are salted')
    console.log('   This makes them extremely difficult to crack even if compromised')
    
    rl.close()
  })
})

rl.on('close', () => {
  console.log('\n👋 Remember to restart your development server after updating .env.local')
  process.exit(0)
})
