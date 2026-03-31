// Appwrite Configuration
const APPWRITE_ENDPOINT = 'https://cloud.appwrite.io/v1';
const APPWRITE_PROJECT_ID = '697aea5a0009bbcaf972'; // GramBazaar project ID

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

// Show a specific state, hide others
function showState(stateId) {
    const states = ['loadingState', 'successState', 'errorState', 'invalidState'];
    states.forEach(id => {
        document.getElementById(id).style.display = id === stateId ? 'block' : 'none';
    });
}

// Verify email on page load
async function verifyEmail() {
    const { userId, secret } = getUrlParams();

    // Check for valid parameters
    if (!userId || !secret) {
        showState('invalidState');
        return;
    }

    try {
        // Call Appwrite to confirm email verification
        await account.updateVerification(userId, secret);
        showState('successState');
    } catch (error) {
        console.error('Verification error:', error);

        // Check if already verified
        if (error.message && error.message.includes('already verified')) {
            showState('successState');
        } else {
            document.getElementById('errorText').textContent =
                error.message || 'Verification failed. The link may have expired. Please request a new verification email from the app.';
            showState('errorState');
        }
    }
}

// Auto-verify when page loads
window.addEventListener('DOMContentLoaded', verifyEmail);
