/**
 * Password Hash Generator Utility
 * 
 * This utility helps generate password hashes for the Dorps Wiki authentication system.
 * Run this script in a Node.js environment or browser console to generate hashes.
 */

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(16);
}

// Example usage:
console.log('Hash Generator for Dorps Wiki');
console.log('================================');
console.log('');
console.log('Current default passwords:');
console.log('Admin password "admin@dorps2025" hash:', hashCode('admin@dorps2025'));
console.log('Viewer password "d@rps1424" hash:', hashCode('d@rps1424'));
console.log('');
console.log('To generate new hashes:');
console.log('1. Change the passwords below');
console.log('2. Run this script');
console.log('3. Copy the hash values to your .env.local file');
console.log('');

// Change these to your desired passwords
const newAdminPassword = 'admin@dorps2025'; // Change this
const newViewerPassword = 'd@rps1424';      // Change this

console.log('New password hashes:');
console.log('NEXT_PUBLIC_ADMIN_PASSWORD_HASH=' + hashCode(newAdminPassword));
console.log('NEXT_PUBLIC_VIEWER_PASSWORD_HASH=' + hashCode(newViewerPassword));

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { hashCode };
}
