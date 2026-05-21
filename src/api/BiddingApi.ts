import { apiFetch } from './http';
import type { Auction, BidRequest, BidResponse } from '../types/BiddingTypes';
import { loadTokens } from '../auth/tokenStorage';

const getAccessToken = () => {
    const tokens = loadTokens();
    return tokens?.accessToken;
};

export const getAuctions = async (): Promise<Auction[]> => {
    return apiFetch('/api/auctions', {});
};

export const getAuctionById = async (auctionId: number): Promise<Auction> => {
    return apiFetch(`/api/auctions/${auctionId}`, {});
};

export const placeBid = async (auctionId: number, request: BidRequest): Promise<BidResponse> => {
    const accessToken = getAccessToken();
    if (!accessToken) throw new Error('Unauthorized');
    
    return apiFetch(`/api/auctions/${auctionId}/bids`, {
        method: 'POST',
        accessToken,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
    });
};
