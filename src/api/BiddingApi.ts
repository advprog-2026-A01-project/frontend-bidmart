import { apiFetch } from './http';
import type { Auction, BidRequest, BidResponse } from '../types/BiddingTypes';
import { loadTokens } from '../auth/tokenStorage';

const getAccessToken = () => {
    const tokens = loadTokens();
    return tokens?.accessToken;
};

export const getAuctions = async (accessToken?: string): Promise<Auction[]> => {
    return apiFetch('/api/auctions', { accessToken: accessToken || getAccessToken() });
};

export const getAuctionById = async (auctionId: number, accessToken?: string): Promise<Auction> => {
    return apiFetch(`/api/auctions/${auctionId}`, { accessToken: accessToken || getAccessToken() });
};

export const placeBid = async (auctionId: number, request: BidRequest, accessToken?: string): Promise<BidResponse> => {
    const token = accessToken || getAccessToken();
    if (!token) throw new Error('Unauthorized');

    return apiFetch(`/api/auctions/${auctionId}/bids`, {
        method: 'POST',
        accessToken: token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
    });
};