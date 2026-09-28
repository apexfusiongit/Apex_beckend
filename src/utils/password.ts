// Secure password hashing using PBKDF2 (compatible with Cloudflare Workers Web Crypto API)

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  
  // Generate a random salt
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  // Import password as key
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    data,
    'PBKDF2',
    false,
    ['deriveBits']
  );
  
  // Derive key using PBKDF2
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  
  // Combine salt and hash
  const saltArray = Array.from(salt);
  const hashArray = Array.from(new Uint8Array(derivedBits));
  const combined = [...saltArray, ...hashArray];
  
  // Convert to hex string
  return combined.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    
    // Parse the stored hash to extract salt and hash
    const combined = new Uint8Array(hash.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    
    // Extract salt (first 16 bytes)
    const salt = combined.slice(0, 16);
    const storedHash = combined.slice(16);
    
    // Import password as key
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      data,
      'PBKDF2',
      false,
      ['deriveBits']
    );
    
    // Derive key using the same parameters
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      256
    );
    
    const derivedArray = new Uint8Array(derivedBits);
    
    // Compare hashes
    if (derivedArray.length !== storedHash.length) {
      return false;
    }
    
    for (let i = 0; i < derivedArray.length; i++) {
      if (derivedArray[i] !== storedHash[i]) {
        return false;
      }
    }
    
    return true;
  } catch (error) {
    return false;
  }
}
