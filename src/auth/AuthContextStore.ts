import { createContext } from 'react'
import type * as AuthApi from '../api/auth'
import type { StoredTokens } from './tokenStorage'

export type PendingMfa = {
    challengeId: string
    method: string
    expiresIn: number
    devCode?: string | null
}

export type AuthState = {
    tokens: StoredTokens | null
    user: AuthApi.MeResponse | null
    loading: boolean
    error: string | null
    lastVerificationToken: string | null
    pendingMfa: PendingMfa | null
}

export type RegisterInput = {
    username: string
    password: string
    requestedRole?: 'BUYER' | 'SELLER'
    extras?: AuthApi.RegisterExtras
}

export type AuthActions = {
    register: (input: RegisterInput) => Promise<AuthApi.RegisterResponse>
    verifyEmail: (token: string, username?: string) => Promise<void>
    login: (username: string, password: string, privateKey?: string, captcha?: AuthApi.CaptchaPayload) => Promise<AuthApi.LoginResponse>
    submitMfa: (code: string) => Promise<void>
    cancelMfa: () => void
    enable2faEmail: () => Promise<void>
    disable2fa: () => Promise<void>
    rotatePrivateKey: () => Promise<AuthApi.RotatePrivateKeyResponse>
    becomeSeller: () => Promise<void>
    logout: () => Promise<void>
    refresh: () => Promise<void>
    reloadMe: () => Promise<void>
}

export type AuthContextValue = AuthState & AuthActions

export const AuthContext = createContext<AuthContextValue | null>(null)