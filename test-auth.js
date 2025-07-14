// Test authentication API
async function testAuth() {
  try {
    console.log('Testing authentication with admin password...')
    
    const response = await fetch('http://localhost:3000/api/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        password: 'admin@dorps2025',
        fingerprint: 'test-fingerprint'
      })
    })
    
    const data = await response.json()
    console.log('Response status:', response.status)
    console.log('Response data:', data)
    
    if (response.ok) {
      console.log('✅ Admin authentication successful!')
    } else {
      console.log('❌ Admin authentication failed')
    }
    
    // Test viewer password
    console.log('\nTesting authentication with viewer password...')
    
    const response2 = await fetch('http://localhost:3000/api/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        password: 'viewer@1424',
        fingerprint: 'test-fingerprint'
      })
    })
    
    const data2 = await response2.json()
    console.log('Response status:', response2.status)
    console.log('Response data:', data2)
    
    if (response2.ok) {
      console.log('✅ Viewer authentication successful!')
    } else {
      console.log('❌ Viewer authentication failed')
    }
    
  } catch (error) {
    console.error('Test failed:', error)
  }
}

testAuth()
