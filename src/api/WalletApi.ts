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

import { loadTokens } from '../auth/tokenStorage';

const getAuthHeaders = () => {
    const tokens = loadTokens();
    const token = tokens?.accessToken;
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
};

export const getWalletInfo = async (): Promise<WalletInfo> => {
    const res = await fetch(`/api/wallet/me/info`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch wallet info');
    return res.json();
};

export const topUpWallet = async (amount: number): Promise<void> => {
    const res = await fetch(`/api/wallet/me/topup`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ amount })
    });
    if (!res.ok) throw new Error('Failed to top up wallet');
};

export const withdrawWallet = async (amount: number): Promise<void> => {
    const res = await fetch(`/api/wallet/me/withdraw`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ amount })
    });
    if (!res.ok) throw new Error(await res.text());
};

export const getWalletHistory = async (): Promise<WalletTransaction[]> => {
    const res = await fetch(`/api/wallet/me/history`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch wallet history');
    return res.json();
};
