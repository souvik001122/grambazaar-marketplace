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
import { getSellerById, registerSellerInvalidationListener } from './sellerService';
import { Seller } from '../types/seller.types';
import { calculateTrustScore, isTopArtisan } from '../utils/trustScore';
import { INDIAN_STATES } from '../constants/regions';
import { CATEGORIES } from '../constants/categories';
import {
  validateDescription,
  validateImageCount,
  validateLocation,
  validatePrice,
  validateProductName,
  validateStock,
} from '../utils/validation';

const sellerSearchCache = new Map<string, Seller | null>();
const sellerSearchCacheTimestamps = new Map<string, number>();
const SELLER_CACHE_MAX_SIZE = 500;
const SELLER_SEARCH_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let allApprovedSellersCache: Seller[] | null = null;
let allApprovedSellersTimestamp = 0;
const APPROVED_SELLERS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const getAllApprovedSellers = async (): Promise<Seller[]> => {
  if (allApprovedSellersCache && (Date.now() - allApprovedSellersTimestamp < APPROVED_SELLERS_CACHE_TTL_MS)) {
    return allApprovedSellersCache;
  }

  try {
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.sellersCollectionId,
      [
        Query.equal('verificationStatus', 'approved'),
        Query.limit(1000),
      ]
    );
    allApprovedSellersCache = response.documents as unknown as Seller[];
    allApprovedSellersTimestamp = Date.now();

    // Populate sellerSearchCache to make individual lookups instant
    allApprovedSellersCache.forEach((seller) => {
      sellerSearchCache.set(seller.$id, seller);
      sellerSearchCacheTimestamps.set(seller.$id, Date.now());
    });

    return allApprovedSellersCache;
  } catch (error) {
    console.error('Error fetching all approved sellers:', error);
    return allApprovedSellersCache || [];
  }
};

// Search results memory cache for zero-latency back-and-forth filtering
const searchResultsCache = new Map<string, { response: PaginatedResponse<Product>; timestamp: number }>();
const SEARCH_CACHE_MAX_SIZE = 100;
const SEARCH_CACHE_TTL_MS = 60 * 1000; // 60 seconds TTL

// Global in-memory cache for product lookups
export const productCache = new Map<string, Product>();
const PRODUCT_CACHE_MAX_SIZE = 1000;

// Register invalidation listener
registerSellerInvalidationListener((sellerId) => {
  if (sellerId === '*') {
    sellerSearchCache.clear();
    sellerSearchCacheTimestamps.clear();
  } else {
    sellerSearchCache.delete(sellerId);
    sellerSearchCacheTimestamps.delete(sellerId);
  }
  allApprovedSellersCache = null;
  allApprovedSellersTimestamp = 0;
  searchResultsCache.clear();
});

export const getCachedProductSync = (productId: string): Product | null => {
  return productCache.get(productId) || null;
};

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
    const ts = sellerSearchCacheTimestamps.get(sellerId) || 0;
    if (Date.now() - ts < SELLER_SEARCH_CACHE_TTL_MS) {
      return sellerSearchCache.get(sellerId) || null;
    }
    sellerSearchCache.delete(sellerId);
    sellerSearchCacheTimestamps.delete(sellerId);
  }

  if (sellerSearchCache.size >= SELLER_CACHE_MAX_SIZE) {
    sellerSearchCache.clear();
    sellerSearchCacheTimestamps.clear();
  }

  const seller = await getSellerById(sellerId).catch(() => null);
  sellerSearchCache.set(sellerId, seller);
  sellerSearchCacheTimestamps.set(sellerId, Date.now());
  return seller;
};

const loadSellersForIds = async (
  sellerIds: string[],
  sellerMap: Map<string, Seller | null>
): Promise<void> => {
  const pending = sellerIds.filter((id) => !sellerSearchCache.has(id));
  
  if (pending.length > 0) {
    try {
      const batchSize = 100;
      for (let i = 0; i < pending.length; i += batchSize) {
        const chunk = pending.slice(i, i + batchSize);
        const response = await databases.listDocuments(
          appwriteConfig.databaseId,
          appwriteConfig.sellersCollectionId,
          [Query.equal('$id', chunk), Query.limit(chunk.length)]
        );
        const docs = response.documents as unknown as Seller[];
        docs.forEach((seller) => {
          sellerSearchCache.set(seller.$id, seller);
          sellerSearchCacheTimestamps.set(seller.$id, Date.now());
        });
      }
    } catch (error) {
      console.error('Error batch loading sellers:', error);
    }
  }

  sellerIds.forEach((id) => {
    sellerMap.set(id, sellerSearchCache.get(id) || null);
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
    searchResultsCache.clear();
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

    const result = product as unknown as Product;
    if (result && result.$id) {
      if (productCache.size >= PRODUCT_CACHE_MAX_SIZE) {
        productCache.clear();
      }
      productCache.set(result.$id, result);
    }
    return result;
  } catch (error) {
    console.error('Error creating product:', error);
    throw error;
  }
};

/**
 * Get product by ID
 */
export const getProductById = async (productId: string): Promise<Product | null> => {
  if (productCache.has(productId)) {
    return productCache.get(productId) || null;
  }
  try {
    const doc = await databases.getDocument(
      appwriteConfig.databaseId,
      appwriteConfig.productsCollectionId,
      productId
    );
    const prod = doc as unknown as Product;
    if (prod) {
      if (productCache.size >= PRODUCT_CACHE_MAX_SIZE) {
        productCache.clear();
      }
      productCache.set(productId, prod);
    }
    return prod;
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
    searchResultsCache.clear();
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

    const result = updated as unknown as Product;
    if (result && result.$id) {
      productCache.set(result.$id, result);
    }
    return result;
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
    searchResultsCache.clear();
    productCache.delete(productId);
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

    const products = response.documents as unknown as Product[];
    const sellerMap = new Map<string, Seller | null>();
    const uniqueSellerIds = [...new Set(products.map((product) => product.sellerId).filter(Boolean))];

    if (uniqueSellerIds.length > 0) {
      await loadSellersForIds(uniqueSellerIds, sellerMap);
    }

    const visibleProducts = products.filter((product) => {
      const seller = sellerMap.get(product.sellerId) || null;
      return seller?.verificationStatus !== 'blocked';
    });

    if (productCache.size + products.length >= PRODUCT_CACHE_MAX_SIZE) {
      productCache.clear();
    }
    visibleProducts.forEach((p) => {
      if (p && p.$id) {
        productCache.set(p.$id, p);
      }
    });

    return {
      data: visibleProducts,
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
const buildBaseProductQueries = (filters: ProductFilters): any[] => {
  const queries: any[] = [
    Query.equal('status', 'active'),
  ];

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

  return queries;
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
  const cacheKey = JSON.stringify({ filters, page, perPage });
  
  if (searchResultsCache.has(cacheKey)) {
    const entry = searchResultsCache.get(cacheKey)!;
    if (Date.now() - entry.timestamp < SEARCH_CACHE_TTL_MS) {
      return entry.response;
    }
    searchResultsCache.delete(cacheKey);
  }

  try {
    const queryTokens = tokenizeSearchQuery(filters.searchQuery);
    const localityText = normalizeSearchText(filters.localityQuery);
    const regionAliases = resolveRegionAliases(filters.region);

    const isHomeRegion = filters.isHomeRegionScope;
    const shouldBypassRegion = isHomeRegion && !!filters.searchQuery;

    // Dynamically resolve 6-digit PIN code to all matching names in-memory
    const resolvedLocalityNames = new Set<string>();
    if (/^\d{6}$/.test(localityText)) {
      try {
        const { getIndiaPincode } = require('india-pincode/browser');
        const client = await getIndiaPincode();
        const res = client.search(localityText);
        if (res.success && res.data) {
          res.data.data.forEach((office: any) => {
            if (office.Name) resolvedLocalityNames.add(normalizeSearchText(office.Name));
            if (office.District) resolvedLocalityNames.add(normalizeSearchText(office.District));
            if (office.Circle) resolvedLocalityNames.add(normalizeSearchText(office.Circle));
          });
        }
      } catch (err) {
        console.error('Error resolving PIN code in search:', err);
      }
    }

    // Get all approved sellers once (cached for 5m, listeners invalidate)
    const approvedSellers = await getAllApprovedSellers();
    const approvedSellerIds = new Set(approvedSellers.map((s) => s.$id));
    // Find sellers matching query tokens and localityText
    let matchingSellerIds: string[] = [];
    if (queryTokens.length > 0 || localityText) {
      const matchingSellers = approvedSellers.filter((seller) => {
        const sellerLocationText = [
          seller.city,
          seller.district,
          seller.village,
          seller.state,
          seller.region,
          seller.address,
        ]
          .filter((s): s is string => typeof s === 'string')
          .map((s) => s.toLowerCase())
          .join(' ');

        const sellerAllText = [
          seller.businessName,
          seller.craftType,
          sellerLocationText,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        const matchesSearch =
          queryTokens.length === 0 ||
          queryTokens.some((token) => sellerAllText.includes(token));

        const matchesLocality =
          !localityText || sellerLocationText.includes(localityText);

        return matchesSearch && matchesLocality;
      });
      matchingSellerIds = matchingSellers.map((s) => s.$id);
    }

    // Build base queries applied to all database requests
    const baseQueries = buildBaseProductQueries(filters);
    const promises: Promise<any[]>[] = [];

    // 1. If searchQuery is provided, query products by name matching searchQuery
    if (filters.searchQuery) {
      promises.push(
        databases
          .listDocuments(appwriteConfig.databaseId, appwriteConfig.productsCollectionId, [
            ...baseQueries,
            Query.search('name', filters.searchQuery),
            Query.limit(150),
          ])
          .then((res) => res.documents)
          .catch((err) => {
            console.error('Error querying products by name search:', err);
            return [];
          })
      );
    }

    // 2. If matching sellers are found, query products from those sellers
    if (matchingSellerIds.length > 0) {
      const slicedSellerIds = matchingSellerIds.slice(0, 100);
      promises.push(
        databases
          .listDocuments(appwriteConfig.databaseId, appwriteConfig.productsCollectionId, [
            ...baseQueries,
            Query.equal('sellerId', slicedSellerIds),
            Query.limit(150),
          ])
          .then((res) => res.documents)
          .catch((err) => {
            console.error('Error querying products by sellerId:', err);
            return [];
          })
      );
    }

    // 3. Check if any tokens match Indian state names/IDs
    const matchedStates = INDIAN_STATES.filter((state) =>
      queryTokens.some(
        (token) =>
          state.name.toLowerCase() === token || state.id.toLowerCase() === token
      )
    );
    if (matchedStates.length > 0) {
      const stateNames = matchedStates.map((s) => s.name);
      promises.push(
        databases
          .listDocuments(appwriteConfig.databaseId, appwriteConfig.productsCollectionId, [
            ...baseQueries,
            Query.equal('state', stateNames),
            Query.limit(150),
          ])
          .then((res) => res.documents)
          .catch((err) => {
            console.error('Error querying products by state names:', err);
            return [];
          })
      );
    }

    // 4. Check if any tokens match category names
    const matchedCategories = CATEGORIES.filter((cat) =>
      queryTokens.some(
        (token) =>
          cat.name.toLowerCase().includes(token) || cat.id.toLowerCase() === token
      )
    );
    if (matchedCategories.length > 0) {
      const categoryIds = matchedCategories.map((c) => c.id);
      promises.push(
        databases
          .listDocuments(appwriteConfig.databaseId, appwriteConfig.productsCollectionId, [
            ...baseQueries,
            Query.equal('category', categoryIds),
            Query.limit(150),
          ])
          .then((res) => res.documents)
          .catch((err) => {
            console.error('Error querying products by category search:', err);
            return [];
          })
      );
    }

    // 4.5 If region is specified and not bypassed, query products by region/state matching filters.region
    if (filters.region && !shouldBypassRegion && regionAliases.size > 0) {
      const stateNames = Array.from(regionAliases);
      promises.push(
        databases
          .listDocuments(appwriteConfig.databaseId, appwriteConfig.productsCollectionId, [
            ...baseQueries,
            Query.equal('state', stateNames),
            Query.limit(150),
          ])
          .then((res) => res.documents)
          .catch((err) => {
            console.error('Error querying products by explicit state filter:', err);
            return [];
          })
      );
    }

    // 5. If no search constraints are active, just query all active products matching base filters
    if (promises.length === 0) {
      promises.push(
        databases
          .listDocuments(appwriteConfig.databaseId, appwriteConfig.productsCollectionId, [
            ...baseQueries,
            Query.limit(300),
          ])
          .then((res) => res.documents)
          .catch((err) => {
            console.error('Error querying products by base filters:', err);
            return [];
          })
      );
    }

    // Execute database queries in parallel
    const queryResults = await Promise.all(promises);

    // Merge and deduplicate candidates by $id
    const candidateMap = new Map<string, Product>();
    queryResults.forEach((docs) => {
      docs.forEach((doc) => {
        const prod = doc as unknown as Product;
        candidateMap.set(prod.$id, prod);
      });
    });

    const candidates = Array.from(candidateMap.values());
    const sellerMap = new Map<string, Seller | null>();

    // Load seller info for candidates using the bulk seller cache loader
    const uniqueSellerIds = [...new Set(candidates.map((p) => p.sellerId).filter(Boolean))];
    if (uniqueSellerIds.length > 0) {
      await loadSellersForIds(uniqueSellerIds, sellerMap);
    }

    // In-memory filter candidates with high precision
    const filtered = candidates.filter((product) => {
      // 1. Only show products from approved sellers
      if (!approvedSellerIds.has(product.sellerId)) {
        return false;
      }

      const seller = sellerMap.get(product.sellerId) || null;

      // 2. Filter by regionAliases if region is requested AND it is not bypassed
      if (regionAliases.size > 0 && !shouldBypassRegion) {
        const regionHaystack = normalizeSearchText(
          [product.region, product.state, seller?.state, seller?.region]
            .filter(Boolean)
            .join(' ')
        );

        if (!regionValueMatches(regionHaystack, regionAliases)) {
          return false;
        }
      }

      // 3. Filter by verified sellers only
      if (
        filters.verifiedSellers &&
        !(seller?.verifiedBadge || seller?.verificationStatus === 'approved')
      ) {
        return false;
      }

      // 4. Filter by top artisans only
      if (filters.topArtisansOnly && !(seller && isTopArtisan(seller))) {
        return false;
      }

      // 5. Filter by delivery options (stock must be > 0 if delivery available is chosen)
      if (filters.deliveryAvailable && (product.stock || 0) < 1) {
        return false;
      }

      // 6. Detailed multi-token search match on both product and seller fields
      if (queryTokens.length > 0) {
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

        if (!containsAllTokens(searchableText, queryTokens)) {
          return false;
        }
      }

      // 7. Detailed locality search match on seller location fields
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

        const matchesLocalityText = localityHaystack.includes(localityText);
        const matchesResolvedPincode = resolvedLocalityNames.size > 0 && 
          Array.from(resolvedLocalityNames).some(name => localityHaystack.includes(name));

        if (!matchesLocalityText && !matchesResolvedPincode) {
          return false;
        }
      }

      return true;
    });

    // Sort products
    const requiresSellerDataForSorting = filters.sortBy === 'trust_high';
    const sortableProducts = requiresSellerDataForSorting
      ? enrichProductsWithSellerData(filtered, sellerMap)
      : filtered;

    const sortedBase = sortProductsByFilter(sortableProducts, filters.sortBy);
    const offset = Math.max(0, (page - 1) * perPage);
    const pagedBase = sortedBase.slice(offset, offset + perPage);

    // Ensure seller data is fully loaded for the paginated slice
    const pageSellerIds = [...new Set(pagedBase.map((p) => p.sellerId).filter(Boolean))];
    await loadSellersForIds(pageSellerIds, sellerMap);

    const paged = enrichProductsWithSellerData(pagedBase, sellerMap);

    const finalResult = {
      data: paged,
      total: sortedBase.length,
      page,
      perPage,
      hasMore: offset + pagedBase.length < sortedBase.length,
    };

    if (searchResultsCache.size >= SEARCH_CACHE_MAX_SIZE) {
      searchResultsCache.clear();
    }
    searchResultsCache.set(cacheKey, { response: finalResult, timestamp: Date.now() });

    return finalResult;
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

    const products = response.documents as unknown as Product[];
    if (productCache.size + products.length >= PRODUCT_CACHE_MAX_SIZE) {
      productCache.clear();
    }
    products.forEach((p) => {
      if (p && p.$id) {
        productCache.set(p.$id, p);
      }
    });
    return products;
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

    const products = response.documents as unknown as Product[];
    if (productCache.size + products.length >= PRODUCT_CACHE_MAX_SIZE) {
      productCache.clear();
    }
    products.forEach((p) => {
      if (p && p.$id) {
        productCache.set(p.$id, p);
      }
    });
    return products;
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

    const result = updated as unknown as Product;
    if (result && result.$id) {
      productCache.set(result.$id, result);
    }
    return result;
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

/**
 * Get dynamic product title suggestions from the database in real-time
 */
export const getProductSuggestions = async (query: string): Promise<string[]> => {
  if (!query || query.trim().length < 2) {
    return [];
  }
  try {
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.productsCollectionId,
      [
        Query.equal('status', 'active'),
        Query.search('name', query.trim()),
        Query.limit(5),
      ]
    );
    return response.documents.map((doc: any) => doc.name);
  } catch (error) {
    console.error('Error fetching product suggestions:', error);
    return [];
  }
};
