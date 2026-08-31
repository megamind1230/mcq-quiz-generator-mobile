const HEADER = 'encrypted-mcq-v1'
const KEY_PASSPHRASE = 'mcq-quiz-generator-encrypted-output-key-2026'

export function isEncrypted(payload: string): boolean {
  return payload.startsWith(HEADER + '|')
}

// Derive AES key (matches desktop: SHA-256 of passphrase, AES-256-GCM)
async function getKey(): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(KEY_PASSPHRASE))
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['decrypt'])
}

function base64ToUint8Array(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

async function decryptMcqPayload(iv: Uint8Array<ArrayBuffer>, tag: Uint8Array<ArrayBuffer>, data: Uint8Array<ArrayBuffer>): Promise<string> {
  const ciphertext = new Uint8Array(data.length + tag.length)
  ciphertext.set(data, 0)
  ciphertext.set(tag, data.length)
  const key = await getKey()
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  return new TextDecoder().decode(plain)
}

export async function decryptMcq(payload: string): Promise<string | null> {
  if (!isEncrypted(payload)) return payload
  const body = payload.slice(HEADER.length + 1)
  const [ivB64, tagB64, dataB64] = body.split(':')
  if (!ivB64 || !tagB64 || !dataB64) return null
  try {
    const iv = base64ToUint8Array(ivB64)
    const tag = base64ToUint8Array(tagB64)
    const data = base64ToUint8Array(dataB64)
    return await decryptMcqPayload(iv, tag, data)
  } catch {
    return null
  }
}
