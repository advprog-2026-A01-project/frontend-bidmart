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

export const BiddingPanel: React.FC = () => {
    const { user } = useAuth();
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
            const data = await getAuctions();
            setAuctions(data);
            setError('');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load auctions');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAuctions();
    }, []);

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
        if (!selectedAuction || !user) return;
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
            await placeBid(selectedAuction.id, { userId: (user as {id?: number}).id || 1, amount });
            setBiddingState('success');
            setBiddingMessage('Bid placed successfully!');
            setTimeout(() => {
                setSelectedAuction(null);
                fetchAuctions();
            }, 2000);
        } catch (err: unknown) {
            setBiddingState('error');
            setBiddingMessage(err instanceof Error ? err.message : 'Failed to place bid');
        }
    };

    if (loading) {
        return <div className="bidding-loading">Loading exclusive auctions...</div>;
    }

    if (error) {
        return <div className="bidding-error">{error}</div>;
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
