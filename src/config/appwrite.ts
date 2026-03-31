import { Client, Account, Databases, Storage } from 'appwrite';

// Appwrite configuration
export const appwriteConfig = {
  endpoint: 'https://cloud.appwrite.io/v1', // Replace with your Appwrite endpoint
  projectId: '697aea5a0009bbcaf972', // Replace with your project ID
  databaseId: '697aeb4a003d2872de00', // Replace with your database ID
  
  // Collections (9 collections for complete system)
  usersCollectionId: 'users',
  sellersCollectionId: 'sellers',
  productsCollectionId: 'products',
  ordersCollectionId: 'orders',
  categoriesCollectionId: 'categories',
  reviewsCollectionId: 'reviews',
  reportsCollectionId: 'reports',
  adminLogsCollectionId: 'admin_logs',
  notificationsCollectionId: 'notifications',
  savedProductsCollectionId: 'saved_products',
  
  // Storage Buckets (using 1 bucket for all - free plan limit)
  profileImagesBucketId: 'grambazaar-storage',
  productImagesBucketId: 'grambazaar-storage',
  documentsBucketId: 'grambazaar-storage',
};

// Email verification redirect URL (hosted on GitHub Pages)
export const EMAIL_VERIFICATION_URL = 'https://souvik001122.github.io/gram-reset-pass-AppD_project-/email-verification-web/';

// Initialize Appwrite client
const client = new Client();
client
  .setEndpoint(appwriteConfig.endpoint)
  .setProject(appwriteConfig.projectId);

// Export Appwrite services
export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);
export { client };

export default client;
