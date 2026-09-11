const HEADER = 'encrypted-mcq-v1'
const KEY_PASSPHRASE = 'mcq-quiz-generator-encrypted-output-key-2026'
const ALGO = 'AES-GCM'
const IV_LENGTH = 12
const TAG_LENGTH = 16

export function isEncrypted(payload: string): boolean {
  return payload.startsWith(HEADER + '|')
}

async function deriveKey(): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(KEY_PASSPHRASE))
}

async function getKey(usages: KeyUsage[]): Promise<CryptoKey> {
  const raw = await deriveKey()
  return crypto.subtle.importKey('raw', raw, ALGO, false, usages)
}

function base64ToUint8Array(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

export async function encryptMcq(plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const key = await getKey(['encrypt'])
  const encrypted = await crypto.subtle.encrypt({ name: ALGO, iv }, key, new TextEncoder().encode(plaintext))
  const buf = new Uint8Array(encrypted)
  const data = buf.subarray(0, buf.length - TAG_LENGTH)
  const tag = buf.subarray(buf.length - TAG_LENGTH)
  return `${HEADER}|${uint8ArrayToBase64(iv)}:${uint8ArrayToBase64(tag)}:${uint8ArrayToBase64(data)}`
}

async function decryptMcqPayload(iv: Uint8Array<ArrayBuffer>, tag: Uint8Array<ArrayBuffer>, data: Uint8Array<ArrayBuffer>): Promise<string> {
  const ciphertext = new Uint8Array(data.length + tag.length)
  ciphertext.set(data, 0)
  ciphertext.set(tag, data.length)
  const key = await getKey(['decrypt'])
  const plain = await crypto.subtle.decrypt({ name: ALGO, iv }, key, ciphertext)
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
