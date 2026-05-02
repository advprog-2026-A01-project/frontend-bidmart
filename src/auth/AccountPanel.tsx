import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import * as Api from '../api/auth'
import { useAuth } from './useAuth'
import { normalizeError } from './error'
import {
    extractIdentityText,
    extractLikelyIdentityName,
    exactIdentityNameMatches,
    formatOcrProgress,
} from './ocr'
import './AccountPanel.css'

type Tab = 'auth' | 'profile' | 'admin'
type AuthMode = 'login' | 'register'
type LoginStep = 'credentials' | 'privateKey' | 'otp'

function EyeIcon({ open }: { open: boolean }) {
    return open ? (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    ) : (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3l18 18" />
            <path d="M10.6 10.7A3 3 0 0 0 13.4 13.5" />
            <path d="M9.9 5.1A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a17.2 17.2 0 0 1-4.1 5.1" />
            <path d="M6.7 6.7C4.2 8.3 2.7 10.8 2 12c0 0 3.5 7 10 7a9.8 9.8 0 0 0 5.3-1.5" />
        </svg>
    )
}

function prettyErrorMessage(raw: string | null | undefined): string {
    const value = (raw ?? '').trim()

    switch (value) {
        case 'invalid_credentials':
            return 'Username/email atau password salah.'
        case 'invalid_private_key':
            return 'Private key yang dimasukkan salah.'
        case 'private_key_required':
            return 'Akun ini memerlukan private key.'
        case 'invalid_or_expired_token':
            return 'Kode verifikasi atau OTP tidak valid, atau sudah kedaluwarsa.'
        case 'invalid_input':
            return 'Input belum lengkap atau tidak valid.'
        case 'username_taken':
            return 'Username/email sudah terdaftar.'
        case 'email_not_verified':
            return 'Akun belum diverifikasi. Selesaikan verifikasi email terlebih dahulu.'
        case 'password_mismatch':
            return 'Password dan tulis ulang password tidak sama.'
        case 'password_too_short':
            return 'Password minimal 8 karakter.'
        case 'identity_document_required':
            return 'Foto KTP/KTM wajib diupload.'
        case 'identity_document_invalid':
            return 'Dokumen tidak valid. Gunakan file gambar KTP/KTM yang jelas.'
        case 'identity_name_mismatch':
            return 'Nama terdeteksi belum cocok secara persis dengan hasil OCR dokumen.'
        case 'ocr_text_missing':
            return 'Teks hasil OCR dari foto KTP/KTM belum ada.'
        case 'captcha_required':
            return 'Captcha wajib diisi.'
        case 'captcha_invalid':
            return 'Jawaban captcha salah. Coba lagi.'
        case 'captcha_expired':
            return 'Captcha sudah kedaluwarsa. Muat captcha baru.'
        case 'unauthorized':
            return 'Kamu tidak punya akses untuk melakukan aksi ini.'
        default:
            return value ? value.replaceAll('_', ' ') : 'Terjadi kesalahan. Silakan coba lagi.'
    }
}

function initials(name: string) {
    const parts = name.trim().split(/\s+/g).filter(Boolean).slice(0, 2)
    const s = parts.map(p => p[0]?.toUpperCase() ?? '').join('')
    return s || 'U'
}

function formatMissingFieldsMessage(fields: string[]) {
    if (!fields.length) return 'Input belum lengkap atau tidak valid.'
    return `Field berikut wajib diisi: ${fields.join(', ')}.`
}

export function AccountPanel() {
    const {
        user,
        tokens,
        loading,
        error,
        lastVerificationToken,
        pendingMfa,
        register,
        verifyEmail,
        login,
        submitMfa,
        cancelMfa,
        rotatePrivateKey,
        becomeSeller,
        logout,
    } = useAuth()

    const accessToken = tokens?.accessToken ?? null
    const isAdmin = user?.role === 'ADMIN'
    const canCall = !!accessToken

    const [tab, setTab] = useState<Tab>('auth')
    const [authMode, setAuthMode] = useState<AuthMode>('login')
    const [loginStep, setLoginStep] = useState<LoginStep>('credentials')

    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)

    const [requestedRole, setRequestedRole] = useState<'BUYER' | 'SELLER'>('BUYER')
    const [verifyToken, setVerifyToken] = useState('')
    const [otp, setOtp] = useState('')
    const [loginPrivateKey, setLoginPrivateKey] = useState('')

    const [legalName, setLegalName] = useState('')
    const [documentType, setDocumentType] = useState<'KTP' | 'KTM'>('KTP')
    const [documentFile, setDocumentFile] = useState<File | null>(null)
    const [ocrText, setOcrText] = useState('')
    const [ocrProgress, setOcrProgress] = useState<{ status: string; progress: number } | null>(null)
    const [isScanningDocument, setIsScanningDocument] = useState(false)
    const [, setDetectedIdentityName] = useState('')

    const [captcha, setCaptcha] = useState<Api.CaptchaResponse | null>(null)
    const [captchaAnswer, setCaptchaAnswer] = useState('')

    const [toast, setToast] = useState<{ type: 'error' | 'success'; message: string } | null>(null)

    const [profile, setProfile] = useState<Api.UserProfile>({
        displayName: null,
        photoUrl: null,
        shippingAddress: null,
    })
    const [profileMsg, setProfileMsg] = useState('')
    const [photoOk, setPhotoOk] = useState(true)

    const [adminUsers, setAdminUsers] = useState<Api.AdminUserRow[] | null>(null)
    const [adminMsg, setAdminMsg] = useState('')
    const [roleDraftById, setRoleDraftById] = useState<Record<number, string>>({})

    const [roles, setRoles] = useState<string[]>([])
    const [perms, setPerms] = useState<Api.PermissionRow[]>([])
    const [newRole, setNewRole] = useState('')

    // Sort list of users
    const sortedAdminUsers = useMemo(
        () => [...(adminUsers ?? [])].sort((a, b) => a.id - b.id),
        [adminUsers],
    )

    const [newPermKey, setNewPermKey] = useState('bid:place')
    const [newPermDesc, setNewPermDesc] = useState('Place bid')
    const [selectedRole, setSelectedRole] = useState('BUYER')
    const [selectedRolePerms, setSelectedRolePerms] = useState<string[]>([])
    const [rbacMsg, setRbacMsg] = useState('')

    const showVerifyBox = authMode === 'register' && !!lastVerificationToken
    const showPrivateKeyStep = authMode === 'login' && loginStep === 'privateKey' && !pendingMfa
    const showLoginMfaBox = authMode === 'login' && (loginStep === 'otp' || !!pendingMfa)
    const showLoginCredentialsStep = authMode === 'login' && !showPrivateKeyStep && !showLoginMfaBox

    const detectedNameVerified = legalName.trim() && ocrText.trim()
        ? exactIdentityNameMatches(legalName, ocrText)
        : false

    async function loadCaptcha() {
        try {
            const issued = await Api.issueCaptcha()
            setCaptcha(issued)
            setCaptchaAnswer('')
        } catch {
            setCaptcha(null)
        }
    }

    function downloadPrivateKeyFile(filename: string | null | undefined, content: string | null | undefined) {
        if (!filename || !content) return
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
    }

    async function scanIdentityDocument(fileOverride?: File | null): Promise<string> {
        const targetFile = fileOverride ?? documentFile
        if (!targetFile) {
            setToast({ type: 'error', message: 'Pilih foto KTP/KTM terlebih dahulu.' })
            return ''
        }

        setIsScanningDocument(true)
        setOcrProgress({ status: 'starting', progress: 0 })

        try {
            const extracted = await extractIdentityText(targetFile, setOcrProgress)
            setOcrText(extracted)

            const detectedName = extractLikelyIdentityName(extracted, documentType)
            setDetectedIdentityName(detectedName)
            setLegalName(detectedName)

            if (!detectedName.trim()) {
                setToast({
                    type: 'error',
                    message: 'OCR berhasil, tetapi nama belum bisa dideteksi dengan yakin. Coba foto yang lebih jelas.',
                })
            } else if (!exactIdentityNameMatches(detectedName, extracted)) {
                setToast({
                    type: 'error',
                    message: 'Nama terdeteksi, tetapi belum bisa diverifikasi secara persis dari hasil OCR.',
                })
            } else {
                setToast({
                    type: 'success',
                    message: `Nama terdeteksi dari dokumen: ${detectedName}`,
                })
            }

            return extracted
        } catch {
            setToast({ type: 'error', message: 'OCR gagal diproses di browser. Coba gunakan foto yang lebih jelas.' })
            setOcrText('')
            setDetectedIdentityName('')
            setLegalName('')
            return ''
        } finally {
            setIsScanningDocument(false)
        }
    }

    async function onRegister() {
        const missingFields: string[] = []

        if (!username.trim()) missingFields.push('Username / Email')
        if (!password.trim()) missingFields.push('Password')
        if (!confirmPassword.trim()) missingFields.push('Tulis ulang password')
        if (!documentFile) missingFields.push('Foto KTP/KTM')

        if (missingFields.length > 0) {
            setToast({
                type: 'error',
                message: formatMissingFieldsMessage(missingFields),
            })
            return
        }

        const extracted = ocrText || await scanIdentityDocument(documentFile)
        if (!documentFile || !extracted) {
            return
        }

        if (!legalName.trim()) {
            setToast({
                type: 'error',
                message: 'Nama dari dokumen belum berhasil dideteksi. Scan ulang dengan foto yang lebih jelas.',
            })
            return
        }

        if (!exactIdentityNameMatches(legalName, extracted)) {
            setToast({
                type: 'error',
                message: 'Nama terdeteksi belum cocok secara persis dengan hasil OCR dokumen.',
            })
            return
        }

        const response = await register({
            username,
            password,
            requestedRole,
            extras: {
                confirmPassword,
                legalName,
                documentType,
                documentFile,
                documentExtractedText: extracted,
            },
        })

        downloadPrivateKeyFile(response.downloadFilename ?? null, response.downloadContent ?? null)
        setLoginPrivateKey(response.privateKey ?? '')
        setAuthMode('login')
        setLoginStep('credentials')
        setConfirmPassword('')
        setDocumentFile(null)
        setOcrText('')
        setDetectedIdentityName('')
        setToast({
            type: 'success',
            message: 'Registrasi berhasil. Private key otomatis terunduh dan siap dipakai untuk login.',
        })
    }

    async function onVerifyEmail() {
        await verifyEmail(verifyToken.trim(), username)
        setVerifyToken('')
        setToast({ type: 'success', message: 'Verifikasi email berhasil.' })
    }

    async function onLogin() {
        setOtp('')

        if (loginStep === 'privateKey') {
            if (!loginPrivateKey.trim()) {
                setToast({
                    type: 'error',
                    message: formatMissingFieldsMessage(['Private Key']),
                })
                return
            }

            try {
                const response = await login(username, password, loginPrivateKey)

                if ('accessToken' in response) {
                    setLoginStep('credentials')
                    setToast({ type: 'success', message: 'Login berhasil.' })
                } else {
                    setLoginStep('otp')
                    setToast({ type: 'success', message: 'Masukkan OTP untuk melanjutkan login.' })
                }
            } catch(e) {
                const code = normalizeError(e)
                setToast({
                    type: 'error',
                    message: prettyErrorMessage(code),
                })
            }
            return
        }

        const missingFields: string[] = []
        if (!username.trim()) missingFields.push('Username / Email')
        if (!password.trim()) missingFields.push('Password')
        if (captcha?.enabled && !captchaAnswer.trim()) missingFields.push('Captcha')

        if (missingFields.length > 0) {
            setToast({
                type: 'error',
                message: formatMissingFieldsMessage(missingFields),
            })
            return
        }

        try {
            const response = await login(username, password, undefined, {
                captchaId: captcha?.captchaId ?? '',
                captchaAnswer,
            })

            if ('accessToken' in response) {
                setLoginStep('credentials')
                setCaptchaAnswer('')
                await loadCaptcha()
                setToast({ type: 'success', message: 'Login berhasil.' })
            } else {
                setLoginStep('otp')
                setCaptchaAnswer('')
                await loadCaptcha()
                setToast({ type: 'success', message: 'Masukkan OTP untuk melanjutkan login.' })
            }
        } catch (e) {
            const code = normalizeError(e)

            if (code === 'private_key_required') {
                setLoginStep('privateKey')
                setLoginPrivateKey('')
                setCaptchaAnswer('')
                await loadCaptcha()
                setToast({
                    type: 'success',
                    message: 'Captcha valid. Sekarang masukkan private key untuk melanjutkan login.',
                })
                return
            }

            setCaptchaAnswer('')
            await loadCaptcha()
            setToast({
                type: 'error',
                message: prettyErrorMessage(code),
            })
        }
    }

    async function onVerifyOtp() {
        await submitMfa(otp.trim())
        setOtp('')
        setToast({ type: 'success', message: 'OTP valid. Login berhasil.' })
    }

    async function onRotatePrivateKey() {
        const response = await rotatePrivateKey()
        downloadPrivateKeyFile(response.downloadFilename, response.downloadContent)
        setLoginPrivateKey(response.privateKey)
        setToast({ type: 'success', message: 'Private key baru berhasil dibuat dan otomatis terunduh.' })
    }

    async function onLogout() {
        setUsername('')
        setPassword('')
        setConfirmPassword('')
        setLoginPrivateKey('')
        setShowPassword(false)
        setShowConfirmPassword(false)
        setVerifyToken('')
        setOtp('')
        setCaptchaAnswer('')
        setAuthMode('login')
        setLoginStep('credentials')
        setTab('auth')
        await logout()
        setToast({ type: 'success', message: 'Logout berhasil.' })
    }

    function backToCredentialStep() {
        setLoginStep('credentials')
        setLoginPrivateKey('')
        setOtp('')
        setToast(null)
    }

    async function loadProfile() {
        if (!accessToken) return
        setProfileMsg('loading...')
        try {
            const p = await Api.getMyProfile(accessToken)
            setProfile(p)
            setProfileMsg('loaded')
        } catch {
            setProfileMsg('failed')
        }
    }

    async function saveProfile() {
        if (!accessToken) return
        setProfileMsg('saving...')
        try {
            await Api.updateMyProfile(accessToken, profile)
            setProfileMsg('saved')
            setToast({ type: 'success', message: 'Profile berhasil disimpan.' })
        } catch {
            setProfileMsg('failed')
        }
    }

    async function loadAdminUsers() {
        if (!accessToken) return
        setAdminMsg('loading...')
        try {
            const u = await Api.adminListUsers(accessToken)
            setAdminUsers(u)
            setAdminMsg('loaded')
        } catch {
            setAdminMsg('failed')
        }
    }

    async function adminDisable(id: number, disabled: boolean) {
        if (!accessToken) return
        setAdminMsg('updating...')
        try {
            await Api.adminDisableUser(accessToken, id, disabled)
            await loadAdminUsers()
            setAdminMsg('updated')
        } catch {
            setAdminMsg('failed')
        }
    }

    async function adminDelete(id: number, usernameText: string, role: string) {
        if (!accessToken) return
        if (role.toUpperCase() === 'ADMIN') {
            setAdminMsg('admin user cannot be deleted')
            return
        }

        const ok = window.confirm(`Delete user "${usernameText}" permanently?`)
        if (!ok) return

        setAdminMsg('deleting...')
        try {
            await Api.adminDeleteUser(accessToken, id)
            await loadAdminUsers()
            setAdminMsg('deleted')
        } catch {
            setAdminMsg('failed')
        }
    }

    async function adminSetRole(id: number) {
        if (!accessToken) return

        const currentRole = adminUsers?.find(u => u.id === id)?.role ?? ''
        const desiredRole = (roleDraftById[id] ?? currentRole).trim()
        if (!desiredRole) return
        if (desiredRole === currentRole) {
            setAdminMsg('no changes')
            return
        }

        setAdminMsg('updating role...')
        try {
            await Api.adminSetUserRole(accessToken, id, desiredRole)
            setRoleDraftById(prev => {
                const next = { ...prev }
                delete next[id]
                return next
            })
            await loadAdminUsers()
            setAdminMsg('role updated (user must re-login)')
        } catch {
            setAdminMsg('failed')
        }
    }

    async function loadRbac() {
        if (!accessToken) return
        setRbacMsg('loading...')
        try {
            const [r, p] = await Promise.all([
                Api.adminListRoles(accessToken),
                Api.adminListPermissions(accessToken),
            ])
            setRoles(r)
            setPerms(p)
            setSelectedRole(r.includes(selectedRole) ? selectedRole : (r[0] ?? 'BUYER'))
            setRbacMsg('loaded')
        } catch {
            setRbacMsg('failed')
        }
    }

    async function loadRolePerms(role: string) {
        if (!accessToken) return
        setRbacMsg('loading role perms...')
        try {
            const rp = await Api.adminListRolePerms(accessToken, role)
            setSelectedRolePerms(rp)
            setRbacMsg('loaded')
        } catch {
            setRbacMsg('failed')
        }
    }

    async function createRole() {
        if (!accessToken) return
        setRbacMsg('creating role...')
        try {
            await Api.adminCreateRole(accessToken, newRole)
            setNewRole('')
            await loadRbac()
            setRbacMsg('role created')
        } catch {
            setRbacMsg('failed')
        }
    }

    async function createPerm() {
        if (!accessToken) return
        setRbacMsg('creating permission...')
        try {
            await Api.adminCreatePermission(accessToken, newPermKey, newPermDesc)
            await loadRbac()
            setRbacMsg('permission created')
        } catch {
            setRbacMsg('failed')
        }
    }

    async function saveRolePerms() {
        if (!accessToken) return
        setRbacMsg('saving role perms...')
        try {
            await Api.adminSetRolePerms(accessToken, selectedRole, selectedRolePerms)
            setRbacMsg('saved')
        } catch {
            setRbacMsg('failed')
        }
    }

    useEffect(() => {
        setPhotoOk(true)
    }, [profile.photoUrl])

    useEffect(() => {
        if (!accessToken) return
        if (tab === 'profile') void loadProfile()
        if (tab === 'admin' && isAdmin) {
            void loadAdminUsers()
            void loadRbac()
            void loadRolePerms(selectedRole)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, accessToken])

    useEffect(() => {
        setShowPassword(false)
        setShowConfirmPassword(false)
        setLoginStep('credentials')
        setLoginPrivateKey('')
        setOtp('')
        setCaptchaAnswer('')
        setToast(null)
        void loadCaptcha()
    }, [authMode])

    useEffect(() => {
        if (user) return
        setUsername('')
        setPassword('')
        setConfirmPassword('')
        setShowPassword(false)
        setShowConfirmPassword(false)
        setVerifyToken('')
        setOtp('')
        setLoginPrivateKey('')
        setLoginStep('credentials')
        setOcrText('')
        setOcrProgress(null)
    }, [user])

    useEffect(() => {
        if (!error) return

        setToast({
            type: 'error',
            message: prettyErrorMessage(error),
        })
    }, [error])

    useEffect(() => {
        if (!toast) return
        const timer = window.setTimeout(() => setToast(null), 4200)
        return () => window.clearTimeout(timer)
    }, [toast])

    const tabs = useMemo<{ key: Tab; label: string; show: boolean }[]>(() => {
        const base: { key: Tab; label: string; show: boolean }[] = [
            { key: 'auth', label: 'Auth', show: true },
            { key: 'profile', label: 'Profile', show: !!user },
            { key: 'admin', label: 'Admin', show: !!user && isAdmin },
        ]
        return base.filter(t => t.show)
    }, [user, isAdmin])

    return (
        <div className="ap-root">
            <div className="ap-tabRow">
                {tabs.map((t: { key: Tab; label: string; show: boolean }) => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        disabled={loading}
                        style={tab === t.key ? activeTab : tabBtn}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === 'auth' && (
                <div style={{ ...card, position: 'relative' }} className="ap-card">
                    {toast ? (
                        <div className="ap-toastWrap">
                            <div role="alert" aria-live="assertive" className={`ap-toast ${toast.type === 'success' ? 'ap-toastSuccess' : 'ap-toastError'}`}>
                                <div className="ap-toastIcon">{toast.type === 'success' ? '✅' : '⚠️'}</div>
                                <div className="ap-toastBody">
                                    <div className="ap-toastTitle">{toast.type === 'success' ? 'Berhasil' : 'Error'}</div>
                                    <div className="ap-toastText">{toast.message}</div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setToast(null)}
                                    aria-label="Close notification"
                                    className="ap-toastClose"
                                >
                                    ×
                                </button>
                            </div>
                        </div>
                    ) : null}

                    {!user ? (
                        <div className="ap-authShell">
                            <div className="ap-authFormCard">
                                <div className="ap-authHeader">
                                    <h3 className="ap-authTitle">
                                        {authMode === 'register'
                                            ? 'Register'
                                            : showPrivateKeyStep
                                                ? 'Masukkan Private Key'
                                                : showLoginMfaBox
                                                    ? 'Verifikasi OTP'
                                                    : 'Login'}
                                    </h3>
                                    <p className="ap-authSubtitle">
                                        {authMode === 'register'
                                            ? 'Daftar akun baru untuk mulai memakai BidMart.'
                                            : showPrivateKeyStep
                                                ? 'Captcha dan kredensial sudah lolos. Sekarang masukkan private key.'
                                                : showLoginMfaBox
                                                    ? 'Masukkan kode OTP untuk menyelesaikan login.'
                                                    : 'Masuk untuk mulai bid, jual barang, dan kelola akunmu.'}
                                    </p>
                                </div>

                                <div className="ap-authModeRow">
                                    <button
                                        onClick={() => setAuthMode('login')}
                                        disabled={loading}
                                        style={authMode === 'login' ? activeTab : tabBtn}
                                    >
                                        Login
                                    </button>
                                    <button
                                        onClick={() => setAuthMode('register')}
                                        disabled={loading}
                                        style={authMode === 'register' ? activeTab : tabBtn}
                                    >
                                        Register
                                    </button>
                                </div>

                                <div className="ap-authFields">
                                    {authMode === 'register' ? (
                                        <>
                                            <label className="ap-field">
                                                <span className="ap-label">Username / Email</span>
                                                <input
                                                    value={username}
                                                    onChange={(e) => {
                                                        setUsername(e.target.value)
                                                        setVerifyToken('')
                                                        setToast(null)
                                                    }}
                                                    placeholder="Masukkan username atau email"
                                                />
                                            </label>

                                            <label className="ap-field">
                                                <span className="ap-label">Password</span>
                                                <div className="ap-passwordWrap">
                                                    <input
                                                        type={showPassword ? 'text' : 'password'}
                                                        value={password}
                                                        onChange={(e) => {
                                                            setPassword(e.target.value)
                                                            setToast(null)
                                                        }}
                                                        className="ap-passwordInput"
                                                        placeholder="Masukkan password"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPassword(v => !v)}
                                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                                        title={showPassword ? 'Hide password' : 'Show password'}
                                                        className="ap-eyeBtn"
                                                    >
                                                        <EyeIcon open={showPassword} />
                                                    </button>
                                                </div>
                                            </label>

                                            <label className="ap-field">
                                                <span className="ap-label">Tulis ulang password</span>
                                                <div className="ap-passwordWrap">
                                                    <input
                                                        type={showConfirmPassword ? 'text' : 'password'}
                                                        value={confirmPassword}
                                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                                        className="ap-passwordInput"
                                                        placeholder="Ulangi password"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowConfirmPassword(v => !v)}
                                                        aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                                                        title={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                                                        className="ap-eyeBtn"
                                                    >
                                                        <EyeIcon open={showConfirmPassword} />
                                                    </button>
                                                </div>
                                            </label>

                                            <label className="ap-field">
                                                <span className="ap-label">Nama terdeteksi dari {documentType}</span>
                                                <input
                                                    value={legalName}
                                                    readOnly
                                                    placeholder='Klik "Scan isi foto" untuk isi otomatis'
                                                />
                                            </label>

                                            <label className="ap-field">
                                                <span className="ap-label">Register as</span>
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

                                            <label className="ap-field">
                                                <span className="ap-label">Jenis dokumen</span>
                                                <select
                                                    value={documentType}
                                                    onChange={(e) => setDocumentType(e.target.value === 'KTM' ? 'KTM' : 'KTP')}
                                                >
                                                    <option value="KTP">KTP</option>
                                                    <option value="KTM">KTM</option>
                                                </select>
                                            </label>

                                            <label className="ap-field">
                                                <span className="ap-label">Upload foto {documentType}</span>
                                                <input
                                                    type="file"
                                                    accept="image/png,image/jpeg,image/jpg,image/webp"
                                                    onChange={(e) => {
                                                        const nextFile = e.target.files?.[0] ?? null
                                                        setDocumentFile(nextFile)
                                                        setOcrText('')
                                                        setOcrProgress(null)
                                                        setDetectedIdentityName('')
                                                        setLegalName('')
                                                    }}
                                                />
                                            </label>

                                            <div className="ap-subcard ap-registerDocCard" style={subcard}>
                                                <div className="ap-subcardTitle">Deteksi nama dari isi foto {documentType}</div>
                                                <div className="ap-helpText ap-helpInfo">
                                                    OCR akan membaca isi foto {documentType}, lalu sistem akan mengisi nama otomatis dari hasil pembacaan dokumen.
                                                </div>

                                                <div className="ap-inlineRow ap-toolbarRow" style={{ marginTop: 10 }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => void scanIdentityDocument()}
                                                        disabled={loading || isScanningDocument || !documentFile}
                                                    >
                                                        {isScanningDocument ? 'Scanning...' : 'Scan isi foto'}
                                                    </button>
                                                    <span className="ap-statusText">{formatOcrProgress(ocrProgress)}</span>
                                                </div>

                                                <textarea
                                                    value={ocrText}
                                                    onChange={(e) => setOcrText(e.target.value)}
                                                    placeholder="Hasil OCR dari isi foto akan muncul di sini"
                                                    rows={4}
                                                />

                                                {legalName.trim() ? (
                                                    <div className={`ap-helpText ${detectedNameVerified ? 'ap-helpOk' : 'ap-helpWarn'}`} style={{ marginTop: 8 }}>
                                                        {detectedNameVerified
                                                            ? `Nama terdeteksi dan tervalidasi: ${legalName}`
                                                            : 'Nama sudah terdeteksi, tetapi belum tervalidasi secara persis dari hasil OCR.'}
                                                    </div>
                                                ) : null}
                                            </div>
                                        </>
                                    ) : showLoginCredentialsStep ? (
                                        <>
                                            <label className="ap-field">
                                                <span className="ap-label">Username / Email</span>
                                                <input
                                                    value={username}
                                                    onChange={(e) => {
                                                        setUsername(e.target.value)
                                                        setVerifyToken('')
                                                        setOtp('')
                                                        setLoginPrivateKey('')
                                                        setLoginStep('credentials')
                                                        setToast(null)
                                                    }}
                                                    placeholder="Masukkan username atau email"
                                                />
                                            </label>

                                            <label className="ap-field">
                                                <span className="ap-label">Password</span>
                                                <div className="ap-passwordWrap">
                                                    <input
                                                        type={showPassword ? 'text' : 'password'}
                                                        value={password}
                                                        onChange={(e) => {
                                                            setPassword(e.target.value)
                                                            setLoginPrivateKey('')
                                                            setLoginStep('credentials')
                                                            setToast(null)
                                                        }}
                                                        className="ap-passwordInput"
                                                        placeholder="Masukkan password"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPassword(v => !v)}
                                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                                        title={showPassword ? 'Hide password' : 'Show password'}
                                                        className="ap-eyeBtn"
                                                    >
                                                        <EyeIcon open={showPassword} />
                                                    </button>
                                                </div>
                                            </label>

                                            {captcha?.enabled ? (
                                                <div style={subcard} className="ap-authSubcard">
                                                    <div className="ap-subcardTitle">Captcha</div>
                                                    <div className="ap-helpText ap-helpInfo">
                                                        Isi captcha dulu sebelum klik login.
                                                    </div>

                                                    {captcha.svgDataUri ? (
                                                        <div className="ap-captchaBox">
                                                            <img src={captcha.svgDataUri} alt="Captcha challenge" className="ap-captchaImage" />
                                                        </div>
                                                    ) : null}

                                                    <div className="ap-authInlineAction" style={{ marginTop: 12 }}>
                                                        <input
                                                            value={captchaAnswer}
                                                            onChange={(e) => setCaptchaAnswer(e.target.value)}
                                                            placeholder="Masukkan captcha"
                                                            autoComplete="off"
                                                            spellCheck={false}
                                                        />
                                                        <button type="button" onClick={() => void loadCaptcha()} disabled={loading}>
                                                            Refresh captcha
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : null}
                                        </>
                                    ) : showPrivateKeyStep ? (
                                        <div style={subcard} className="ap-authSubcard">
                                            <div className="ap-subcardTitle">Masukkan Private Key</div>
                                            <div className="ap-helpText ap-helpInfo">
                                                Captcha dan username/password sudah tervalidasi. Lanjutkan dengan private key.
                                            </div>

                                            <label className="ap-field" style={{ marginTop: 12 }}>
                                                <span className="ap-label">Private Key</span>
                                                <input
                                                    value={loginPrivateKey}
                                                    onChange={(e) => {
                                                        setLoginPrivateKey(e.target.value)
                                                        setToast(null)
                                                    }}
                                                    placeholder="Contoh: BMK1-ABCD-EFGH-2345"
                                                    autoComplete="one-time-code"
                                                />
                                            </label>

                                            <div className="ap-inlineRow" style={{ marginTop: 12 }}>
                                                <button type="button" onClick={backToCredentialStep} disabled={loading}>
                                                    Kembali
                                                </button>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>

                                <div className="ap-authSubmit">
                                    {authMode === 'register' ? (
                                        <button
                                            onClick={() => void onRegister()}
                                            disabled={loading || isScanningDocument}
                                            className="ap-primaryBtn"
                                        >
                                            Register
                                        </button>
                                    ) : showPrivateKeyStep ? (
                                        <button
                                            onClick={() => void onLogin()}
                                            disabled={loading || !loginPrivateKey.trim()}
                                            className="ap-primaryBtn"
                                        >
                                            Login
                                        </button>
                                    ) : showLoginCredentialsStep ? (
                                        <button
                                            onClick={() => void onLogin()}
                                            disabled={loading || (!!captcha?.enabled && !captchaAnswer.trim())}
                                            className="ap-primaryBtn"
                                        >
                                            Login
                                        </button>
                                    ) : null}
                                </div>

                                {showVerifyBox ? (
                                    <div style={subcard} className="ap-authSubcard">
                                        <div className="ap-subcardTitle">Email verification</div>
                                        <div className="ap-helpText ap-helpInfo">
                                            Registrasi berhasil. Masukkan kode verifikasi untuk menyelesaikan aktivasi akun.
                                        </div>

                                        <div className="ap-authInlineAction">
                                            <input
                                                value={verifyToken}
                                                onChange={(e) => {
                                                    setVerifyToken(e.target.value)
                                                    setToast(null)
                                                }}
                                                placeholder="Masukkan kode verifikasi"
                                                autoComplete="off"
                                                spellCheck={false}
                                            />
                                            <button onClick={() => void onVerifyEmail()} disabled={loading || !verifyToken.trim()}>
                                                Verify
                                            </button>
                                        </div>
                                    </div>
                                ) : null}

                                {showLoginMfaBox ? (
                                    <div style={subcard} className="ap-authSubcard">
                                        <div className="ap-subcardTitle">Verifikasi OTP</div>
                                        <div className="ap-helpText ap-helpInfo">
                                            Login membutuhkan OTP. Masukkan kode OTP untuk melanjutkan.
                                        </div>

                                        <div className="ap-authInlineAction">
                                            <input
                                                value={otp}
                                                onChange={(e) => {
                                                    setOtp(e.target.value)
                                                    setToast(null)
                                                }}
                                                placeholder="6 digit OTP"
                                                autoComplete="one-time-code"
                                                spellCheck={false}
                                            />
                                            <button onClick={() => void onVerifyOtp()} disabled={loading || !otp.trim()}>
                                                Verify OTP
                                            </button>
                                            <button
                                                onClick={() => {
                                                    cancelMfa()
                                                    backToCredentialStep()
                                                }}
                                                disabled={loading}
                                            >
                                                Cancel
                                            </button>
                                        </div>

                                        {pendingMfa?.devCode ? (
                                            <div className="ap-helpText ap-helpInfo" style={{ marginTop: 8 }}>
                                                Dev OTP: <b>{pendingMfa.devCode}</b>
                                            </div>
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    ) : (
                        <>
                            <h3 className="ap-title">Account</h3>
                            <div className="ap-userMeta">
                                Logged in as <b>{user.username}</b> ({user.role})
                            </div>

                            <div className="ap-inlineRow ap-primaryActions">
                                <button onClick={() => void onLogout()} disabled={loading}>Logout</button>
                                {user.role !== 'ADMIN' && (
                                    <button onClick={() => void onRotatePrivateKey()} disabled={loading}>
                                        Rotate & download private key
                                    </button>
                                )}
                                {user.role === 'BUYER' && (
                                    <button onClick={() => void becomeSeller()} disabled={loading}>Become a Seller</button>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}

            {tab === 'profile' && user && (
                <div style={card} className="ap-card">
                    <h3 className="ap-title">Profile</h3>

                    <div className="ap-profileGrid">
                        <div className="ap-previewCard">
                            <div className="ap-avatarLg" aria-label="Profile photo preview">
                                {profile.photoUrl && photoOk ? (
                                    <img
                                        src={profile.photoUrl}
                                        alt="Profile"
                                        referrerPolicy="no-referrer"
                                        onError={() => setPhotoOk(false)}
                                    />
                                ) : (
                                    <span aria-hidden="true">{initials(profile.displayName ?? user.username)}</span>
                                )}
                            </div>

                            <div className="ap-previewText">
                                <div className="ap-previewName">{profile.displayName?.trim() || user.username}</div>
                                <div className="ap-previewMeta">{user.username} · {user.role}</div>
                                <div className="ap-previewMeta">
                                    {profile.shippingAddress?.trim() || 'No shipping address yet'}
                                </div>
                            </div>
                        </div>

                        <div className="ap-editorCard">
                            <div className="ap-inlineRow ap-toolbarRow">
                                <button onClick={() => void loadProfile()} disabled={!canCall || loading}>Reload</button>
                                <span className="ap-statusText">{profileMsg}</span>
                            </div>

                            <div className="ap-formGrid">
                                <label className="ap-field">
                                    <span className="ap-label">Display name</span>
                                    <input
                                        value={profile.displayName ?? ''}
                                        onChange={(e) => setProfile(p => ({ ...p, displayName: e.target.value || null }))}
                                        placeholder="Masukkan nama tampilan"
                                    />
                                </label>

                                <label className="ap-field">
                                    <span className="ap-label">Photo URL</span>
                                    <input
                                        value={profile.photoUrl ?? ''}
                                        onChange={(e) => setProfile(p => ({ ...p, photoUrl: e.target.value || null }))}
                                        placeholder="https://..."
                                    />
                                </label>

                                <label className="ap-field" style={{ gridColumn: '1 / -1' }}>
                                    <span className="ap-label">Shipping address</span>
                                    <textarea
                                        value={profile.shippingAddress ?? ''}
                                        onChange={(e) => setProfile(p => ({ ...p, shippingAddress: e.target.value || null }))}
                                        placeholder="Masukkan alamat pengiriman"
                                        rows={4}
                                    />
                                </label>
                            </div>

                            <div className="ap-inlineRow ap-primaryActions">
                                <button onClick={() => void saveProfile()} disabled={!canCall || loading}>Save profile</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {tab === 'admin' && user && isAdmin && (
                <div style={card} className="ap-card">
                    <h3 className="ap-title">Admin</h3>

                    <div style={subcard} className="ap-subcard">
                        <div className="ap-subcardTitle">Users</div>

                        <div className="ap-inlineRow ap-toolbarRow">
                            <button onClick={() => void loadAdminUsers()} disabled={!canCall || loading}>Reload users</button>
                            <span className="ap-statusText">{adminMsg}</span>
                        </div>

                        {sortedAdminUsers?.length ? (
                            <div className="ap-tableWrap">
                                <table className="ap-table">
                                    <thead>
                                    <tr>
                                        <th style={th}>ID</th>
                                        <th style={th}>Username</th>
                                        <th style={th}>Role</th>
                                        <th style={th}>Disabled</th>
                                        <th style={th}>Created</th>
                                        <th style={th}>Actions</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {sortedAdminUsers.map(u => {
                                        const options = roles.length ? roles : ['ADMIN', 'BUYER', 'SELLER']
                                        return (
                                            <tr key={u.id}>
                                                <td style={td} data-label="ID">{u.id}</td>
                                                <td style={td} data-label="Username">{u.username}</td>
                                                <td style={td} data-label="Role">{u.role}</td>
                                                <td style={td} data-label="Disabled">{String(u.disabled)}</td>
                                                <td style={td} data-label="Created">{new Date(u.createdAt).toLocaleString()}</td>
                                                <td style={td} data-label="Actions">
                                                    <div className="ap-adminActionWrap">
                                                        <select
                                                            value={roleDraftById[u.id] ?? u.role}
                                                            onChange={(e) => setRoleDraftById(prev => ({ ...prev, [u.id]: e.target.value }))}
                                                            className="ap-roleSelect"
                                                        >
                                                            {options.map(r => <option key={r} value={r}>{r}</option>)}
                                                        </select>

                                                        <button onClick={() => void adminSetRole(u.id)} disabled={loading}>Set role</button>

                                                        <button onClick={() => void adminDisable(u.id, !u.disabled)} disabled={loading}>
                                                            {u.disabled ? 'Enable' : 'Disable'}
                                                        </button>

                                                        <button
                                                            onClick={() => void adminDelete(u.id, u.username, u.role)}
                                                            disabled={loading || u.role.toUpperCase() === 'ADMIN'}
                                                            title={u.role.toUpperCase() === 'ADMIN' ? 'Admin user cannot be deleted' : 'Delete user'}
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="ap-emptyState">No users loaded</div>
                        )}
                    </div>

                    <div style={subcard} className="ap-subcard">
                        <div className="ap-subcardTitle">RBAC (roles & permissions)</div>

                        <div className="ap-inlineRow ap-toolbarRow">
                            <button onClick={() => void loadRbac()} disabled={!canCall || loading}>Reload RBAC</button>
                            <span className="ap-statusText">{rbacMsg}</span>
                        </div>

                        <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
                            <div className="ap-inlineRow" style={{ gap: 12, flexWrap: 'wrap' }}>
                                <input
                                    placeholder="New role (e.g. MODERATOR)"
                                    value={newRole}
                                    onChange={(e) => setNewRole(e.target.value)}
                                />
                                <button onClick={() => void createRole()} disabled={loading || !newRole.trim()}>
                                    Create role
                                </button>
                            </div>

                            <div className="ap-inlineRow" style={{ gap: 12, flexWrap: 'wrap' }}>
                                <input
                                    placeholder="Permission key (e.g. bid:place)"
                                    value={newPermKey}
                                    onChange={(e) => setNewPermKey(e.target.value)}
                                />
                                <input
                                    placeholder="Description"
                                    value={newPermDesc}
                                    onChange={(e) => setNewPermDesc(e.target.value)}
                                />
                                <button onClick={() => void createPerm()} disabled={loading || !newPermKey.trim()}>
                                    Create permission
                                </button>
                            </div>

                            <div className="ap-inlineRow" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                                <label>
                                    Role:
                                    <select
                                        value={selectedRole}
                                        onChange={(e) => {
                                            const r = e.target.value
                                            setSelectedRole(r)
                                            void loadRolePerms(r)
                                        }}
                                    >
                                        {roles.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                </label>
                                <button onClick={() => void loadRolePerms(selectedRole)} disabled={loading}>
                                    Load role perms
                                </button>
                                <button onClick={() => void saveRolePerms()} disabled={loading}>
                                    Save role perms
                                </button>
                            </div>

                            <div style={{ display: 'grid', gap: 6 }}>
                                <div style={{ fontSize: 12, opacity: 0.8 }}>Permissions (tick to grant to role)</div>
                                <div style={{ display: 'grid', gap: 6, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
                                    {perms.map(p => {
                                        const checked = selectedRolePerms.includes(p.key)
                                        return (
                                            <label key={p.key} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => setSelectedRolePerms(prev => checked ? prev.filter(x => x !== p.key) : [...prev, p.key])}
                                                />
                                                <span>
                                                    <code>{p.key}</code>{' '}
                                                    <span style={{ opacity: 0.7 }}>{p.description ?? ''}</span>
                                                </span>
                                            </label>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

const card: CSSProperties = {
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: 16,
    background: '#fff',
    boxShadow: 'var(--shadow)',
}

const subcard: CSSProperties = {
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
    background: 'var(--bg-subtle)',
}

const tabBtn: CSSProperties = {
    padding: '8px 12px',
    borderRadius: 999,
    border: '1px solid var(--border)',
    background: '#fff',
}

const activeTab: CSSProperties = {
    ...tabBtn,
    fontWeight: 800,
    borderColor: 'var(--ebay-blue)',
    background: 'rgba(8, 106, 244, 0.08)',
}

const th: CSSProperties = {
    borderBottom: '1px solid #ccc',
    padding: 6,
    textAlign: 'left',
    whiteSpace: 'nowrap',
}

const td: CSSProperties = {
    borderBottom: '1px solid #eee',
    padding: 6,
    verticalAlign: 'top',
}