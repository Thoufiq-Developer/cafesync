// ==============================================================================
// CafeSync - Framework-Independent Checksum Utility
// Pure TypeScript - Works in modern browsers and Node environments
// ==============================================================================

export async function calculateSha256(data: Uint8Array | string): Promise<string> {
  const buffer = typeof data === 'string'
    ? new TextEncoder().encode(data)
    : data;

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer.buffer as ArrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Node fallback if crypto.subtle is not accessible
  try {
    // Dynamic require so browser bundlers don't panic
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeCrypto = require('crypto');
    return nodeCrypto.createHash('sha256').update(buffer).digest('hex');
  } catch {
    // Basic fallback hash for edge environments without web crypto
    let hash = 0;
    for (let i = 0; i < buffer.length; i++) {
      hash = (hash << 5) - hash + buffer[i];
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
  }
}

