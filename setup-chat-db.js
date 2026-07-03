/**
 * GramBazaar — Setup Chat Collection Database Script
 * 
 * Run: node setup-chat-db.js
 */

const { Client, Databases, ID, Permission, Role } = require('node-appwrite');

const ENDPOINT = 'https://cloud.appwrite.io/v1';
const PROJECT_ID = '697aea5a0009bbcaf972';
const API_KEY = process.env.APPWRITE_API_KEY || 'standard_c2356ee4d2fbad11646e9a25a8031b43b64f9512ed6c83a49e05bf353c6a87afffd7ec11d63b44470c381e708919477430d54434544505c16369dca557b6eeba260b74dd7358ea1b96afea45733d8c9942205dc440e872cba82bc3e3fa17e14717a47ec87b8113fd7f16f5a837566fd0ebeea7a1f76e8d930f275cf9ee46fe29';
const DATABASE_ID = '697aeb4a003d2872de00';
const COLLECTION_ID = 'chat_messages';

const client = new Client()
  .setEndpoint(ENDPOINT)
  .setProject(PROJECT_ID)
  .setKey(API_KEY);

const databases = new Databases(client);
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function getExistingCollections() {
  try {
    const result = await databases.listCollections(DATABASE_ID);
    return result.collections.map(c => c.$id);
  } catch (e) {
    return [];
  }
}

async function run() {
  console.log('🚀 Starting setup for chat collection...\n');
  
  const existing = await getExistingCollections();
  
  if (!existing.includes(COLLECTION_ID)) {
    try {
      console.log(`Creating collection: ${COLLECTION_ID}...`);
      await databases.createCollection(
        DATABASE_ID,
        COLLECTION_ID,
        'Chat Messages',
        [
          Permission.read(Role.any()),
          Permission.create(Role.users()),
          Permission.update(Role.users()),
          Permission.delete(Role.users()),
        ]
      );
      console.log('✓ Collection created successfully.');
    } catch (error) {
      console.error('❌ Failed to create collection:', error.message);
      return;
    }
  } else {
    console.log('⏭️ Collection chat_messages already exists.');
  }

  // Define attributes
  const attributes = [
    { key: 'senderId', type: 'string', size: 255, required: true },
    { key: 'receiverId', type: 'string', size: 255, required: true },
    { key: 'text', type: 'string', size: 1000, required: true },
    { key: 'productId', type: 'string', size: 255, required: false, default: '' },
    { key: 'createdAt', type: 'string', size: 50, required: true },
  ];

  console.log('\nConfiguring attributes...');
  for (const attr of attributes) {
    try {
      if (attr.type === 'string') {
        await databases.createStringAttribute(
          DATABASE_ID,
          COLLECTION_ID,
          attr.key,
          attr.size,
          attr.required,
          attr.default !== undefined ? attr.default : null
        );
        console.log(`  ✓ Added attribute: ${attr.key}`);
        await sleep(1000);
      }
    } catch (e) {
      if (e.message?.includes('already exists') || e.code === 409) {
        console.log(`  ⏭️ Attribute ${attr.key} already exists`);
      } else {
        console.error(`  ❌ Failed to create attribute ${attr.key}:`, e.message);
      }
    }
  }

  console.log('⏳ Waiting for attributes compilation...');
  await sleep(4000);

  // Define indexes
  const indexes = [
    { key: 'idx_chat_sender', type: 'key', attributes: ['senderId'] },
    { key: 'idx_chat_receiver', type: 'key', attributes: ['receiverId'] },
  ];

  console.log('\nConfiguring indexes...');
  for (const idx of indexes) {
    try {
      await databases.createIndex(
        DATABASE_ID,
        COLLECTION_ID,
        idx.key,
        idx.type,
        idx.attributes
      );
      console.log(`  ✓ Added index: ${idx.key}`);
      await sleep(1000);
    } catch (e) {
      if (e.message?.includes('already exists') || e.code === 409) {
        console.log(`  ⏭️ Index ${idx.key} already exists`);
      } else {
        console.error(`  ❌ Failed to create index ${idx.key}:`, e.message);
      }
    }
  }

  console.log('\n🎉 Chat database setup completed successfully!\n');
}

run().catch(e => {
  console.error('Fatal error during chat setup:', e.message);
});
