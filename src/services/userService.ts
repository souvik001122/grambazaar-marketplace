import { ID, Query } from 'appwrite';
import { databases, appwriteConfig } from '../config/appwrite';
import { User, CreateUserDTO, UpdateUserDTO } from '../types/user.types';

/**
 * Create user document
 */
export const createUser = async (data: CreateUserDTO, authUserId: string): Promise<User> => {
  try {
    const user = await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.usersCollectionId,
      ID.unique(),
      {
        name: data.name,
        email: data.email,
        phone: data.phone || '',
        role: data.role,
        profileImage: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    );

    return user as unknown as User;
  } catch (error) {
    console.error('Error creating user:', error);
    throw new Error('Failed to create user');
  }
};

/**
 * Get user by userId (document $id)
 */
export const getUserById = async (userId: string): Promise<User | null> => {
  try {
    const user = await databases.getDocument(
      appwriteConfig.databaseId,
      appwriteConfig.usersCollectionId,
      userId
    );

    return user as unknown as User;
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
};

/**
 * Get user by email
 */
export const getUserByEmail = async (email: string): Promise<User | null> => {
  try {
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.usersCollectionId,
      [Query.equal('email', email)]
    );

    if (response.documents.length === 0) {
      return null;
    }

    return response.documents[0] as unknown as User;
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
};

/**
 * Get user by phone
 */
export const getUserByPhone = async (phone: string): Promise<User | null> => {
  try {
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.usersCollectionId,
      [Query.equal('phone', phone)]
    );

    if (response.documents.length === 0) {
      return null;
    }

    return response.documents[0] as unknown as User;
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
};

/**
 * Update user profile
 */
export const updateUser = async (userId: string, data: UpdateUserDTO): Promise<User> => {
  try {
    // Find user document
    const userDoc = await getUserById(userId);
    if (!userDoc) {
      throw new Error('User not found');
    }

    const updated = await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.usersCollectionId,
      userDoc.$id,
      {
        ...data,
        updatedAt: new Date().toISOString(),
      }
    );

    return updated as unknown as User;
  } catch (error) {
    console.error('Error updating user:', error);
    throw new Error('Failed to update user');
  }
};

/**
 * Delete user
 */
export const deleteUser = async (userId: string): Promise<void> => {
  try {
    const userDoc = await getUserById(userId);
    if (!userDoc) {
      throw new Error('User not found');
    }

    await databases.deleteDocument(
      appwriteConfig.databaseId,
      appwriteConfig.usersCollectionId,
      userDoc.$id
    );
  } catch (error) {
    console.error('Error deleting user:', error);
    throw new Error('Failed to delete user');
  }
};

/**
 * Update user role
 */
export const updateUserRole = async (
  userId: string,
  role: 'buyer' | 'seller' | 'admin'
): Promise<User> => {
  try {
    return await updateUser(userId, { role } as any);
  } catch (error) {
    console.error('Error updating user role:', error);
    throw new Error('Failed to update user role');
  }
};

/**
 * Get users by role
 */
export const getUsersByRole = async (role: 'buyer' | 'seller' | 'admin'): Promise<User[]> => {
  try {
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.usersCollectionId,
      [Query.equal('role', role)]
    );

    return response.documents as unknown as User[];
  } catch (error) {
    console.error('Error fetching users by role:', error);
    return [];
  }
};

/**
 * Search users by name
 */
export const searchUsers = async (searchQuery: string): Promise<User[]> => {
  try {
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.usersCollectionId,
      [Query.search('name', searchQuery)]
    );

    return response.documents as unknown as User[];
  } catch (error) {
    console.error('Error searching users:', error);
    return [];
  }
};
