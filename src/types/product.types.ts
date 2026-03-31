export type ProductStatus = 'pending' | 'active' | 'approved' | 'rejected' | 'out_of_stock';

export interface Product {
  $id: string;
  sellerId: string;
  name: string;
  description: string;
  images: string[];
  price: number;
  category: string;
  region: string;
  state: string;
  stock: number;
  status: ProductStatus;
  rating: number;
  reviewCount: number;
  views: number;
  featured: boolean;
  deliveryOption?: 'pickup' | 'delivery' | 'both';
  tags?: string[];
  sellerVerified?: boolean;
  sellerLocationLabel?: string;
  sellerTrustScore?: number;
  topArtisan?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductDTO {
  sellerId: string;
  name: string;
  category: string;
  price: number;
  description: string;
  images: string[];
  region: string;
  state: string;
  quantity: number;
  stock?: number;
  deliveryOption?: 'pickup' | 'delivery' | 'both';
}

export interface UpdateProductDTO {
  name?: string;
  category?: string;
  price?: number;
  description?: string;
  images?: string[];
  stock?: number;
  region?: string;
  state?: string;
  status?: string;
}

export interface ApproveProductDTO {
  productId: string;
  status: 'active' | 'rejected';
  reason?: string;
  adminId: string;
}

export interface ProductFilters {
  region?: string;
  category?: string;
  localityQuery?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  deliveryAvailable?: boolean;
  verifiedSellers?: boolean;
  topArtisansOnly?: boolean;
  sortBy?: 'price_asc' | 'price_desc' | 'rating' | 'newest' | 'trending' | 'trust_high';
  searchQuery?: string;
}
