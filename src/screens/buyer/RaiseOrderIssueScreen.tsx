import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Image,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { COLORS } from '../../constants/colors';
import { showAlert } from '../../utils/alert';
import { uploadFile } from '../../services/storageService';
import { createOrderDisputeReport } from '../../services/adminService';
import { useAuth } from '../../context/AuthContext';
import { formatDateTime } from '../../utils/formatting';

const ISSUE_CATEGORIES = [
  'Not Delivered',
  'Wrong Item Delivered',
  'Damaged Parcel',
  'Partial Delivery',
  'Tracking Mismatch',
  'Other',
] as const;

const RaiseOrderIssueScreen = ({ route, navigation }: any) => {
  const { user } = useAuth();
  const order = route?.params?.order;
  const existingReport = route?.params?.existingReport;
  const readOnly = !!route?.params?.readOnly && !!existingReport;

  const defaultCategory =
    existingReport?.issueCategory && ISSUE_CATEGORIES.includes(existingReport.issueCategory)
      ? existingReport.issueCategory
      : 'Not Delivered';

  const [issueCategory, setIssueCategory] = useState<(typeof ISSUE_CATEGORIES)[number]>(defaultCategory);
  const [details, setDetails] = useState(existingReport?.details || '');
  const [proofUrls, setProofUrls] = useState<string[]>(existingReport?.proofUrls || []);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!order) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Order details not found.</Text>
      </View>
    );
  }

  const pickImageProof = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showAlert('Permission Required', 'Allow gallery access to upload issue proof.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      setUploading(true);
      const url = await uploadFile(result.assets[0].uri, `issue_proof_img_${order.$id}_${Date.now()}`);
      setProofUrls((prev) => [...prev, url]);
      showAlert('Uploaded', 'Image proof added.');
    } catch {
      showAlert('Error', 'Failed to upload image proof.');
    } finally {
      setUploading(false);
    }
  };

  const pickDocumentProof = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      setUploading(true);
      const asset = result.assets[0];
      const url = await uploadFile(asset.uri, `issue_proof_doc_${order.$id}_${Date.now()}`);
      setProofUrls((prev) => [...prev, url]);
      showAlert('Uploaded', 'Document proof added.');
    } catch {
      showAlert('Error', 'Failed to upload document proof.');
    } finally {
      setUploading(false);
    }
  };

  const removeProof = (url: string) => {
    setProofUrls((prev) => prev.filter((p) => p !== url));
  };

  const submitIssue = async () => {
    if (!user?.$id) return;
    if (!details.trim()) {
      showAlert('Missing Details', 'Please describe the issue clearly for admin review.');
      return;
    }

    setSubmitting(true);
    try {
      await createOrderDisputeReport({
        buyerId: user.$id,
        sellerId: order.sellerId,
        orderId: order.$id,
        issueCategory,
        reason: `${issueCategory} for order #${order.$id.slice(-8).toUpperCase()}`,
        details: details.trim(),
        proofUrls,
        courierName: order.courierName,
        trackingId: order.trackingId || order.trackingInfo,
      });

      showAlert('Issue Submitted', 'Your issue has been submitted with proof. Admin will review it soon.', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error: any) {
      showAlert('Error', error?.message || 'Failed to submit issue.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Raise Delivery Issue</Text>
      <Text style={styles.subtitle}>Order #{order.$id.slice(-8).toUpperCase()}</Text>

      {readOnly && (
        <>
          <View style={styles.statusBox}>
            <Text style={styles.statusLabel}>Current Status</Text>
            <Text style={styles.statusValue}>{String(existingReport?.status || 'pending').toUpperCase()}</Text>
            {!!existingReport?.createdAt && (
              <Text style={styles.statusMeta}>Submitted: {formatDateTime(existingReport.createdAt)}</Text>
            )}
            {!!existingReport?.resolvedAt && (
              <Text style={styles.statusMeta}>Closed: {formatDateTime(existingReport.resolvedAt)}</Text>
            )}
          </View>

          {!!existingReport?.resolution && (
            <View style={styles.adminNoteBox}>
              <Text style={styles.adminNoteLabel}>Admin Resolution</Text>
              <Text style={styles.adminNoteText}>{existingReport.resolution}</Text>
            </View>
          )}
        </>
      )}

      <Text style={styles.label}>Issue Type</Text>
      <View style={styles.chipWrap}>
        {ISSUE_CATEGORIES.map((c) => {
          const selected = issueCategory === c;
          return (
            <TouchableOpacity
              key={c}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => !readOnly && setIssueCategory(c)}
              disabled={readOnly}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{c}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.label}>Issue Details</Text>
      <TextInput
        style={styles.textArea}
        value={details}
        onChangeText={setDetails}
        multiline
        numberOfLines={5}
        editable={!readOnly}
        placeholder="Example: Seller marked delivered, but parcel not received at address."
      />

      <Text style={styles.label}>Proof {readOnly ? '' : '(Optional but recommended)'}</Text>
      {!readOnly && (
        <View style={styles.proofActions}>
          <TouchableOpacity style={styles.proofBtn} onPress={pickImageProof} disabled={uploading}>
            <Ionicons name="image-outline" size={16} color={COLORS.primary} />
            <Text style={styles.proofBtnText}>Upload Image</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.proofBtn} onPress={pickDocumentProof} disabled={uploading}>
            <Ionicons name="document-text-outline" size={16} color={COLORS.primary} />
            <Text style={styles.proofBtnText}>Upload Document</Text>
          </TouchableOpacity>
        </View>
      )}

      {uploading && <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: 8 }} />}

      {proofUrls.map((url, idx) => (
        <View key={`${url}-${idx}`} style={styles.proofItem}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => Linking.openURL(url)}>
            <Text style={styles.proofLink} numberOfLines={1}>{url}</Text>
          </TouchableOpacity>
          {!readOnly && (
            <TouchableOpacity onPress={() => removeProof(url)}>
              <Ionicons name="trash-outline" size={16} color={COLORS.error} />
            </TouchableOpacity>
          )}
        </View>
      ))}

      {!readOnly && (
        <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.7 }]} onPress={submitIssue} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Ionicons name="flag-outline" size={16} color="#FFF" />
              <Text style={styles.submitText}>Submit Issue</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {readOnly && (
        <View style={styles.readOnlyHintBox}>
          <Ionicons name="information-circle-outline" size={16} color="#A87722" />
          <Text style={styles.readOnlyHintText}>This issue is already submitted. Admin will update status after review.</Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 28 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: COLORS.error, fontSize: 14 },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  subtitle: { marginTop: 2, marginBottom: 14, color: COLORS.textSecondary },
  statusBox: {
    borderWidth: 1,
    borderColor: '#F6E1B3',
    backgroundColor: '#FFF8E8',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  statusLabel: { fontSize: 11, color: '#8A5A00', fontWeight: '600' },
  statusValue: { fontSize: 13, color: '#A87722', fontWeight: '700', marginTop: 2 },
  statusMeta: { marginTop: 4, fontSize: 11, color: '#8A5A00' },
  adminNoteBox: {
    borderWidth: 1,
    borderColor: '#D7E4F2',
    backgroundColor: '#F5F9FF',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  adminNoteLabel: { fontSize: 11, fontWeight: '700', color: '#1E4B7A', marginBottom: 4 },
  adminNoteText: { fontSize: 12, color: '#355C86', lineHeight: 18 },
  label: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.surface,
  },
  chipSelected: { borderColor: COLORS.primary, backgroundColor: `${COLORS.primary}12` },
  chipText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  chipTextSelected: { color: COLORS.primary },
  textArea: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    padding: 10,
    minHeight: 110,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  proofActions: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  proofBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: `${COLORS.primary}40`,
    borderRadius: 9,
    paddingVertical: 10,
    backgroundColor: `${COLORS.primary}08`,
  },
  proofBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 12 },
  proofItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
    backgroundColor: COLORS.surface,
  },
  proofLink: { fontSize: 12, color: COLORS.info },
  submitBtn: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.error,
    borderRadius: 10,
    paddingVertical: 12,
  },
  submitText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  readOnlyHintBox: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#F6E1B3',
    backgroundColor: '#FFF8E8',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  readOnlyHintText: { flex: 1, color: '#8A5A00', fontSize: 12, lineHeight: 18 },
});

export default RaiseOrderIssueScreen;
