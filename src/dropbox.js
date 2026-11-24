// dropbox.js — bring music in from Dropbox, without a server.
//
// The app is a static page, so there is no client secret to keep and no server
// to exchange a code: this uses Dropbox's own recommendation for that case,
// OAuth with PKCE. The app key is public and typed in once on the device; the
// code verifier never leaves the browser; Dropbox returns a short-lived access
// token and a refresh token, and the refresh token stays in this browser.
//
// Only two permissions are asked for, both read-only: `files.metadata.read` (to
// list folders) and `files.content.read` (to download the file the student
// taps). Nothing is written back to Dropbox.
//
// Every URL here was checked for CORS from the published origin: the token,
// list_folder and download endpoints all answer preflight.

import { base64url } from './sheetlib.js?v=202611240700';

const API = 'https://api.dropboxapi.com/2';
const CONTENT = 'https://content.dropboxapi.com/2';
const AUTHORIZE = 'https://www.dropbox.com/oauth2/authorize';
const TOKEN = 'https://api.dropboxapi.com/oauth2/token';

export const SCOPES = ['files.metadata.read', 'files.content.read'];
export const KEY_STORE = 'scaleStudio.dropbox';
export const CONSOLE_URL = 'https://www.dropbox.com/developers/apps';

const AUDIO = /\.(mp3|m4a|aac|wav|ogg|oga|flac|opus)$/i;
const MUSIC = /\.(pdf|musicxml|mxl|xml|png|jpe?g|webp|gif|avif)$/i;

/** The address Dropbox sends the student back to: this page, without a query. */
export function redirectUri() {
  try {
    const url = new URL(location.href);
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return String(location.href);
  }
}

/** Characters Dropbox allows in a verifier: 43–128 of [A-Za-z0-9-._~]. */
export function randomVerifier(size = 64) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
}

export async function challengeFor(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

export function authUrl({ appKey, redirect, challenge, state }) {
  const q = new URLSearchParams({
    client_id: appKey,
    redirect_uri: redirect,
    response_type: 'code',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    token_access_type: 'offline',
    scope: SCOPES.join(' '),
    state,
  });
  return `${AUTHORIZE}?${q}`;
}

export function parseCallback(search) {
  const q = new URLSearchParams(search || '');
  return {
    code: q.get('code') || '',
    state: q.get('state') || '',
    error: q.get('error') || '',
    description: q.get('error_description') || '',
  };
}

export function normalizeKey(key) {
  return String(key || '')
    .replace(/^Key([A-Z])$/, '$1')
    .replace(/^Digit(\d)$/, '$1')
    .replace(/^Numpad(\d)$/, 'Num$1')
    .replace(/^Arrow(\w+)$/, '$1');
}

/** A folder listing, folders first, only files the shelf can hold. */
export function musicEntries(entries) {
  const usable = (entries || []).filter(
    (e) => e && (e['.tag'] === 'folder' || (e['.tag'] === 'file' && (AUDIO.test(e.name || '') || MUSIC.test(e.name || '')))),
  );
  return usable.sort((a, b) => {
    const af = a['.tag'] === 'folder' ? 0 : 1;
    const bf = b['.tag'] === 'folder' ? 0 : 1;
    if (af !== bf) return af - bf;
    return String(a.name).localeCompare(String(b.name), undefined, { numeric: true, sensitivity: 'base' });
  });
}

export function isAudioName(name) {
  return AUDIO.test(String(name || ''));
}

export function joinPath(base, name) {
  const trimmed = String(base || '').replace(/\/+$/, '');
  return `${trimmed}/${String(name || '').replace(/^\/+/, '')}` || '/';
}

export function parentPath(path) {
  const parts = String(path || '').split('/').filter(Boolean);
  parts.pop();
  return parts.length ? `/${parts.join('/')}` : '';
}

/** JSON for a header: all non-ASCII written as \u escapes. */
export function asciiJson(value) {
  return JSON.stringify(value).replace(/[\u007f-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

export class DropboxError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

function state() {
  try {
    const raw = localStorage.getItem(KEY_STORE);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saved() {
  return state();
}

export function saveAppKey(appKey) {
  const current = state() || {};
  try {
    localStorage.setItem(KEY_STORE, JSON.stringify({ ...current, appKey: String(appKey || '').trim() }));
  } catch {
    /* private mode */
  }
}

export function saveTokens(tokens) {
  const current = state() || {};
  try {
    localStorage.setItem(
      KEY_STORE,
      JSON.stringify({
        ...current,
        refreshToken: tokens.refresh_token || current.refreshToken || '',
        accessToken: tokens.access_token || '',
        expiresAt: Date.now() + (Number(tokens.expires_in) || 14400) * 1000 - 60000,
      }),
    );
  } catch {
    /* private mode */
  }
}

export function forget() {
  try {
    const appKey = state()?.appKey || '';
    localStorage.setItem(KEY_STORE, JSON.stringify({ appKey }));
  } catch {
    /* private mode */
  }
}

export function isConnected() {
  return Boolean(state()?.refreshToken);
}

async function tokenRequest(fields) {
  const response = await fetch(TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new DropboxError(body.error === 'invalid_grant' ? 'grant' : 'token', body.error_description || body.error);
  }
  saveTokens(body);
  return body.access_token;
}

export async function exchange({ code, verifier, appKey, redirect }) {
  return tokenRequest({
    code,
    grant_type: 'authorization_code',
    code_verifier: verifier,
    client_id: appKey,
    redirect_uri: redirect,
  });
}

async function accessToken() {
  const s = state();
  if (!s?.refreshToken) throw new DropboxError('signed-out');
  if (s.accessToken && s.expiresAt && Date.now() < s.expiresAt) return s.accessToken;
  return tokenRequest({ grant_type: 'refresh_token', refresh_token: s.refreshToken, client_id: s.appKey });
}

async function call(url, { apiArg, body, json = true } = {}) {
  const token = await accessToken();
  const headers = { Authorization: `Bearer ${token}` };
  if (apiArg) headers['Dropbox-API-Arg'] = asciiJson(apiArg);
  if (json) headers['Content-Type'] = 'application/json';
  let response;
  try {
    response = await fetch(url, { method: 'POST', headers, body: json ? JSON.stringify(body || {}) : undefined });
  } catch {
    throw new DropboxError('network');
  }
  if (response.status === 401) {
    // An expired token that the clock disagreed about: refresh once.
    const s = state();
    if (s) s.expiresAt = 0;
    throw new DropboxError('expired');
  }
  if (response.status === 409) {
    const err = await response.json().catch(() => ({}));
    throw new DropboxError('path', err.error_summary || 'path');
  }
  if (!response.ok) throw new DropboxError('api', String(response.status));
  return response;
}

/** Every entry of a folder, following Dropbox's own paging. */
export async function listFolder(path) {
  let response = await call(`${API}/files/list_folder`, {
    body: { path: String(path || ''), limit: 200, include_deleted: false },
  });
  let page = await response.json();
  const out = [...(page.entries || [])];
  while (page.has_more) {
    response = await call(`${API}/files/list_folder/continue`, { body: { cursor: page.cursor } });
    page = await response.json();
    out.push(...(page.entries || []));
  }
  return musicEntries(out);
}

export async function download(path) {
  const response = await call(`${CONTENT}/files/download`, { apiArg: { path: String(path) }, json: false });
  return response.blob();
}
