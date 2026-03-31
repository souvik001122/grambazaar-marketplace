# GramBazaar Email Verification Page

A standalone email verification page for GramBazaar, using Appwrite.

When a user clicks the verification link in their email, they land on this page. It automatically calls `account.updateVerification(userId, secret)` to confirm the email, then shows a success message.

## Setup Instructions

### 1. Deploy to GitHub Pages

#### Option A: Direct Upload
1. Create a new GitHub repository (or use the same one as `password-reset-web`)
2. Upload all files from this `email-verification-web` folder
3. Go to **Settings → Pages**
4. Select branch and folder
5. Save and note the deployed URL

#### Option B: Using Git
```bash
cd email-verification-web
git init
git add .
git commit -m "Email verification page"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/grambazaar-verify.git
git push -u origin main
```
Then enable GitHub Pages in the repository settings.

### 2. Update the Verification URL in the App

Open `src/config/appwrite.ts` and update the `EMAIL_VERIFICATION_URL`:

```typescript
export const EMAIL_VERIFICATION_URL = 'https://YOUR_USERNAME.github.io/REPO_NAME/email-verification-web/';
```

The app uses this URL when calling `account.createVerification()`. Appwrite appends `?userId=xxx&secret=yyy` to it automatically.

### 3. Add the URL to Appwrite Platforms

In the Appwrite Console:
1. Go to your project → **Settings → Platforms**
2. Add the GitHub Pages domain (e.g., `YOUR_USERNAME.github.io`) as a **Web** platform
3. This is required for Appwrite to allow the verification redirect

## How It Works

1. User signs up in the app → app calls `account.createVerification(url)`
2. Appwrite sends email with link: `{url}?userId=xxx&secret=yyy`
3. User clicks link → this page opens in browser
4. Page auto-calls `account.updateVerification(userId, secret)`
5. Shows "Email Verified!" on success
6. User goes back to app → taps "I've Verified My Email" → logs in
