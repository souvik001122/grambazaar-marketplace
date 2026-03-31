// Appwrite Configuration
const APPWRITE_ENDPOINT = 'https://cloud.appwrite.io/v1';
const APPWRITE_PROJECT_ID = '697aea5a0009bbcaf972'; // Your GramBazaar project ID

// Initialize Appwrite
const client = new Appwrite.Client();
client.setEndpoint(APPWRITE_ENDPOINT).setProject(APPWRITE_PROJECT_ID);
const account = new Appwrite.Account(client);

// Get URL parameters
function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        userId: params.get('userId'),
        secret: params.get('secret')
    };
}

// Show error message
function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    const successDiv = document.getElementById('successMessage');
    
    errorDiv.textContent = message;
    errorDiv.classList.add('show');
    successDiv.classList.remove('show');
    
    setTimeout(() => {
        errorDiv.classList.remove('show');
    }, 5000);
}

// Show success message
function showSuccess(message) {
    const errorDiv = document.getElementById('errorMessage');
    const successDiv = document.getElementById('successMessage');
    
    successDiv.textContent = message;
    successDiv.classList.add('show');
    errorDiv.classList.remove('show');
}

// Handle form submission
async function handleSubmit(event) {
    event.preventDefault();
    
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const submitBtn = document.getElementById('submitBtn');
    
    // Validate passwords match
    if (password !== confirmPassword) {
        showError('Passwords do not match!');
        return;
    }
    
    // Validate password strength
    if (password.length < 8) {
        showError('Password must be at least 8 characters long!');
        return;
    }
    
    // Get userId and secret from URL
    const { userId, secret } = getUrlParams();
    
    if (!userId || !secret) {
        showError('Invalid reset link. Please request a new password reset.');
        return;
    }
    
    // Disable button and show loading
    submitBtn.disabled = true;
    submitBtn.textContent = 'Resetting...';
    
    try {
        // Call Appwrite to update password
        await account.updateRecovery(userId, secret, password);
        
        showSuccess('✅ Password reset successful! You can now close this page and log in to the GramBazaar app with your new password.');
        
        // Clear form
        document.getElementById('resetForm').reset();
        
        // Hide form after success
        document.getElementById('resetForm').style.display = 'none';
        
    } catch (error) {
        console.error('Reset password error:', error);
        showError(error.message || 'Failed to reset password. Please try again or request a new reset link.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Reset Password';
    }
}

// Check if reset link has valid parameters on page load
window.addEventListener('DOMContentLoaded', () => {
    const { userId, secret } = getUrlParams();
    
    if (!userId || !secret) {
        showError('Invalid reset link. Please check your email and use the correct link.');
    }
    
    // Add form submit listener
    document.getElementById('resetForm').addEventListener('submit', handleSubmit);
});
