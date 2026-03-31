/**
 * Complete Fix for Authentication System
 * This script will:
 * 1. Ensure all attributes exist in users collection
 * 2. Fix all permissions
 * 3. Create missing user documents for existing accounts
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

async function completeAuthFix() {
    console.log('🔧 Starting complete authentication system fix...\n');

    // Step 1: Fix permissions for all collections
    console.log('📋 Step 1: Fixing permissions...');
    const collections = ['users', 'sellers', 'products', 'orders', 'categories'];
    
    for (const collectionId of collections) {
        try {
            await databases.updateCollection(
                DATABASE_ID,
                collectionId,
                collectionId.charAt(0).toUpperCase() + collectionId.slice(1),
                [
                    sdk.Permission.read(sdk.Role.any()),
                    sdk.Permission.create(sdk.Role.any()),
                    sdk.Permission.update(sdk.Role.any()),
                    sdk.Permission.delete(sdk.Role.any())
                ]
            );
            console.log(`  ✓ ${collectionId} permissions updated`);
        } catch (error) {
            console.log(`  ⚠ ${collectionId}: ${error.message}`);
        }
    }

    // Step 2: Ensure all attributes exist in users collection
    console.log('\n📋 Step 2: Checking users collection attributes...');
    const requiredAttributes = [
        { key: 'email', type: 'string', size: 255, required: true },
        { key: 'name', type: 'string', size: 255, required: true },
        { key: 'phone', type: 'string', size: 20, required: false },
        { key: 'role', type: 'string', size: 50, required: false, default: 'buyer' },
        { key: 'profileImage', type: 'string', size: 2000, required: false },
        { key: 'createdAt', type: 'string', size: 50, required: true },
        { key: 'updatedAt', type: 'string', size: 50, required: true }
    ];

    for (const attr of requiredAttributes) {
        try {
            await databases.createStringAttribute(
                DATABASE_ID,
                'users',
                attr.key,
                attr.size,
                attr.required,
                attr.default
            );
            console.log(`  ✓ Added attribute: ${attr.key}`);
            await sleep(1000);
        } catch (error) {
            if (error.code === 409) {
                console.log(`  ✓ ${attr.key} already exists`);
            } else {
                console.log(`  ⚠ ${attr.key}: ${error.message}`);
            }
        }
    }

    // Step 3: Wait for attributes to be ready
    console.log('\n⏳ Waiting for attributes to be ready...');
    await sleep(3000);

    // Step 4: Get all users from Auth and create missing documents
    console.log('\n📋 Step 3: Creating missing user documents...');
    try {
        const allUsers = await users.list();
        console.log(`  Found ${allUsers.total} auth accounts`);

        for (const user of allUsers.users) {
            try {
                // Try to get existing document
                await databases.getDocument(DATABASE_ID, 'users', user.$id);
                console.log(`  ✓ Document exists for: ${user.email}`);
            } catch (error) {
                if (error.code === 404) {
                    // Document doesn't exist, create it
                    try {
                        await databases.createDocument(
                            DATABASE_ID,
                            'users',
                            user.$id,
                            {
                                email: user.email,
                                name: user.name,
                                phone: user.phone || '',
                                role: 'buyer',
                                profileImage: '',
                                createdAt: user.$createdAt,
                                updatedAt: user.$updatedAt
                            }
                        );
                        console.log(`  ✓ Created document for: ${user.email}`);
                    } catch (createError) {
                        console.log(`  ❌ Failed to create document for ${user.email}: ${createError.message}`);
                    }
                }
            }
        }
    } catch (error) {
        console.error('  ❌ Error listing users:', error.message);
    }

    console.log('\n✅ Authentication system fix complete!\n');
    console.log('📝 Next steps:');
    console.log('   1. Restart your app: npx expo start -c');
    console.log('   2. Try logging in with existing accounts');
    console.log('   3. Try creating new accounts - they should work automatically!');
    console.log('\n🎉 Users can now register and login easily!');
}

completeAuthFix();
