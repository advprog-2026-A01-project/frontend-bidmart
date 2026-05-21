export interface Auction {
    id: number;
    itemId: number;
    startingPrice: number;
    currentHighestBid: number;
    minimumIncrement: number;
    currentHighestBidderId: number | null;
    startTime: string;
    endTime: string;
    status: 'PENDING' | 'ACTIVE' | 'CLOSED' | 'EXTENDED';
}

export interface BidRequest {
    userId: number;
    amount: number;
}

export interface BidResponse {
    bidId: number;
    auctionId: number;
    userId: number;
    bidAmount: number;
    status: 'ACTIVE' | 'OUTBID' | 'REFUNDED';
}
