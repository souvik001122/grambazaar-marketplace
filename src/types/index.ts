// User roles
export type UserRole = 'buyer' | 'seller' | 'admin';

// User interface
export interface User {
  $id: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  profileImage?: string;
  createdAt: string;
  updatedAt: string;
}

// Seller verification status
export type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'blocked';

// Seller interface
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
  verificationStatus: VerificationStatus;
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

// Product status
export type ProductStatus = 'pending' | 'active' | 'approved' | 'rejected' | 'out_of_stock';

// Product interface
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
  featured: boolean;
  rating: number;
  reviewCount: number;
  views: number;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

// Category interface
export interface Category {
  $id: string;
  name: string;
  icon: string;
  description: string;
  image?: string;
  sortOrder: number;
  isActive: boolean;
}

// Saved product (wishlist)
export interface SavedProduct {
  $id: string;
  userId: string;
  productId: string;
  createdAt: string;
}

// Order status
export type OrderStatus = 
  | 'pending' 
  | 'processing' 
  | 'shipped' 
  | 'delivered' 
  | 'cancelled'
  | 'refunded';

// Order item
export interface OrderItem {
  productId: string;
  productName: string;
  productImage: string;
  quantity: number;
  price: number;
  sellerId: string;
}

// Order interface
export interface Order {
  $id: string;
  buyerId: string;
  sellerId: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  paymentId?: string;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  deliveryAddress: string;
  deliveryTime?: string;
  courierName?: 'India Post' | 'DTDC' | 'Blue Dart' | 'Delhivery' | 'Other';
  trackingId?: string;
  shippingDate?: string;
  trackingInfo?: string;
  createdAt: string;
  updatedAt: string;
}

// Cart item
export interface CartItem {
  product: Product;
  quantity: number;
}

// Address
export interface Address {
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
}

// Payment
export interface Payment {
  orderId: string;
  amount: number;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  status: 'pending' | 'success' | 'failed';
}
