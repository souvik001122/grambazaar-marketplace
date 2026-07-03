import { ID, Query } from 'appwrite';
import { databases, client, appwriteConfig } from '../config/appwrite';

export interface ChatMessage {
  $id: string;
  senderId: string;
  receiverId: string;
  text: string;
  productId?: string;
  createdAt: string;
}

export interface Conversation {
  otherParticipantId: string;
  otherParticipantName: string;
  otherParticipantRole: string;
  lastMessage: string;
  lastMessageTime: string;
  productId?: string;
}

/**
 * Send a new chat message
 */
export const sendMessage = async (
  senderId: string,
  receiverId: string,
  text: string,
  productId?: string
): Promise<ChatMessage> => {
  try {
    const payload = {
      senderId,
      receiverId,
      text: text.trim(),
      productId: productId || '',
      createdAt: new Date().toISOString(),
    };

    const doc = await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.chatMessagesCollectionId,
      ID.unique(),
      payload
    );

    return doc as unknown as ChatMessage;
  } catch (error) {
    console.error('Error sending message:', error);
    throw new Error('Failed to send message');
  }
};

/**
 * Get messages between two users
 */
export const getChatMessages = async (
  userId1: string,
  userId2: string
): Promise<ChatMessage[]> => {
  try {
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.chatMessagesCollectionId,
      [
        Query.equal('senderId', [userId1, userId2]),
        Query.equal('receiverId', [userId1, userId2]),
        Query.orderAsc('createdAt'),
        Query.limit(100),
      ]
    );

    return response.documents as unknown as ChatMessage[];
  } catch (error) {
    console.error('Error getting chat messages:', error);
    return [];
  }
};

/**
 * Get active conversations list for a user (Inbox)
 */
export const getInbox = async (currentUserId: string): Promise<Conversation[]> => {
  try {
    // Query sent messages
    const sentResponse = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.chatMessagesCollectionId,
      [Query.equal('senderId', currentUserId), Query.orderDesc('createdAt'), Query.limit(100)]
    );

    // Query received messages
    const receivedResponse = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.chatMessagesCollectionId,
      [Query.equal('receiverId', currentUserId), Query.orderDesc('createdAt'), Query.limit(100)]
    );

    const allMessages = [
      ...sentResponse.documents,
      ...receivedResponse.documents,
    ] as unknown as ChatMessage[];

    // Sort all messages descending by date
    allMessages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const conversationMap = new Map<string, ChatMessage>();

    for (const msg of allMessages) {
      const otherId = msg.senderId === currentUserId ? msg.receiverId : msg.senderId;
      if (!conversationMap.has(otherId)) {
        conversationMap.set(otherId, msg);
      }
    }

    const conversations: Conversation[] = [];

    for (const [otherId, latestMsg] of conversationMap.entries()) {
      // Fetch other participant profile details
      let otherName = 'User';
      let otherRole = 'buyer';

      try {
        const userDoc = await databases.getDocument(
          appwriteConfig.databaseId,
          appwriteConfig.usersCollectionId,
          otherId
        );
        otherName = userDoc.name || 'User';
        otherRole = userDoc.role || 'buyer';

        // If other role is seller, we can try to fetch their businessName/shopName
        if (otherRole === 'seller') {
          try {
            const sellerRes = await databases.listDocuments(
              appwriteConfig.databaseId,
              appwriteConfig.sellersCollectionId,
              [Query.equal('userId', otherId)]
            );
            if (sellerRes.documents.length > 0) {
              otherName = sellerRes.documents[0].businessName || otherName;
            }
          } catch {
            // Non-critical fallback
          }
        }
      } catch {
        // Non-critical profile fetching issues fallback
      }

      conversations.push({
        otherParticipantId: otherId,
        otherParticipantName: otherName,
        otherParticipantRole: otherRole,
        lastMessage: latestMsg.text,
        lastMessageTime: latestMsg.createdAt,
        productId: latestMsg.productId,
      });
    }

    return conversations;
  } catch (error) {
    console.error('Error fetching inbox:', error);
    return [];
  }
};

/**
 * Subscribe to realtime chat messages
 */
export const subscribeToChat = (
  currentUserId: string,
  onMessage: (message: ChatMessage) => void
): (() => void) => {
  const channel = `databases.${appwriteConfig.databaseId}.collections.${appwriteConfig.chatMessagesCollectionId}.documents`;

  const unsubscribe = client.subscribe(channel, (response) => {
    if (response.events.some((e) => e.includes('.create'))) {
      const msg = response.payload as unknown as ChatMessage;
      // Trigger callback only if message is related to current user
      if (msg.senderId === currentUserId || msg.receiverId === currentUserId) {
        onMessage(msg);
      }
    }
  });

  return unsubscribe;
};
