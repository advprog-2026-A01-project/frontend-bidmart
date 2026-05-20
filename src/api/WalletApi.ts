import { apiFetch } from './http';
import type { WalletInfo, WalletTransaction } from '../types/WalletTypes';
import { loadTokens } from '../auth/tokenStorage';

const getAccessToken = () => {
    const tokens = loadTokens();
    return tokens?.accessToken;
};

export const getWalletInfo = async (): Promise<WalletInfo> => {
    const accessToken = getAccessToken();
    if (!accessToken) throw new Error('Unauthorized');
    return apiFetch('/api/wallet/me/info', { accessToken });
};

export const topUpWallet = async (amount: number): Promise<void> => {
    const accessToken = getAccessToken();
    if (!accessToken) throw new Error('Unauthorized');
    return apiFetch('/api/wallet/me/topup', {
        method: 'POST',
        accessToken,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount })
    });
};

export const withdrawWallet = async (amount: number): Promise<void> => {
    const accessToken = getAccessToken();
    if (!accessToken) throw new Error('Unauthorized');
    return apiFetch('/api/wallet/me/withdraw', {
        method: 'POST',
        accessToken,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount })
    });
};

export const getWalletHistory = async (): Promise<WalletTransaction[]> => {
    const accessToken = getAccessToken();
    if (!accessToken) throw new Error('Unauthorized');
    return apiFetch('/api/wallet/me/history', { accessToken });
};