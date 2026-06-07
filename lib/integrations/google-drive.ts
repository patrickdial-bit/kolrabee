// Google Drive integration — OAuth 2.0 (web server flow) + Drive v3 REST, all
// over plain fetch so we don't pull in the heavy googleapis SDK.
//
// Least-privilege scope: `drive.file` lets the app create and manage ONLY the
// files and folders it creates itself — it cannot see the rest of the user's
// Drive. That's exactly what per-project backup folders need, and it keeps
// Google's OAuth verification light (sensitive, not restricted).
//
// Required env (set in Vercel + .env.local):
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
// Redirect URI is derived from the request/site origin: <origin>/api/integrations/google/callback

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/userinfo'
const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files'
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files'
const FOLDER_MIME = 'application/vnd.google-apps.folder'

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'openid',
  'email',
].join(' ')

export function isConfigured(): boolean {
  return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET
}

export function callbackUrl(origin: string): string {
  return `${origin.replace(/\/$/, '')}/api/integrations/google/callback`
}

export function getAuthUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline', // request a refresh token
    prompt: 'consent', // force refresh_token issuance on reconnect
    include_granted_scopes: 'true',
    state,
  })
  return `${AUTH_ENDPOINT}?${params.toString()}`
}

export type TokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in: number
}

export async function exchangeCode(code: string, redirectUri: string): Promise<TokenResponse> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) throw new Error(`Token exchange failed (${res.status})`)
  return res.json()
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error(`Token refresh failed (${res.status})`)
  const data = (await res.json()) as TokenResponse
  return data.access_token
}

export async function getUserEmail(accessToken: string): Promise<string | null> {
  const res = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return null
  const data = (await res.json()) as { email?: string }
  return data.email ?? null
}

// Escape a value for a Drive `q` query string literal.
function q(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

// Find a folder by name under an optional parent, creating it if absent.
// Returns the folder id and a shareable webViewLink.
export async function ensureFolder(
  accessToken: string,
  name: string,
  parentId?: string | null,
): Promise<{ id: string; webViewLink: string | null }> {
  const clauses = [
    `name='${q(name)}'`,
    `mimeType='${FOLDER_MIME}'`,
    'trashed=false',
  ]
  if (parentId) clauses.push(`'${q(parentId)}' in parents`)
  const search = new URLSearchParams({
    q: clauses.join(' and '),
    fields: 'files(id,webViewLink)',
    spaces: 'drive',
    pageSize: '1',
  })
  const listRes = await fetch(`${DRIVE_FILES}?${search.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (listRes.ok) {
    const data = (await listRes.json()) as { files?: { id: string; webViewLink?: string }[] }
    const existing = data.files?.[0]
    if (existing) return { id: existing.id, webViewLink: existing.webViewLink ?? null }
  }

  const body: Record<string, unknown> = { name, mimeType: FOLDER_MIME }
  if (parentId) body.parents = [parentId]
  const createRes = await fetch(`${DRIVE_FILES}?fields=id,webViewLink`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!createRes.ok) throw new Error(`Create folder failed (${createRes.status})`)
  const created = (await createRes.json()) as { id: string; webViewLink?: string }
  return { id: created.id, webViewLink: created.webViewLink ?? null }
}

// Multipart upload of a single file into a folder. Returns the new file id.
export async function uploadFile(
  accessToken: string,
  folderId: string,
  filename: string,
  bytes: Uint8Array,
  mimeType: string,
): Promise<string> {
  const boundary = `kb${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
  const metadata = JSON.stringify({ name: filename, parents: [folderId] })

  const enc = new TextEncoder()
  const head = enc.encode(
    `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${metadata}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`,
  )
  const tail = enc.encode(`\r\n--${boundary}--`)
  const body = new Uint8Array(head.length + bytes.length + tail.length)
  body.set(head, 0)
  body.set(bytes, head.length)
  body.set(tail, head.length + bytes.length)

  const res = await fetch(`${DRIVE_UPLOAD}?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  })
  if (!res.ok) throw new Error(`Upload failed for ${filename} (${res.status})`)
  const data = (await res.json()) as { id: string }
  return data.id
}
