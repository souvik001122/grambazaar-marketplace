/**
 * ============================================================
 *  GramBazaar — FINAL DATABASE STRUCTURE (v1.0)
 * ============================================================
 * 
 *  Run:   node setup-final-db.js
 * 
 *  This script creates ALL collections, attributes, and indexes
 *  needed for the complete GramBazaar platform.
 * 
 *  Safe to run multiple times — skips what already exists.
 * 
 *  Collections (10 total):
 *   1. users             — All app users (buyer/seller/admin)
 *   2. sellers            — Seller profiles & verification
 *   3. products           — Product listings
 *   4. orders             — Purchase orders
 *   5. categories         — Product categories
 *   6. reviews            — Product reviews & ratings
 *   7. reports            — User reports & moderation
 *   8. admin_logs         — Admin audit trail
 *   9. notifications      — Push & in-app notifications
 *  10. saved_products     — Buyer wishlist / bookmarks
 * 
 *  Storage:
 *   - grambazaar-storage  — Single bucket for all files
 * 
 * ============================================================
 */

const { Client, Databases, ID, Permission, Role } = require('node-appwrite');

// ─── CONFIG ────────────────────────────────────────────────
const ENDPOINT = 'https://cloud.appwrite.io/v1';
const PROJECT_ID = '697aea5a0009bbcaf972';
const API_KEY = process.env.APPWRITE_API_KEY || 'standard_c2356ee4d2fbad11646e9a25a8031b43b64f9512ed6c83a49e05bf353c6a87afffd7ec11d63b44470c381e708919477430d54434544505c16369dca557b6eeba260b74dd7358ea1b96afea45733d8c9942205dc440e872cba82bc3e3fa17e14717a47ec87b8113fd7f16f5a837566fd0ebeea7a1f76e8d930f275cf9ee46fe29';
const DATABASE_ID = '697aeb4a003d2872de00';

const client = new Client()
  .setEndpoint(ENDPOINT)
  .setProject(PROJECT_ID)
  .setKey(API_KEY);

const databases = new Databases(client);

// ─── HELPER: Wait for attribute processing ─────────────────
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ─── HELPER: Get existing attributes ───────────────────────
async function getExistingAttributes(collectionId) {
  try {
    const result = await databases.listAttributes(DATABASE_ID, collectionId);
    return result.attributes.map(a => a.key);
  } catch (e) {
    return [];
  }
}

// ─── HELPER: Get existing collections ──────────────────────
async function getExistingCollections() {
  try {
    const result = await databases.listCollections(DATABASE_ID);
    return result.collections.map(c => c.$id);
  } catch (e) {
    return [];
  }
}

// ─── HELPER: Get existing indexes ──────────────────────────
async function getExistingIndexes(collectionId) {
  try {
    const result = await databases.listIndexes(DATABASE_ID, collectionId);
    return result.indexes.map(i => i.key);
  } catch (e) {
    return [];
  }
}

// ─── COLLECTION DEFINITIONS ────────────────────────────────

const COLLECTIONS = [
  // ════════════════════════════════════════════════════════════
  // 1. USERS
  // ════════════════════════════════════════════════════════════
  {
    id: 'users',
    name: 'Users',
    attributes: [
      { key: 'email',        type: 'string',  size: 255, required: true },
      { key: 'name',         type: 'string',  size: 255, required: true },
      { key: 'phone',        type: 'string',  size: 20,  required: false, default: '' },
      { key: 'role',         type: 'string',  size: 20,  required: true },  // buyer | seller | admin
      { key: 'profileImage', type: 'string',  size: 500, required: false, default: '' },
      { key: 'createdAt',    type: 'string',  size: 50,  required: false, default: '' },
      { key: 'updatedAt',    type: 'string',  size: 50,  required: false, default: '' },
    ],
    indexes: [
      { key: 'idx_users_email', type: 'unique', attributes: ['email'] },
      { key: 'idx_users_role',  type: 'key',    attributes: ['role'] },
      { key: 'idx_users_phone', type: 'key',    attributes: ['phone'] },
    ],
  },

  // ════════════════════════════════════════════════════════════
  // 2. SELLERS
  // ════════════════════════════════════════════════════════════
  {
    id: 'sellers',
    name: 'Sellers',
    attributes: [
      { key: 'userId',                 type: 'string',  size: 255,  required: true },
      { key: 'businessName',           type: 'string',  size: 255,  required: true },
      { key: 'description',            type: 'string',  size: 2000, required: false, default: '' },
      { key: 'region',                 type: 'string',  size: 100,  required: false, default: '' },
      { key: 'state',                  type: 'string',  size: 100,  required: false, default: '' },
      { key: 'city',                   type: 'string',  size: 100,  required: false, default: '' },
      { key: 'district',               type: 'string',  size: 100,  required: false, default: '' },
      { key: 'village',                type: 'string',  size: 120,  required: false, default: '' },
      { key: 'address',                type: 'string',  size: 500,  required: false, default: '' },
      { key: 'craftType',              type: 'string',  size: 100,  required: false, default: '' },
      { key: 'verificationStatus',     type: 'string',  size: 20,   required: false, default: 'pending' }, // pending | approved | rejected
      { key: 'verificationDocuments',  type: 'string',  size: 2000, required: false, array: true },
      { key: 'shopPhoto',              type: 'string',  size: 500,  required: false, default: '' },
      { key: 'phone',                  type: 'string',  size: 20,   required: false, default: '' },
      { key: 'latitude',               type: 'float',               required: false, default: null },
      { key: 'longitude',              type: 'float',               required: false, default: null },
      { key: 'isShopActive',           type: 'boolean',             required: false, default: true },
      { key: 'verifiedBadge',          type: 'boolean',             required: false, default: false },
      { key: 'rating',                 type: 'float',               required: false, default: 0 },
      { key: 'totalOrders',            type: 'integer',             required: false, default: 0 },
      { key: 'paymentUpiId',           type: 'string',  size: 120,  required: false, default: '' },
      { key: 'paymentQrImageUrl',      type: 'string',  size: 2000, required: false, default: '' },
      { key: 'paymentBankAccountName', type: 'string',  size: 150,  required: false, default: '' },
      { key: 'paymentBankAccountNumber', type: 'string', size: 32,  required: false, default: '' },
      { key: 'paymentBankIfsc',        type: 'string',  size: 20,   required: false, default: '' },
      { key: 'createdAt',              type: 'string',  size: 50,   required: false, default: '' },
      { key: 'updatedAt',              type: 'string',  size: 50,   required: false, default: '' },
    ],
    indexes: [
      { key: 'idx_sellers_userId',     type: 'unique', attributes: ['userId'] },
      { key: 'idx_sellers_status',     type: 'key',    attributes: ['verificationStatus'] },
      { key: 'idx_sellers_region',     type: 'key',    attributes: ['region'] },
      { key: 'idx_sellers_state',      type: 'key',    attributes: ['state'] },
      { key: 'idx_sellers_district',   type: 'key',    attributes: ['district'] },
      { key: 'idx_sellers_craftType',  type: 'key',    attributes: ['craftType'] },
      { key: 'idx_sellers_rating',     type: 'key',    attributes: ['rating'] },
    ],
  },

  // ════════════════════════════════════════════════════════════
  // 3. PRODUCTS
  // ════════════════════════════════════════════════════════════
  {
    id: 'products',
    name: 'Products',
    attributes: [
      { key: 'sellerId',    type: 'string',  size: 255,  required: true },
      { key: 'name',        type: 'string',  size: 255,  required: true },
      { key: 'description', type: 'string',  size: 5000, required: false, default: '' },
      { key: 'images',      type: 'string',  size: 500,  required: false, array: true },
      { key: 'price',       type: 'float',               required: true },
      { key: 'category',    type: 'string',  size: 100,  required: false, default: '' },
      { key: 'region',      type: 'string',  size: 100,  required: false, default: '' },
      { key: 'state',       type: 'string',  size: 100,  required: false, default: '' },
      { key: 'stock',       type: 'integer',             required: false, default: 0 },
      { key: 'status',      type: 'string',  size: 20,   required: false, default: 'pending' }, // pending | approved | rejected | out_of_stock
      { key: 'featured',    type: 'boolean',             required: false, default: false },
      { key: 'rating',      type: 'float',               required: false, default: 0 },
      { key: 'reviewCount', type: 'integer',             required: false, default: 0 },
      { key: 'views',       type: 'integer',             required: false, default: 0 },
      { key: 'tags',        type: 'string',  size: 100,  required: false, array: true },
      { key: 'createdAt',   type: 'string',  size: 50,   required: false, default: '' },
      { key: 'updatedAt',   type: 'string',  size: 50,   required: false, default: '' },
    ],
    indexes: [
      { key: 'idx_products_sellerId',  type: 'key',      attributes: ['sellerId'] },
      { key: 'idx_products_status',    type: 'key',      attributes: ['status'] },
      { key: 'idx_products_category',  type: 'key',      attributes: ['category'] },
      { key: 'idx_products_region',    type: 'key',      attributes: ['region'] },
      { key: 'idx_products_state',     type: 'key',      attributes: ['state'] },
      { key: 'idx_products_featured',  type: 'key',      attributes: ['featured'] },
      { key: 'idx_products_rating',    type: 'key',      attributes: ['rating'] },
      { key: 'idx_products_price',     type: 'key',      attributes: ['price'] },
      { key: 'idx_products_name',      type: 'fulltext', attributes: ['name'] },
      { key: 'idx_products_createdAt', type: 'key',      attributes: ['createdAt'] },
    ],
  },

  // ════════════════════════════════════════════════════════════
  // 4. ORDERS
  // ════════════════════════════════════════════════════════════
  {
    id: 'orders',
    name: 'Orders',
    attributes: [
      { key: 'buyerId',         type: 'string',  size: 255,  required: true },
      { key: 'sellerId',        type: 'string',  size: 255,  required: false, default: '' },
      { key: 'items',           type: 'string',  size: 5000, required: false, default: '[]' }, // JSON string of OrderItem[]
      { key: 'totalAmount',     type: 'float',               required: true },
      { key: 'status',          type: 'string',  size: 30,   required: false, default: 'pending' },
      { key: 'paymentId',       type: 'string',  size: 255,  required: false, default: '' },
      { key: 'paymentStatus',   type: 'string',  size: 20,   required: false, default: 'pending' },
      { key: 'deliveryAddress', type: 'string',  size: 1000, required: false, default: '' },
      { key: 'deliveryTime',    type: 'string',  size: 50,   required: false, default: '' },
      { key: 'trackingInfo',    type: 'string',  size: 500,  required: false, default: '' },
      { key: 'createdAt',       type: 'string',  size: 50,   required: false, default: '' },
      { key: 'updatedAt',       type: 'string',  size: 50,   required: false, default: '' },
    ],
    indexes: [
      { key: 'idx_orders_buyerId',  type: 'key', attributes: ['buyerId'] },
      { key: 'idx_orders_sellerId', type: 'key', attributes: ['sellerId'] },
      { key: 'idx_orders_status',   type: 'key', attributes: ['status'] },
      { key: 'idx_orders_created',  type: 'key', attributes: ['createdAt'] },
    ],
  },

  // ════════════════════════════════════════════════════════════
  // 5. CATEGORIES
  // ════════════════════════════════════════════════════════════
  {
    id: 'categories',
    name: 'Categories',
    attributes: [
      { key: 'name',        type: 'string', size: 100,  required: true },
      { key: 'icon',        type: 'string', size: 50,   required: false, default: '' },
      { key: 'description', type: 'string', size: 500,  required: false, default: '' },
      { key: 'image',       type: 'string', size: 500,  required: false, default: '' },
      { key: 'sortOrder',   type: 'integer',            required: false, default: 0 },
      { key: 'isActive',    type: 'boolean',            required: false, default: true },
    ],
    indexes: [
      { key: 'idx_categories_name',   type: 'unique', attributes: ['name'] },
      { key: 'idx_categories_active', type: 'key',    attributes: ['isActive'] },
    ],
  },

  // ════════════════════════════════════════════════════════════
  // 6. REVIEWS
  // ════════════════════════════════════════════════════════════
  {
    id: 'reviews',
    name: 'Reviews',
    attributes: [
      { key: 'productId', type: 'string',  size: 255,  required: true },
      { key: 'userId',    type: 'string',  size: 255,  required: true },
      { key: 'rating',    type: 'integer',             required: true },
      { key: 'comment',   type: 'string',  size: 2000, required: false, default: '' },
      { key: 'createdAt', type: 'string',  size: 50,   required: false, default: '' },
      { key: 'updatedAt', type: 'string',  size: 50,   required: false, default: '' },
    ],
    indexes: [
      { key: 'idx_reviews_productId', type: 'key', attributes: ['productId'] },
      { key: 'idx_reviews_userId',    type: 'key', attributes: ['userId'] },
      { key: 'idx_reviews_rating',    type: 'key', attributes: ['rating'] },
      { key: 'idx_reviews_created',   type: 'key', attributes: ['createdAt'] },
    ],
  },

  // ════════════════════════════════════════════════════════════
  // 7. REPORTS
  // ════════════════════════════════════════════════════════════
  {
    id: 'reports',
    name: 'Reports',
    attributes: [
      { key: 'reportedBy',     type: 'string', size: 255,  required: true },
      { key: 'reportedEntity', type: 'string', size: 20,   required: true },  // product | seller | review
      { key: 'entityId',       type: 'string', size: 255,  required: true },
      { key: 'reason',         type: 'string', size: 2000, required: true },
      { key: 'status',         type: 'string', size: 20,   required: false, default: 'pending' }, // pending | investigating | resolved | dismissed
      { key: 'resolvedBy',     type: 'string', size: 255,  required: false, default: '' },
      { key: 'resolution',     type: 'string', size: 2000, required: false, default: '' },
      { key: 'createdAt',      type: 'string', size: 50,   required: false, default: '' },
      { key: 'resolvedAt',     type: 'string', size: 50,   required: false, default: '' },
    ],
    indexes: [
      { key: 'idx_reports_status',   type: 'key', attributes: ['status'] },
      { key: 'idx_reports_reporter', type: 'key', attributes: ['reportedBy'] },
      { key: 'idx_reports_entity',   type: 'key', attributes: ['reportedEntity'] },
      { key: 'idx_reports_created',  type: 'key', attributes: ['createdAt'] },
    ],
  },

  // ════════════════════════════════════════════════════════════
  // 8. ADMIN LOGS
  // ════════════════════════════════════════════════════════════
  {
    id: 'admin_logs',
    name: 'Admin Logs',
    attributes: [
      { key: 'adminId',    type: 'string', size: 255,  required: true },
      { key: 'action',     type: 'string', size: 100,  required: true },
      { key: 'entityType', type: 'string', size: 50,   required: false, default: '' },  // seller | product | user | report
      { key: 'entityId',   type: 'string', size: 255,  required: false, default: '' },
      { key: 'details',    type: 'string', size: 2000, required: false, default: '' },
      { key: 'createdAt',  type: 'string', size: 50,   required: false, default: '' },
    ],
    indexes: [
      { key: 'idx_logs_adminId',  type: 'key', attributes: ['adminId'] },
      { key: 'idx_logs_action',   type: 'key', attributes: ['action'] },
      { key: 'idx_logs_entity',   type: 'key', attributes: ['entityType'] },
      { key: 'idx_logs_created',  type: 'key', attributes: ['createdAt'] },
    ],
  },

  // ════════════════════════════════════════════════════════════
  // 9. NOTIFICATIONS
  // ════════════════════════════════════════════════════════════
  {
    id: 'notifications',
    name: 'Notifications',
    attributes: [
      { key: 'userId',          type: 'string',  size: 255,  required: true },
      { key: 'type',            type: 'string',  size: 50,   required: false, default: 'general' },
      { key: 'message',         type: 'string',  size: 1000, required: true },
      { key: 'isRead',          type: 'boolean',             required: false, default: false },
      { key: 'relatedEntityId', type: 'string',  size: 255,  required: false, default: '' },
      { key: 'createdAt',       type: 'string',  size: 50,   required: false, default: '' },
    ],
    indexes: [
      { key: 'idx_notif_userId',  type: 'key', attributes: ['userId'] },
      { key: 'idx_notif_isRead',  type: 'key', attributes: ['isRead'] },
      { key: 'idx_notif_type',    type: 'key', attributes: ['type'] },
      { key: 'idx_notif_created', type: 'key', attributes: ['createdAt'] },
    ],
  },

  // ════════════════════════════════════════════════════════════
  // 10. SAVED PRODUCTS (Buyer Wishlist)
  // ════════════════════════════════════════════════════════════
  {
    id: 'saved_products',
    name: 'Saved Products',
    attributes: [
      { key: 'userId',    type: 'string', size: 255, required: true },
      { key: 'productId', type: 'string', size: 255, required: true },
      { key: 'createdAt', type: 'string', size: 50,  required: false, default: '' },
    ],
    indexes: [
      { key: 'idx_saved_userId',    type: 'key', attributes: ['userId'] },
      { key: 'idx_saved_productId', type: 'key', attributes: ['productId'] },
    ],
  },
];

// ─── MAIN EXECUTION ────────────────────────────────────────

async function createAttribute(collectionId, attr) {
  try {
    if (attr.type === 'string') {
      if (attr.array) {
        await databases.createStringAttribute(
          DATABASE_ID, collectionId, attr.key, attr.size, attr.required, attr.default || null, attr.array
        );
      } else {
        await databases.createStringAttribute(
          DATABASE_ID, collectionId, attr.key, attr.size, attr.required, attr.default !== undefined ? attr.default : null
        );
      }
    } else if (attr.type === 'integer') {
      await databases.createIntegerAttribute(
        DATABASE_ID, collectionId, attr.key, attr.required, undefined, undefined, attr.default !== undefined ? attr.default : null
      );
    } else if (attr.type === 'float') {
      await databases.createFloatAttribute(
        DATABASE_ID, collectionId, attr.key, attr.required, undefined, undefined, attr.default !== undefined ? attr.default : null
      );
    } else if (attr.type === 'boolean') {
      await databases.createBooleanAttribute(
        DATABASE_ID, collectionId, attr.key, attr.required, attr.default !== undefined ? attr.default : null
      );
    }
    return true;
  } catch (e) {
    if (e.message?.includes('already exists') || e.code === 409) return false;
    throw e;
  }
}

async function createIndex(collectionId, idx) {
  try {
    await databases.createIndex(
      DATABASE_ID, collectionId, idx.key, idx.type, idx.attributes, idx.orders || []
    );
    return true;
  } catch (e) {
    if (e.message?.includes('already exists') || e.code === 409) return false;
    throw e;
  }
}

async function run() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║   GramBazaar — Final Database Setup (v1.0)      ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');

  const existingCollections = await getExistingCollections();
  let totalCreated = 0;
  let totalSkipped = 0;

  for (const col of COLLECTIONS) {
    console.log(`\n📋 Collection: ${col.name} (${col.id})`);
    console.log('─'.repeat(50));

    // Create collection if not exists
    if (!existingCollections.includes(col.id)) {
      try {
        await databases.createCollection(
          DATABASE_ID,
          col.id,
          col.name,
          [
            Permission.read(Role.any()),
            Permission.create(Role.users()),
            Permission.update(Role.users()),
            Permission.delete(Role.users()),
          ]
        );
        console.log(`   ✅ Collection created`);
      } catch (e) {
        console.log(`   ❌ Failed to create collection: ${e.message}`);
        continue;
      }
    } else {
      console.log(`   ⏭️  Collection exists`);
    }

    // Get existing attributes
    const existingAttrs = await getExistingAttributes(col.id);

    // Create attributes
    for (const attr of col.attributes) {
      if (existingAttrs.includes(attr.key)) {
        console.log(`   ⏭️  ${attr.key} — exists`);
        totalSkipped++;
        continue;
      }

      try {
        const created = await createAttribute(col.id, attr);
        if (created) {
          console.log(`   ✅ ${attr.key} (${attr.type}${attr.array ? ' []' : ''})`);
          totalCreated++;
        } else {
          console.log(`   ⏭️  ${attr.key} — exists`);
          totalSkipped++;
        }
      } catch (e) {
        console.log(`   ❌ ${attr.key} — ${e.message}`);
      }
    }

    // Wait for attributes to be processed before creating indexes
    if (totalCreated > 0) {
      console.log(`   ⏳ Waiting for attributes to process...`);
      await sleep(3000);
    }

    // Create indexes
    const existingIdxs = await getExistingIndexes(col.id);
    for (const idx of col.indexes) {
      if (existingIdxs.includes(idx.key)) {
        console.log(`   ⏭️  Index ${idx.key} — exists`);
        continue;
      }

      try {
        const created = await createIndex(col.id, idx);
        if (created) {
          console.log(`   🔑 Index ${idx.key} (${idx.type})`);
        } else {
          console.log(`   ⏭️  Index ${idx.key} — exists`);
        }
      } catch (e) {
        console.log(`   ❌ Index ${idx.key} — ${e.message}`);
      }
      await sleep(1000); // Rate limit between indexes
    }
  }

  console.log('\n');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║   ✅ SETUP COMPLETE                              ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║   Created: ${totalCreated} attributes                       ║`);
  console.log(`║   Skipped: ${totalSkipped} (already existed)                ║`);
  console.log('╠══════════════════════════════════════════════════╣');
  console.log('║                                                  ║');
  console.log('║   Collections (10):                              ║');
  console.log('║   ├── users                                      ║');
  console.log('║   ├── sellers                                    ║');
  console.log('║   ├── products                                   ║');
  console.log('║   ├── orders                                     ║');
  console.log('║   ├── categories                                 ║');
  console.log('║   ├── reviews                                    ║');
  console.log('║   ├── reports                                    ║');
  console.log('║   ├── admin_logs                                 ║');
  console.log('║   ├── notifications                              ║');
  console.log('║   └── saved_products                             ║');
  console.log('║                                                  ║');
  console.log('║   Storage: grambazaar-storage                    ║');
  console.log('║                                                  ║');
  console.log('║   This is the FINAL structure.                   ║');
  console.log('║   No further DB changes needed.                  ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
}

run().catch(e => {
  console.error('\n❌ Fatal error:', e.message);
  process.exit(1);
});
