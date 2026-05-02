import { useCallback, useEffect, useMemo, useState } from 'react'
import * as AuthApi from '../api/auth'
import { clearTokens, isAccessExpired, loadTokens, saveTokens, type StoredTokens } from './tokenStorage'
import { getStatus, normalizeError } from './error'
import { AuthContext, type AuthContextValue, type PendingMfa, type RegisterInput } from './AuthContextStore'

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [tokens, setTokens] = useState<StoredTokens | null>(() => loadTokens())
    const [user, setUser] = useState<AuthApi.MeResponse | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [lastVerificationToken, setLastVerificationToken] = useState<string | null>(null)
    const [pendingMfa, setPendingMfa] = useState<PendingMfa | null>(null)

    const refreshOnce = useCallback(async (refreshToken: string) => {
        try {
            const newTokens = await AuthApi.refresh(refreshToken)
            const stored = saveTokens(newTokens)
            setTokens(stored)
            const me = await AuthApi.me(stored.accessToken)
            setUser(me)
            setError(null)
        } catch {
            clearTokens()
            setTokens(null)
            setUser(null)
            setError('refresh_failed')
        }
    }, [])

    const register = useCallback(async (input: RegisterInput) => {
        setLoading(true)
        setError(null)
        try {
            const res = await AuthApi.register(input.username, input.password, input.requestedRole, input.extras)
            setLastVerificationToken(res.verificationToken ?? null)
            return res
        } catch (e: unknown) {
            setError(normalizeError(e))
            throw e
        } finally {
            setLoading(false)
        }
    }, [])

    const verifyEmail = useCallback(async (token: string, username?: string) => {
        setLoading(true)
        setError(null)
        try {
            await AuthApi.verifyEmail(token, username)
            setLastVerificationToken(null)
        } catch (e: unknown) {
            setError(normalizeError(e))
            throw e
        } finally {
            setLoading(false)
        }
    }, [])

    const login = useCallback(async (username: string, password: string, privateKey?: string, captcha?: AuthApi.CaptchaPayload) => {
        setLoading(true)
        setError(null)
        setPendingMfa(null)
        try {
            const res = await AuthApi.login(username, password, privateKey, captcha)

            if (!('accessToken' in res)) {
                setPendingMfa({
                    challengeId: res.challengeId,
                    method: res.method,
                    expiresIn: res.expiresIn,
                    devCode: res.devCode ?? null,
                })
                return res
            }

            const stored = saveTokens(res)
            setTokens(stored)
            const me = await AuthApi.me(stored.accessToken)
            setUser(me)
            return res
        } catch (e: unknown) {
            const code = normalizeError(e)

            if (code !== 'private_key_required') {
                setError(code)
            } else {
                setError(null)
            }

            clearTokens()
            setTokens(null)
            setUser(null)
            throw e
        } finally {
            setLoading(false)
        }
    }, [])

    const submitMfa = useCallback(async (code: string) => {
        if (!pendingMfa) return
        setLoading(true)
        setError(null)
        try {
            const t = await AuthApi.verifyMfa(pendingMfa.challengeId, code)
            const stored = saveTokens(t)
            setTokens(stored)
            const me = await AuthApi.me(stored.accessToken)
            setUser(me)
            setPendingMfa(null)
        } catch (e: unknown) {
            setError(normalizeError(e))
            throw e
        } finally {
            setLoading(false)
        }
    }, [pendingMfa])

    const cancelMfa = useCallback(() => setPendingMfa(null), [])

    const enable2faEmail = useCallback(async () => {
        const accessToken = tokens?.accessToken
        if (!accessToken) return
        setLoading(true)
        setError(null)
        try {
            await AuthApi.enable2faEmail(accessToken)
        } catch (e: unknown) {
            setError(normalizeError(e))
            throw e
        } finally {
            setLoading(false)
        }
    }, [tokens?.accessToken])

    const disable2fa = useCallback(async () => {
        const accessToken = tokens?.accessToken
        if (!accessToken) return
        setLoading(true)
        setError(null)
        try {
            await AuthApi.disable2fa(accessToken)
        } catch (e: unknown) {
            setError(normalizeError(e))
            throw e
        } finally {
            setLoading(false)
        }
    }, [tokens?.accessToken])

    const rotatePrivateKey = useCallback(async () => {
        const accessToken = tokens?.accessToken
        if (!accessToken) {
            throw new Error('NOT_AUTHENTICATED')
        }
        setLoading(true)
        setError(null)
        try {
            return await AuthApi.rotatePrivateKey(accessToken)
        } catch (e: unknown) {
            setError(normalizeError(e))
            throw e
        } finally {
            setLoading(false)
        }
    }, [tokens?.accessToken])

    const becomeSeller = useCallback(async () => {
        const accessToken = tokens?.accessToken
        if (!accessToken) return
        setLoading(true)
        setError(null)
        try {
            await AuthApi.becomeSeller(accessToken)
            const me = await AuthApi.me(accessToken)
            setUser(me)
        } catch (e: unknown) {
            setError(normalizeError(e))
            throw e
        } finally {
            setLoading(false)
        }
    }, [tokens?.accessToken])

    const logout = useCallback(async () => {
        const accessToken = tokens?.accessToken
        clearTokens()
        setTokens(null)
        setUser(null)
        setPendingMfa(null)
        if (!accessToken) return
        try {
            await AuthApi.logout(accessToken)
        } catch(e) {
            console.warn('Logout request failed after local cleanup', e)
        }
    }, [tokens?.accessToken])

    const refresh = useCallback(async () => {
        const rt = tokens?.refreshToken
        if (!rt) return
        await refreshOnce(rt)
    }, [tokens?.refreshToken, refreshOnce])

    const reloadMe = useCallback(async () => {
        const accessToken = tokens?.accessToken
        if (!accessToken) {
            setUser(null)
            return
        }
        setLoading(true)
        setError(null)
        try {
            const me = await AuthApi.me(accessToken)
            setUser(me)
        } catch (e: unknown) {
            setUser(null)
            setError(normalizeError(e))
            if (getStatus(e) === 401 && tokens?.refreshToken) {
                await refreshOnce(tokens.refreshToken)
            }
        } finally {
            setLoading(false)
        }
    }, [tokens?.accessToken, tokens?.refreshToken, refreshOnce])

    useEffect(() => {
        if (!tokens) return
        if (isAccessExpired(tokens) && tokens.refreshToken) {
            void refreshOnce(tokens.refreshToken)
            return
        }
        void reloadMe()
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const value: AuthContextValue = useMemo(
        () => ({
            tokens, user, loading, error, lastVerificationToken, pendingMfa,
            register, verifyEmail, login, submitMfa, cancelMfa,
            enable2faEmail, disable2fa, rotatePrivateKey, becomeSeller,
            logout, refresh, reloadMe,
        }),
        [tokens, user, loading, error, lastVerificationToken, pendingMfa,
            register, verifyEmail, login, submitMfa, cancelMfa,
            enable2faEmail, disable2fa, rotatePrivateKey, becomeSeller,
            logout, refresh, reloadMe]
    )

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}