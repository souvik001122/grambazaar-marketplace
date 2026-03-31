/**
 * Add Missing Attributes to Collections
 */

const sdk = require('node-appwrite');

const client = new sdk.Client();
const databases = new sdk.Databases(client);

client
    .setEndpoint('https://cloud.appwrite.io/v1')
    .setProject('697aea5a0009bbcaf972')
    .setKey('standard_c4e1cc93997ad3ba97815b907f9d6b758ba5542fc1165eefc96e33d5ce86a4d0163d03f743f4ca2f3e2c33630004e5e930d72aaa0457c426525a58140614d528fcf01e57a8f5af41ba11aebc0a3f5ec2bf8e0c670afc2245eac16f00f58bd05fd005b397a32b1ea4ebee08ff06d77dde7c852e6bae74f7d507551fe802ab10f6');

const DATABASE_ID = '697aeb4a003d2872de00';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function addMissingAttributes() {
    console.log('🔧 Adding missing attributes to collections...\n');

    try {
        // Check and add missing attributes to users collection
        console.log('Checking users collection...');
        const usersAttributes = [
            { key: 'email', type: 'string', size: 255, required: true },
            { key: 'name', type: 'string', size: 255, required: true },
            { key: 'phone', type: 'string', size: 20, required: false },
            { key: 'role', type: 'string', size: 50, required: false, default: 'buyer' },
            { key: 'profileImage', type: 'string', size: 2000, required: false },
            { key: 'createdAt', type: 'string', size: 50, required: true },
            { key: 'updatedAt', type: 'string', size: 50, required: true }
        ];

        for (const attr of usersAttributes) {
            try {
                if (attr.type === 'string') {
                    await databases.createStringAttribute(
                        DATABASE_ID, 
                        'users', 
                        attr.key, 
                        attr.size, 
                        attr.required,
                        attr.default
                    );
                    console.log(`  ✓ Added attribute: ${attr.key}`);
                    await sleep(500);
                }
            } catch (error) {
                if (error.code === 409) {
                    console.log(`  ⚠ ${attr.key} already exists`);
                } else {
                    console.error(`  ❌ Error adding ${attr.key}:`, error.message);
                }
            }
        }

        // Check and add missing attributes to sellers collection
        console.log('\nChecking sellers collection...');
        const sellersAttributes = [
            { key: 'businessName', type: 'string', size: 255, required: false, default: '' },
            { key: 'description', type: 'string', size: 2000, required: false, default: '' },
            { key: 'region', type: 'string', size: 100, required: false, default: '' },
            { key: 'state', type: 'string', size: 100, required: false, default: '' },
            { key: 'city', type: 'string', size: 100, required: false, default: '' },
            { key: 'phone', type: 'string', size: 20, required: false },
            { key: 'village', type: 'string', size: 255, required: false },
            { key: 'district', type: 'string', size: 255, required: false },
            { key: 'address', type: 'string', size: 500, required: false, default: '' },
            { key: 'craftType', type: 'string', size: 100, required: false, default: '' },
            { key: 'verificationStatus', type: 'string', size: 20, required: false, default: 'pending' },
            { key: 'verificationDocuments', type: 'string', size: 2000, required: false, array: true },
            { key: 'shopPhoto', type: 'string', size: 500, required: false, default: '' },
            { key: 'latitude', type: 'float', required: false },
            { key: 'longitude', type: 'float', required: false },
            { key: 'isShopActive', type: 'boolean', required: false, default: true },
            { key: 'verifiedBadge', type: 'boolean', required: false, default: false },
            { key: 'rating', type: 'float', required: false, default: 0 },
            { key: 'totalOrders', type: 'integer', required: false, default: 0 },
            { key: 'paymentUpiId', type: 'string', size: 255, required: false },
            { key: 'paymentQrImageUrl', type: 'string', size: 2000, required: false },
            { key: 'paymentBankAccountName', type: 'string', size: 255, required: false },
            { key: 'paymentBankAccountNumber', type: 'string', size: 50, required: false },
            { key: 'paymentBankIfsc', type: 'string', size: 20, required: false },
            { key: 'createdAt', type: 'string', size: 50, required: false, default: '' },
            { key: 'updatedAt', type: 'string', size: 50, required: false, default: '' }
        ];

        for (const attr of sellersAttributes) {
            try {
                if (attr.type === 'string') {
                    await databases.createStringAttribute(
                        DATABASE_ID,
                        'sellers',
                        attr.key,
                        attr.size,
                        attr.required,
                        attr.default,
                        attr.array
                    );
                    console.log(`  ✓ Added attribute: ${attr.key}`);
                    await sleep(500);
                } else if (attr.type === 'float') {
                    const min = attr.key === 'latitude' ? -90 : -180;
                    const max = attr.key === 'latitude' ? 90 : 180;
                    await databases.createFloatAttribute(
                        DATABASE_ID,
                        'sellers',
                        attr.key,
                        attr.required,
                        min,
                        max,
                        attr.default
                    );
                    console.log(`  ✓ Added attribute: ${attr.key}`);
                    await sleep(500);
                } else if (attr.type === 'boolean') {
                    await databases.createBooleanAttribute(
                        DATABASE_ID,
                        'sellers',
                        attr.key,
                        attr.required,
                        attr.default
                    );
                    console.log(`  ✓ Added attribute: ${attr.key}`);
                    await sleep(500);
                } else if (attr.type === 'integer') {
                    await databases.createIntegerAttribute(
                        DATABASE_ID,
                        'sellers',
                        attr.key,
                        attr.required,
                        undefined,
                        undefined,
                        attr.default
                    );
                    console.log(`  ✓ Added attribute: ${attr.key}`);
                    await sleep(500);
                }
            } catch (error) {
                if (error.code === 409) {
                    console.log(`  ⚠ ${attr.key} already exists`);
                } else {
                    console.error(`  ❌ Error adding ${attr.key}:`, error.message);
                }
            }
        }

        console.log('\nChecking sellers indexes...');
        const sellersIndexes = [
            { key: 'idx_sellers_userId', type: 'unique', attributes: ['userId'] },
            { key: 'idx_sellers_status', type: 'key', attributes: ['verificationStatus'] },
            { key: 'idx_sellers_region', type: 'key', attributes: ['region'] },
            { key: 'idx_sellers_state', type: 'key', attributes: ['state'] },
            { key: 'idx_sellers_district', type: 'key', attributes: ['district'] },
            { key: 'idx_sellers_craftType', type: 'key', attributes: ['craftType'] },
            { key: 'idx_sellers_rating', type: 'key', attributes: ['rating'] }
        ];

        for (const idx of sellersIndexes) {
            try {
                await databases.createIndex(
                    DATABASE_ID,
                    'sellers',
                    idx.key,
                    idx.type,
                    idx.attributes
                );
                console.log(`  ✓ Added index: ${idx.key}`);
                await sleep(500);
            } catch (error) {
                if (error.code === 409) {
                    console.log(`  ⚠ ${idx.key} already exists`);
                } else {
                    console.error(`  ❌ Error adding index ${idx.key}:`, error.message);
                }
            }
        }

        // Check and add missing attributes to orders collection
        console.log('\nChecking orders collection...');
        const ordersAttributes = [
            { key: 'courierName', type: 'string', size: 50, required: false },
            { key: 'trackingId', type: 'string', size: 120, required: false },
            { key: 'shippingDate', type: 'string', size: 50, required: false }
        ];

        for (const attr of ordersAttributes) {
            try {
                if (attr.type === 'string') {
                    await databases.createStringAttribute(
                        DATABASE_ID,
                        'orders',
                        attr.key,
                        attr.size,
                        attr.required,
                        attr.default
                    );
                    console.log(`  ✓ Added attribute: ${attr.key}`);
                    await sleep(500);
                }
            } catch (error) {
                if (error.code === 409) {
                    console.log(`  ⚠ ${attr.key} already exists`);
                } else {
                    console.error(`  ❌ Error adding ${attr.key}:`, error.message);
                }
            }
        }

        // Check and add missing attributes to reports collection
        console.log('\nChecking reports collection...');
        const reportsAttributes = [
            { key: 'details', type: 'string', size: 5000, required: false },
            { key: 'issueCategory', type: 'string', size: 120, required: false },
            { key: 'orderId', type: 'string', size: 80, required: false },
            { key: 'courierName', type: 'string', size: 50, required: false },
            { key: 'trackingId', type: 'string', size: 120, required: false }
        ];

        for (const attr of reportsAttributes) {
            try {
                if (attr.type === 'string') {
                    await databases.createStringAttribute(
                        DATABASE_ID,
                        'reports',
                        attr.key,
                        attr.size,
                        attr.required,
                        attr.default
                    );
                    console.log(`  ✓ Added attribute: ${attr.key}`);
                    await sleep(500);
                }
            } catch (error) {
                if (error.code === 409) {
                    console.log(`  ⚠ ${attr.key} already exists`);
                } else {
                    console.error(`  ❌ Error adding ${attr.key}:`, error.message);
                }
            }
        }

        console.log('\n✅ Attributes check complete!');
        console.log('\nNow try signing up again in your app.');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

addMissingAttributes();
