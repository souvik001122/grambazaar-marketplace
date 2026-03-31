const { Client, Databases } = require('node-appwrite');

const client = new Client();
client
  .setEndpoint('https://cloud.appwrite.io/v1')
  .setProject('697aea5a0009bbcaf972')
  .setKey('standard_c2356ee4d2fbad11646e9a25a8031b43b64f9512ed6c83a49e05bf353c6a87afffd7ec11d63b44470c381e708919477430d54434544505c16369dca557b6eeba260b74dd7358ea1b96afea45733d8c9942205dc440e872cba82bc3e3fa17e14717a47ec87b8113fd7f16f5a837566fd0ebeea7a1f76e8d930f275cf9ee46fe29');

const databases = new Databases(client);
const databaseId = '697aeb4a003d2872de00';

async function checkStructure() {
  console.log('Checking database structure...\n');
  
  try {
    // Get all collections
    const collections = await databases.listCollections(databaseId);
    
    console.log(`Found ${collections.total} collections:\n`);
    
    for (const collection of collections.collections) {
      console.log(`\n📋 Collection: ${collection.name} (ID: ${collection.$id})`);
      console.log('─'.repeat(60));
      
      // Get collection details with attributes
      const collectionDetails = await databases.getCollection(databaseId, collection.$id);
      
      if (collectionDetails.attributes && collectionDetails.attributes.length > 0) {
        console.log('Attributes:');
        collectionDetails.attributes.forEach(attr => {
          const required = attr.required ? '✓ REQUIRED' : '✗ optional';
          const type = attr.type.toUpperCase();
          const size = attr.size ? ` (size: ${attr.size})` : '';
          const array = attr.array ? ' [ARRAY]' : '';
          console.log(`  - ${attr.key}: ${type}${size}${array} ${required}`);
        });
      } else {
        console.log('  No attributes defined');
      }
      
      if (collectionDetails.indexes && collectionDetails.indexes.length > 0) {
        console.log('Indexes:');
        collectionDetails.indexes.forEach(idx => {
          console.log(`  - ${idx.key}: ${idx.type} on [${idx.attributes.join(', ')}]`);
        });

        const signatureMap = new Map();
        collectionDetails.indexes.forEach((idx) => {
          const signature = `${idx.type}:${(idx.attributes || []).join(',')}`;
          const list = signatureMap.get(signature) || [];
          list.push(idx.key);
          signatureMap.set(signature, list);
        });

        const duplicates = Array.from(signatureMap.entries())
          .filter(([, keys]) => keys.length > 1)
          .map(([signature, keys]) => ({ signature, keys }));

        if (duplicates.length > 0) {
          console.log('Potential duplicate indexes:');
          duplicates.forEach((dup) => {
            const [type, attrs] = dup.signature.split(':');
            console.log(`  - ${type} on [${attrs || ''}] -> ${dup.keys.join(', ')}`);
          });
        }
      }
    }
    
    console.log('\n\n✅ Structure check complete!');
    
  } catch (error) {
    console.error('Error checking structure:', error.message);
  }
}

checkStructure();
