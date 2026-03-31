# Automated Appwrite Setup

## Quick Setup (Recommended)

Instead of manually creating all collections and attributes, use the automated script!

### Steps:

1. **Get your API Key**:
   - Go to [Appwrite Console](https://cloud.appwrite.io)
   - Open your GramBazzar project
   - Go to **Settings** (bottom left) → **API Keys**
   - Click **"Create API Key"**
   - Name: `Database Setup`
   - Scopes: Select ALL scopes (or at least: `databases.read`, `databases.write`, `collections.read`, `collections.write`, `attributes.read`, `attributes.write`, `documents.read`, `documents.write`, `buckets.read`, `buckets.write`)
   - Click **Create**
   - Copy the API key (you'll only see it once!)

2. **Install Node Appwrite SDK**:
   ```bash
   npm install node-appwrite
   ```

3. **Update the setup script**:
   - Open `setup-appwrite.js`
   - Replace `YOUR_API_KEY_HERE` with your actual API key

4. **Run the setup script**:
   ```bash
   node setup-appwrite.js
   ```

5. **Add Platform** (still manual):
   - Go to Appwrite Console → Settings → Platforms
   - Add Web App with hostname: `localhost`

6. **Restart your app**:
   ```bash
   npx expo start -c
   ```

---

## What the script does:

✅ Creates all 5 collections (users, sellers, products, orders, categories)  
✅ Adds all attributes with correct types and defaults  
✅ Creates both storage buckets with proper settings  
✅ Adds sample categories  
✅ Sets up proper permissions  

**Time saved**: ~30-45 minutes of manual work!

---

## If you prefer manual setup:

Follow the step-by-step instructions in `APPWRITE_SETUP.md`
