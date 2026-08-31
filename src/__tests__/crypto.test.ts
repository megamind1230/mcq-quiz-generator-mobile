import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'
import { decryptMcq, isEncrypted } from '../lib/crypto'

// Fixture encrypted by the desktop app (Node crypto, AES-256-GCM, same key).
const emcq = readFileSync(new URL('./fixtures/sample.emcq', import.meta.url), 'utf-8')
const plain = readFileSync(new URL('./fixtures/sample.mcq', import.meta.url), 'utf-8')

describe('crypto (mobile WebCrypto interop)', () => {
  it('detects the encrypted header', () => {
    expect(isEncrypted(emcq)).toBe(true)
    expect(isEncrypted(plain)).toBe(false)
  })

  it('decrypts a desktop-encrypted .emcq back to the original text', async () => {
    const decrypted = await decryptMcq(emcq)
    expect(decrypted).toBe(plain)
  })

  it('returns plaintext unchanged when input is not encrypted', async () => {
    expect(await decryptMcq(plain)).toBe(plain)
  })

  it('returns null for malformed encrypted payloads', async () => {
    expect(await decryptMcq('encrypted-mcq-v1|bad')).toBeNull()
    expect(await decryptMcq('encrypted-mcq-v1|!@#:$$:%%')).toBeNull()
  })
})
