import React, { useEffect, useState } from 'react';
import { getAuctions, placeBid } from '../../api/BiddingApi';
import type { Auction } from '../../types/BiddingTypes';
import { useAuth } from '../../auth/useAuth';
import './BiddingPanel.css';

const MOCK_ITEM_CATALOG: Record<number, { title: string; image: string; description: string }> = {
    1: { title: "Vintage Leather Jacket", image: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&q=80", description: "Authentic 1980s leather jacket in pristine condition." },
    2: { title: "Classic Analog Watch", image: "https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=400&q=80", description: "Water resistant classic analog watch with leather strap." },
    3: { title: "Professional Camera", image: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400&q=80", description: "High performance mirrorless camera body." },
};

const getMockItem = (itemId: number) => MOCK_ITEM_CATALOG[itemId] || {
    title: `Premium Item #${itemId}`,
    image: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=400&q=80",
    description: "Exclusive item currently up for auction."
};

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

function extractErrorMessage(err: unknown): string {
    if (err instanceof Error) {
        const extended = err as Error & { status?: number; payload?: unknown };
        // Try to extract a meaningful message from the payload
        if (extended.payload) {
            if (typeof extended.payload === 'object' && extended.payload !== null) {
                const p = extended.payload as Record<string, unknown>;
                if (typeof p.message === 'string') return p.message;
                if (typeof p.error === 'string') return p.error;
            }
            if (typeof extended.payload === 'string' && extended.payload.length > 0 && extended.payload.length < 200) {
                return extended.payload;
            }
        }
        // If status is available, provide a user-friendly message
        if (extended.status === 401) return 'Please sign in to view auctions.';
        if (extended.status === 403) return 'You do not have permission to access auctions.';
        if (extended.status === 404) return 'Auction not found.';
        if (extended.status === 500) return 'Server error. Please try again later.';
        if (extended.status === 502 || extended.status === 503) return 'Auction service is currently unavailable. Please try again later.';
    }
    return 'Failed to load auctions. Please try again.';
}

export const BiddingPanel: React.FC = () => {
    const { user, tokens } = useAuth();
    const accessToken = tokens?.accessToken ?? null;

    const [auctions, setAuctions] = useState<Auction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null);
    const [bidAmount, setBidAmount] = useState('');
    const [biddingState, setBiddingState] = useState<'idle' | 'bidding' | 'success' | 'error'>('idle');
    const [biddingMessage, setBiddingMessage] = useState('');

    const fetchAuctions = async () => {
        try {
            setLoading(true);
            const data = await getAuctions(accessToken ?? undefined);
            setAuctions(data);
            setError('');
        } catch (err: unknown) {
            setError(extractErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAuctions();
    }, [accessToken]); // re-fetch when auth state changes

    const handleBidClick = (auction: Auction) => {
        if (!user) {
            alert('Please sign in to place a bid.');
            return;
        }
        setSelectedAuction(auction);
        const minBid = auction.currentHighestBid + auction.minimumIncrement;
        setBidAmount(minBid.toString());
        setBiddingState('idle');
        setBiddingMessage('');
    };

    const submitBid = async () => {
        if (!selectedAuction || !user || !accessToken) return;
        const amount = parseFloat(bidAmount);
        if (isNaN(amount)) {
            setBiddingState('error');
            setBiddingMessage('Please enter a valid amount.');
            return;
        }
        const minBid = selectedAuction.currentHighestBid + selectedAuction.minimumIncrement;
        if (amount < minBid) {
            setBiddingState('error');
            setBiddingMessage(`Minimum bid is ${formatCurrency(minBid)}`);
            return;
        }

        try {
            setBiddingState('bidding');
            await placeBid(selectedAuction.id, { userId: (user as {id?: number}).id || 1, amount }, accessToken);
            setBiddingState('success');
            setBiddingMessage('Bid placed successfully!');
            setTimeout(() => {
                setSelectedAuction(null);
                fetchAuctions();
            }, 2000);
        } catch (err: unknown) {
            setBiddingState('error');
            setBiddingMessage(extractErrorMessage(err));
        }
    };

    if (loading) {
        return <div className="bidding-loading">Loading exclusive auctions...</div>;
    }

    if (error) {
        return (
            <div className="bidding-error">
                <p>{error}</p>
                <button
                    onClick={fetchAuctions}
                    style={{ marginTop: 8, padding: '6px 16px', fontSize: 13, cursor: 'pointer' }}
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="bidding-container">
            <div className="bidding-grid">
                {auctions.map(auction => {
                    const item = getMockItem(auction.itemId);
                    const isClosed = auction.status === 'CLOSED';
                    return (
                        <div key={auction.id} className={`bidding-card ${isClosed ? 'closed' : ''}`}>
                            <div className="bidding-card-image-wrapper">
                                <img src={item.image} alt={item.title} className="bidding-card-image" />
                                <div className={`bidding-status-badge ${auction.status.toLowerCase()}`}>
                                    {auction.status}
                                </div>
                            </div>
                            <div className="bidding-card-content">
                                <h3 className="bidding-card-title">{item.title}</h3>
                                <p className="bidding-card-desc">{item.description}</p>
                                <div className="bidding-card-meta">
                                    <div className="meta-item">
                                        <span className="meta-label">Highest Bid</span>
                                        <span className="meta-value highlight">{formatCurrency(auction.currentHighestBid)}</span>
                                    </div>
                                    <div className="meta-item">
                                        <span className="meta-label">Ends In</span>
                                        <span className="meta-value">{new Date(auction.endTime).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                <button 
                                    className="bidding-btn-primary" 
                                    onClick={() => handleBidClick(auction)}
                                    disabled={isClosed}
                                >
                                    {isClosed ? 'Auction Closed' : 'Place Bid'}
                                </button>
                            </div>
                        </div>
                    );
                })}
                {auctions.length === 0 && (
                    <div className="bidding-empty">No active auctions at the moment.</div>
                )}
            </div>

            {selectedAuction && (
                <div className="bidding-modal-overlay" onMouseDown={(e) => { if(e.target === e.currentTarget) setSelectedAuction(null); }}>
                    <div className="bidding-modal">
                        <div className="bidding-modal-header">
                            <h2>Place Your Bid</h2>
                            <button className="bidding-btn-close" onClick={() => setSelectedAuction(null)}>×</button>
                        </div>
                        <div className="bidding-modal-body">
                            <div className="modal-item-info">
                                <img src={getMockItem(selectedAuction.itemId).image} alt="" className="modal-img" />
                                <div>
                                    <h3>{getMockItem(selectedAuction.itemId).title}</h3>
                                    <p>Current Highest: <strong>{formatCurrency(selectedAuction.currentHighestBid)}</strong></p>
                                    <p>Min Increment: <strong>{formatCurrency(selectedAuction.minimumIncrement)}</strong></p>
                                </div>
                            </div>
                            <div className="modal-input-group">
                                <label>Your Bid Amount</label>
                                <input 
                                    type="number" 
                                    value={bidAmount} 
                                    onChange={(e) => setBidAmount(e.target.value)} 
                                    min={selectedAuction.currentHighestBid + selectedAuction.minimumIncrement}
                                    step={0.01}
                                />
                            </div>
                            {biddingMessage && (
                                <div className={`bidding-alert ${biddingState}`}>{biddingMessage}</div>
                            )}
                            <button 
                                className="bidding-btn-submit" 
                                onClick={submitBid}
                                disabled={biddingState === 'bidding' || biddingState === 'success'}
                            >
                                {biddingState === 'bidding' ? 'Processing...' : 'Confirm Bid'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
