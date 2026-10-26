import { describe, expect, it, vi } from 'vitest'
import {
  DROPBOX_TOKEN_URL,
  DropboxAuthError,
  DropboxConflictError,
  buildAuthorizeUrl,
  codeChallengeFor,
  createDropboxClient,
  createPkcePair,
  dropboxRedirectUri,
  exchangeDropboxCode,
  parseDropboxCallback,
  type DropboxToken,
} from '../dropbox'

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const fetchMock = () => vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()

describe('Dropbox OAuth', () => {
  it('creates a PKCE verifier and matching S256 challenge', async () => {
    const { verifier, challenge } = await createPkcePair()
    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]{43,128}$/)
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(await codeChallengeFor(verifier)).toBe(challenge)
  })

  it('builds an offline PKCE authorization URL with the app-folder scopes', () => {
    const url = new URL(
      buildAuthorizeUrl({
        clientId: 'app-key',
        redirectUri: 'https://example.com/snapbook/',
        state: 'state-value',
        codeChallenge: 'challenge-value',
      }),
    )

    expect(url.origin).toBe('https://www.dropbox.com')
    expect(url.pathname).toBe('/oauth2/authorize')
    expect(url.searchParams.get('client_id')).toBe('app-key')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('redirect_uri')).toBe('https://example.com/snapbook/')
    expect(url.searchParams.get('token_access_type')).toBe('offline')
    expect(url.searchParams.get('scope')).toBe(
      'account_info.read files.content.read files.content.write files.metadata.read',
    )
    expect(url.searchParams.get('state')).toBe('state-value')
    expect(url.searchParams.get('code_challenge')).toBe('challenge-value')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.has('client_secret')).toBe(false)
  })

  it('resolves the registered directory for both index and directory URLs', () => {
    expect(dropboxRedirectUri('https://example.com/snapbook/index.html?x=1')).toBe(
      'https://example.com/snapbook/',
    )
    expect(dropboxRedirectUri('https://example.com/snapbook')).toBe(
      'https://example.com/snapbook/',
    )
    expect(dropboxRedirectUri('https://example.com/snapbook/?code=abc')).toBe(
      'https://example.com/snapbook/',
    )
    expect(dropboxRedirectUri('http://localhost:5173/')).toBe('http://localhost:5173/')
  })

  it('parses success and cancellation callbacks', () => {
    expect(parseDropboxCallback('?code=abc&state=xyz')).toEqual({ code: 'abc', state: 'xyz' })
    expect(parseDropboxCallback('?error=access_denied&error_description=Nope')).toEqual({
      error: 'Nope',
    })
    expect(parseDropboxCallback('?code=&state=xyz')).toBeNull()
    expect(parseDropboxCallback('')).toBeNull()
  })

  it('exchanges a code with PKCE and no client secret', async () => {
    const fetch = fetchMock().mockResolvedValue(
      jsonResponse({
        access_token: 'sl.access',
        refresh_token: 'refresh',
        expires_in: 14400,
        account_id: 'dbid:123',
      }),
    )

    const token = await exchangeDropboxCode(
      {
        clientId: 'app-key',
        code: 'code-value',
        redirectUri: 'https://example.com/snapbook/',
        codeVerifier: 'verifier-value',
      },
      fetch as unknown as typeof globalThis.fetch,
    )

    expect(token).toEqual<DropboxToken>({
      accessToken: 'sl.access',
      refreshToken: 'refresh',
      expiresIn: 14400,
      accountId: 'dbid:123',
    })
    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, init] = fetch.mock.calls[0]
    expect(String(url)).toBe(DROPBOX_TOKEN_URL)
    const body = init?.body as URLSearchParams
    expect(body).toBeInstanceOf(URLSearchParams)
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('code')).toBe('code-value')
    expect(body.get('redirect_uri')).toBe('https://example.com/snapbook/')
    expect(body.get('code_verifier')).toBe('verifier-value')
    expect(body.get('client_id')).toBe('app-key')
    expect(body.get('client_secret')).toBeNull()
  })
})

describe('Dropbox App Folder files', () => {
  it('treats a missing playbook as an empty remote', async () => {
    const fetch = fetchMock().mockResolvedValue(
      jsonResponse(
        {
          error_summary: 'path/not_found/..',
          error: { '.tag': 'path', path: { '.tag': 'not_found' } },
        },
        409,
      ),
    )

    const client = createDropboxClient('token', fetch as unknown as typeof globalThis.fetch)
    await expect(client.getMetadata()).resolves.toBeNull()
  })

  it('uploads with the expected revision and conflict protection', async () => {
    const fetch = fetchMock().mockResolvedValue(
      jsonResponse({ rev: 'rev-2', path_display: '/snapbook.json' }),
    )
    const client = createDropboxClient('token', fetch as unknown as typeof globalThis.fetch)

    await expect(client.upload('{"format":"snapbook"}', { rev: 'rev-1' })).resolves.toEqual({
      rev: 'rev-2',
      path: '/snapbook.json',
    })

    const [url, init] = fetch.mock.calls[0]
    expect(String(url)).toBe('https://content.dropboxapi.com/2/files/upload')
    expect(init?.body).toBe('{"format":"snapbook"}')
    const headers = init?.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer token')
    const args = JSON.parse(headers['Dropbox-API-Arg']) as {
      path: string
      mode: { '.tag': string; update?: string }
      strict_conflict: boolean
      autorename: boolean
    }
    expect(args.path).toBe('/snapbook.json')
    expect(args.mode).toEqual({ '.tag': 'update', update: 'rev-1' })
    expect(args.strict_conflict).toBe(true)
    expect(args.autorename).toBe(false)
  })

  it('creates the file when there is no remote revision', async () => {
    const fetch = fetchMock().mockResolvedValue(jsonResponse({ rev: 'rev-1' }))
    const client = createDropboxClient('token', fetch as unknown as typeof globalThis.fetch)

    await client.upload('{}')
    const headers = fetch.mock.calls[0][1]?.headers as Record<string, string>
    const args = JSON.parse(headers['Dropbox-API-Arg']) as {
      mode: { '.tag': string }
    }
    expect(args.mode).toEqual({ '.tag': 'add' })
  })

  it('downloads the file content from the app folder', async () => {
    const fetch = fetchMock().mockResolvedValue(new Response('{"format":"snapbook"}'))
    const client = createDropboxClient('token', fetch as unknown as typeof globalThis.fetch)

    await expect(client.download()).resolves.toBe('{"format":"snapbook"}')
    const [url, init] = fetch.mock.calls[0]
    expect(String(url)).toBe('https://content.dropboxapi.com/2/files/download')
    const headers = init?.headers as Record<string, string>
    expect(JSON.parse(headers['Dropbox-API-Arg'])).toEqual({ path: '/snapbook.json' })
  })

  it('surfaces a revision conflict instead of overwriting', async () => {
    const fetch = fetchMock().mockResolvedValue(
      jsonResponse({ error_summary: 'path/conflict/file/..' }, 409),
    )
    const client = createDropboxClient('token', fetch as unknown as typeof globalThis.fetch)

    await expect(client.upload('{}', { rev: 'stale' })).rejects.toBeInstanceOf(
      DropboxConflictError,
    )
  })

  it('marks an expired token as an auth error', async () => {
    const fetch = fetchMock().mockResolvedValue(
      jsonResponse({ error_summary: 'invalid_access_token/..' }, 401),
    )
    const client = createDropboxClient('token', fetch as unknown as typeof globalThis.fetch)

    await expect(client.getMetadata()).rejects.toBeInstanceOf(DropboxAuthError)
  })
})
