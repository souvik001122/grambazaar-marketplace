import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform, Image, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { COLORS } from '../../constants/colors';

type RouteParams = {
  url?: string;
  type?: 'pdf' | 'image';
  title?: string;
};

const AdminDocumentViewerScreen = ({ route, navigation }: any) => {
  const params: RouteParams = route?.params || {};
  const docUrl = params.url || '';
  const type = params.type || 'pdf';

  const viewerUrl = useMemo(() => {
    if (!docUrl) {
      return '';
    }

    if (type === 'pdf') {
      return `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(docUrl)}`;
    }

    return docUrl;
  }, [docUrl, type]);

  if (!docUrl) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <View style={styles.errorState}>
          <Ionicons name="alert-circle-outline" size={58} color={COLORS.error} />
          <Text style={styles.errorTitle}>Document not available</Text>
          <Text style={styles.errorSubtext}>No preview URL was provided for this document.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.primaryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <View style={styles.topActions}>
        <TouchableOpacity style={styles.actionButton} onPress={() => Linking.openURL(docUrl)}>
          <Ionicons name="open-outline" size={17} color={COLORS.primary} />
          <Text style={styles.actionButtonText}>Open External</Text>
        </TouchableOpacity>
      </View>

      {type === 'image' ? (
        <ScrollView contentContainerStyle={styles.imageWrap}>
          <Image source={{ uri: docUrl }} style={styles.imagePreview} resizeMode="contain" />
        </ScrollView>
      ) : (
        <WebView
          source={{ uri: viewerUrl }}
          style={styles.webview}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loadingWrap}>
              <Text style={styles.loadingText}>Loading PDF preview...</Text>
            </View>
          )}
        />
      )}

      {Platform.OS === 'web' && type === 'pdf' && (
        <Text style={styles.webHint}>If browser blocks preview, use Open External to view directly.</Text>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  topActions: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: COLORS.primary + '12',
    borderWidth: 1,
    borderColor: COLORS.primary + '40',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  actionButtonText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  webview: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  imageWrap: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14,
  },
  imagePreview: {
    width: '100%',
    minHeight: 520,
  },
  webHint: {
    fontSize: 12,
    color: COLORS.textTertiary,
    textAlign: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  errorState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorTitle: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  errorSubtext: {
    marginTop: 6,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  primaryButton: {
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
});

export default AdminDocumentViewerScreen;
