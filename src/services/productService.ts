import { ID, Query } from 'appwrite';
import { databases, appwriteConfig } from '../config/appwrite';
import {
  Product,
  CreateProductDTO,
  UpdateProductDTO,
  ApproveProductDTO,
  ProductFilters,
} from '../types/product.types';
import { PaginatedResponse } from '../types/common.types';
import { sendNotification } from './notificationService';
import { getSellerById } from './sellerService';
import { Seller } from '../types/seller.types';
import { calculateTrustScore, isTopArtisan } from '../utils/trustScore';
import { INDIAN_STATES } from '../constants/regions';
import {
  validateDescription,
  validateImageCount,
  validateLocation,
  validatePrice,
  validateProductName,
  validateStock,
} from '../utils/validation';

const sellerSearchCache = new Map<string, Seller | null>();
const SELLER_CACHE_MAX_SIZE = 500;

const normalizeText = (value?: string): string =>
  (value || '').replace(/\s+/g, ' ').trim();

const sanitizeCreateProductPayload = (data: CreateProductDTO) => {
  const name = normalizeText(data.name);
  const category = normalizeText(data.category);
  const description = normalizeText(data.description);
  const state = normalizeText(data.state || data.region);
  const images = Array.isArray(data.images)
    ? data.images.map((img) => normalizeText(img)).filter(Boolean)
    : [];
  const quantity = Number(data.quantity);

  if (!validateProductName(name)) {
    throw new Error('Product name must be 3-100 characters.');
  }

  if (!category) {
    throw new Error('Please select a valid category.');
  }

  if (!validatePrice(data.price)) {
    throw new Error('Price must be between ₹10 and ₹1,00,000.');
  }

  if (!validateDescription(description, 20, 1200)) {
    throw new Error('Description must be 20-1200 characters.');
  }

  if (!validateImageCount(images, 5)) {
    throw new Error('Please upload 1 to 5 product images.');
  }

  if (!validateLocation(state)) {
    throw new Error('Please select a valid state.');
  }

  if (!validateStock(quantity, 1, 100000)) {
    throw new Error('Stock must be a whole number between 1 and 1,00,000.');
  }

  return {
    sellerId: data.sellerId,
    name,
    category,
    price: data.price,
    description,
    images,
    state,
    region: state,
    quantity,
  };
};

const sanitizeUpdateProductPayload = (data: UpdateProductDTO): Record<string, unknown> => {
  const payload: Record<string, unknown> = {
    ...data,
  };

  if (typeof data.name === 'string') {
    const name = normalizeText(data.name);
    if (!validateProductName(name)) {
      throw new Error('Product name must be 3-100 characters.');
    }
    payload.name = name;
  }

  if (typeof data.category === 'string') {
    const category = normalizeText(data.category);
    if (!category) {
      throw new Error('Please select a valid category.');
    }
    payload.category = category;
  }

  if (typeof data.description === 'string') {
    const description = normalizeText(data.description);
    if (!validateDescription(description, 20, 1200)) {
      throw new Error('Description must be 20-1200 characters.');
    }
    payload.description = description;
  }

  if (typeof data.price === 'number' && !validatePrice(data.price)) {
    throw new Error('Price must be between ₹10 and ₹1,00,000.');
  }

  if (typeof data.stock === 'number' && !validateStock(data.stock, 0, 100000)) {
    throw new Error('Stock must be a whole number between 0 and 1,00,000.');
  }

  if (Array.isArray(data.images)) {
    const images = data.images.map((img) => normalizeText(img)).filter(Boolean);
    if (!validateImageCount(images, 5)) {
      throw new Error('Please upload 1 to 5 product images.');
    }
    payload.images = images;
  }

  const stateFromRegion = typeof data.region === 'string' ? normalizeText(data.region) : '';
  const stateFromState = typeof data.state === 'string' ? normalizeText(data.state) : '';
  const resolvedState = stateFromState || stateFromRegion;

  if (resolvedState) {
    if (!validateLocation(resolvedState)) {
      throw new Error('Please select a valid state.');
    }
    payload.state = resolvedState;
    payload.region = resolvedState;
  }

  return payload;
};

const normalizeSearchText = (value: string | undefined): string =>
  (value || '').toLowerCase().trim();

const tokenizeSearchQuery = (value: string | undefined): string[] =>
  normalizeSearchText(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);

const containsAllTokens = (haystack: string, tokens: string[]): boolean =>
  tokens.every((token) => haystack.includes(token));

const resolveRegionAliases = (region: string | undefined): Set<string> => {
  const aliases = new Set<string>();
  const normalizedRegion = normalizeSearchText(region);
  if (!normalizedRegion) {
    return aliases;
  }

  aliases.add(normalizedRegion);

  const matchedState = INDIAN_STATES.find(
    (state) =>
      normalizeSearchText(state.name) === normalizedRegion ||
      normalizeSearchText(state.id) === normalizedRegion
  );

  if (matchedState) {
    aliases.add(normalizeSearchText(matchedState.name));
    aliases.add(normalizeSearchText(matchedState.id));
  }

  return aliases;
};

const regionValueMatches = (haystack: string, aliases: Set<string>): boolean => {
  if (aliases.size === 0) {
    return true;
  }

  const wrapped = ` ${haystack} `;
  for (const alias of aliases) {
    if (!alias) {
      continue;
    }

    if (alias.length <= 3) {
      if (wrapped.includes(` ${alias} `)) {
        return true;
      }
      continue;
    }

    if (haystack.includes(alias)) {
      return true;
    }
  }

  return false;
};

const getCachedSeller = async (sellerId: string): Promise<Seller | null> => {
  if (!sellerId) return null;
  if (sellerSearchCache.has(sellerId)) {
    return sellerSearchCache.get(sellerId) || null;
  }

  if (sellerSearchCache.size >= SELLER_CACHE_MAX_SIZE) {
    sellerSearchCache.clear();
  }

  const seller = await getSellerById(sellerId).catch(() => null);
  sellerSearchCache.set(sellerId, seller);
  return seller;
};

const loadSellersForIds = async (
  sellerIds: string[],
  sellerMap: Map<string, Seller | null>
): Promise<void> => {
  const pending = sellerIds.filter((sellerId) => !sellerMap.has(sellerId));
  if (pending.length === 0) {
    return;
  }

  const sellerResults = await Promise.all(
    pending.map(async (sellerId) => ({
      sellerId,
      seller: await getCachedSeller(sellerId),
    }))
  );

  sellerResults.forEach(({ sellerId, seller }) => {
    sellerMap.set(sellerId, seller);
  });
};

const enrichProductsWithSellerData = (
  products: Product[],
  sellerMap: Map<string, Seller | null>
): Product[] => {
  return products.map((product) => {
    const seller = sellerMap.get(product.sellerId) || null;
    const sellerTrustScore = seller ? calculateTrustScore(seller) : 0;

    return {
      ...product,
      sellerVerified: !!(seller?.verifiedBadge || seller?.verificationStatus === 'approved'),
      sellerTrustScore,
      topArtisan: seller ? isTopArtisan(seller) : false,
      sellerLocationLabel: [seller?.village, seller?.district, seller?.city, seller?.state]
        .filter(Boolean)
        .join(', '),
    } as Product;
  });
};

const sortProductsByFilter = (products: Product[], sortBy?: ProductFilters['sortBy']): Product[] => {
  const sorted = [...products];

  switch (sortBy) {
    case 'price_asc':
      sorted.sort((a, b) => (a.price || 0) - (b.price || 0));
      break;
    case 'price_desc':
      sorted.sort((a, b) => (b.price || 0) - (a.price || 0));
      break;
    case 'rating':
      sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      break;
    case 'trending':
      sorted.sort((a, b) => ((b.views || 0) + (b.reviewCount || 0) * 5) - ((a.views || 0) + (a.reviewCount || 0) * 5));
      break;
    case 'trust_high':
      sorted.sort((a, b) => ((b as any).sellerTrustScore || 0) - ((a as any).sellerTrustScore || 0));
      break;
    case 'newest':
    default:
      sorted.sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
      );
      break;
  }

  return sorted;
};

/**
 * Create product (Seller only)
 */
export const createProduct = async (data: CreateProductDTO): Promise<Product> => {
  try {
    const payload = sanitizeCreateProductPayload(data);
    const now = new Date().toISOString();
    const product = await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.productsCollectionId,
      ID.unique(),
      {
        // Required fields
        sellerId: payload.sellerId,
        name: payload.name,
        description: payload.description,
        images: payload.images,
        price: payload.price,
        category: payload.category,
        region: payload.region,
        state: payload.state,
        createdAt: now,
        updatedAt: now,
        // Optional fields
        stock: payload.quantity,
        status: 'pending',
        rating: 0,
        reviewCount: 0,
      }
    );

    return product as unknown as Product;
  } catch (error) {
    console.error('Error creating product:', error);
    throw error;
  }
};

/**
 * Get product by ID
 */
export const getProductById = async (productId: string): Promise<Product | null> => {
  try {
    const doc = await databases.getDocument(
      appwriteConfig.databaseId,
      appwriteConfig.productsCollectionId,
      productId
    );
    return doc as unknown as Product;
  } catch (error) {
    console.error('Error fetching product:', error);
    return null;
  }
};

/**
 * Update product
 */
export const updateProduct = async (
  productId: string,
  data: UpdateProductDTO
): Promise<Product> => {
  try {
    const payload = sanitizeUpdateProductPayload(data);
    const updated = await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.productsCollectionId,
      productId,
      {
        ...payload,
        updatedAt: new Date().toISOString(),
      }
    );

    return updated as unknown as Product;
  } catch (error) {
    console.error('Error updating product:', error);
    throw new Error('Failed to update product');
  }
};

/**
 * Delete product
 */
export const deleteProduct = async (productId: string): Promise<void> => {
  try {
    await databases.deleteDocument(
      appwriteConfig.databaseId,
      appwriteConfig.productsCollectionId,
      productId
    );
  } catch (error) {
    console.error('Error deleting product:', error);
    throw new Error('Failed to delete product');
  }
};

/**
 * Get products with filters and pagination
 */
export const getProducts = async (
  filters: ProductFilters = {},
  page: number = 1,
  perPage: number = 20
): Promise<PaginatedResponse<Product>> => {
  try {
    const queries: any[] = [
      Query.equal('status', 'active'),
      Query.orderDesc('createdAt'),
    ];

    if (filters.region) {
      queries.push(Query.equal('region', filters.region));
    }

    if (filters.category) {
      queries.push(Query.equal('category', filters.category));
    }

    if (filters.minPrice !== undefined) {
      queries.push(Query.greaterThanEqual('price', filters.minPrice));
    }

    if (filters.maxPrice !== undefined) {
      queries.push(Query.lessThanEqual('price', filters.maxPrice));
    }

    if (filters.minRating !== undefined) {
      queries.push(Query.greaterThanEqual('rating', filters.minRating));
    }

    if (filters.searchQuery) {
      queries.push(Query.search('name', filters.searchQuery));
    }

    // Sort handling
    if (filters.sortBy) {
      switch (filters.sortBy) {
        case 'price_asc':
          queries.push(Query.orderAsc('price'));
          break;
        case 'price_desc':
          queries.push(Query.orderDesc('price'));
          break;
        case 'rating':
          queries.push(Query.orderDesc('rating'));
          break;
        case 'trending':
          queries.push(Query.orderDesc('views'));
          break;
        case 'newest':
          queries.push(Query.orderDesc('createdAt'));
          break;
      }
    }

    const offset = (page - 1) * perPage;
    queries.push(Query.limit(perPage));
    queries.push(Query.offset(offset));

    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.productsCollectionId,
      queries
    );

    return {
      data: response.documents as unknown as Product[],
      total: response.total,
      page,
      perPage,
      hasMore: offset + response.documents.length < response.total,
    };
  } catch (error) {
    console.error('Error fetching products:', error);
    throw new Error('Failed to fetch products');
  }
};

/**
 * Marketplace-aware buyer search.
 * Supports product + shop + locality matching (state/city/address/village-like text)
 */
export const searchMarketplaceProducts = async (
  filters: ProductFilters = {},
  page: number = 1,
  perPage: number = 20
): Promise<PaginatedResponse<Product>> => {
  try {
    let baseFilters: ProductFilters = {
      ...filters,
      searchQuery: undefined,
      localityQuery: undefined,
      verifiedSellers: undefined,
      topArtisansOnly: undefined,
    };

    let firstBatch = await getProducts(baseFilters, 1, 120);
    if (filters.region && firstBatch.total === 0) {
      baseFilters = {
        ...baseFilters,
        region: undefined,
      };
      firstBatch = await getProducts(baseFilters, 1, 120);
    }

    const collectedProducts: Product[] = [...firstBatch.data];

    let nextPage = 2;
    let hasMore = firstBatch.hasMore;

    // Keep a practical cap to avoid overfetching while still enabling rich filtering.
    while (hasMore && collectedProducts.length < 360) {
      const nextBatch = await getProducts(baseFilters, nextPage, 120);
      collectedProducts.push(...nextBatch.data);
      hasMore = nextBatch.hasMore;
      nextPage += 1;
    }

    const queryTokens = tokenizeSearchQuery(filters.searchQuery);
    const localityText = normalizeSearchText(filters.localityQuery);
    const regionAliases = resolveRegionAliases(filters.region);
    const requiresSellerDataForFiltering =
      queryTokens.length > 0 ||
      Boolean(localityText) ||
      regionAliases.size > 0 ||
      Boolean(filters.verifiedSellers) ||
      Boolean(filters.topArtisansOnly);
    const requiresSellerDataForSorting = filters.sortBy === 'trust_high';

    const sellerMap = new Map<string, Seller | null>();

    if (requiresSellerDataForFiltering || requiresSellerDataForSorting) {
      const uniqueSellerIds = [...new Set(collectedProducts.map((p) => p.sellerId).filter(Boolean))];
      await loadSellersForIds(uniqueSellerIds, sellerMap);
    }

    const filtered = collectedProducts.filter((product) => {
      const seller = sellerMap.get(product.sellerId) || null;

      if (regionAliases.size > 0) {
        const regionHaystack = normalizeSearchText(
          [product.region, product.state, seller?.state, seller?.region]
            .filter(Boolean)
            .join(' ')
        );

        if (!regionValueMatches(regionHaystack, regionAliases)) {
          return false;
        }
      }

      if (
        filters.verifiedSellers &&
        !(seller?.verifiedBadge || seller?.verificationStatus === 'approved')
      ) {
        return false;
      }

      if (filters.topArtisansOnly && !(seller && isTopArtisan(seller))) {
        return false;
      }

      if (filters.deliveryAvailable && (product.stock || 0) < 1) {
        return false;
      }

      const searchableText = normalizeSearchText(
        [
          product.name,
          product.description,
          product.category,
          product.region,
          product.state,
          seller?.businessName,
          seller?.craftType,
          seller?.city,
          seller?.district,
          seller?.village,
          seller?.state,
          seller?.region,
          seller?.address,
        ]
          .filter(Boolean)
          .join(' ')
      );

      if (queryTokens.length > 0 && !containsAllTokens(searchableText, queryTokens)) {
        return false;
      }

      if (localityText) {
        const localityHaystack = normalizeSearchText(
          [
            seller?.city,
            seller?.district,
            seller?.village,
            seller?.state,
            seller?.region,
            seller?.address,
            product.region,
            product.state,
          ]
            .filter(Boolean)
            .join(' ')
        );

        if (!localityHaystack.includes(localityText)) {
          return false;
        }
      }

      return true;
    });

    const sortableProducts = requiresSellerDataForSorting
      ? enrichProductsWithSellerData(filtered, sellerMap)
      : filtered;

    const sortedBase = sortProductsByFilter(sortableProducts, filters.sortBy);
    const offset = Math.max(0, (page - 1) * perPage);
    const pagedBase = sortedBase.slice(offset, offset + perPage);

    const pageSellerIds = [...new Set(pagedBase.map((p) => p.sellerId).filter(Boolean))];
    await loadSellersForIds(pageSellerIds, sellerMap);

    const paged = enrichProductsWithSellerData(pagedBase, sellerMap);

    return {
      data: paged,
      total: sortedBase.length,
      page,
      perPage,
      hasMore: offset + pagedBase.length < sortedBase.length,
    };
  } catch (error) {
    console.error('Error in marketplace product search:', error);
    throw new Error('Failed to search marketplace products');
  }
};

/**
 * Get products by seller
 */
export const getProductsBySeller = async (
  sellerId: string,
  status?: string
): Promise<Product[]> => {
  try {
    if (!sellerId) {
      return [];
    }
    
    const queries: any[] = [Query.equal('sellerId', sellerId)];

    if (status) {
      queries.push(Query.equal('status', status));
    }

    queries.push(Query.orderDesc('createdAt'));

    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.productsCollectionId,
      queries
    );

    return response.documents as unknown as Product[];
  } catch (error) {
    console.error('Error fetching seller products:', error);
    return [];
  }
};

/**
 * Get pending products (Admin only)
 */
export const getPendingProducts = async (): Promise<Product[]> => {
  try {
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.productsCollectionId,
      [
        Query.equal('status', 'pending'),
        Query.orderDesc('createdAt'),
      ]
    );

    return response.documents as unknown as Product[];
  } catch (error) {
    console.error('Error fetching pending products:', error);
    return [];
  }
};

/**
 * Approve product (Admin only)
 */
export const approveProduct = async (data: ApproveProductDTO): Promise<Product> => {
  try {
    const product = await getProductById(data.productId);
    if (!product) {
      throw new Error('Product not found');
    }

    const updateData: any = {
      status: data.status,
      updatedAt: new Date().toISOString(),
    };

    const updated = await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.productsCollectionId,
      product.$id,
      updateData
    );

    // Notify seller (look up seller doc to get user ID)
    const seller = await getSellerById(product.sellerId);
    if (seller) {
      const message =
        data.status === 'active'
          ? `Your product "${product.name}" has been approved and is now live!`
          : `Your product "${product.name}" was rejected. Reason: ${data.reason}`;

      await sendNotification(seller.userId, message, 'product_approval', product.$id, 'product');
    }

    return updated as unknown as Product;
  } catch (error) {
    console.error('Error approving product:', error);
    throw new Error('Failed to approve product');
  }
};

/**
 * Increment product views
 */
export const incrementProductViews = async (productId: string): Promise<void> => {
  try {
    const product = await getProductById(productId);
    if (!product) return;

    await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.productsCollectionId,
      product.$id,
      { views: (product.views || 0) + 1 }
    );
  } catch (error) {
    console.error('Error incrementing product views:', error);
  }
};

/**
 * Update product rating
 */
export const updateProductRating = async (
  productId: string,
  rating: number,
  reviewCount: number
): Promise<void> => {
  try {
    const product = await getProductById(productId);
    if (!product) return;

    await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.productsCollectionId,
      product.$id,
      { rating, reviewCount }
    );
  } catch (error) {
    console.error('Error updating product rating:', error);
  }
};

/**
 * Toggle featured status
 */
export const toggleFeatured = async (productId: string, featured: boolean): Promise<void> => {
  try {
    const product = await getProductById(productId);
    if (!product) {
      throw new Error('Product not found');
    }

    await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.productsCollectionId,
      product.$id,
      { featured }
    );
  } catch (error) {
    console.error('Error toggling featured status:', error);
    throw new Error('Failed to update featured status');
  }
};
