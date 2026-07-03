import { Client, Account, Databases, Storage } from 'appwrite';
import { Platform } from 'react-native';

// Polyfill window/global localStorage in React Native to prevent Appwrite SDK crashes
if (typeof window !== 'undefined' && !(window as any).localStorage) {
  (window as any).localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
  };
}
if (typeof global !== 'undefined' && !(global as any).localStorage) {
  (global as any).localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
  };
}

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
  chatMessagesCollectionId: 'chat_messages',
  
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

// Polyfill global WebSocket in React Native to inject custom Origin header for Appwrite Realtime (WebSockets)
if (Platform.OS === 'android' || Platform.OS === 'ios') {
  const OriginalWebSocket = (global as any).WebSocket || (window as any).WebSocket;
  if (OriginalWebSocket) {
    const CustomWebSocket = function (url: string, protocols?: string | string[], options?: any) {
      if (url && (url.includes('appwrite.io') || url.includes('/realtime'))) {
        options = options || {};
        options.headers = options.headers || {};
        options.headers['Origin'] = `appwrite-${Platform.OS}://com.grambazaar.app`;
      }
      return new OriginalWebSocket(url, protocols, options);
    };
    
    CustomWebSocket.prototype = OriginalWebSocket.prototype;
    (CustomWebSocket as any).CONNECTING = 0;
    (CustomWebSocket as any).OPEN = 1;
    (CustomWebSocket as any).CLOSING = 2;
    (CustomWebSocket as any).CLOSED = 3;
    
    (global as any).WebSocket = CustomWebSocket;
    (window as any).WebSocket = CustomWebSocket;
  }
}

// Set custom headers to identify as registered Android/iOS platform and bypass web origin checks
if (Platform.OS === 'android' || Platform.OS === 'ios') {
  (client.headers as any)['Origin'] = `appwrite-${Platform.OS}://com.grambazaar.app`;
}



// Export Appwrite services
export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);
export { client };

export default client;
