import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { spacing } from '../../src/config/theme';
import { useAuthStore } from '../../src/stores/authStore';
import { getSellerByUserId, updateSeller } from '../../src/services/sellerService';
import { uploadFile } from '../../src/services/storageService';
import { Seller } from '../../src/types/seller.types';
import { COLORS } from '../../src/constants/colors';

type PaymentForm = {
  paymentUpiId: string;
  paymentQrImageUrl: string;
  paymentBankAccountName: string;
  paymentBankAccountNumber: string;
  paymentBankIfsc: string;
};

const EMPTY_FORM: PaymentForm = {
  paymentUpiId: '',
  paymentQrImageUrl: '',
  paymentBankAccountName: '',
  paymentBankAccountNumber: '',
  paymentBankIfsc: '',
};

export default function SellerProfileScreen() {
  const user = useAuthStore((state) => state.user);

  const [seller, setSeller] = useState<Seller | null>(null);
  const [form, setForm] = useState<PaymentForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingQr, setUploadingQr] = useState(false);

  useEffect(() => {
    loadSeller();
  }, [user?.$id]);

  const loadSeller = async () => {
    if (!user?.$id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const sellerData = await getSellerByUserId(user.$id);
      setSeller(sellerData);
      setForm({
        paymentUpiId: sellerData?.paymentUpiId || '',
        paymentQrImageUrl: sellerData?.paymentQrImageUrl || '',
        paymentBankAccountName: sellerData?.paymentBankAccountName || '',
        paymentBankAccountNumber: sellerData?.paymentBankAccountNumber || '',
        paymentBankIfsc: sellerData?.paymentBankIfsc || '',
      });
    } finally {
      setLoading(false);
    }
  };

  const onChange = (key: keyof PaymentForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const pickQrImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
    });

    if (result.canceled || !result.assets?.[0]?.uri || !user?.$id) {
      return;
    }

    try {
      setUploadingQr(true);
      const uploadedUrl = await uploadFile(
        result.assets[0].uri,
        `payment_qr_${user.$id}_${Date.now()}`
      );
      onChange('paymentQrImageUrl', uploadedUrl);
    } finally {
      setUploadingQr(false);
    }
  };

  const savePaymentDetails = async () => {
    if (!user?.$id || !seller) return;

    const hasAnyBankField =
      form.paymentBankAccountName.trim() ||
      form.paymentBankAccountNumber.trim() ||
      form.paymentBankIfsc.trim();

    if (hasAnyBankField) {
      if (
        !form.paymentBankAccountName.trim() ||
        !form.paymentBankAccountNumber.trim() ||
        !form.paymentBankIfsc.trim()
      ) {
        return;
      }
    }

    try {
      setSaving(true);
      const payload = {
        paymentUpiId: form.paymentUpiId.trim(),
        paymentQrImageUrl: form.paymentQrImageUrl.trim(),
        paymentBankAccountName: form.paymentBankAccountName.trim(),
        paymentBankAccountNumber: form.paymentBankAccountNumber.trim(),
        paymentBankIfsc: form.paymentBankIfsc.trim().toUpperCase(),
      };
      const updated = await updateSeller(user.$id, payload);
      setSeller(updated);
      setForm({
        paymentUpiId: updated.paymentUpiId || '',
        paymentQrImageUrl: updated.paymentQrImageUrl || '',
        paymentBankAccountName: updated.paymentBankAccountName || '',
        paymentBankAccountNumber: updated.paymentBankAccountNumber || '',
        paymentBankIfsc: updated.paymentBankIfsc || '',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView edges={[]} style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator color={COLORS.primary} size="small" />
          <Text style={styles.messageText}>Loading seller profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!seller) {
    return (
      <SafeAreaView edges={[]} style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.titleText}>Seller profile not found</Text>
          <Text style={styles.subtitle}>
            Complete seller registration first.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={[]} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.titleText}>Payment Details</Text>
          <Text style={styles.subtitle}>
            Buyers see these details after you accept an order.
          </Text>

          <Text style={styles.label}>UPI ID</Text>
          <TextInput
            placeholder="example@upi"
            value={form.paymentUpiId}
            autoCapitalize="none"
            onChangeText={(text: string) => onChange('paymentUpiId', text)}
            style={styles.input}
          />

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={pickQrImage}
            disabled={uploadingQr}
          >
            {uploadingQr ? (
              <ActivityIndicator color={COLORS.primary} size="small" />
            ) : (
              <Text style={styles.secondaryButtonText}>
                {form.paymentQrImageUrl ? 'Replace UPI QR' : 'Upload UPI QR'}
              </Text>
            )}
          </TouchableOpacity>

          {!!form.paymentQrImageUrl && (
            <Image source={{ uri: form.paymentQrImageUrl }} style={styles.qrImage} />
          )}

          <Text style={styles.label}>Bank Account Holder</Text>
          <TextInput
            value={form.paymentBankAccountName}
            onChangeText={(text: string) => onChange('paymentBankAccountName', text)}
            style={styles.input}
          />

          <Text style={styles.label}>Bank Account Number</Text>
          <TextInput
            keyboardType="number-pad"
            value={form.paymentBankAccountNumber}
            onChangeText={(text: string) => onChange('paymentBankAccountNumber', text)}
            style={styles.input}
          />

          <Text style={styles.label}>IFSC</Text>
          <TextInput
            autoCapitalize="characters"
            value={form.paymentBankIfsc}
            onChangeText={(text: string) => onChange('paymentBankIfsc', text)}
            style={styles.input}
          />

          <Text style={styles.hint}>If adding bank details, fill all 3 bank fields.</Text>

          <TouchableOpacity
            style={[styles.primaryButton, saving && { opacity: 0.7 }]}
            onPress={savePaymentDetails}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Save Payment Details</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  subtitle: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    opacity: 0.75,
    color: COLORS.textSecondary,
  },
  messageText: {
    marginTop: spacing.sm,
    color: COLORS.textSecondary,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: spacing.md,
  },
  titleText: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  label: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: spacing.sm,
  },
  hint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: spacing.sm,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    marginBottom: spacing.sm,
    backgroundColor: `${COLORS.primary}08`,
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  qrImage: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginBottom: spacing.sm,
  },
  primaryButton: {
    marginTop: spacing.sm,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
