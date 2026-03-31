const sdk = require('node-appwrite');

const client = new sdk.Client();
const databases = new sdk.Databases(client);

client
  .setEndpoint('https://cloud.appwrite.io/v1')
  .setProject('697aea5a0009bbcaf972')
  .setKey('standard_c4e1cc93997ad3ba97815b907f9d6b758ba5542fc1165eefc96e33d5ce86a4d0163d03f743f4ca2f3e2c33630004e5e930d72aaa0457c426525a58140614d528fcf01e57a8f5af41ba11aebc0a3f5ec2bf8e0c670afc2245eac16f00f58bd05fd005b397a32b1ea4ebee08ff06d77dde7c852e6bae74f7d507551fe802ab10f6');

const databases = new Databases(client);

const DATABASE_ID = '697aeb4a003d2872de00';
const USERS_COLLECTION_ID = '697aeb5c00335e4359e3';

// Delete the duplicate user document with NULL role
const DUPLICATE_DOC_ID = '697b0991001598f9fbbe';

async function deleteDuplicate() {
  try {
    await databases.deleteDocument(DATABASE_ID, USERS_COLLECTION_ID, DUPLICATE_DOC_ID);
    console.log(`✅ Deleted duplicate user document: ${DUPLICATE_DOC_ID}`);
    console.log('Now logout and login again — admin dashboard should appear.');
  } catch (error) {
    console.error('❌ Error deleting document:', error.message);
  }
}

deleteDuplicate();
