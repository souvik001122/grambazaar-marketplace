import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import { createProduct } from '../../services/productService';
import { uploadFile } from '../../services/storageService';
import { getSellerByUserId } from '../../services/sellerService';
import { CATEGORIES } from '../../constants/categories';
import { COLORS } from '../../constants/colors';
import { showAlert } from '../../utils/alert';
import { Seller } from '../../types/seller.types';
import {
  validateDescription,
  validateImageCount,
  validatePrice,
  validateProductName,
  validateStock,
} from '../../utils/validation';
import { PremiumImage } from '../../components/PremiumImage';
import { PremiumTopBar } from '../../components/PremiumTopBar';

const AddProductScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [sellerLoading, setSellerLoading] = useState(true);
  const [seller, setSeller] = useState<Seller | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    price: '',
    description: '',
    stock: '',
    deliveryOption: 'pickup',
  });

  const [images, setImages] = useState<string[]>([]);

  useEffect(() => {
    let active = true;

    const loadSeller = async () => {
      if (!user?.$id) {
        setSellerLoading(false);
        return;
      }

      try {
        const sellerProfile = await getSellerByUserId(user.$id);
        if (!active) {
          return;
        }
        setSeller(sellerProfile);
      } catch {
        if (active) {
          setSeller(null);
        }
      } finally {
        if (active) {
          setSellerLoading(false);
        }
      }
    };

    loadSeller();

    return () => {
      active = false;
    };
  }, [user?.$id]);

  const sellerLocationLabel = useMemo(() => {
    if (!seller) {
      return 'Seller profile not loaded';
    }

    return [seller.village, seller.district, seller.state].filter(Boolean).join(', ');
  }, [seller]);

  const handlePickImages = async () => {
    if (images.length >= 5) {
      showAlert('Limit Reached', 'You can upload maximum 5 images');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsMultipleSelection: true,
      });

      if (!result.canceled) {
        const newImages = result.assets.map((asset) => asset.uri);
        setImages([...images, ...newImages].slice(0, 5));
      }
    } catch {
      showAlert('Error', 'Failed to pick images');
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!seller?.$id || !seller.state) {
      showAlert('Error', 'Seller profile location is incomplete. Update your seller profile first.');
      return;
    }

    const trimmedName = formData.name.trim();
    const trimmedDescription = formData.description.trim();
    const parsedPrice = Number(formData.price);
    const parsedStock = Number(formData.stock);

    if (!validateProductName(trimmedName)) {
      showAlert('Error', 'Product name must be 3-100 characters.');
      return;
    }

    if (!formData.category.trim()) {
      showAlert('Error', 'Please select category');
      return;
    }

    if (!validatePrice(parsedPrice)) {
      showAlert('Error', 'Price must be between ₹10 and ₹1,00,000.');
      return;
    }

    if (!validateDescription(trimmedDescription, 20, 1200)) {
      showAlert('Error', 'Description must be 20-1200 characters.');
      return;
    }

    if (!validateStock(parsedStock, 1, 100000)) {
      showAlert('Error', 'Stock must be a whole number between 1 and 1,00,000.');
      return;
    }

    if (!validateImageCount(images, 5)) {
      showAlert('Error', 'Please add 1 to 5 product images');
      return;
    }

    try {
      setLoading(true);

      const imageUrls: string[] = [];
      for (let i = 0; i < images.length; i += 1) {
        const imageUrl = await uploadFile(images[i], `products/${seller.$id}_${Date.now()}_${i}`);
        imageUrls.push(imageUrl);
      }

      await createProduct({
        sellerId: seller.$id,
        name: trimmedName,
        category: formData.category,
        price: parsedPrice,
        description: trimmedDescription,
        images: imageUrls,
        quantity: parsedStock,
        deliveryOption: formData.deliveryOption as 'pickup' | 'delivery' | 'both',
        region: seller.state,
        state: seller.state,
      });

      setFormData({
        name: '',
        category: '',
        price: '',
        stock: '',
        description: '',
        deliveryOption: 'pickup',
      });
      setImages([]);

      showAlert('Success!', 'Your product has been submitted for review.');
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to add product');
    } finally {
      setLoading(false);
    }
  };

  if (sellerLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!seller) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Seller profile not found. Complete onboarding first.</Text>
      </View>
    );
  }

  return (
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 16 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      enableOnAndroid
      extraScrollHeight={24}
      extraHeight={120}
    >
      <PremiumTopBar
        title="Add Product"
        subtitle="Submit accurate details for faster approval"
        icon="add-circle-outline"
        showBack={navigation?.canGoBack?.()}
        onBack={() => navigation?.goBack?.()}
      />

      <View style={styles.form}>
        <View style={styles.locationBox}>
          <Ionicons name="location-outline" size={18} color={COLORS.primary} />
          <View style={styles.locationBoxTextWrap}>
            <Text style={styles.locationLabel}>Shop Location (Locked from seller profile)</Text>
            <Text style={styles.locationValue}>{sellerLocationLabel || seller.state}</Text>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Product Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter product name"
            value={formData.name}
            onChangeText={(text) => setFormData({ ...formData, name: text })}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Category *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryChip,
                  formData.category === cat.id && styles.categoryChipSelected,
                ]}
                onPress={() => setFormData({ ...formData, category: cat.id })}
              >
                <Text style={styles.categoryIcon}>{cat.icon}</Text>
                <Text
                  style={[
                    styles.categoryText,
                    formData.category === cat.id && styles.categoryTextSelected,
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Price (₹) *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter price"
            value={formData.price}
            onChangeText={(text) => setFormData({ ...formData, price: text })}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Description *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe your product in detail..."
            value={formData.description}
            onChangeText={(text) => setFormData({ ...formData, description: text })}
            multiline
            numberOfLines={5}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Stock Quantity *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter available stock"
            value={formData.stock}
            onChangeText={(text) => setFormData({ ...formData, stock: text })}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Delivery Option *</Text>
          <View style={styles.optionsRow}>
            {['pickup', 'delivery', 'both'].map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.optionChip,
                  formData.deliveryOption === option && styles.optionChipSelected,
                ]}
                onPress={() => setFormData({ ...formData, deliveryOption: option })}
              >
                <Text
                  style={[
                    styles.optionText,
                    formData.deliveryOption === option && styles.optionTextSelected,
                  ]}
                >
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Product Images * (Max 5)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesScroll}>
            {images.map((uri, index) => (
              <View key={index} style={styles.imageContainer}>
                <PremiumImage
                  uri={uri}
                  style={styles.productImage}
                  variant="product"
                />
                <TouchableOpacity style={styles.removeImageButton} onPress={() => handleRemoveImage(index)}>
                  <Text style={styles.removeImageText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            {images.length < 5 && (
              <TouchableOpacity style={styles.addImageButton} onPress={handlePickImages}>
                <Text style={styles.addImageIcon}>📷</Text>
                <Text style={styles.addImageText}>Add Image</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.submitButtonText}>Submit for Review</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.noteBox}>
          <Ionicons name="information-circle" size={20} color={COLORS.primary} />
          <Text style={styles.noteText}>
            Your product location is auto-linked to your verified seller profile so buyers can filter accurately.
          </Text>
        </View>
      </View>
    </KeyboardAwareScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    paddingHorizontal: 24,
  },
  errorText: {
    textAlign: 'center',
    color: COLORS.error,
    fontSize: 15,
    lineHeight: 22,
  },
  form: {
    padding: 16,
  },
  locationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAF4FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CFE4FF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 18,
    gap: 8,
  },
  locationBoxTextWrap: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    color: '#5A6D80',
  },
  locationValue: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: '700',
    color: '#1F3B5B',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.text,
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  categoryScroll: {
    flexDirection: 'row',
  },
  categoryChip: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginRight: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  categoryText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  categoryTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  optionChip: {
    flex: 1,
    backgroundColor: COLORS.surface,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  optionChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  optionText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  optionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  imagesScroll: {
    flexDirection: 'row',
  },
  imageContainer: {
    position: 'relative',
    marginRight: 10,
  },
  productImage: {
    width: 100,
    height: 100,
    borderRadius: 10,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FF4444',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeImageText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  addImageButton: {
    width: 100,
    height: 100,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addImageIcon: {
    fontSize: 32,
    marginBottom: 4,
  },
  addImageText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  noteBox: {
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
    marginBottom: 30,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
});

export default AddProductScreen;
