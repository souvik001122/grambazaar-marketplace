import { ID, Query } from 'appwrite';
import { databases, appwriteConfig } from '../config/appwrite';
import {
  Seller,
  CreateSellerDTO,
  UpdateSellerDTO,
  VerifySellerDTO,
} from '../types/seller.types';
import { calculateTrustScore } from '../utils/trustScore';
import { sendNotification } from './notificationService';
import { getUsersByRole } from './userService';
import {
  normalizePhone,
  validateAddress,
  validateLatitude,
  validateLocation,
  validateLongitude,
  validatePhone,
  validateShopName,
  validateSkills,
} from '../utils/validation';
import { INDIAN_STATES } from '../constants/regions';

// Global in-memory cache for seller profiles
export const sellerCache = new Map<string, Seller>();
const sellerCacheTimestamps = new Map<string, number>();
const SELLER_CACHE_MAX_SIZE = 500;
const SELLER_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const sellerInvalidationListeners: Array<(sellerId: string) => void> = [];

export const registerSellerInvalidationListener = (listener: (sellerId: string) => void) => {
  sellerInvalidationListeners.push(listener);
};

export const invalidateSellerCache = (sellerId: string) => {
  sellerCache.delete(sellerId);
  sellerCacheTimestamps.delete(sellerId);
  sellerInvalidationListeners.forEach((listener) => {
    try {
      listener(sellerId);
    } catch (e) {
      console.error('Error in seller invalidation listener:', e);
    }
  });
};

export const clearAllSellerCaches = () => {
  sellerCache.clear();
  sellerCacheTimestamps.clear();
  sellerInvalidationListeners.forEach((listener) => {
    try {
      listener('*');
    } catch (e) {
      console.error('Error in seller invalidation listener:', e);
    }
  });
};

const setSellerCache = (sellerId: string, seller: Seller) => {
  if (sellerCache.size >= SELLER_CACHE_MAX_SIZE) {
    sellerCache.clear();
    sellerCacheTimestamps.clear();
  }
  sellerCache.set(sellerId, seller);
  sellerCacheTimestamps.set(sellerId, Date.now());
};

export const getCachedSellerSync = (sellerId: string): Seller | null => {
  const cached = sellerCache.get(sellerId);
  if (cached) {
    const ts = sellerCacheTimestamps.get(sellerId) || 0;
    if (Date.now() - ts < SELLER_CACHE_TTL_MS) {
      return cached;
    }
    sellerCache.delete(sellerId);
    sellerCacheTimestamps.delete(sellerId);
  }
  return null;
};

const normalizeText = (value?: string): string =>
  (value || '').replace(/\s+/g, ' ').trim();

const sanitizeCreateSellerPayload = (data: CreateSellerDTO) => {
  const shopName = normalizeText(data.shopName);
  const craftType = normalizeText(data.craftType);
  const skills = normalizeText(data.skills);
  const address = normalizeText(data.address);
  const state = normalizeText(data.state);
  const district = normalizeText(data.district);
  const locality = normalizeText(data.locality || data.village);
  const phone = normalizePhone(data.phone || '');
  const documents = Array.isArray(data.documents)
    ? data.documents.map((doc) => normalizeText(doc)).filter(Boolean)
    : [];

  if (!validateShopName(shopName)) {
    throw new Error('Shop name must be 3-50 characters.');
  }

  if (!craftType) {
    throw new Error('Please select a valid craft type.');
  }

  if (!validateSkills(skills)) {
    throw new Error('Skills description must be 10-200 characters.');
  }

  if (!validatePhone(phone)) {
    throw new Error('Please provide a valid 10-digit Indian mobile number.');
  }

  if (!validateAddress(address)) {
    throw new Error('Address must be 10-300 characters.');
  }

  if (!validateLocation(state)) {
    throw new Error('Please select a valid state.');
  }

  if (!validateLocation(district)) {
    throw new Error('Please select a valid district.');
  }

  if (!validateLocation(locality)) {
    throw new Error('Please select a valid locality/village.');
  }

  if (typeof data.latitude === 'number' && !validateLatitude(data.latitude)) {
    throw new Error('Latitude must be between -90 and 90.');
  }

  if (typeof data.longitude === 'number' && !validateLongitude(data.longitude)) {
    throw new Error('Longitude must be between -180 and 180.');
  }

  if (documents.length !== 2) {
    throw new Error('Please upload exactly 2 files: 1 shop photo and 1 PDF ID proof.');
  }

  return {
    userId: data.userId,
    shopName,
    craftType,
    skills,
    phone,
    address,
    state,
    district,
    locality,
    latitude: data.latitude,
    longitude: data.longitude,
    documents,
  };
};

const sanitizeUpdateSellerPayload = (data: UpdateSellerDTO): Record<string, unknown> => {
  const payload: Record<string, unknown> = {
    ...data,
  };

  if (typeof data.phone === 'string') {
    const phone = normalizePhone(data.phone);
    if (!validatePhone(phone)) {
      throw new Error('Please provide a valid 10-digit Indian mobile number.');
    }
    payload.phone = phone;
  }

  if (typeof data.businessName === 'string') {
    const businessName = normalizeText(data.businessName);
    if (!validateShopName(businessName)) {
      throw new Error('Shop name must be 3-50 characters.');
    }
    payload.businessName = businessName;
  }

  if (typeof data.description === 'string') {
    const description = normalizeText(data.description);
    if (!validateSkills(description)) {
      throw new Error('Description must be 10-200 characters.');
    }
    payload.description = description;
  }

  if (typeof data.address === 'string') {
    const address = normalizeText(data.address);
    if (!validateAddress(address)) {
      throw new Error('Address must be 10-300 characters.');
    }
    payload.address = address;
  }

  if (typeof data.state === 'string') {
    payload.state = normalizeText(data.state);
    payload.region = normalizeText(data.state);
  }

  if (typeof data.district === 'string') {
    payload.district = normalizeText(data.district);
    payload.city = normalizeText(data.district);
  }

  if (typeof data.locality === 'string') {
    payload.village = normalizeText(data.locality);
    delete payload.locality;
  }

  if (typeof data.village === 'string') {
    payload.village = normalizeText(data.village);
  }

  if (typeof data.city === 'string') {
    payload.city = normalizeText(data.city);
  }

  if (typeof data.craftType === 'string') {
    payload.craftType = normalizeText(data.craftType);
  }

  if (typeof data.latitude === 'number' && !validateLatitude(data.latitude)) {
    throw new Error('Latitude must be between -90 and 90.');
  }

  if (typeof data.longitude === 'number' && !validateLongitude(data.longitude)) {
    throw new Error('Longitude must be between -180 and 180.');
  }

  return payload;
};

const extractErrorMessage = (error: unknown): string => {
  if (error instanceof Error && typeof error.message === 'string' && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message.trim();
    }
  }

  return 'Failed to create seller application.';
};

const normalizeCreateSellerErrorMessage = (rawMessage: string): string => {
  const message = rawMessage || 'Failed to create seller application.';
  const lower = message.toLowerCase();

  if (
    lower.includes('idx_sellers_userid') ||
    lower.includes('already exists') ||
    lower.includes('duplicate') ||
    lower.includes('unique')
  ) {
    return 'You already submitted a seller application. Please wait for admin review.';
  }

  if (
    lower.includes('attribute not found') ||
    lower.includes('unknown attribute') ||
    lower.includes('invalid document structure') ||
    lower.includes('attribute') && lower.includes('missing')
  ) {
    return 'Seller setup is incomplete on backend. Please complete Appwrite seller schema setup and try again.';
  }

  return message;
};

const OPTIONAL_CREATE_FIELDS = [
  'latitude',
  'longitude',
  'paymentUpiId',
  'paymentQrImageUrl',
  'paymentBankAccountName',
  'paymentBankAccountNumber',
  'paymentBankIfsc',
] as const;

const parseUnknownAttribute = (message: string): string | null => {
  const normalized = message || '';
  const match = normalized.match(/(?:unknown attribute|attribute not found)\s*:?\s*["']?([a-zA-Z0-9_]+)["']?/i);
  return match?.[1] || null;
};

const isNotFoundError = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const maybe = error as { code?: unknown; message?: unknown; type?: unknown };
  if (typeof maybe.code === 'number' && maybe.code === 404) {
    return true;
  }

  const message = typeof maybe.message === 'string' ? maybe.message.toLowerCase() : '';
  const type = typeof maybe.type === 'string' ? maybe.type.toLowerCase() : '';

  return (
    type.includes('not_found') ||
    message.includes('could not be found') ||
    message.includes('document with the requested id')
  );
};

const isSchemaMismatchError = (message: string): boolean => {
  const lower = (message || '').toLowerCase();
  return (
    lower.includes('unknown attribute') ||
    lower.includes('attribute not found') ||
    lower.includes('invalid document structure')
  );
};

const createSellerDocumentWithFallback = async (docData: Record<string, unknown>) => {
  const mutableDoc = { ...docData };
  const stripped = new Set<string>();

  for (let attempt = 0; attempt < OPTIONAL_CREATE_FIELDS.length + 2; attempt += 1) {
    try {
      return await databases.createDocument(
        appwriteConfig.databaseId,
        appwriteConfig.sellersCollectionId,
        ID.unique(),
        mutableDoc
      );
    } catch (error) {
      const message = extractErrorMessage(error);
      if (!isSchemaMismatchError(message)) {
        throw error;
      }

      const unknownAttr = parseUnknownAttribute(message);
      if (unknownAttr && OPTIONAL_CREATE_FIELDS.includes(unknownAttr as (typeof OPTIONAL_CREATE_FIELDS)[number])) {
        if (unknownAttr in mutableDoc) {
          delete mutableDoc[unknownAttr];
          stripped.add(unknownAttr);
          continue;
        }
      }

      const fallbackField = OPTIONAL_CREATE_FIELDS.find((field) => field in mutableDoc && !stripped.has(field));
      if (fallbackField) {
        delete mutableDoc[fallbackField];
        stripped.add(fallbackField);
        continue;
      }

      throw error;
    }
  }

  throw new Error('Seller setup is incomplete on backend. Please complete Appwrite seller schema setup and try again.');
};

/**
 * Create seller application
 */
export const createSeller = async (data: CreateSellerDTO): Promise<Seller> => {
  try {
    const payload = sanitizeCreateSellerPayload(data);

    const existingSeller = await getSellerByUserId(payload.userId);
    if (existingSeller) {
      throw new Error('You already submitted a seller application. Please wait for admin review.');
    }

    const now = new Date().toISOString();
    const sellerDocPayload: Record<string, unknown> = {
      userId: payload.userId,
      businessName: payload.shopName,
      description: payload.skills,
      region: payload.state,
      state: payload.state,
      city: payload.district,
      address: payload.address,
      village: payload.locality,
      district: payload.district,
      phone: payload.phone,
      craftType: payload.craftType,
      verificationDocuments: payload.documents,
      verificationStatus: 'pending',
      verifiedBadge: false,
      rating: 0,
      totalOrders: 0,
      paymentUpiId: '',
      paymentQrImageUrl: '',
      paymentBankAccountName: '',
      paymentBankAccountNumber: '',
      paymentBankIfsc: '',
      createdAt: now,
      updatedAt: now,
    };

    if (typeof payload.latitude === 'number') {
      sellerDocPayload.latitude = payload.latitude;
    }

    if (typeof payload.longitude === 'number') {
      sellerDocPayload.longitude = payload.longitude;
    }

    const seller = await createSellerDocumentWithFallback(sellerDocPayload);

    // Notify admin about new seller application
    try {
      const admins = await getUsersByRole('admin');
      for (const admin of admins) {
        await sendNotification(
          admin.$id,
          `New seller application: ${payload.shopName} wants to join GramBazaar`,
          'seller_application',
          seller.$id
        );
      }
    } catch {
      // Non-critical — don't block seller creation if notification fails
    }

    const result = seller as unknown as Seller;
    if (result && result.$id) {
      setSellerCache(result.$id, result);
    }
    return result;
  } catch (error) {
    console.error('Error creating seller:', error);
    const rawMessage = extractErrorMessage(error);
    throw new Error(normalizeCreateSellerErrorMessage(rawMessage));
  }
};

/**
 * Get seller by user ID
 */
export const getSellerByUserId = async (userId: string): Promise<Seller | null> => {
  for (const seller of sellerCache.values()) {
    if (seller.userId === userId) {
      return seller;
    }
  }
  try {
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.sellersCollectionId,
      [Query.equal('userId', userId)]
    );

    if (response.documents.length === 0) {
      return null;
    }

    const seller = response.documents[0] as unknown as Seller;
    if (seller) {
      setSellerCache(seller.$id, seller);
    }
    return seller;
  } catch (error) {
    console.error('Error fetching seller:', error);
    return null;
  }
};

/**
 * Get seller by seller ID
 */
export const getSellerById = async (sellerId: string): Promise<Seller | null> => {
  const cached = getCachedSellerSync(sellerId);
  if (cached) {
    return cached;
  }
  try {
    const doc = await databases.getDocument(
      appwriteConfig.databaseId,
      appwriteConfig.sellersCollectionId,
      sellerId
    );
    const seller = doc as unknown as Seller;
    if (seller) {
      setSellerCache(sellerId, seller);
    }
    return seller;
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    console.error('Error fetching seller:', error);
    return null;
  }
};

/**
 * Update seller profile
 */
export const updateSeller = async (
  userId: string,
  data: UpdateSellerDTO
): Promise<Seller> => {
  try {
    const seller = await getSellerByUserId(userId);
    if (!seller) {
      throw new Error('Seller not found');
    }

    const payload = sanitizeUpdateSellerPayload(data);

    const updated = await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.sellersCollectionId,
      seller.$id,
      {
        ...payload,
        updatedAt: new Date().toISOString(),
      }
    );

    const result = updated as unknown as Seller;
    if (result && result.$id) {
      invalidateSellerCache(result.$id);
    }
    return result;
  } catch (error) {
    console.error('Error updating seller:', error);
    throw new Error('Failed to update seller');
  }
};

/**
 * Verify seller (Admin only)
 */
export const verifySeller = async (data: VerifySellerDTO): Promise<Seller> => {
  try {
    const seller = await getSellerById(data.sellerId);
    if (!seller) {
      throw new Error('Seller not found');
    }

    const updateData: any = {
      verificationStatus: data.status,
      verifiedBadge: data.status === 'approved',
      updatedAt: new Date().toISOString(),
    };

    const updated = await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.sellersCollectionId,
      seller.$id,
      updateData
    );

    const message =
      data.status === 'approved'
        ? 'Congratulations! Your seller account has been approved.'
        : `Your seller application has been rejected. Reason: ${data.reason}`;

    await sendNotification(seller.userId, message, 'verification', seller.$id, 'seller');

    const result = updated as unknown as Seller;
    if (result && result.$id) {
      invalidateSellerCache(result.$id);
    }
    return result;
  } catch (error) {
    console.error('Error verifying seller:', error);
    throw new Error('Failed to verify seller');
  }
};

/**
 * Get pending sellers (Admin only)
 */
export const getPendingSellers = async (): Promise<Seller[]> => {
  try {
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.sellersCollectionId,
      [
        Query.equal('verificationStatus', 'pending'),
        Query.orderDesc('createdAt'),
      ]
    );

    return response.documents as unknown as Seller[];
  } catch (error) {
    console.error('Error fetching pending sellers:', error);
    return [];
  }
};

/**
 * Get verified sellers by region
 */
export const getSellersByRegion = async (state: string): Promise<Seller[]> => {
  try {
    const strictResponse = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.sellersCollectionId,
      [
        Query.equal('state', state),
        Query.equal('verificationStatus', 'approved'),
        Query.orderDesc('rating'),
      ]
    );

    if (strictResponse.documents.length > 0) {
      const sellers = strictResponse.documents as unknown as Seller[];
      if (sellerCache.size + sellers.length >= SELLER_CACHE_MAX_SIZE) {
        sellerCache.clear();
        sellerCacheTimestamps.clear();
      }
      sellers.forEach((s) => {
        if (s && s.$id) {
          setSellerCache(s.$id, s);
        }
      });
      return sellers;
    }

    const normalizedState = normalizeText(state).toLowerCase();
    const matchedState = INDIAN_STATES.find(
      (item) =>
        item.name.toLowerCase() === normalizedState ||
        item.id.toLowerCase() === normalizedState
    );

    const aliases = new Set<string>([
      normalizedState,
      matchedState?.name.toLowerCase() || '',
      matchedState?.id.toLowerCase() || '',
    ]);

    const fallbackResponse = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.sellersCollectionId,
      [
        Query.equal('verificationStatus', 'approved'),
        Query.limit(300),
      ]
    );

    const filtered = (fallbackResponse.documents as unknown as Seller[])
      .filter((seller) => {
        const sellerState = normalizeText(seller.state).toLowerCase();
        const sellerRegion = normalizeText((seller as any).region).toLowerCase();
        return aliases.has(sellerState) || aliases.has(sellerRegion);
      })
      .sort((a, b) => (b.rating || 0) - (a.rating || 0));

    if (sellerCache.size + filtered.length >= SELLER_CACHE_MAX_SIZE) {
      sellerCache.clear();
      sellerCacheTimestamps.clear();
    }
    filtered.forEach((s) => {
      if (s && s.$id) {
        setSellerCache(s.$id, s);
      }
    });

    return filtered;
  } catch (error) {
    console.error('Error fetching sellers by region:', error);
    return [];
  }
};

/**
 * Get top verified sellers across India
 */
export const getTopVerifiedSellers = async (limit: number = 200): Promise<Seller[]> => {
  try {
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.sellersCollectionId,
      [
        Query.equal('verificationStatus', 'approved'),
        Query.orderDesc('rating'),
        Query.limit(limit),
      ]
    );

    const sellers = response.documents as unknown as Seller[];
    if (sellerCache.size + sellers.length >= SELLER_CACHE_MAX_SIZE) {
      sellerCache.clear();
      sellerCacheTimestamps.clear();
    }
    sellers.forEach((s) => {
      if (s && s.$id) {
        setSellerCache(s.$id, s);
      }
    });

    return sellers;
  } catch (error) {
    console.error('Error fetching top verified sellers:', error);
    return [];
  }
};

/**
 * Get seller trust score (computed, not stored)
 */
export const getSellerTrustScore = async (sellerId: string): Promise<number> => {
  try {
    const seller = await getSellerById(sellerId);
    if (!seller) return 0;
    return calculateTrustScore(seller);
  } catch (error) {
    console.error('Error computing trust score:', error);
    return 0;
  }
};

/**
 * Update seller rating
 */
export const updateSellerRating = async (
  sellerId: string,
  rating: number
): Promise<void> => {
  try {
    const seller = await getSellerById(sellerId);
    if (!seller) {
      throw new Error('Seller not found');
    }

    await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.sellersCollectionId,
      seller.$id,
      { rating }
    );
  } catch (error) {
    console.error('Error updating seller rating:', error);
  }
};

/**
 * Toggle shop active status (uses verificationStatus since isShopActive not in DB)
 */
export const toggleShopStatus = async (
  userId: string,
  isActive: boolean
): Promise<void> => {
  try {
    const seller = await getSellerByUserId(userId);
    if (!seller) {
      throw new Error('Seller not found');
    }

    // Use verificationStatus: 'approved' for active, 'blocked' for inactive
    await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.sellersCollectionId,
      seller.$id,
      {
        verificationStatus: isActive ? 'approved' : 'blocked',
        updatedAt: new Date().toISOString(),
      }
    );
    invalidateSellerCache(seller.$id);
  } catch (error) {
    console.error('Error toggling shop status:', error);
    throw new Error('Failed to update shop status');
  }
};

/**
 * Get account health (computed, not stored)
 */
export const getAccountHealth = (seller: Seller): 'good' | 'warning' | 'risk' => {
  if (seller.rating && seller.rating < 2.5) return 'risk';
  if (seller.rating && seller.rating < 3.5) return 'warning';
  return 'good';
};

/**
 * Delete seller profile (for reapply flow)
 */
export const deleteSellerProfile = async (sellerId: string): Promise<void> => {
  try {
    await databases.deleteDocument(
      appwriteConfig.databaseId,
      appwriteConfig.sellersCollectionId,
      sellerId
    );
    invalidateSellerCache(sellerId);
  } catch (error) {
    console.error('Error deleting seller profile:', error);
    throw new Error('Failed to delete seller profile');
  }
};
