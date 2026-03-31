import { ID, Query } from 'appwrite';
import { databases, appwriteConfig } from '../config/appwrite';
import { CreateReviewDTO, Review, PaginatedResponse } from '../types/common.types';
import { sendNotification } from './notificationService';
import { getProductById } from './productService';
import { getSellerById } from './sellerService';

const REVIEW_AGGREGATION_LIMIT = 5000;

/**
 * Create review
 */
export const createReview = async (data: CreateReviewDTO): Promise<Review> => {
  try {
    const now = new Date().toISOString();
    const review = await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.reviewsCollectionId,
      ID.unique(),
      {
        productId: data.productId,
        userId: data.userId,
        rating: data.rating,
        comment: data.comment || '',
        createdAt: now,
        updatedAt: now,
      }
    );

    // Update product rating and review count
    const { avgRating, totalReviews } = await calculateProductRating(data.productId);
    await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.productsCollectionId,
      data.productId,
      { rating: avgRating, reviewCount: totalReviews }
    ).catch(() => {});

    // Notify the seller about the new review
    const product = await getProductById(data.productId);
    if (product) {
      await syncSellerRating(product.sellerId);
      const seller = await getSellerById(product.sellerId);
      if (seller) {
        await sendNotification(
          seller.userId,
          `New ${data.rating}★ review on "${product.name}"`,
          'review',
          data.productId,
          'product'
        ).catch(() => {});
      }
    }

    return review as unknown as Review;
  } catch (error) {
    console.error('Error creating review:', error);
    throw new Error('Failed to create review');
  }
};

/**
 * Get product reviews
 */
export const getProductReviews = async (
  productId: string,
  page: number = 1,
  perPage: number = 10
): Promise<PaginatedResponse<Review>> => {
  try {
    const offset = (page - 1) * perPage;
    
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.reviewsCollectionId,
      [
        Query.equal('productId', productId),
        Query.orderDesc('createdAt'),
        Query.limit(perPage),
        Query.offset(offset),
      ]
    );

    return {
      data: response.documents as unknown as Review[],
      total: response.total,
      page,
      perPage,
      hasMore: offset + response.documents.length < response.total,
    };
  } catch (error) {
    console.error('Error fetching product reviews:', error);
    throw new Error('Failed to fetch reviews');
  }
};

/**
 * Get reviews written by a user
 */
export const getUserReviews = async (
  userId: string,
  page: number = 1,
  perPage: number = 20
): Promise<PaginatedResponse<Review>> => {
  try {
    const offset = (page - 1) * perPage;

    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.reviewsCollectionId,
      [
        Query.equal('userId', userId),
        Query.orderDesc('createdAt'),
        Query.limit(perPage),
        Query.offset(offset),
      ]
    );

    return {
      data: response.documents as unknown as Review[],
      total: response.total,
      page,
      perPage,
      hasMore: offset + response.documents.length < response.total,
    };
  } catch (error) {
    console.error('Error fetching user reviews:', error);
    throw new Error('Failed to fetch user reviews');
  }
};

/**
 * Get seller reviews (all reviews for seller's products)
 */
export const getSellerReviews = async (
  sellerId: string,
  page: number = 1,
  perPage: number = 10
): Promise<PaginatedResponse<Review>> => {
  try {
    // First get all product IDs for this seller
    const products = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.productsCollectionId,
      [Query.equal('sellerId', sellerId)]
    );

    const productIds = products.documents.map(p => p.$id);
    
    if (productIds.length === 0) {
      return {
        data: [],
        total: 0,
        page,
        perPage,
        hasMore: false,
      };
    }

    const offset = (page - 1) * perPage;
    
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.reviewsCollectionId,
      [
        Query.equal('productId', productIds),
        Query.orderDesc('createdAt'),
        Query.limit(perPage),
        Query.offset(offset),
      ]
    );

    return {
      data: response.documents as unknown as Review[],
      total: response.total,
      page,
      perPage,
      hasMore: offset + response.documents.length < response.total,
    };
  } catch (error) {
    console.error('Error fetching seller reviews:', error);
    throw new Error('Failed to fetch seller reviews');
  }
};

/**
 * Calculate average rating for product
 */
export const calculateProductRating = async (productId: string): Promise<{ avgRating: number; totalReviews: number }> => {
  try {
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.reviewsCollectionId,
      [Query.equal('productId', productId), Query.limit(REVIEW_AGGREGATION_LIMIT)]
    );

    if (response.total === 0) {
      return { avgRating: 0, totalReviews: 0 };
    }

    const reviews = response.documents as unknown as Review[];
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const avgRating = totalRating / reviews.length;

    return {
      avgRating: Math.round(avgRating * 10) / 10, // Round to 1 decimal
      totalReviews: reviews.length,
    };
  } catch (error) {
    console.error('Error calculating product rating:', error);
    return { avgRating: 0, totalReviews: 0 };
  }
};

/**
 * Calculate aggregate rating across all seller products.
 */
export const calculateSellerRating = async (
  sellerId: string
): Promise<{ avgRating: number; totalReviews: number }> => {
  try {
    const products = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.productsCollectionId,
      [Query.equal('sellerId', sellerId), Query.limit(REVIEW_AGGREGATION_LIMIT)]
    );

    const productIds = products.documents.map((product) => product.$id);
    if (productIds.length === 0) {
      return { avgRating: 0, totalReviews: 0 };
    }

    const reviews = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.reviewsCollectionId,
      [Query.equal('productId', productIds), Query.limit(REVIEW_AGGREGATION_LIMIT)]
    );

    if (reviews.total === 0) {
      return { avgRating: 0, totalReviews: 0 };
    }

    const reviewDocs = reviews.documents as unknown as Review[];
    const totalRating = reviewDocs.reduce((sum, review) => sum + review.rating, 0);

    return {
      avgRating: Math.round((totalRating / reviewDocs.length) * 10) / 10,
      totalReviews: reviewDocs.length,
    };
  } catch (error) {
    console.error('Error calculating seller rating:', error);
    return { avgRating: 0, totalReviews: 0 };
  }
};

const syncSellerRating = async (sellerId: string): Promise<void> => {
  const { avgRating } = await calculateSellerRating(sellerId);

  await databases.updateDocument(
    appwriteConfig.databaseId,
    appwriteConfig.sellersCollectionId,
    sellerId,
    {
      rating: avgRating,
      updatedAt: new Date().toISOString(),
    }
  ).catch(() => {});
};

/**
 * Check if user has reviewed product
 */
export const hasUserReviewedProduct = async (
  productId: string,
  userId: string
): Promise<boolean> => {
  try {
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.reviewsCollectionId,
      [
        Query.equal('productId', productId),
        Query.equal('userId', userId),
      ]
    );

    return response.total > 0;
  } catch (error) {
    console.error('Error checking review status:', error);
    return false;
  }
};

/**
 * Delete review
 */
export const deleteReview = async (reviewId: string, productId?: string): Promise<void> => {
  try {
    await databases.deleteDocument(
      appwriteConfig.databaseId,
      appwriteConfig.reviewsCollectionId,
      reviewId
    );
    
    // Update product rating after deletion
    if (productId) {
      const { avgRating, totalReviews } = await calculateProductRating(productId);
      await databases.updateDocument(
        appwriteConfig.databaseId,
        appwriteConfig.productsCollectionId,
        productId,
        { rating: avgRating, reviewCount: totalReviews }
      ).catch(() => {});

      const product = await getProductById(productId);
      if (product) {
        await syncSellerRating(product.sellerId);
      }
    }
  } catch (error) {
    console.error('Error deleting review:', error);
    throw new Error('Failed to delete review');
  }
};
