const { Client, Databases } = require('node-appwrite');

const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID || '697aea5a0009bbcaf972';
const APPWRITE_DATABASE_ID = process.env.APPWRITE_DATABASE_ID || '697aeb4a003d2872de00';
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY;
const DRY_RUN = (process.env.DRY_RUN || 'true').toLowerCase() !== 'false';

const cleanupRules = [
  { collectionId: 'reports', legacyKey: 'status_idx', canonicalKey: 'idx_reports_status' },
  { collectionId: 'admin_logs', legacyKey: 'adminId_idx', canonicalKey: 'idx_logs_adminId' },
  { collectionId: 'admin_logs', legacyKey: 'action_idx', canonicalKey: 'idx_logs_action' },
  { collectionId: 'notifications', legacyKey: 'userId_idx', canonicalKey: 'idx_notif_userId' },
  { collectionId: 'notifications', legacyKey: 'isRead_idx', canonicalKey: 'idx_notif_isRead' },
];

if (!APPWRITE_API_KEY) {
  console.error('Missing APPWRITE_API_KEY.');
  console.error('PowerShell example:');
  console.error('  $env:APPWRITE_API_KEY="your_api_key"; node cleanup-duplicate-indexes.js');
  process.exit(1);
}

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);

const databases = new Databases(client);

async function run() {
  console.log('Cleaning duplicate indexes...');
  console.log(`Mode: ${DRY_RUN ? 'DRY_RUN (no deletions)' : 'EXECUTE (deletions enabled)'}`);

  const grouped = cleanupRules.reduce((acc, rule) => {
    acc[rule.collectionId] = acc[rule.collectionId] || [];
    acc[rule.collectionId].push(rule);
    return acc;
  }, {});

  let removedCount = 0;
  let skippedCount = 0;

  for (const collectionId of Object.keys(grouped)) {
    const collection = await databases.getCollection(APPWRITE_DATABASE_ID, collectionId);
    const indexKeys = new Set((collection.indexes || []).map((idx) => idx.key));

    console.log(`\nCollection: ${collectionId}`);

    for (const rule of grouped[collectionId]) {
      const hasLegacy = indexKeys.has(rule.legacyKey);
      const hasCanonical = indexKeys.has(rule.canonicalKey);

      if (!hasLegacy) {
        console.log(`  - Skip ${rule.legacyKey}: not present`);
        skippedCount += 1;
        continue;
      }

      if (!hasCanonical) {
        console.log(`  - Skip ${rule.legacyKey}: canonical ${rule.canonicalKey} missing`);
        skippedCount += 1;
        continue;
      }

      if (DRY_RUN) {
        console.log(`  - Would delete ${rule.legacyKey} (canonical: ${rule.canonicalKey})`);
        skippedCount += 1;
        continue;
      }

      await databases.deleteIndex(APPWRITE_DATABASE_ID, collectionId, rule.legacyKey);
      console.log(`  - Deleted ${rule.legacyKey} (canonical: ${rule.canonicalKey})`);
      removedCount += 1;
    }
  }

  console.log('\nDone.');
  console.log(`Removed: ${removedCount}`);
  console.log(`Skipped: ${skippedCount}`);
}

run().catch((error) => {
  console.error('Cleanup failed:', error.message || error);
  process.exit(1);
});
