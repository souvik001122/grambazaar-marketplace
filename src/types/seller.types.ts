export interface Seller {
  $id: string;
  userId: string;
  businessName: string;
  description: string;
  region: string;
  state: string;
  city: string;
  address: string;
  village?: string;
  district?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  craftType: string;
  verificationStatus: 'pending' | 'approved' | 'rejected' | 'blocked';
  verificationDocuments: string[];
  isShopActive: boolean;
  verifiedBadge: boolean;
  rating: number;
  totalOrders: number;
  paymentUpiId?: string;
  paymentQrImageUrl?: string;
  paymentBankAccountName?: string;
  paymentBankAccountNumber?: string;
  paymentBankIfsc?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSellerDTO {
  userId: string;
  shopName: string;
  craftType: string;
  skills: string;
  phone: string;
  address: string;
  village?: string;
  district: string;
  locality: string;
  state: string;
  latitude?: number;
  longitude?: number;
  documents?: string[];
}

export interface UpdateSellerDTO {
  businessName?: string;
  description?: string;
  region?: string;
  state?: string;
  city?: string;
  address?: string;
  village?: string;
  district?: string;
  locality?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  craftType?: string;
  paymentUpiId?: string;
  paymentQrImageUrl?: string;
  paymentBankAccountName?: string;
  paymentBankAccountNumber?: string;
  paymentBankIfsc?: string;
}

export interface VerifySellerDTO {
  sellerId: string;
  status: 'approved' | 'rejected';
  reason?: string;
  adminId: string;
}
