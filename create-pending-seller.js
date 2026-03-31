const { Client, Databases, ID } = require('node-appwrite');

const PROJECT_ID = '697aea5a0009bbcaf972';
const DATABASE_ID = '697aeb4a003d2872de00';
const API_KEY = 'standard_c4e1cc93997ad3ba97815b907f9d6b758ba5542fc1165eefc96e33d5ce86a4d0163d03f743f4ca2f3e2c33630004e5e930d72aaa0457c426525a58140614d528fcf01e57a8f5af41ba11aebc0a3f5ec2bf8e0c670afc2245eac16f00f58bd05fd005b397a32b1ea4ebee08ff06d77dde7c852e6bae74f7d507551fe802ab10f6';

const client = new Client()
    .setEndpoint('https://cloud.appwrite.io/v1')
    .setProject(PROJECT_ID)
    .setKey(API_KEY);

const databases = new Databases(client);

async function createPendingSeller() {
    try {
        console.log('📝 Creating a test pending seller...');

        // Use Shubham's user ID for the seller
        const userId = '697b1424002e50701d3d'; // Shubham's ID

        // Check if seller already exists
        const existingSellers = await databases.listDocuments(
            DATABASE_ID,
            'sellers',
            []
        );

        console.log('📋 Existing sellers:', existingSellers.documents.length);

        // Create a new test seller
        const seller = await databases.createDocument(
            DATABASE_ID,
            'sellers',
            ID.unique(),
            {
                userId: userId,
                businessName: 'Traditional Handicrafts by Shubham',
                description: 'Authentic handmade crafts from rural India. Specializing in traditional pottery, textiles, and wooden artifacts. Over 15 years of experience in preserving ancient craft techniques.',
                region: 'Uttar Pradesh',
                state: 'Uttar Pradesh',
                city: 'Varanasi',
                district: 'Varanasi',
                village: 'Nagwa',
                address: 'Shop No. 23, Craftsman Colony, Near Ghats, Varanasi',
                phone: '9876543210',
                craftType: 'Pottery & Textiles',
                verificationStatus: 'pending',
                verificationDocuments: [],
                verifiedBadge: false,
                rating: 0,
                totalOrders: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            }
        );

        console.log('✅ Test seller created successfully!');
        console.log('📦 Seller ID:', seller.$id);
        console.log('👤 User ID:', seller.userId);
        console.log('🏪 Business Name:', seller.businessName);
        console.log('⏳ Status:', seller.verificationStatus);
        
        console.log('\n✅ Now login as admin and go to the Sellers tab to see the verification request!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Response:', error.response);
        }
    }
}

createPendingSeller();
