export interface WalletInfo {
    availableBalance: number;
    heldBalance: number;
}

export interface WalletTransaction {
    id: string;
    userId: number;
    type: string;
    amount: number;
    createdAt: string;
}