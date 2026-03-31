/**
 * Update User Role to Admin
 */

const sdk = require('node-appwrite');

const client = new sdk.Client();
const databases = new sdk.Databases(client);

client
    .setEndpoint('https://cloud.appwrite.io/v1')
    .setProject('697aea5a0009bbcaf972')
    .setKey('standard_c4e1cc93997ad3ba97815b907f9d6b758ba5542fc1165eefc96e33d5ce86a4d0163d03f743f4ca2f3e2c33630004e5e930d72aaa0457c426525a58140614d528fcf01e57a8f5af41ba11aebc0a3f5ec2bf8e0c670afc2245eac16f00f58bd05fd005b397a32b1ea4ebee08ff06d77dde7c852e6bae74f7d507551fe802ab10f6');

const DATABASE_ID = '697aeb4a003d2872de00';

async function makeAdmin() {
    console.log('🔧 Updating user role to admin...\n');

    const userId = '697aeb8000150fdd8f30'; // Souvik's user ID

    try {
        await databases.updateDocument(
            DATABASE_ID,
            'users',
            userId,
            {
                role: 'admin',
                updatedAt: new Date().toISOString()
            }
        );

        console.log('✅ User role updated to admin successfully!');
        console.log('\nAdmin Login:');
        console.log('   Email: abc787286@gmail.com');
        console.log('   Role: admin');
        console.log('\nNow you can login and access admin features!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

makeAdmin();
