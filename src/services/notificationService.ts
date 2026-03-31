import { ID, Query } from 'appwrite';
import { databases, appwriteConfig } from '../config/appwrite';
import {
  CreateNotificationDTO,
  Notification,
  PaginatedResponse,
} from '../types/common.types';

const getTitleFromType = (type: string): string => {
  const titles: Record<string, string> = {
    seller_application: 'New Seller Application',
    verification: 'Verification Update',
    product_approval: 'Product Status Update',
    order_created: 'New Order',
    order_update: 'Order Update',
    order_status: 'Order Status Update',
    new_review: 'New Review',
    admin_action: 'Admin Notification',
  };
  return titles[type] || 'Notification';
};

/**
 * Create notification
 */
export const createNotification = async (
  data: CreateNotificationDTO
): Promise<Notification> => {
  const basePayload = {
    userId: data.userId,
    message: data.message,
    type: data.type,
    isRead: false,
    relatedEntityId: data.relatedEntityId || '',
    createdAt: new Date().toISOString(),
  };

  try {
    const notification = await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.notificationsCollectionId,
      ID.unique(),
      {
        ...basePayload,
        title: data.title || getTitleFromType(data.type),
      }
    );

    return notification as unknown as Notification;
  } catch (error) {
    // Compatibility fallback for projects where notifications schema has no `title` field.
    const message = (error as any)?.message || '';
    const looksLikeUnknownTitle =
      typeof message === 'string' &&
      message.toLowerCase().includes('unknown') &&
      message.toLowerCase().includes('title');

    if (looksLikeUnknownTitle) {
      try {
        const notification = await databases.createDocument(
          appwriteConfig.databaseId,
          appwriteConfig.notificationsCollectionId,
          ID.unique(),
          basePayload
        );
        return notification as unknown as Notification;
      } catch (retryError) {
        console.error('Error creating notification:', retryError);
        throw new Error('Failed to create notification');
      }
    }

    console.error('Error creating notification:', error);
    throw new Error('Failed to create notification');
  }
};

/**
 * Get user notifications
 */
export const getUserNotifications = async (
  userId: string,
  page: number = 1,
  perPage: number = 20
): Promise<PaginatedResponse<Notification>> => {
  try {
    const offset = (page - 1) * perPage;
    
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.notificationsCollectionId,
      [
        Query.equal('userId', userId),
        Query.orderDesc('createdAt'),
        Query.limit(perPage),
        Query.offset(offset),
      ]
    );

    return {
      data: response.documents as unknown as Notification[],
      total: response.total,
      page,
      perPage,
      hasMore: offset + response.documents.length < response.total,
    };
  } catch (error) {
    console.error('Error fetching notifications:', error);
    throw new Error('Failed to fetch notifications');
  }
};

/**
 * Get unread notification count
 */
export const getUnreadCount = async (userId: string): Promise<number> => {
  try {
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.notificationsCollectionId,
      [
        Query.equal('userId', userId),
        Query.equal('isRead', false),
      ]
    );

    return response.total;
  } catch (error) {
    console.error('Error fetching unread count:', error);
    return 0;
  }
};

/**
 * Mark notification as read
 */
export const markAsRead = async (notificationId: string): Promise<void> => {
  try {
    await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.notificationsCollectionId,
      notificationId,
      { isRead: true }
    );
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw new Error('Failed to mark notification as read');
  }
};

/**
 * Mark all notifications as read
 */
export const markAllAsRead = async (userId: string): Promise<void> => {
  try {
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.notificationsCollectionId,
      [
        Query.equal('userId', userId),
        Query.equal('isRead', false),
      ]
    );

    const updatePromises = response.documents.map(doc =>
      databases.updateDocument(
        appwriteConfig.databaseId,
        appwriteConfig.notificationsCollectionId,
        doc.$id,
        { isRead: true }
      )
    );

    await Promise.all(updatePromises);
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw new Error('Failed to mark all notifications as read');
  }
};

/**
 * Delete notification
 */
export const deleteNotification = async (notificationId: string): Promise<void> => {
  try {
    await databases.deleteDocument(
      appwriteConfig.databaseId,
      appwriteConfig.notificationsCollectionId,
      notificationId
    );
  } catch (error) {
    console.error('Error deleting notification:', error);
    throw new Error('Failed to delete notification');
  }
};

/**
 * Send notification helper (creates notification)
 */
export const sendNotification = async (
  userId: string,
  message: string,
  type: string,
  relatedEntityId?: string,
  _relatedType?: string
): Promise<void> => {
  try {
    await createNotification({
      userId,
      message,
      type,
      relatedEntityId,
    });
  } catch (error) {
    console.error('Error sending notification:', error);
    // Don't throw - notifications are non-critical
  }
};
