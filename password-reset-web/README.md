# GramBazaar Password Reset Page

A modern, standalone password reset page for GramBazaar app using Appwrite.

## Setup Instructions

### 1. Configure Appwrite Project ID

Open `script.js` and replace `YOUR_PROJECT_ID` with your actual Appwrite project ID:

```javascript
const APPWRITE_PROJECT_ID = 'your-actual-project-id';
```

### 2. Update AuthContext Reset URL

In your main app, update the password reset URL in `src/context/AuthContext.tsx`:

```typescript
await account.createRecovery(
  email,
  'https://yourusername.github.io/repo-name/password-reset-web/' // Your GitHub Pages URL
);
```

### 3. Deploy to GitHub Pages

#### Option A: Direct Upload
1. Create a new GitHub repository
2. Upload all files from `password-reset-web` folder
3. Go to Settings > Pages
4. Select branch and folder
5. Save and get your URL

#### Option B: Using Git
```bash
cd password-reset-web
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/your-repo.git
git push -u origin main
```

Then enable GitHub Pages in repository settings.

### 4. Register URL in Appwrite

1. Go to your Appwrite Console
2. Navigate to your project > Settings > Platforms
3. Add a new Web Platform
4. Set Name: "Password Reset Page"
5. Set Hostname: `yourusername.github.io`
6. Save

### 5. Test the Flow

1. Request password reset from your app
2. Check your email for the reset link
3. Click the link - it should open your GitHub Pages reset page
4. Enter new password and submit
5. Log in to your app with the new password

## Features

- ✅ Modern, responsive design
- ✅ Mobile-friendly
- ✅ Password validation
- ✅ Real-time error handling
- ✅ Success confirmation
- ✅ Appwrite integration
- ✅ Ready for GitHub Pages

## File Structure

```
password-reset-web/
├── index.html      # Main HTML page
├── style.css       # Styling
├── script.js       # Appwrite logic
└── README.md       # This file
```

## Support

For issues or questions, refer to the main GramBazaar app documentation.
