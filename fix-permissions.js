/**
 * Fix Appwrite Permissions Script
 * This will set proper permissions for all collections
 */

const sdk = require('node-appwrite');

const client = new sdk.Client();
const databases = new sdk.Databases(client);

client
    .setEndpoint('https://cloud.appwrite.io/v1')
    .setProject('697aea5a0009bbcaf972')
    .setKey('standard_c4e1cc93997ad3ba97815b907f9d6b758ba5542fc1165eefc96e33d5ce86a4d0163d03f743f4ca2f3e2c33630004e5e930d72aaa0457c426525a58140614d528fcf01e57a8f5af41ba11aebc0a3f5ec2bf8e0c670afc2245eac16f00f58bd05fd005b397a32b1ea4ebee08ff06d77dde7c852e6bae74f7d507551fe802ab10f6');

const DATABASE_ID = '697aeb4a003d2872de00';

async function fixPermissions() {
    console.log('🔧 Fixing collection permissions...\n');

    const collections = [
        { id: 'users', name: 'Users' },
        { id: 'sellers', name: 'Sellers' },
        { id: 'products', name: 'Products' },
        { id: 'orders', name: 'Orders' },
        { id: 'categories', name: 'Categories' }
    ];

    for (const collection of collections) {
        try {
            await databases.updateCollection(
                DATABASE_ID,
                collection.id,
                collection.name,
                [
                    sdk.Permission.read(sdk.Role.any()),
                    sdk.Permission.create(sdk.Role.any()),
                    sdk.Permission.update(sdk.Role.any()),
                    sdk.Permission.delete(sdk.Role.any())
                ]
            );
            console.log(`✅ ${collection.name} permissions updated`);
        } catch (error) {
            console.error(`❌ Error updating ${collection.name}:`, error.message);
        }
    }

    console.log('\n✅ All permissions fixed!');
    console.log('\nNow restart your app: npx expo start -c');
}

fixPermissions();
