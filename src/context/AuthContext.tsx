import React, { createContext, useContext, useState, useEffect } from 'react';
import { account, EMAIL_VERIFICATION_URL } from '../config/appwrite';
import { User } from '../types/user.types';
import { getUserById, createUser, getUserByEmail, getUserByPhone } from '../services/userService';
import { Models, ID } from 'appwrite';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithPhone: (phone: string, otp: string) => Promise<void>;
  sendOTP: (phone: string) => Promise<void>;
  register: (email: string, password: string, name: string, phone: string, role: 'buyer' | 'seller') => Promise<void>;
  registerWithPhone: (phone: string, name: string, role: 'buyer' | 'seller') => Promise<void>;
  verifyPhoneOTP: (phone: string, otp: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const createFreshEmailSession = async (email: string, password: string) => {
    // Best effort cleanup in case a stale session is still active on the server.
    try {
      await account.deleteSession('current');
    } catch {
      // No current session to delete.
    }

    try {
      await account.createEmailPasswordSession(email, password);
    } catch (error: any) {
      const message = error?.message || '';
      const hasActiveSession = message.includes('Creation of a session is prohibited when a session is active');

      if (!hasActiveSession) {
        throw error;
      }

      // Fallback cleanup + single retry for Appwrite pause/resume edge cases.
      try {
        await account.deleteSessions();
      } catch {
        // Ignore if this scope is unavailable and retry with current-session deletion.
      }

      try {
        await account.deleteSession('current');
      } catch {
        // Ignore and retry create once.
      }

      await account.createEmailPasswordSession(email, password);
    }
  };

  // Check if user is already logged in on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      setLoading(true);
      const session = await account.get();
      
      if (session) {
        // Fetch user details from database using email
        let userData = await getUserByEmail(session.email);
        
        // If user document doesn't exist, create it
        if (!userData) {
          console.log('User document not found, creating one...');
          userData = await createUser(
            {
              name: session.name || 'User',
              email: session.email || '',
              phone: session.phone || '',
              role: 'buyer', // Default role
            },
            session.$id
          );
        }
        
        setUser(userData);
      }
    } catch (error) {
      // No active session at startup; keep auth state null silently.
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      
      // Create a fresh session with Appwrite (handles stale active sessions)
      await createFreshEmailSession(email, password);
      
      // Get current account to check email verification
      const session = await account.get();
      
      // Check if email is verified (skip for phone-only accounts)
      const isPhoneOnlyAccount = email.includes('@phone.grambazaar.local');
      if (!isPhoneOnlyAccount && !session.emailVerification) {
        // Send verification email again
        try {
          await account.createVerification(EMAIL_VERIFICATION_URL);
        } catch {}
        // Delete session — don't allow login
        await account.deleteSession('current');
        throw new Error('EMAIL_NOT_VERIFIED');
      }
      
      // Get user details using email
      let userData = await getUserByEmail(email);
      
      // If user document doesn't exist, create it
      if (!userData) {
        console.log('User document not found during login, creating one...');
        userData = await createUser(
          {
            name: session.name || 'User',
            email: email,
            phone: session.phone || '',
            role: 'buyer', // Default role
          },
          session.$id
        );
      }
      
      setUser(userData);
    } catch (error: any) {
      console.error('Login error:', error);
      throw new Error(error.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  const register = async (
    email: string,
    password: string,
    name: string,
    phone: string,
    role: 'buyer' | 'seller'
  ) => {
    try {
      // Don't use global setLoading here — RegisterScreen manages its own loading
      // Using global loading causes AppNavigator to remount auth stack
      
      // Delete any existing session first (silently fail if no session exists)
      try {
        await account.deleteSession('current');
      } catch (e) {
        // No active session, continue silently
      }
      
      // Create Appwrite account
      const authUser = await account.create('unique()', email, password, name);
      
      // Create session (needed to send verification email)
      await createFreshEmailSession(email, password);
      
      // Create user document in database
      await createUser(
        {
          name,
          phone,
          email,
          role,
        },
        authUser.$id
      );
      
      // Send verification email
      try {
        await account.createVerification(EMAIL_VERIFICATION_URL);
      } catch (verifyErr) {
        console.error('Failed to send verification email:', verifyErr);
      }
      
      // Do NOT set user here — user must verify email first
      // The RegisterScreen will navigate to EmailVerificationScreen
    } catch (error: any) {
      console.error('Registration error:', error);
      throw new Error(error.message || 'Failed to register');
    }
  };

  const sendVerificationEmail = async () => {
    try {
      await account.createVerification(EMAIL_VERIFICATION_URL);
    } catch (error: any) {
      console.error('Send verification error:', error);
      throw new Error(error.message || 'Failed to send verification email');
    }
  };

  // Mock OTP for development
  const DEV_OTP = '123456';
  const IS_DEV = __DEV__;

  // Deterministic temp password for phone-only accounts (dev mock)
  // In production, replace with Appwrite Phone Auth (createPhoneToken)
  const getPhoneTempPassword = (phone: string) => `GBPhone_${phone}_SecureKey2024!`;

  const sendOTP = async (phone: string) => {
    try {
      setLoading(true);
      if (IS_DEV) {
        // Mock OTP sending in development
        console.log(`[DEV] Mock OTP sent to ${phone}: ${DEV_OTP}`);
        // In production, use Appwrite Phone Auth
        // await account.createPhoneSession(phone);
      } else {
        // Production: Send real OTP via Appwrite
        throw new Error('Phone OTP not configured for production yet');
      }
    } catch (error: any) {
      console.error('Send OTP error:', error);
      throw new Error(error.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const registerWithPhone = async (phone: string, name: string, role: 'buyer' | 'seller') => {
    try {
      setLoading(true);
      
      // Delete any existing session first (silently fail if no session exists)
      try {
        await account.deleteSession('current');
      } catch (e) {
        // No active session, continue silently
      }
      
      // Check if user already exists
      const existingUser = await getUserByPhone(phone);
      if (existingUser) {
        throw new Error('User with this phone number already exists');
      }

      // Create a temporary email for phone-only registration
      // Format: phone@phone.grambazaar.local
      const tempEmail = `${phone}@phone.grambazaar.local`;
      const tempPassword = getPhoneTempPassword(phone);
      
      // Create Appwrite auth account
      const authUser = await account.create(ID.unique(), tempEmail, tempPassword, name);
      
      // Create user document in database
      const userData = await createUser(
        {
          name,
          email: tempEmail,
          phone,
          role,
        },
        authUser.$id
      );

      // Create session
      await createFreshEmailSession(tempEmail, tempPassword);
      
      setUser(userData);
    } catch (error: any) {
      console.error('Phone registration error:', error);
      throw new Error(error.message || 'Failed to register with phone');
    } finally {
      setLoading(false);
    }
  };

  const verifyPhoneOTP = async (phone: string, otp: string) => {
    try {
      setLoading(true);
      
      if (IS_DEV) {
        // Mock OTP verification
        if (otp !== DEV_OTP) {
          throw new Error('Invalid OTP. Use 123456 for testing');
        }
        // In dev mode, OTP verified but need to complete registration
        console.log('[DEV] OTP verified successfully');
      } else {
        // Production: Verify with Appwrite
        throw new Error('Phone OTP not configured for production yet');
      }
    } catch (error: any) {
      console.error('Verify OTP error:', error);
      throw new Error(error.message || 'Failed to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  const loginWithPhone = async (phone: string, otp: string) => {
    try {
      setLoading(true);
      
      if (IS_DEV) {
        // Mock OTP verification
        if (otp !== DEV_OTP) {
          throw new Error('Invalid OTP. Use 123456 for testing');
        }
        
        // Find user by phone in database
        const userData = await getUserByPhone(phone);
        if (!userData) {
          throw new Error('User not found. Please register first.');
        }
        
        // Create a real Appwrite session so it persists across app restarts
        const tempEmail = `${phone}@phone.grambazaar.local`;
        const tempPassword = getPhoneTempPassword(phone);
        await createFreshEmailSession(tempEmail, tempPassword);
        
        setUser(userData);
      } else {
        // Production: Appwrite phone session
        throw new Error('Phone OTP not configured for production yet');
      }
    } catch (error: any) {
      console.error('Phone login error:', error);
      throw new Error(error.message || 'Failed to login with phone');
    } finally {
      setLoading(false);
    }
  };

  const forgotPassword = async (email: string) => {
    try {
      setLoading(true);
      
      // Appwrite password recovery - sends real email
      await account.createRecovery(
        email,
        'https://souvik001122.github.io/gram-reset-pass-AppD_project-/' // Your GitHub Pages reset page
      );
    } catch (error: any) {
      console.error('Forgot password error:', error);
      throw new Error(error.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      // Only try to delete session if user is actually logged in
      if (user) {
        try {
          await account.deleteSession('current');
        } catch (error: any) {
          // Ignore error if session doesn't exist
          if (!error.message?.includes('missing scopes')) {
            console.error('Logout error:', error);
          }
        }
      }
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
      throw new Error('Failed to logout');
    } finally {
      setLoading(false);
    }
  };

  const refreshUser = async () => {
    try {
      const session = await account.get();
      if (session) {
        // Use email to find user document (not auth ID)
        let userData = await getUserByEmail(session.email);
        
        // Create user document if it doesn't exist
        if (!userData) {
          userData = await createUser(
            {
              name: session.name || 'User',
              email: session.email || '',
              phone: session.phone || '',
              role: 'buyer',
            },
            session.$id
          );
        }
        
        setUser(userData);
      }
    } catch (error) {
      console.error('Refresh user error:', error);
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    loginWithPhone,
    sendOTP,
    register,
    registerWithPhone,
    verifyPhoneOTP,
    forgotPassword,
    sendVerificationEmail,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
