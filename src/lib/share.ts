import type { Playbook } from '../types'
import { createSnapbookFile, parseSnapbook } from './files'

/**
 * Share links keep the whole playbook in the URL fragment. The fragment is
 * never sent to a server and does not depend on any hosted storage.
 */
export const SHARE_HASH_PREFIX = '#snapbook='

const DAMAGED_LINK =
  'This share link is damaged or incomplete. Ask the sender for a fresh link.'

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+={0,2}$/.test(value)) throw new Error(DAMAGED_LINK)
  const base64 = value.replace(/=+$/, '').replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

/** Encodes the complete playbook as base64url text, without the URL around it. */
export function encodeSharedPlaybook(playbook: Playbook): string {
  const file = createSnapbookFile(playbook)
  return toBase64Url(new TextEncoder().encode(JSON.stringify(file)))
}

/** Decodes a shared payload back into a playbook, using the normal import rules. */
export function decodeSharedPlaybook(payload: string): Playbook {
  const value = payload.trim()
  if (!value) throw new Error('This share link is empty or incomplete.')

  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(fromBase64Url(value))
  } catch {
    throw new Error(DAMAGED_LINK)
  }
  if (!text.trim()) throw new Error('This share link is empty or incomplete.')

  try {
    return parseSnapbook(text)
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (/not valid JSON|is empty|does not look like a Snapbook/i.test(message)) {
      throw new Error(DAMAGED_LINK)
    }
    throw error
  }
}

/** Builds the full link to share from any app URL. */
export function createShareLink(playbook: Playbook, baseUrl: string): string {
  const url = new URL(baseUrl)
  url.hash = `snapbook=${encodeSharedPlaybook(playbook)}`
  return url.toString()
}

/**
 * Reads a playbook from a URL hash. Returns null when the hash is not a share
 * link, so ordinary app URLs keep their normal behaviour.
 */
export function sharePlaybookFromHash(hash: string): Playbook | null {
  if (!hash.startsWith(SHARE_HASH_PREFIX)) return null
  return decodeSharedPlaybook(hash.slice(SHARE_HASH_PREFIX.length))
}
