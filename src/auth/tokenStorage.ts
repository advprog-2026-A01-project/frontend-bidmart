import type { TokenResponse } from '../api/auth'

/*
Tanggung jawab: simpan token ke localStorage + cek expiry.
 */
export type StoredTokens = TokenResponse & {
    obtainedAt: number // epoch ms
}

const KEY = 'bidmart.auth'

export function loadTokens(): StoredTokens | null {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    try {
        return JSON.parse(raw) as StoredTokens
    } catch {
        return null
    }
}

export function saveTokens(tokens: TokenResponse): StoredTokens {
    const stored: StoredTokens = { ...tokens, obtainedAt: Date.now() }
    localStorage.setItem(KEY, JSON.stringify(stored))
    return stored
}

export function clearTokens() {
    localStorage.removeItem(KEY)
}

export function isAccessExpired(tokens: StoredTokens, skewSeconds = 20): boolean {
    const expMs = tokens.obtainedAt + Math.max(0, tokens.expiresIn - skewSeconds) * 1000
    return Date.now() >= expMs
}