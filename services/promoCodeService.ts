import { apiClient } from './apiClient';
import { publicAppUrl } from './publicAppUrl';

// Shapes mirror contracts/promo-codes-contract.md (IAM service).

export interface PromoCode {
  id: string;
  code: string;
  freeDays: number;
  /** 0 = unlimited redemptions */
  maxRedemptions: number;
  redemptionCount: number;
  /** null = never expires */
  expiresAt: string | null;
  active: boolean;
  createdBy?: string | null;
  created?: string;
  updated?: string;
}

export interface PromoCodeListResponse {
  items: PromoCode[];
  total: number;
  page: number;
}

export interface CreatePromoCodeRequest {
  code: string;
  freeDays: number;
  maxRedemptions?: number;
  expiresAt?: string;
}

export interface UpdatePromoCodeRequest {
  code: string;
  active?: boolean;
  freeDays?: number;
  maxRedemptions?: number;
  /** RFC3339 timestamp, or '' to clear the expiry */
  expiresAt?: string;
}

/**
 * Where a scanned promo QR code lands. The app redeems it on the spot for a
 * signed-in user, and otherwise carries it through signup so the code is applied
 * in the same request that creates the account.
 */
export const promoRedeemUrl = (code: string): string =>
  publicAppUrl(`/redeem?promo_code=${encodeURIComponent(code.trim().toUpperCase())}`);

export type PromoStatus = 'Active' | 'Inactive' | 'Expired' | 'Exhausted';

/**
 * Whether a code would actually redeem right now. Lives here rather than in the
 * manager view because the QR modal has to warn about the same three dead states
 * before anyone sends the code to a printer.
 */
export const getPromoStatus = (promo: PromoCode): PromoStatus => {
  if (!promo.active) return 'Inactive';
  if (promo.expiresAt && new Date(promo.expiresAt).getTime() < Date.now()) return 'Expired';
  if (promo.maxRedemptions > 0 && promo.redemptionCount >= promo.maxRedemptions) return 'Exhausted';
  return 'Active';
};

export const promoCodeService = {
  listPromoCodes: async (page = 1, limit = 10, search = ''): Promise<PromoCodeListResponse> => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    if (search.trim()) {
      params.set('q', search.trim());
    }

    return apiClient.get<PromoCodeListResponse>('IAM', `/promo-codes?${params.toString()}`);
  },

  createPromoCode: async (payload: CreatePromoCodeRequest): Promise<PromoCode> => {
    const body: CreatePromoCodeRequest = {
      code: payload.code.trim().toUpperCase(),
      freeDays: payload.freeDays,
    };
    if (payload.maxRedemptions && payload.maxRedemptions > 0) {
      body.maxRedemptions = payload.maxRedemptions;
    }
    if (payload.expiresAt) {
      body.expiresAt = payload.expiresAt;
    }

    return apiClient.post<PromoCode>('IAM', '/promo-codes', body);
  },

  updatePromoCode: async (payload: UpdatePromoCodeRequest): Promise<PromoCode> => {
    return apiClient.put<PromoCode>('IAM', '/promo-codes', {
      ...payload,
      code: payload.code.trim().toUpperCase(),
    });
  },

  setPromoCodeActive: async (code: string, active: boolean): Promise<PromoCode> => {
    return apiClient.put<PromoCode>('IAM', '/promo-codes', {
      code: code.trim().toUpperCase(),
      active,
    });
  },
};
