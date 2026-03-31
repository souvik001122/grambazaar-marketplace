const { Client, Databases, ID } = require('node-appwrite');

const PROJECT_ID = '697aea5a0009bbcaf972';
const DATABASE_ID = '697aeb4a003d2872de00';
const API_KEY = 'standard_c4e1cc93997ad3ba97815b907f9d6b758ba5542fc1165eefc96e33d5ce86a4d0163d03f743f4ca2f3e2c33630004e5e930d72aaa0457c426525a58140614d528fcf01e57a8f5af41ba11aebc0a3f5ec2bf8e0c670afc2245eac16f00f58bd05fd005b397a32b1ea4ebee08ff06d77dde7c852e6bae74f7d507551fe802ab10f6';

const client = new Client()
    .setEndpoint('https://cloud.appwrite.io/v1')
    .setProject(PROJECT_ID)
    .setKey(API_KEY);

const databases = new Databases(client);

async function createSellerProfile() {
    try {
        console.log('📝 Creating seller profile for seller123@gmail.com...');

        // Seller user ID from the logs
        const userId = '697b1f7a000f0c1ec1c7';

        // Check if seller already exists
        const existingSellers = await databases.listDocuments(
            DATABASE_ID,
            'sellers',
            []
        );

        console.log('📋 Existing sellers:', existingSellers.documents.length);

        // Check if this user already has a seller profile
        const existing = existingSellers.documents.find(s => s.userId === userId);
        if (existing) {
            console.log('✅ Seller profile already exists for this user!');
            console.log('📦 Seller ID:', existing.$id);
            console.log('🏪 Business Name:', existing.businessName);
            console.log('⏳ Status:', existing.verificationStatus);
            return;
        }

        // Create a new seller profile
        const seller = await databases.createDocument(
            DATABASE_ID,
            'sellers',
            ID.unique(),
            {
                userId: userId,
                businessName: 'Artisan Crafts by Seller',
                description: 'Premium handcrafted products made with traditional techniques. Specializing in authentic rural crafts including pottery, weaving, and metalwork. Supporting local artisans and preserving cultural heritage.',
                region: 'Maharashtra',
                state: 'Maharashtra',
                city: 'Pune',
                district: 'Pune',
                village: 'Kasba Peth',
                address: 'Shop No. 45, Artisan Market, Deccan Area, Pune',
                phone: '9876543210',
                craftType: 'Handicrafts & Pottery',
                verificationStatus: 'pending',
                verificationDocuments: [],
                verifiedBadge: false,
                rating: 0,
                totalOrders: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            }
        );

        console.log('\n✅ Seller profile created successfully!');
        console.log('📦 Seller ID:', seller.$id);
        console.log('👤 User ID:', seller.userId);
        console.log('🏪 Business Name:', seller.businessName);
        console.log('⏳ Verification Status:', seller.verificationStatus);
        
        console.log('\n✨ Now you can:');
        console.log('1. Refresh the seller profile page to see your business details');
        console.log('2. Login as admin to approve this seller');
        console.log('3. After approval, you can start adding products!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Response:', error.response);
        }
    }
}

createSellerProfile();
