import { useEffect, useState } from 'react';
import type { WalletInfo, WalletTransaction } from '../../api/WalletApi';
import { getWalletInfo, getWalletHistory, topUpWallet, withdrawWallet } from '../../api/WalletApi';
import { useAuth } from '../../auth/useAuth';
import './WalletPanel.css';

interface WalletPanelProps {
    onClose?: () => void;
}

export function WalletPanel({ onClose }: WalletPanelProps) {
    const { user } = useAuth();
    const [info, setInfo] = useState<WalletInfo | null>(null);
    const [history, setHistory] = useState<WalletTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [actionAmount, setActionAmount] = useState('');
    const [error, setError] = useState('');

    const formatCurrency = (amount: number) => {
        const formatted = new Intl.NumberFormat('id-ID', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
        return `Rp ${formatted}`;
    };

    const loadData = async () => {
        try {
            const [wInfo, wHistory] = await Promise.all([
                getWalletInfo(),
                getWalletHistory()
            ]);
            setInfo(wInfo);
            setHistory(wHistory);
            setError('');
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Failed to load wallet data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            setLoading(true);
            loadData();
        }
    }, [user]);

    const handleAction = async (actionFn: (amt: number) => Promise<void>) => {
        setError('');
        const amt = parseFloat(actionAmount);
        if (isNaN(amt) || amt <= 0) {
            return setError('Please enter a valid amount greater than 0.');
        }

        setIsProcessing(true);
        try {
            await actionFn(amt);
            setActionAmount('');
            await loadData();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Action failed');
        } finally {
            setIsProcessing(false);
        }
    };

    const getTransactionIcon = (type: string) => {
        switch (type) {
            case 'TOPUP': return '↓';
            case 'WITHDRAW': return '↑';
            case 'HOLD': return '🔒';
            case 'RELEASE': return '🔓';
            case 'PAYMENT': return '✓';
            default: return '•';
        }
    };

    const getTransactionSign = (type: string) => {
        if (['WITHDRAW', 'HOLD', 'PAYMENT'].includes(type)) return '-';
        if (['TOPUP', 'RELEASE'].includes(type)) return '+';
        return '';
    };

    if (loading && !info) {
        return (
            <div className="wallet-panel wallet-loading">
                <div className="wallet-loading-spinner"></div>
                <div>Loading your wallet securely...</div>
            </div>
        );
    }

    return (
        <div className="wallet-panel">
            {onClose && (
                <button 
                    className="bm-btnGhost" 
                    onClick={onClose} 
                    style={{ position: 'absolute', top: '16px', right: '16px', padding: '8px 12px', border: 'none', background: 'transparent' }}
                    aria-label="Close"
                >
                    ✕
                </button>
            )}
            <header className="wallet-header">
                <h2>Wallet</h2>
                <p className="wallet-subtitle">View and manage your balance.</p>
            </header>

            {error && <div className="wallet-alert-error">{error}</div>}

            <div className="wallet-cards">
                <div className="wallet-card primary">
                    <div className="label">Available Balance</div>
                    <div className="amount">{info ? formatCurrency(info.availableBalance) : 'Rp 0,00'}</div>
                </div>
                <div className="wallet-card secondary">
                    <div className="label">Held in Bids</div>
                    <div className="amount">{info ? formatCurrency(info.heldBalance) : 'Rp 0,00'}</div>
                </div>
            </div>

            <div className="wallet-actions">
                <h3>Top-up & Withdraw</h3>
                <div className="action-row">
                    <input
                        type="number"
                        placeholder="Amount (Rp)"
                        value={actionAmount}
                        onChange={e => setActionAmount(e.target.value)}
                        min="1"
                        step="0.01"
                        disabled={isProcessing}
                        aria-label="Transaction amount"
                    />
                    <button 
                        className="bm-btnPrimary" 
                        onClick={() => handleAction(topUpWallet)}
                        disabled={isProcessing || !actionAmount}
                    >
                        {isProcessing ? 'Processing...' : 'Top Up'}
                    </button>
                    <button 
                        className="bm-btnGhost action-withdraw" 
                        onClick={() => handleAction(withdrawWallet)}
                        disabled={isProcessing || !actionAmount}
                    >
                        Withdraw
                    </button>
                </div>
            </div>

            <div className="wallet-history">
                <h3>Recent Activity</h3>
                {history.length === 0 ? (
                    <div className="empty-state">
                        No transactions found.
                    </div>
                ) : (
                    <ul className="history-list">
                        {history.map(tx => (
                            <li key={tx.id} className="history-item">
                                <div className="history-icon" data-type={tx.type} aria-hidden="true">
                                    {getTransactionIcon(tx.type)}
                                </div>
                                <div className="history-details">
                                    <span className="history-type">
                                        {tx.type.charAt(0) + tx.type.slice(1).toLowerCase()}
                                    </span>
                                    <span className="history-date">
                                        {new Date(tx.createdAt).toLocaleString(undefined, {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </span>
                                </div>
                                <div className={`history-amount ${['WITHDRAW', 'HOLD', 'PAYMENT'].includes(tx.type) ? 'negative' : 'positive'}`}>
                                    {getTransactionSign(tx.type)}{formatCurrency(tx.amount)}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}