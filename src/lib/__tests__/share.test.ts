import { describe, expect, it } from 'vitest'
import {
  SHARE_HASH_PREFIX,
  createShareLink,
  decodeSharedPlaybook,
  encodeSharedPlaybook,
  sharePlaybookFromHash,
} from '../share'
import { serializeSnapbook } from '../files'
import { parseFixture, randomPlaybook, semantics } from './snapbookTestUtils'

const base64url = (text: string) => {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

describe('share links', () => {
  it('round-trips the complete playbook through the payload', () => {
    const original = parseFixture('v3-complete')
    const restored = decodeSharedPlaybook(encodeSharedPlaybook(original))

    expect(semantics(restored)).toEqual(semantics(original))
    expect(restored.formations.length).toBe(original.formations.length)
    expect(restored.routes.length).toBe(original.routes.length)
    expect(restored.plays.length).toBe(original.plays.length)
    expect(restored.categories).toHaveLength(original.categories.length)
  })

  it('keeps Unicode names and notes intact', () => {
    const original = {
      ...parseFixture('v3-complete'),
      name: 'Café “Friday” 🏈',
      team: '日本語チーム',
    }

    const restored = decodeSharedPlaybook(encodeSharedPlaybook(original))
    expect(restored.name).toBe('Café “Friday” 🏈')
    expect(restored.team).toBe('日本語チーム')
    expect(semantics(restored)).toEqual(semantics(original))
  })

  it('builds a URL-safe link with the data in the fragment', () => {
    const original = randomPlaybook(17)
    const link = createShareLink(original, 'https://example.com/app/?tab=plays')
    const url = new URL(link)

    expect(url.origin).toBe('https://example.com')
    expect(url.pathname).toBe('/app/')
    expect(url.search).toBe('?tab=plays')
    expect(url.hash.startsWith(SHARE_HASH_PREFIX)).toBe(true)
    expect(url.hash.slice(SHARE_HASH_PREFIX.length)).toMatch(/^[A-Za-z0-9_-]+$/)

    const restored = sharePlaybookFromHash(url.hash)
    expect(restored).not.toBeNull()
    expect(semantics(restored!)).toEqual(semantics(original))
  })

  it('does not treat other hashes as share links', () => {
    expect(sharePlaybookFromHash('')).toBeNull()
    expect(sharePlaybookFromHash('#plays')).toBeNull()
    expect(sharePlaybookFromHash('#snapbook')).toBeNull()
  })

  it('reports empty and damaged payloads clearly', () => {
    expect(() => decodeSharedPlaybook('')).toThrow(/empty or incomplete/)
    expect(() => decodeSharedPlaybook('!!!')).toThrow(/damaged/)
    expect(() => sharePlaybookFromHash('#snapbook=bm90IGpzb24')).toThrow(/damaged/)
  })

  it('keeps the format version error for links from a newer writer', () => {
    const file = JSON.parse(
      serializeSnapbook(parseFixture('v3-complete'), '2026-10-24T00:00:00.000Z'),
    ) as { version: number; minReaderVersion: number }
    file.version = 4
    file.minReaderVersion = 4

    expect(() => decodeSharedPlaybook(base64url(JSON.stringify(file)))).toThrow(
      /needs app version 4/,
    )
  })
})
