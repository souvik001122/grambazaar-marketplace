import { Platform, Alert } from 'react-native';

/**
 * Cross-platform alert that works on both mobile and web
 */
export const showAlert = (title: string, message?: string, buttons?: any[]) => {
  if (Platform.OS === 'web') {
    const alertMessage = message ? `${title}\n\n${message}` : title;
    
    // If there are multiple buttons, use confirm() to get Cancel/OK
    if (buttons && buttons.length > 1) {
      const confirmed = window.confirm(alertMessage);
      
      if (confirmed) {
        // User clicked OK - call the last button (primary action)
        const primaryButton = buttons[buttons.length - 1];
        if (primaryButton && primaryButton.onPress) {
          primaryButton.onPress();
        }
      } else {
        // User clicked Cancel - call the first button (cancel action)
        const cancelButton = buttons[0];
        if (cancelButton && cancelButton.onPress) {
          cancelButton.onPress();
        }
      }
    } else {
      // Single button or no buttons - use alert()
      window.alert(alertMessage);
      if (buttons && buttons.length > 0) {
        const button = buttons[0];
        if (button && button.onPress) {
          button.onPress();
        }
      }
    }
  } else {
    // Use native Alert for mobile
    Alert.alert(title, message, buttons);
  }
};
