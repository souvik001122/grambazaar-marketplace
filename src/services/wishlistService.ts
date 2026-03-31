import { ID, Query } from 'appwrite';
import { databases, appwriteConfig } from '../config/appwrite';
import { SavedProduct } from '../types/common.types';

type WishlistChangeEvent = {
  userId: string;
  productId: string;
  action: 'added' | 'removed';
};

type WishlistListener = (event: WishlistChangeEvent) => void;

const wishlistListeners = new Set<WishlistListener>();

const emitWishlistChange = (event: WishlistChangeEvent) => {
  wishlistListeners.forEach((listener) => {
    try {
      listener(event);
    } catch {
      // Keep event dispatch resilient.
    }
  });
};

export const subscribeWishlistChanges = (listener: WishlistListener): (() => void) => {
  wishlistListeners.add(listener);
  return () => {
    wishlistListeners.delete(listener);
  };
};

/**
 * Add product to wishlist
 */
export const addToWishlist = async (
  userId: string,
  productId: string
): Promise<SavedProduct> => {
  try {
    // Check if already saved
    const existing = await isInWishlist(userId, productId);
    if (existing) {
      throw new Error('Product already in wishlist');
    }

    const doc = await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.savedProductsCollectionId,
      ID.unique(),
      {
        userId,
        productId,
        createdAt: new Date().toISOString(),
      }
    );

    emitWishlistChange({ userId, productId, action: 'added' });

    return doc as unknown as SavedProduct;
  } catch (error: any) {
    console.error('Error adding to wishlist:', error);
    throw new Error(error.message || 'Failed to add to wishlist');
  }
};

/**
 * Remove product from wishlist
 */
export const removeFromWishlist = async (
  userId: string,
  productId: string
): Promise<void> => {
  try {
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.savedProductsCollectionId,
      [
        Query.equal('userId', userId),
        Query.equal('productId', productId),
      ]
    );

    if (response.documents.length > 0) {
      await databases.deleteDocument(
        appwriteConfig.databaseId,
        appwriteConfig.savedProductsCollectionId,
        response.documents[0].$id
      );
      emitWishlistChange({ userId, productId, action: 'removed' });
    }
  } catch (error) {
    console.error('Error removing from wishlist:', error);
    throw new Error('Failed to remove from wishlist');
  }
};

/**
 * Check if product is in wishlist
 */
export const isInWishlist = async (
  userId: string,
  productId: string
): Promise<boolean> => {
  try {
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.savedProductsCollectionId,
      [
        Query.equal('userId', userId),
        Query.equal('productId', productId),
        Query.limit(1),
      ]
    );

    return response.documents.length > 0;
  } catch (error) {
    console.error('Error checking wishlist:', error);
    return false;
  }
};

/**
 * Get user's wishlist product IDs
 */
export const getWishlistProductIds = async (
  userId: string
): Promise<string[]> => {
  try {
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.savedProductsCollectionId,
      [
        Query.equal('userId', userId),
        Query.orderDesc('createdAt'),
        Query.limit(100),
      ]
    );

    return response.documents.map((doc: any) => doc.productId);
  } catch (error) {
    console.error('Error fetching wishlist:', error);
    return [];
  }
};

/**
 * Get user's wishlist with product details
 */
export const getWishlistProducts = async (
  userId: string
): Promise<SavedProduct[]> => {
  try {
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.savedProductsCollectionId,
      [
        Query.equal('userId', userId),
        Query.orderDesc('createdAt'),
        Query.limit(100),
      ]
    );

    return response.documents as unknown as SavedProduct[];
  } catch (error) {
    console.error('Error fetching wishlist:', error);
    return [];
  }
};

/**
 * Get wishlist count
 */
export const getWishlistCount = async (userId: string): Promise<number> => {
  try {
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.savedProductsCollectionId,
      [
        Query.equal('userId', userId),
        Query.limit(1),
      ]
    );
    return response.total;
  } catch (error) {
    return 0;
  }
};
