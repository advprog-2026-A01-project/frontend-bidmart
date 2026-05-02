import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { sessions as fetchSessions, type SessionRow } from '../api/auth'
import { useAuth } from './useAuth'

export function AuthPanel() {
    const {
        user, tokens, loading, error,
        register, verifyEmail,
        login, submitMfa, cancelMfa,
        enable2faEmail, disable2fa,
        logout, refresh, pendingMfa,
    } = useAuth()

    const [username, setUsername] = useState('demo')
    const [password, setPassword] = useState('demo')
    const [requestedRole, setRequestedRole] = useState<'BUYER' | 'SELLER'>('BUYER')

    const [verifyToken, setVerifyToken] = useState('')
    const [otp, setOtp] = useState('')

    const [, setLog] = useState<string>('')
    const [sessionRows, setSessionRows] = useState<SessionRow[] | null>(null)

    useEffect(() => {
        if (!tokens?.accessToken) {
            return
        }
        void (async () => {
            try {
                const s = await fetchSessions(tokens.accessToken)
                setSessionRows(s)
            } catch {
                setSessionRows(null)
            }
        })()
    }, [tokens?.accessToken])

    async function onRegister() {
        setLog('registering...')
        try {
            await register({username, password, requestedRole})
            setLog('register ok — check your email for the verification token')
            // Hapus auto-fill: if (lastVerificationToken) setVerifyToken(lastVerificationToken)
        } catch {
            setLog('register failed')
        }
    }

    async function onVerifyEmail() {
        setLog('Verifying email...')
        try {
            await verifyEmail(verifyToken, username)
            setLog('Email verified! - now login')
        } catch {
            setLog('Verify email failed')
        }
    }

    async function onLogin() {
        setLog('logging in...')
        try {
            await login(username, password)
            setLog(pendingMfa ? '2FA required — enter OTP' : 'login ok')
        } catch {
            setLog('login failed')
        }
    }

    async function onVerifyOtp() {
        setLog('verifying OTP...')
        try {
            await submitMfa(otp)
            setOtp('')
            setLog('2FA ok — logged in')
        } catch {
            setLog('OTP invalid')
        }
    }

    async function onLogout() {
        setLog('logging out...')
        await logout()
        setLog('logged out')
    }

    async function onRefresh() {
        setLog('refreshing...')
        await refresh()
        setLog('refresh done')
    }

    return (
        <div style={{ display: 'grid', gap: 10, maxWidth: 560, margin: '0 auto', textAlign: 'left' }}>
            <h2 style={{ textAlign: 'center', margin: 0 }}>Account</h2>

            {!user ? (
                <>
                    <label>
                        Username / Email
                        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="email" />
                    </label>

                    <label>
                        Password
                        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" type="password" />
                    </label>

                    <label>
                        Register as
                        <select
                            value={requestedRole}
                            onChange={(e) => {
                                const v = e.target.value
                                setRequestedRole(v === 'SELLER' ? 'SELLER' : 'BUYER')
                            }}
                        >
                            <option value="BUYER">Buyer</option>
                            <option value="SELLER">Seller</option>
                        </select>
                    </label>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button style={{ flex: '1 1 140px' }} onClick={onRegister} disabled={loading}>Register</button>
                        <button style={{ flex: '1 1 140px' }} onClick={onLogin} disabled={loading}>Login</button>
                    </div>

                    <div style={{ border: '1px solid #333', borderRadius: 12, padding: 12 }}>
                        <div style={{ fontWeight: 700 }}>Email verification</div>
                        <div style={{ fontSize: 13, marginTop: 6, color: '#0056b3' }}>
                            Masukkan kode verifikasi untuk akun <b>{username}</b>.
                        </div>

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                            <input
                                value={verifyToken}
                                onChange={(e) => setVerifyToken(e.target.value)}
                                placeholder="paste verification token"
                                style={{ flex: '1 1 240px' }}
                            />
                            <button onClick={onVerifyEmail} disabled={loading || !verifyToken}>Verify</button>
                        </div>
                    </div>

                    {pendingMfa ? (
                        <div style={{ border: '1px solid #333', borderRadius: 12, padding: 12 }}>
                            <div style={{ fontWeight: 700 }}>2FA required ({pendingMfa.method})</div>
                            <div style={{ fontSize: 13, marginTop: 6, color: '#0056b3' }}>
                                {pendingMfa.method === 'EMAIL'
                                    ? 'Masukkan 6-digit kode OTP untuk melanjutkan login.'
                                    : 'Masukkan 6-digit kode dari aplikasi Authenticator Anda.'}
                            </div>

                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                                <input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="6-digit code" style={{ flex: '1 1 160px' }} />
                                <button onClick={onVerifyOtp} disabled={loading || !otp}>Verify OTP</button>
                                <button onClick={cancelMfa} disabled={loading}>Cancel</button>
                            </div>
                        </div>
                    ) : null}
                </>
            ) : (
                <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div>
                            Logged in as <b>{user.username}</b> ({user.role})
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button onClick={onRefresh} disabled={loading}>Refresh Token</button>
                            <button onClick={onLogout} disabled={loading}>Logout</button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button onClick={() => void enable2faEmail()} disabled={loading}>Enable 2FA (Email)</button>
                        <button onClick={() => void disable2fa()} disabled={loading}>Disable 2FA</button>
                    </div>

                    <h3 style={{ marginBottom: 0 }}>Active sessions</h3>
                    {sessionRows?.length ? (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                <tr>
                                    <th style={th}>Created</th>
                                    <th style={th}>Last seen</th>
                                    <th style={th}>Expires</th>
                                    <th style={th}>Revoked</th>
                                    <th style={th}>IP</th>
                                </tr>
                                </thead>
                                <tbody>
                                {sessionRows.map((s) => (
                                    <tr key={s.token}>
                                        <td style={td}>{fmt(s.createdAt)}</td>
                                        <td style={td}>{fmt(s.lastSeenAt)}</td>
                                        <td style={td}>{s.expiresAt ? fmt(s.expiresAt) : '-'}</td>
                                        <td style={td}>{s.revokedAt ? fmt(s.revokedAt) : '-'}</td>
                                        <td style={td}>{s.ip ?? '-'}</td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div style={{ opacity: 0.8 }}>No session rows (or not supported).</div>
                    )}
                </>
            )}

            <hr />

            <div style={{ fontSize: 12, marginTop: 8, opacity: 0.9 }}>
                Status: {loading ? 'loading…' : 'idle'}{error ? ` | error: ${error}` : ''}
            </div>
        </div>
    )
}

const th: CSSProperties = { borderBottom: '1px solid #ccc', padding: 6, textAlign: 'left' }
const td: CSSProperties = { borderBottom: '1px solid #eee', padding: 6, verticalAlign: 'top' }

function fmt(iso: string) {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString()
}