export const APP_CONFIG = {
  // App Info
  APP_NAME: 'GramBazaar',
  APP_VERSION: '1.0.0',
  
  // Pagination
  PRODUCTS_PER_PAGE: 20,
  REVIEWS_PER_PAGE: 10,
  NOTIFICATIONS_PER_PAGE: 20,
  
  // Image Limits
  MAX_PRODUCT_IMAGES: 5,
  MAX_IMAGE_SIZE_MB: 5,
  IMAGE_QUALITY: 0.8,
  
  // Trust Score Weights
  TRUST_WEIGHTS: {
    VERIFICATION: 30,
    REVIEWS_BASE: 30,
    COMPLAINTS: -20,
    ACTIVITY: 20,
  },
  
  // Minimum Requirements
  MIN_PRODUCT_PRICE: 10,
  MAX_PRODUCT_PRICE: 100000,
  MIN_REVIEW_LENGTH: 10,
  MAX_REVIEW_LENGTH: 500,
  
  // Status Values
  SELLER_STATUS: {
    PENDING: 'pending',
    VERIFIED: 'verified',
    REJECTED: 'rejected',
    BLOCKED: 'blocked',
  },
  
  PRODUCT_STATUS: {
    PENDING: 'pending',
    ACTIVE: 'active',
    REJECTED: 'rejected',
    INACTIVE: 'inactive',
  },
  
  // User Roles
  ROLES: {
    BUYER: 'buyer',
    SELLER: 'seller',
    ADMIN: 'admin',
  },
  
  // Report Categories
  REPORT_REASONS: [
    'Fake Product',
    'Misleading Description',
    'Poor Quality',
    'Fraud/Scam',
    'Inappropriate Content',
    'Wrong Category',
    'Other',
  ],
  
  // Contact Methods
  CONTACT_METHODS: {
    PHONE: 'phone',
    WHATSAPP: 'whatsapp',
  },
  
  // Notification Types
  NOTIFICATION_TYPES: {
    VERIFICATION: 'verification',
    PRODUCT_APPROVAL: 'product_approval',
    NEW_REVIEW: 'new_review',
    REPORT_UPDATE: 'report_update',
    SYSTEM: 'system',
  },
};

// Appwrite Config (to be set via environment variables in production)
export const APPWRITE_CONFIG = {
  ENDPOINT: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1',
  PROJECT_ID: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID || '',
  DATABASE_ID: process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID || '',
  
  // Collection IDs
  COLLECTIONS: {
    USERS: process.env.EXPO_PUBLIC_COLLECTION_USERS || 'users',
    SELLERS: process.env.EXPO_PUBLIC_COLLECTION_SELLERS || 'sellers',
    PRODUCTS: process.env.EXPO_PUBLIC_COLLECTION_PRODUCTS || 'products',
    REVIEWS: process.env.EXPO_PUBLIC_COLLECTION_REVIEWS || 'reviews',
    REPORTS: process.env.EXPO_PUBLIC_COLLECTION_REPORTS || 'reports',
    ADMIN_LOGS: process.env.EXPO_PUBLIC_COLLECTION_ADMIN_LOGS || 'admin_logs',
    NOTIFICATIONS: process.env.EXPO_PUBLIC_COLLECTION_NOTIFICATIONS || 'notifications',
  },
  
  // Storage Bucket IDs
  BUCKETS: {
    PROFILE_IMAGES: process.env.EXPO_PUBLIC_BUCKET_PROFILE_IMAGES || 'profile-images',
    PRODUCT_IMAGES: process.env.EXPO_PUBLIC_BUCKET_PRODUCT_IMAGES || 'product-images',
    DOCUMENTS: process.env.EXPO_PUBLIC_BUCKET_DOCUMENTS || 'documents',
  },
};
