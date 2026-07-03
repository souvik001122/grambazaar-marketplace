import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import {
  getChatMessages,
  sendMessage,
  subscribeToChat,
  ChatMessage,
} from '../../services/chatService';
import { COLORS } from '../../constants/colors';
import { showAlert } from '../../utils/alert';

const ChatScreen = ({ route, navigation }: any) => {
  const { otherParticipantId, otherParticipantName, otherParticipantRole, productId } = route.params;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!user?.$id) return;

    const loadMessages = async () => {
      try {
        const history = await getChatMessages(user.$id, otherParticipantId);
        // Reverse for inverted FlatList
        setMessages([...history].reverse());
      } catch (error) {
        console.error('Error loading chat history:', error);
      } finally {
        setLoading(false);
      }
    };

    loadMessages();

    const unsubscribe = subscribeToChat(user.$id, (newMsg) => {
      const isFromOther = newMsg.senderId === otherParticipantId && newMsg.receiverId === user.$id;
      const isFromMe = newMsg.senderId === user.$id && newMsg.receiverId === otherParticipantId;

      if (isFromOther || isFromMe) {
        setMessages((prev) => {
          if (prev.some((m) => m.$id === newMsg.$id)) return prev;

          if (newMsg.senderId === user.$id) {
            const optIndex = prev.findIndex(
              (m) =>
                m.$id.startsWith('temp_') &&
                m.text === newMsg.text &&
                m.senderId === newMsg.senderId &&
                m.receiverId === newMsg.receiverId
            );
            if (optIndex !== -1) {
              const next = [...prev];
              next[optIndex] = newMsg;
              return next;
            }
          }

          // Prepend for inverted list
          return [newMsg, ...prev];
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user?.$id, otherParticipantId]);

  const handleSend = async () => {
    if (!inputText.trim() || !user?.$id) return;

    const textToSend = inputText.trim();
    setInputText('');
    setSending(true);

    const tempId = `temp_${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      $id: tempId,
      senderId: user.$id,
      receiverId: otherParticipantId,
      text: textToSend,
      productId,
      createdAt: new Date().toISOString(),
    };

    // Prepend for inverted list
    setMessages((prev) => [optimisticMsg, ...prev]);

    try {
      const sent = await sendMessage(user.$id, otherParticipantId, textToSend, productId);
      setMessages((prev) => prev.map((m) => (m.$id === tempId ? sent : m)));
    } catch (error) {
      setMessages((prev) => prev.filter((m) => m.$id !== tempId));
      showAlert('Error', 'Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const formatMessageTime = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const renderMessageItem = useCallback(({ item }: { item: ChatMessage }) => {
    const isMe = item.senderId === user?.$id;
    const isPending = item.$id.startsWith('temp_');
    return (
      <View style={[styles.messageRow, isMe ? styles.messageRowRight : styles.messageRowLeft]}>
        <View style={[styles.bubble, isMe ? styles.bubbleRight : styles.bubbleLeft]}>
          <Text style={[styles.messageText, isMe ? styles.messageTextRight : styles.messageTextLeft]}>
            {item.text}
          </Text>
          <View style={styles.metaRow}>
            <Text style={[styles.timeText, isMe ? styles.timeTextRight : styles.timeTextLeft]}>
              {formatMessageTime(item.createdAt)}
            </Text>
            {isMe && (
              <Ionicons
                name={isPending ? 'time-outline' : 'checkmark-done'}
                size={12}
                color={isPending ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.85)'}
                style={{ marginLeft: 4 }}
              />
            )}
          </View>
        </View>
      </View>
    );
  }, [user?.$id]);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>

        {/* Avatar */}
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(otherParticipantName || '?')[0].toUpperCase()}
          </Text>
        </View>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {otherParticipantName}
          </Text>
          <View style={styles.badgeRow}>
            <View style={[styles.roleBadge, otherParticipantRole === 'seller' ? styles.roleBadgeSeller : styles.roleBadgeBuyer]}>
              <Text style={styles.roleBadgeText}>
                {otherParticipantRole === 'seller' ? '🎨 Artisan' : '🛍 Buyer'}
              </Text>
            </View>
            {productId && (
              <View style={styles.productBadge}>
                <Ionicons name="cube-outline" size={9} color={COLORS.textSecondary} />
                <Text style={styles.productBadgeText}> Product</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Messages */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessageItem}
          keyExtractor={(item) => item.$id}
          contentContainerStyle={[styles.messageList, { paddingBottom: 8 }]}
          inverted
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="chatbubble-ellipses-outline" size={52} color={COLORS.textTertiary} />
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubText}>Say hello to start the conversation!</Text>
            </View>
          }
        />
      )}

      {/* Input Bar */}
      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor={COLORS.textTertiary}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={1000}
          returnKeyType="default"
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
          activeOpacity={0.8}
        >
          {sending ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <Ionicons name="send" size={18} color="#FFF" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 10,
  },
  backButton: {
    padding: 2,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },
  headerTitleWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
    alignItems: 'center',
  },
  roleBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  roleBadgeSeller: {
    backgroundColor: COLORS.primary + '15',
  },
  roleBadgeBuyer: {
    backgroundColor: COLORS.secondary + '15',
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  productBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  productBadgeText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  messageList: {
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 8,
    // inverted list flips this, so it shows in center
    transform: [{ scaleY: -1 }],
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  emptySubText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 6,
    width: '100%',
  },
  messageRowLeft: {
    justifyContent: 'flex-start',
  },
  messageRowRight: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom: 7,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  bubbleLeft: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  bubbleRight: {
    backgroundColor: COLORS.primary,
    borderTopRightRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
  },
  messageTextLeft: {
    color: COLORS.text,
  },
  messageTextRight: {
    color: '#FFF',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 3,
  },
  timeText: {
    fontSize: 10,
  },
  timeTextLeft: {
    color: COLORS.textSecondary,
  },
  timeTextRight: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    maxHeight: 120,
    minHeight: 40,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
});

export default ChatScreen;
