/**
 * Create Test Data for GramBazaar
 * This will populate the database with sample products, sellers, and categories
 */

const sdk = require('node-appwrite');

const client = new sdk.Client();
const databases = new sdk.Databases(client);
const users = new sdk.Users(client);

client
    .setEndpoint('https://cloud.appwrite.io/v1')
    .setProject('697aea5a0009bbcaf972')
    .setKey('standard_c4e1cc93997ad3ba97815b907f9d6b758ba5542fc1165eefc96e33d5ce86a4d0163d03f743f4ca2f3e2c33630004e5e930d72aaa0457c426525a58140614d528fcf01e57a8f5af41ba11aebc0a3f5ec2bf8e0c670afc2245eac16f00f58bd05fd005b397a32b1ea4ebee08ff06d77dde7c852e6bae74f7d507551fe802ab10f6');

const DATABASE_ID = '697aeb4a003d2872de00';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function createTestData() {
    console.log('🎨 Creating test data for GramBazaar...\n');

    try {
        // Step 1: Create Categories
        console.log('📂 Step 1: Creating categories...');
        const categories = [
            { name: 'Handicrafts', icon: 'hand-saw', description: 'Traditional handmade crafts and decorative items' },
            { name: 'Textiles', icon: 'tshirt-crew', description: 'Handwoven fabrics, sarees, and garments' },
            { name: 'Pottery', icon: 'pot', description: 'Clay pottery, ceramics, and earthenware' },
            { name: 'Jewelry', icon: 'diamond-stone', description: 'Handcrafted jewelry and accessories' },
            { name: 'Woodwork', icon: 'tree', description: 'Wooden crafts, furniture, and carvings' },
            { name: 'Art', icon: 'palette', description: 'Paintings, artwork, and wall hangings' }
        ];

        for (const category of categories) {
            try {
                await databases.createDocument(
                    DATABASE_ID,
                    'categories',
                    sdk.ID.unique(),
                    category
                );
                console.log(`  ✓ Added category: ${category.name}`);
            } catch (error) {
                console.log(`  ⚠ ${category.name}: ${error.message}`);
            }
        }

        // Step 2: Get or create test sellers
        console.log('\n👥 Step 2: Creating test sellers...');
        
        // Get existing users to use as sellers
        const allUsers = await users.list();
        let sellerIds = [];
        
        if (allUsers.total > 0) {
            // Use first user as seller
            const firstUser = allUsers.users[0];
            sellerIds.push(firstUser.$id);
            
            // Create seller profile
            try {
                await databases.createDocument(
                    DATABASE_ID,
                    'sellers',
                    sdk.ID.unique(),
                    {
                        userId: firstUser.$id,
                        businessName: 'Artisan Crafts',
                        description: 'Traditional handicrafts from rural India',
                        region: 'North India',
                        state: 'Rajasthan',
                        city: 'Jaipur',
                        address: 'Pink City Craft Market, Jaipur',
                        craftType: 'Handicrafts',
                        verificationStatus: 'approved',
                        verificationDocuments: [],
                        verifiedBadge: true,
                        rating: 4.8,
                        totalOrders: 150,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    }
                );
                console.log(`  ✓ Created seller profile for: ${firstUser.email}`);
            } catch (error) {
                console.log(`  ⚠ Seller profile: ${error.message}`);
            }
        }

        // Use first user ID for all products (or use the logged-in user's ID)
        const sellerId = sellerIds[0] || '697aeb8000150fdd8f30'; // Fallback to Souvik's ID

        // Step 3: Create Sample Products with Images
        console.log('\n🛍️ Step 3: Creating sample products...');
        
        const products = [
            {
                name: 'Handwoven Silk Saree',
                description: 'Beautiful traditional silk saree with intricate handwoven patterns. Made by skilled artisans from Varanasi. Perfect for special occasions.',
                images: [
                    'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&h=600&fit=crop',
                    'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=800&h=600&fit=crop'
                ],
                price: 5500,
                category: 'Textiles',
                region: 'North India',
                state: 'Uttar Pradesh',
                stock: 15,
                status: 'approved',
                rating: 4.7,
                reviewCount: 23,
                tags: ['silk', 'traditional', 'handwoven', 'saree']
            },
            {
                name: 'Clay Terracotta Pot Set',
                description: 'Set of 3 handmade terracotta pots. Eco-friendly, durable, and perfect for kitchen or home decor. Traditional Indian pottery.',
                images: [
                    'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=800&h=600&fit=crop',
                    'https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=800&h=600&fit=crop'
                ],
                price: 450,
                category: 'Pottery',
                region: 'South India',
                state: 'Tamil Nadu',
                stock: 50,
                status: 'approved',
                rating: 4.5,
                reviewCount: 45,
                tags: ['pottery', 'clay', 'terracotta', 'eco-friendly']
            },
            {
                name: 'Wooden Carved Elephant Statue',
                description: 'Intricately carved wooden elephant statue. Handcrafted by expert woodworkers. Great for home or office decoration.',
                images: [
                    'https://images.unsplash.com/photo-1565191999001-551c187427bb?w=800&h=600&fit=crop',
                    'https://images.unsplash.com/photo-1580982172477-9373ff52ae43?w=800&h=600&fit=crop'
                ],
                price: 1200,
                category: 'Woodwork',
                region: 'South India',
                state: 'Kerala',
                stock: 25,
                status: 'approved',
                rating: 4.9,
                reviewCount: 67,
                tags: ['wooden', 'carved', 'statue', 'elephant']
            },
            {
                name: 'Traditional Brass Diya Set',
                description: 'Set of 5 handcrafted brass diyas. Perfect for festivals and daily puja. Traditional Indian oil lamps with beautiful designs.',
                images: [
                    'https://images.unsplash.com/photo-1604869515882-4d10fa4b0492?w=800&h=600&fit=crop',
                    'https://images.unsplash.com/photo-1609690408670-3f6e5f8d72c5?w=800&h=600&fit=crop'
                ],
                price: 850,
                category: 'Handicrafts',
                region: 'North India',
                state: 'Rajasthan',
                stock: 100,
                status: 'approved',
                rating: 4.6,
                reviewCount: 89,
                tags: ['brass', 'diya', 'lamp', 'traditional', 'festival']
            },
            {
                name: 'Handmade Silver Jhumka Earrings',
                description: 'Exquisite handcrafted silver jhumka earrings with traditional design. Lightweight and comfortable. Perfect for ethnic wear.',
                images: [
                    'https://images.unsplash.com/photo-1535632787350-4e68ef0ac584?w=800&h=600&fit=crop',
                    'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=800&h=600&fit=crop'
                ],
                price: 1800,
                category: 'Jewelry',
                region: 'West India',
                state: 'Gujarat',
                stock: 30,
                status: 'approved',
                rating: 4.8,
                reviewCount: 56,
                tags: ['silver', 'jewelry', 'earrings', 'jhumka', 'handmade']
            },
            {
                name: 'Madhubani Painting Canvas',
                description: 'Authentic Madhubani art painting on canvas. Traditional folk art from Bihar depicting mythological themes. Unique piece.',
                images: [
                    'https://images.unsplash.com/photo-1580206412918-96f6fe8297d8?w=800&h=600&fit=crop',
                    'https://images.unsplash.com/photo-1578301978162-7aae4d755744?w=800&h=600&fit=crop'
                ],
                price: 3500,
                category: 'Art',
                region: 'East India',
                state: 'Bihar',
                stock: 8,
                status: 'approved',
                rating: 5.0,
                reviewCount: 12,
                tags: ['painting', 'madhubani', 'folk-art', 'canvas']
            },
            {
                name: 'Bamboo Basket Set',
                description: 'Eco-friendly bamboo baskets handwoven by tribal artisans. Set of 3 different sizes. Perfect for storage and decor.',
                images: [
                    'https://images.unsplash.com/photo-1610390222909-e9e945c04b44?w=800&h=600&fit=crop',
                    'https://images.unsplash.com/photo-1615529328331-f8917597711f?w=800&h=600&fit=crop'
                ],
                price: 650,
                category: 'Handicrafts',
                region: 'Northeast India',
                state: 'Assam',
                stock: 40,
                status: 'approved',
                rating: 4.4,
                reviewCount: 34,
                tags: ['bamboo', 'basket', 'eco-friendly', 'handwoven']
            },
            {
                name: 'Block Printed Cotton Bedsheet',
                description: 'Hand block printed cotton bedsheet with traditional Rajasthani designs. Double bed size. Natural dyes used.',
                images: [
                    'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&h=600&fit=crop',
                    'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=800&h=600&fit=crop'
                ],
                price: 2200,
                category: 'Textiles',
                region: 'North India',
                state: 'Rajasthan',
                stock: 20,
                status: 'approved',
                rating: 4.7,
                reviewCount: 41,
                tags: ['bedsheet', 'block-print', 'cotton', 'traditional']
            },
            {
                name: 'Copper Water Bottle',
                description: 'Handcrafted pure copper water bottle. Health benefits of drinking from copper vessel. Leak-proof lid. 1 liter capacity.',
                images: [
                    'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&h=600&fit=crop',
                    'https://images.unsplash.com/photo-1625498234376-e94c803e8ae6?w=800&h=600&fit=crop'
                ],
                price: 750,
                category: 'Handicrafts',
                region: 'South India',
                state: 'Karnataka',
                stock: 75,
                status: 'approved',
                rating: 4.6,
                reviewCount: 128,
                tags: ['copper', 'bottle', 'health', 'handcrafted']
            },
            {
                name: 'Warli Art Wall Hanging',
                description: 'Traditional Warli tribal art wall hanging on cloth. Depicts village life scenes. Unique piece from Maharashtra artisans.',
                images: [
                    'https://images.unsplash.com/photo-1582738411706-bfc8e691d1c2?w=800&h=600&fit=crop',
                    'https://images.unsplash.com/photo-1513519245088-0e12902e35ca?w=800&h=600&fit=crop'
                ],
                price: 1500,
                category: 'Art',
                region: 'West India',
                state: 'Maharashtra',
                stock: 12,
                status: 'approved',
                rating: 4.9,
                reviewCount: 28,
                tags: ['warli', 'tribal-art', 'wall-hanging', 'traditional']
            },
            {
                name: 'Jute Shopping Bag Set',
                description: 'Set of 3 eco-friendly jute bags with traditional prints. Reusable and durable. Perfect for shopping and daily use.',
                images: [
                    'https://images.unsplash.com/photo-1591561954557-26941169b49e?w=800&h=600&fit=crop',
                    'https://images.unsplash.com/photo-1547949003-9792a18a2601?w=800&h=600&fit=crop'
                ],
                price: 350,
                category: 'Handicrafts',
                region: 'East India',
                state: 'West Bengal',
                stock: 200,
                status: 'approved',
                rating: 4.3,
                reviewCount: 95,
                tags: ['jute', 'bag', 'eco-friendly', 'reusable']
            },
            {
                name: 'Sandalwood Carved Box',
                description: 'Intricately carved sandalwood jewelry box. Aromatic and beautiful. Perfect for storing jewelry and precious items.',
                images: [
                    'https://images.unsplash.com/photo-1595246140625-573b715d11dc?w=800&h=600&fit=crop',
                    'https://images.unsplash.com/photo-1565191999001-551c187427bb?w=800&h=600&fit=crop'
                ],
                price: 2800,
                category: 'Woodwork',
                region: 'South India',
                state: 'Karnataka',
                stock: 15,
                status: 'approved',
                rating: 4.8,
                reviewCount: 37,
                tags: ['sandalwood', 'carved', 'box', 'jewelry-box']
            }
        ];

        for (const product of products) {
            try {
                await databases.createDocument(
                    DATABASE_ID,
                    'products',
                    sdk.ID.unique(),
                    {
                        sellerId: sellerId,
                        ...product,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    }
                );
                console.log(`  ✓ Created product: ${product.name}`);
                await sleep(500); // Avoid rate limiting
            } catch (error) {
                console.log(`  ❌ ${product.name}: ${error.message}`);
            }
        }

        console.log('\n✅ Test data creation complete!\n');
        console.log('📊 Summary:');
        console.log(`   - ${categories.length} categories`);
        console.log(`   - 1 seller profile`);
        console.log(`   - ${products.length} products with images`);
        console.log('\n🎉 Your app is now ready to test with real-looking data!');
        console.log('\nRestart your app: npx expo start -c');

    } catch (error) {
        console.error('❌ Error creating test data:', error.message);
    }
}

createTestData();
