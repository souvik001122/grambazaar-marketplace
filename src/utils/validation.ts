/**
 * Phone number validation (Indian format)
 */
export const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^[6-9]\d{9}$/;
  return phoneRegex.test(phone.replace(/\D/g, ''));
};

/**
 * Normalize Indian phone number to 10 digits.
 */
export const normalizePhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits;
};

/**
 * Email validation
 */
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Name validation
 */
export const validateName = (name: string): boolean => {
  return name.trim().length >= 2 && name.trim().length <= 50;
};

/**
 * Price validation
 */
export const validatePrice = (price: number, min: number = 10, max: number = 100000): boolean => {
  return price >= min && price <= max;
};

/**
 * Product name validation
 */
export const validateProductName = (name: string): boolean => {
  return name.trim().length >= 3 && name.trim().length <= 100;
};

/**
 * Description validation
 */
export const validateDescription = (description: string, minLength: number = 10, maxLength: number = 1000): boolean => {
  const trimmed = description.trim();
  return trimmed.length >= minLength && trimmed.length <= maxLength;
};

/**
 * Address validation
 */
export const validateAddress = (address: string, minLength: number = 10, maxLength: number = 300): boolean => {
  const trimmed = address.trim();
  return trimmed.length >= minLength && trimmed.length <= maxLength;
};

/**
 * Review validation
 */
export const validateReview = (comment: string): boolean => {
  return comment.trim().length >= 10 && comment.trim().length <= 500;
};

/**
 * Rating validation
 */
export const validateRating = (rating: number): boolean => {
  return rating >= 1 && rating <= 5 && Number.isInteger(rating);
};

/**
 * Image validation
 */
export const validateImageCount = (images: string[], max: number = 5): boolean => {
  return images.length > 0 && images.length <= max;
};

/**
 * Stock validation
 */
export const validateStock = (stock: number, min: number = 0, max: number = 100000): boolean => {
  return Number.isInteger(stock) && stock >= min && stock <= max;
};

/**
 * Shop name validation
 */
export const validateShopName = (name: string): boolean => {
  return name.trim().length >= 3 && name.trim().length <= 50;
};

/**
 * Village/District validation
 */
export const validateLocation = (location: string): boolean => {
  return location.trim().length >= 2 && location.trim().length <= 50;
};

/**
 * Coordinate validation
 */
export const validateLatitude = (latitude: number): boolean => {
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90;
};

export const validateLongitude = (longitude: number): boolean => {
  return Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
};

/**
 * Seller KYC file validation
 */
export const isAllowedSellerDocType = (mimeType?: string): boolean => {
  if (!mimeType) {
    return false;
  }

  const normalized = mimeType.toLowerCase();
  return normalized === 'application/pdf' || normalized.startsWith('image/');
};

/**
 * Skills/Craft description validation
 */
export const validateSkills = (skills: string): boolean => {
  return skills.trim().length >= 10 && skills.trim().length <= 200;
};

/**
 * Get validation error message
 */
export const getValidationError = (field: string, value: any): string | null => {
  switch (field) {
    case 'phone':
      return validatePhone(value) ? null : 'Invalid phone number. Use 10-digit Indian mobile number.';
    case 'email':
      return validateEmail(value) ? null : 'Invalid email address.';
    case 'name':
      return validateName(value) ? null : 'Name must be 2-50 characters.';
    case 'productName':
      return validateProductName(value) ? null : 'Product name must be 3-100 characters.';
    case 'description':
      return validateDescription(value) ? null : 'Description must be 10-1000 characters.';
    case 'address':
      return validateAddress(value) ? null : 'Address must be 10-300 characters.';
    case 'price':
      return validatePrice(value) ? null : 'Price must be between ₹10 and ₹1,00,000.';
    case 'stock':
      return validateStock(value) ? null : 'Stock must be a whole number between 0 and 1,00,000.';
    case 'rating':
      return validateRating(value) ? null : 'Rating must be between 1 and 5.';
    case 'review':
      return validateReview(value) ? null : 'Review must be 10-500 characters.';
    case 'shopName':
      return validateShopName(value) ? null : 'Shop name must be 3-50 characters.';
    case 'skills':
      return validateSkills(value) ? null : 'Skills description must be 10-200 characters.';
    default:
      return null;
  }
};
