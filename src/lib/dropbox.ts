export const DROPBOX_AUTH_URL = 'https://www.dropbox.com/oauth2/authorize'
export const DROPBOX_TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token'
export const DROPBOX_API_URL = 'https://api.dropboxapi.com/2'
export const DROPBOX_CONTENT_URL = 'https://content.dropboxapi.com/2'
export const DROPBOX_FILE_PATH = '/snapbook.json'
export const DROPBOX_SCOPES =
  'account_info.read files.content.read files.content.write files.metadata.read'

type FetchLike = typeof fetch

export function getDropboxAppKey(): string {
  return (import.meta.env.VITE_DROPBOX_APP_KEY ?? '').trim()
}

/**
 * OAuth redirects must match the App Console exactly. Resolve the app's
 * directory rather than the current document so `/snapbook/` and
 * `/snapbook/index.html` both come back as the same registered URI.
 */
export function dropboxRedirectUri(href = window.location.href): string {
  const url = new URL(href)
  if (!url.pathname.endsWith('/')) {
    if (url.pathname.endsWith('/index.html')) {
      return `${url.origin}${url.pathname.slice(0, -'index.html'.length)}`
    }
    const last = url.pathname.split('/').pop() ?? ''
    if (!last.includes('.')) return `${url.origin}${url.pathname}/`
  }
  const directory = new URL('.', url)
  return `${directory.origin}${directory.pathname}`
}

function bytesToBinary(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return binary
}

export function base64UrlEncode(bytes: Uint8Array): string {
  return btoa(bytesToBinary(bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export function randomToken(byteLength = 48): string {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Dropbox sign-in needs a secure browser page.')
  }
  const bytes = new Uint8Array(byteLength)
  globalThis.crypto.getRandomValues(bytes)
  return base64UrlEncode(bytes)
}

export async function codeChallengeFor(verifier: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Dropbox sign-in needs a secure (HTTPS or localhost) page.')
  }
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier),
  )
  return base64UrlEncode(new Uint8Array(digest))
}

export async function createPkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = randomToken(48)
  return { verifier, challenge: await codeChallengeFor(verifier) }
}

export function buildAuthorizeUrl({
  clientId,
  redirectUri,
  state,
  codeChallenge,
}: {
  clientId: string
  redirectUri: string
  state: string
  codeChallenge: string
}): string {
  const url = new URL(DROPBOX_AUTH_URL)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('token_access_type', 'offline')
  url.searchParams.set('scope', DROPBOX_SCOPES)
  url.searchParams.set('state', state)
  url.searchParams.set('code_challenge', codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  return url.toString()
}

export type DropboxCallback = { code: string; state: string } | { error: string }

export function parseDropboxCallback(search: string): DropboxCallback | null {
  const params = new URLSearchParams(search)
  if (params.has('error')) {
    return {
      error:
        params.get('error_description')?.trim() ||
        params.get('error')?.trim() ||
        'Dropbox sign-in was cancelled.',
    }
  }
  const code = params.get('code')?.trim()
  if (!code) return null
  return { code, state: params.get('state') ?? '' }
}

export interface DropboxToken {
  accessToken: string
  refreshToken: string | null
  expiresIn: number
  accountId: string | null
}

interface DropboxErrorBody {
  error_summary?: unknown
  error_description?: unknown
  error?: { '.tag'?: unknown; path?: { '.tag'?: unknown } } | string
}

export class DropboxApiError extends Error {
  readonly status: number
  readonly summary: string
  readonly tag: string | null

  constructor(message: string, status: number, summary: string, tag: string | null = null) {
    super(message)
    this.name = 'DropboxApiError'
    this.status = status
    this.summary = summary
    this.tag = tag
  }
}

export class DropboxConflictError extends DropboxApiError {
  constructor(message = 'The Dropbox copy changed in another place.', summary = 'conflict') {
    super(message, 409, summary, 'conflict')
    this.name = 'DropboxConflictError'
  }
}

export class DropboxAuthError extends DropboxApiError {
  constructor(message = 'Your Dropbox session expired.', summary = 'unauthorized') {
    super(message, 401, summary, 'unauthorized')
    this.name = 'DropboxAuthError'
  }
}

async function readJson(response: Response): Promise<DropboxErrorBody | null> {
  try {
    const value: unknown = await response.json()
    return typeof value === 'object' && value !== null ? (value as DropboxErrorBody) : null
  } catch {
    return null
  }
}

function errorSummary(data: DropboxErrorBody | null, response: Response): string {
  if (typeof data?.error_summary === 'string' && data.error_summary.trim()) {
    return data.error_summary.trim()
  }
  if (typeof data?.error_description === 'string' && data.error_description.trim()) {
    return data.error_description.trim()
  }
  return `${response.status} ${response.statusText}`.trim()
}

function errorTag(data: DropboxErrorBody | null): string | null {
  if (typeof data?.error === 'string') return data.error
  const tag = data?.error?.['.tag']
  return typeof tag === 'string' ? tag : null
}

async function throwResponseError(response: Response, prefix: string): Promise<never> {
  const data = await readJson(response)
  const summary = errorSummary(data, response)
  if (response.status === 401) {
    throw new DropboxAuthError(`${prefix}: ${summary}`)
  }
  throw new DropboxApiError(`${prefix}: ${summary}`, response.status, summary, errorTag(data))
}

async function requestToken(
  params: Record<string, string>,
  fetchImpl: FetchLike,
): Promise<DropboxToken> {
  const response = await fetchImpl(DROPBOX_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  })
  if (!response.ok) {
    const data = await readJson(response)
    const summary = errorSummary(data, response)
    throw new DropboxApiError(
      `Dropbox sign-in failed: ${summary}`,
      response.status,
      summary,
      errorTag(data),
    )
  }
  const data = (await response.json()) as {
    access_token?: unknown
    refresh_token?: unknown
    expires_in?: unknown
    account_id?: unknown
  }
  if (typeof data.access_token !== 'string' || !data.access_token) {
    throw new DropboxApiError('Dropbox did not return an access token.', 500, 'missing token')
  }
  return {
    accessToken: data.access_token,
    refreshToken:
      typeof data.refresh_token === 'string' && data.refresh_token
        ? data.refresh_token
        : null,
    expiresIn:
      typeof data.expires_in === 'number' && Number.isFinite(data.expires_in)
        ? data.expires_in
        : 14400,
    accountId: typeof data.account_id === 'string' ? data.account_id : null,
  }
}

export function exchangeDropboxCode(
  {
    clientId,
    code,
    redirectUri,
    codeVerifier,
  }: {
    clientId: string
    code: string
    redirectUri: string
    codeVerifier: string
  },
  fetchImpl: FetchLike = fetch,
): Promise<DropboxToken> {
  return requestToken(
    {
      client_id: clientId,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    },
    fetchImpl,
  )
}

export function refreshDropboxToken(
  {
    clientId,
    refreshToken,
  }: {
    clientId: string
    refreshToken: string
  },
  fetchImpl: FetchLike = fetch,
): Promise<DropboxToken> {
  return requestToken(
    {
      client_id: clientId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    },
    fetchImpl,
  )
}

export interface DropboxFileMetadata {
  rev: string
  path: string | null
}

export interface DropboxAccount {
  accountId: string | null
  displayName: string
  email: string | null
}

type DropboxWriteMode =
  | { '.tag': 'add' }
  | { '.tag': 'update'; update: string }

function isNotFound(data: DropboxErrorBody | null): boolean {
  const summary = typeof data?.error_summary === 'string' ? data.error_summary : ''
  if (summary.includes('not_found')) return true
  const error = data?.error
  if (typeof error !== 'object' || error === null) return false
  return error['.tag'] === 'path' && error.path?.['.tag'] === 'not_found'
}

function metadataFrom(value: unknown): DropboxFileMetadata {
  if (typeof value !== 'object' || value === null) {
    throw new DropboxApiError('Dropbox returned invalid file metadata.', 500, 'invalid metadata')
  }
  const record = value as Record<string, unknown>
  if (typeof record.rev !== 'string' || !record.rev) {
    throw new DropboxApiError('Dropbox did not return a file revision.', 500, 'missing rev')
  }
  return {
    rev: record.rev,
    path: typeof record.path_display === 'string' ? record.path_display : null,
  }
}

export function createDropboxClient(accessToken: string, fetchImpl: FetchLike = fetch) {
  const authorization = { Authorization: `Bearer ${accessToken}` }
  const contentUrl = (endpoint: string) => `${DROPBOX_CONTENT_URL}/${endpoint}`
  const apiUrl = (endpoint: string) => `${DROPBOX_API_URL}/${endpoint}`

  return {
    async getMetadata(path = DROPBOX_FILE_PATH): Promise<DropboxFileMetadata | null> {
      const response = await fetchImpl(apiUrl('files/get_metadata'), {
        method: 'POST',
        headers: { ...authorization, 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      })
      if (response.status === 409) {
        const data = await readJson(response)
        if (isNotFound(data)) return null
      }
      if (!response.ok) await throwResponseError(response, 'Dropbox could not read the playbook')
      return metadataFrom(await response.json())
    },

    async download(path = DROPBOX_FILE_PATH): Promise<string> {
      const response = await fetchImpl(contentUrl('files/download'), {
        method: 'GET',
        headers: {
          ...authorization,
          'Dropbox-API-Arg': JSON.stringify({ path }),
        },
      })
      if (!response.ok) await throwResponseError(response, 'Dropbox could not download the playbook')
      return response.text()
    },

    async upload(
      text: string,
      { rev = null, path = DROPBOX_FILE_PATH }: { rev?: string | null; path?: string } = {},
    ): Promise<DropboxFileMetadata> {
      const mode: DropboxWriteMode = rev
        ? { '.tag': 'update', update: rev }
        : { '.tag': 'add' }
      const response = await fetchImpl(contentUrl('files/upload'), {
        method: 'POST',
        headers: {
          ...authorization,
          'Content-Type': 'application/octet-stream',
          'Dropbox-API-Arg': JSON.stringify({
            path,
            mode,
            autorename: false,
            mute: true,
            strict_conflict: true,
          }),
        },
        body: text,
      })
      if (response.status === 409) {
        const data = await readJson(response)
        throw new DropboxConflictError(
          'The Dropbox copy changed while this playbook was uploading. Nothing was overwritten.',
          errorSummary(data, response),
        )
      }
      if (!response.ok) await throwResponseError(response, 'Dropbox could not save the playbook')
      return metadataFrom(await response.json())
    },

    async getAccount(): Promise<DropboxAccount> {
      const response = await fetchImpl(apiUrl('users/get_current_account'), {
        method: 'POST',
        headers: { ...authorization, 'Content-Type': 'application/json' },
        body: 'null',
      })
      if (!response.ok) await throwResponseError(response, 'Dropbox could not read the account')
      const data = (await response.json()) as {
        account_id?: unknown
        email?: unknown
        name?: { display_name?: unknown }
      }
      return {
        accountId: typeof data.account_id === 'string' ? data.account_id : null,
        displayName:
          typeof data.name?.display_name === 'string' && data.name.display_name.trim()
            ? data.name.display_name.trim()
            : typeof data.email === 'string' && data.email.trim()
              ? data.email.trim()
              : 'Dropbox',
        email: typeof data.email === 'string' ? data.email : null,
      }
    },

    async revoke(): Promise<void> {
      await fetchImpl(apiUrl('auth/token/revoke'), {
        method: 'POST',
        headers: authorization,
      })
    },
  }
}
