import { account, databases, appwriteConfig } from '../config/appwrite';
import { User, UserRole } from '../types';
import { ID, Query } from 'appwrite';

const createFreshEmailSession = async (email: string, password: string) => {
  try {
    await account.deleteSession('current');
  } catch {
    // No current session to delete.
  }

  try {
    await account.createEmailPasswordSession(email, password);
  } catch (error: any) {
    const message = error?.message || '';
    const hasActiveSession = message.includes('Creation of a session is prohibited when a session is active');

    if (!hasActiveSession) {
      throw error;
    }

    try {
      await account.deleteSessions();
    } catch {
      // Ignore and retry with best-effort current-session cleanup.
    }

    try {
      await account.deleteSession('current');
    } catch {
      // Ignore and retry create once.
    }

    await account.createEmailPasswordSession(email, password);
  }
};

export const authService = {
  // Sign up
  async signUp(email: string, password: string, name: string, role: UserRole = 'buyer') {
    try {
      console.log('Starting signup...');
      // Create account
      const response = await account.create(ID.unique(), email, password, name);
      console.log('Account created:', response.$id);
      
      // Create user document
      const userDoc = await databases.createDocument(
        appwriteConfig.databaseId,
        appwriteConfig.usersCollectionId,
        response.$id,
        {
          email,
          name,
          phone: '',
          role,
          profileImage: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      );
      console.log('User document created:', userDoc);
      
      // Create session
      await createFreshEmailSession(email, password);
      console.log('Session created');
      
      return this.getCurrentUser();
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    }
  },

  // Sign in
  async signIn(email: string, password: string) {
    try {
      await createFreshEmailSession(email, password);
      return this.getCurrentUser();
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  },

  // Get current user
  async getCurrentUser(): Promise<User | null> {
    try {
      const accountData = await account.get();
      console.log('Account data:', accountData);
      
      // Get user document
      const userDoc = await databases.getDocument(
        appwriteConfig.databaseId,
        appwriteConfig.usersCollectionId,
        accountData.$id
      );
      
      console.log('User document:', userDoc);
      
      return {
        $id: userDoc.$id,
        email: userDoc.email,
        name: userDoc.name,
        phone: userDoc.phone,
        role: userDoc.role,
        profileImage: userDoc.profileImage,
        createdAt: userDoc.createdAt,
        updatedAt: userDoc.updatedAt,
      } as User;
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  },

  // Sign out
  async signOut() {
    try {
      await account.deleteSession('current');
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  },

  // Update profile
  async updateProfile(userId: string, data: Partial<User>) {
    try {
      const response = await databases.updateDocument(
        appwriteConfig.databaseId,
        appwriteConfig.usersCollectionId,
        userId,
        {
          ...data,
          updatedAt: new Date().toISOString(),
        }
      );
      return response;
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    }
  },
};
