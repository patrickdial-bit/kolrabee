import crypto from 'crypto'

// AES-256-GCM encryption for secrets at rest (OAuth refresh tokens). The key
// comes from INTEGRATION_ENCRYPTION_KEY — a 32-byte key, hex (64 chars) or
// base64 encoded. Generate one with:  openssl rand -hex 32
//
// Stored format: v1:<iv_b64>:<tag_b64>:<ciphertext_b64>. The version prefix
// lets us rotate algorithms later without ambiguity.

const PREFIX = 'v1'

function getKey(): Buffer {
  const raw = process.env.INTEGRATION_ENCRYPTION_KEY
  if (!raw) {
    throw new Error('INTEGRATION_ENCRYPTION_KEY is not set')
  }
  // Accept hex (64 chars) or base64.
  let key: Buffer
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, 'hex')
  } else {
    key = Buffer.from(raw, 'base64')
  }
  if (key.length !== 32) {
    throw new Error('INTEGRATION_ENCRYPTION_KEY must decode to 32 bytes (use: openssl rand -hex 32)')
  }
  return key
}

// True when an encryption key is configured. Callers can surface a clear
// "backup isn't configured" state instead of throwing.
export function hasEncryptionKey(): boolean {
  try {
    getKey()
    return true
  } catch {
    return false
  }
}

export function encryptSecret(plaintext: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [PREFIX, iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join(':')
}

export function decryptSecret(payload: string): string {
  const key = getKey()
  const parts = payload.split(':')
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    throw new Error('Malformed encrypted payload')
  }
  const iv = Buffer.from(parts[1], 'base64')
  const tag = Buffer.from(parts[2], 'base64')
  const ciphertext = Buffer.from(parts[3], 'base64')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
