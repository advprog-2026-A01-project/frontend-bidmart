import { useEffect, useState } from 'react'
import './App.css'
import { useAuth } from './auth/useAuth'
import { AccountPanel } from './auth/AccountPanel'
import { WalletPanel } from './components/wallet/WalletPanel'
import { AuthProvider } from './auth/AuthContext'

function HomePage() {
    const { user } = useAuth()
    const [showAccount, setShowAccount] = useState(false)
    const [showWallet, setShowWallet] = useState(false)
    const [q, setQ] = useState('')

    // Better UX: close modal on ESC
    useEffect(() => {
        if (!showAccount && !showWallet) return
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setShowAccount(false)
                setShowWallet(false)
            }
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [showAccount, showWallet])

    const who = user ? user.username : 'Guest'
    const whoInitial = (who.trim()[0] ?? 'G').toUpperCase()

    return (
        <>
            <header className="bm-header">
                <div className="container bm-header__inner">
                    <a className="bm-logo" href="#" aria-label="BidMart">
                        <span className="c1">B</span><span className="c2">i</span><span className="c3">d</span><span className="c4">Mart</span>
                        <span className="bm-logoBadge" aria-label="Version A01">A01</span>
                    </a>

                    <div className="bm-search" role="search">
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Search for anything"
                            aria-label="Search"
                        />
                        <button className="bm-btnPrimary" onClick={() => void 0} aria-label="Search">
                            Search
                        </button>
                    </div>

                    <div className="bm-user">
                        <span className="bm-avatar" aria-hidden="true">{whoInitial}</span>
                        <span className="bm-pill">
                            {user ? (
                                <>Hi, <b>{user.username}</b> <span className="bm-muted">({user.role})</span></>
                            ) : (
                                <span className="bm-muted">Guest</span>
                            )}
                        </span>
                        <button className="bm-btnGhost" onClick={() => setShowAccount(true)} aria-haspopup="dialog">
                            Account
                        </button>
                        {user && (
                            <button className="bm-btnPrimary" onClick={() => setShowWallet(true)} aria-haspopup="dialog" style={{marginLeft: '8px'}}>
                                Wallet
                            </button>
                        )}
                    </div>
                </div>

                <nav className="bm-nav" aria-label="Primary">
                    <div className="container bm-nav__inner">
                        <a href="#">Motors</a>
                        <a href="#">Electronics</a>
                        <a href="#">Collectibles</a>
                        <a href="#">Fashion</a>
                        <a href="#">Home & Garden</a>
                        <a href="#">Sports</a>
                        <a href="#">Toys</a>
                        <a href="#">Daily deals</a>
                    </div>
                </nav>
            </header>

            <main className="container bm-main">
                <section className="bm-hero">
                    <h1>Browse auctions</h1>
                    <p className="bm-muted" style={{ margin: '8px 0 0' }}>
                        Browse listings without signing in. Sign in is required to bid, sell, and manage wallet.
                    </p>
                </section>

                <section style={{ marginTop: 16 }}>
                    <div className="bm-grid">
                        <div className="bm-card">
                            <p className="bm-cardTitle">Popular item #1</p>
                            <p className="bm-cardMeta">Starting at $10 · Ends in 2h</p>
                        </div>
                        <div className="bm-card">
                            <p className="bm-cardTitle">Popular item #2</p>
                            <p className="bm-cardMeta">Starting at $35 · Ends tomorrow</p>
                        </div>
                        <div className="bm-card">
                            <p className="bm-cardTitle">Popular item #3</p>
                            <p className="bm-cardMeta">Starting at $7 · Ends in 5h</p>
                        </div>
                    </div>
                </section>
            </main>

            {showAccount && (
                <div
                    className="bm-overlay"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Account"
                    onMouseDown={(e) => {
                        if (e.target === e.currentTarget) setShowAccount(false)
                    }}
                >
                    <div className="bm-modal">
                        <div className="bm-modalHeader">
                            <h2>Account</h2>
                            <button className="bm-btnGhost" onClick={() => setShowAccount(false)} aria-label="Close account dialog">
                                Close
                            </button>
                        </div>
                        <div className="bm-modalBody">
                            <AccountPanel />
                        </div>
                    </div>
                </div>
            )}

            {showWallet && (
                <div
                    className="bm-overlay"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Wallet"
                    onMouseDown={(e) => {
                        if (e.target === e.currentTarget) setShowWallet(false)
                    }}
                >
                    <WalletPanel onClose={() => setShowWallet(false)} />
                </div>
            )}
        </>
    )
}

export default function App() {
    return (
        <AuthProvider>
            <HomePage />
        </AuthProvider>
    )
}