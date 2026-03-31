/**
 * Create Missing User Document
 */

const sdk = require('node-appwrite');

const client = new sdk.Client();
const databases = new sdk.Databases(client);

client
    .setEndpoint('https://cloud.appwrite.io/v1')
    .setProject('697aea5a0009bbcaf972')
    .setKey('standard_c4e1cc93997ad3ba97815b907f9d6b758ba5542fc1165eefc96e33d5ce86a4d0163d03f743f4ca2f3e2c33630004e5e930d72aaa0457c426525a58140614d528fcf01e57a8f5af41ba11aebc0a3f5ec2bf8e0c670afc2245eac16f00f58bd05fd005b397a32b1ea4ebee08ff06d77dde7c852e6bae74f7d507551fe802ab10f6');

const DATABASE_ID = '697aeb4a003d2872de00';

async function createUserDocument() {
    console.log('🔧 Creating missing user document...\n');

    // Change these values to match the user trying to log in
    const userId = '697b1424002e50701d3d';  // Update this
    const email = 'shubh9525looser@gmail.com';  // Update this
    const name = 'Shubham';  // Update this

    try {
        await databases.createDocument(
            DATABASE_ID,
            'users',
            userId, // Use the same ID as the auth account
            {
                email: email,
                name: name,
                phone: '',
                role: 'buyer',
                profileImage: '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        );

        console.log('✅ User document created successfully!');
        console.log('\nNow restart your app and try logging in again:');
        console.log('npx expo start -c');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.code === 409) {
            console.log('\nℹ User document already exists!');
        }
    }
}

createUserDocument();
