// Review — matches DB: reviews collection
export interface Review {
  $id: string;
  productId: string;
  userId: string;
  rating: number;
  comment?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateReviewDTO {
  productId: string;
  userId: string;
  rating: number;
  comment?: string;
}

// Report — matches DB: reports collection
export interface Report {
  $id: string;
  reportedBy: string;
  reportedEntity: string;
  entityId: string;
  reason: string;
  details?: string;
  issueCategory?: string;
  proofUrls?: string[];
  orderId?: string;
  courierName?: string;
  trackingId?: string;
  status: string;
  resolvedBy?: string;
  resolution?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface CreateReportDTO {
  reportedBy: string;
  reportedEntity: string;
  entityId: string;
  reason: string;
  details?: string;
  issueCategory?: string;
  proofUrls?: string[];
  orderId?: string;
  courierName?: string;
  trackingId?: string;
}

// AdminLog — matches DB: admin_logs collection
export interface AdminLog {
  $id: string;
  adminId: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: string;
  createdAt: string;
}

// Notification — matches DB: notifications collection
export interface Notification {
  $id: string;
  userId: string;
  title?: string;
  type: string;
  message: string;
  isRead: boolean;
  relatedEntityId?: string;
  createdAt: string;
}

export interface CreateNotificationDTO {
  userId: string;
  title?: string;
  message: string;
  type: string;
  relatedEntityId?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
  hasMore: boolean;
}

// SavedProduct — matches DB: saved_products collection
export interface SavedProduct {
  $id: string;
  userId: string;
  productId: string;
  createdAt: string;
}

// Category — matches DB: categories collection
export interface Category {
  $id: string;
  name: string;
  icon: string;
  description: string;
  image?: string;
  sortOrder: number;
  isActive: boolean;
}
