import { User } from '../types/user.types';
import { APP_CONFIG } from '../constants/config';

/**
 * Check if user has a specific role
 */
export const hasRole = (user: User | null, role: string): boolean => {
  return user?.role === role;
};

/**
 * Check if user is admin
 */
export const isAdmin = (user: User | null): boolean => {
  return hasRole(user, APP_CONFIG.ROLES.ADMIN);
};

/**
 * Check if user is seller
 */
export const isSeller = (user: User | null): boolean => {
  return hasRole(user, APP_CONFIG.ROLES.SELLER);
};

/**
 * Check if user is buyer
 */
export const isBuyer = (user: User | null): boolean => {
  return hasRole(user, APP_CONFIG.ROLES.BUYER);
};

/**
 * Check if user can edit seller profile
 */
export const canEditSeller = (user: User | null, sellerId: string): boolean => {
  if (!user) return false;
  if (isAdmin(user)) return true;
  return user.$id === sellerId;
};

/**
 * Check if user can edit product
 */
export const canEditProduct = (user: User | null, productOwnerId: string): boolean => {
  if (!user) return false;
  if (isAdmin(user)) return true;
  return user.$id === productOwnerId;
};

/**
 * Check if user can approve sellers
 */
export const canApproveSellers = (user: User | null): boolean => {
  return isAdmin(user);
};

/**
 * Check if user can approve products
 */
export const canApproveProducts = (user: User | null): boolean => {
  return isAdmin(user);
};

/**
 * Check if user can view admin panel
 */
export const canViewAdminPanel = (user: User | null): boolean => {
  return isAdmin(user);
};

/**
 * Check if user can write review
 */
export const canWriteReview = (user: User | null, productOwnerId: string): boolean => {
  if (!user) return false;
  // Users cannot review their own products
  return user.$id !== productOwnerId;
};

/**
 * Check if user can report
 */
export const canReport = (user: User | null): boolean => {
  return user !== null;
};

/**
 * Check if user can contact seller
 */
export const canContactSeller = (user: User | null): boolean => {
  return user !== null;
};

/**
 * Get allowed routes for user role
 */
export const getAllowedRoutes = (role: string | undefined): string[] => {
  switch (role) {
    case APP_CONFIG.ROLES.ADMIN:
      return ['/admin/*'];
    case APP_CONFIG.ROLES.SELLER:
      return ['/seller/*', '/buyer/*'];
    case APP_CONFIG.ROLES.BUYER:
      return ['/buyer/*'];
    default:
      return ['/auth/*', '/'];
  }
};
