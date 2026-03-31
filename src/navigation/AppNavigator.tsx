import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { getSellerByUserId } from '../services/sellerService';
import { SellerVerificationStatusScreen } from '../screens/seller/SellerVerificationStatusScreen';

// Auth Screens
import WelcomeScreen from '../screens/auth/WelcomeScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import OTPVerificationScreen from '../screens/auth/OTPVerificationScreen';
import EmailVerificationScreen from '../screens/auth/EmailVerificationScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import { BecomeSellerScreen } from '../screens/seller/BecomeSellerScreen';

// Role-based Navigators
import BuyerNavigator from './BuyerNavigator';
import SellerNavigator from './SellerNavigator';
import AdminNavigator from './AdminNavigator';

const Stack = createNativeStackNavigator();

// Deep linking configuration
const linking = {
  prefixes: ['https://grambazaar.app', 'http://grambazaar.app', 'grambazaar://'],
  config: {
    screens: {
      ResetPassword: 'reset-password',
      Welcome: 'welcome',
      Login: 'login',
      Register: 'register',
    },
  },
};

const AppNavigator = () => {
  const { user, loading, isAuthenticated } = useAuth();
  const [sellerProfile, setSellerProfile] = useState<any>(null);
  const [checkingSellerProfile, setCheckingSellerProfile] = useState(true);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  useEffect(() => {
    const checkSellerProfile = async () => {
      if (isAuthenticated && user?.role === 'seller') {
        setCheckingSellerProfile(true);
        const profile = await getSellerByUserId(user.$id);
        setSellerProfile(profile);
        setCheckingSellerProfile(false);
      } else {
        setCheckingSellerProfile(false);
      }
    };

    checkSellerProfile();
  }, [isAuthenticated, user, reloadTrigger]);

  if (loading || (isAuthenticated && user?.role === 'seller' && checkingSellerProfile)) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <>
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="OTPVerification" component={OTPVerificationScreen} />
            <Stack.Screen name="EmailVerification" component={EmailVerificationScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
            <Stack.Screen name="GuestBuyerApp" component={BuyerNavigator} />
          </>
        ) : user?.role === 'admin' ? (
          <Stack.Screen name="AdminApp" component={AdminNavigator} />
        ) : user?.role === 'seller' ? (
          // If seller role but no profile, show BecomeSellerScreen
          !sellerProfile ? (
            <Stack.Screen name="BecomeSeller">
              {(props) => <BecomeSellerScreen {...props} onProfileCreated={() => setReloadTrigger(prev => prev + 1)} />}
            </Stack.Screen>
          ) : sellerProfile.verificationStatus === 'approved' ? (
            // Only approved sellers get full access
            <Stack.Screen name="SellerApp" component={SellerNavigator} />
          ) : (
            // Pending / rejected / blocked sellers see status screen
            <Stack.Screen name="VerificationStatus">
              {(props) => (
                <SellerVerificationStatusScreen
                  {...props}
                  onRecheck={() => setReloadTrigger(prev => prev + 1)}
                />
              )}
            </Stack.Screen>
          )
        ) : (
          <Stack.Screen name="BuyerApp" component={BuyerNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
