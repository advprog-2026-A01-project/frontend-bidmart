import { apiFetch } from './http';
import type { Auction, BidRequest, BidResponse } from '../types/BiddingTypes';

export const getAuctions = async (accessToken?: string): Promise<Auction[]> => {
    return apiFetch('/api/auctions', {
        ...(accessToken ? { accessToken } : {}),
    });
};

export const getAuctionById = async (auctionId: number, accessToken?: string): Promise<Auction> => {
    return apiFetch(`/api/auctions/${auctionId}`, {
        ...(accessToken ? { accessToken } : {}),
    });
};

export const placeBid = async (auctionId: number, request: BidRequest, accessToken: string): Promise<BidResponse> => {
    return apiFetch(`/api/auctions/${auctionId}/bids`, {
        method: 'POST',
        accessToken,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
    });
};
