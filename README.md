# GramBazaar - Rural Artisan Marketplace

GramBazaar is a region-based digital marketplace designed to connect verified rural artisans with buyers seeking authentic handmade products.

## 🎯 Features

### For Buyers
- Browse authentic handmade products by region
- Verified seller badges for trust
- Secure payment via Razorpay
- Order tracking and management
- Category-based product discovery

### For Sellers
- Digital presence for rural artisans
- Product management dashboard
- Order tracking
- Admin verification system
- Payment integration

### For Admins
- Seller verification workflow
- Product approval system
- Order monitoring
- Platform analytics

## 🛠️ Tech Stack

- **Frontend**: React Native with Expo
- **UI Library**: React Native Paper (Material Design)
- **State Management**: Zustand
- **Backend**: Appwrite (BaaS)
- **Authentication**: Appwrite Auth
- **Database**: Appwrite Database
- **Storage**: Appwrite Storage
- **Payment**: Razorpay (Sandbox)
- **Navigation**: Expo Router
- **Language**: TypeScript

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd grambazaar
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Appwrite**
   - Create an Appwrite project at [cloud.appwrite.io](https://cloud.appwrite.io)
   - Update `src/config/appwrite.ts` with your project credentials:
     - `projectId`
     - `databaseId`
     - Collection IDs
     - Bucket IDs

4. **Set up Appwrite Database**

   Create the following collections in your Appwrite database:

   **users** collection:
   - `email` (string, required)
   - `name` (string, required)
   - `phone` (string, optional)
   - `role` (string, required) - enum: buyer, seller, admin
   - `profileImage` (string, optional)
   - `createdAt` (datetime)
   - `updatedAt` (datetime)

   **sellers** collection:
   - `userId` (string, required)
   - `businessName` (string, required)
   - `description` (string, required)
   - `region` (string, required)
   - `state` (string, required)
   - `city` (string, required)
   - `address` (string, required)
   - `craftType` (string, required)
   - `verificationStatus` (string, required) - enum: pending, approved, rejected
   - `verificationDocuments` (string[], required)
   - `verifiedBadge` (boolean, default: false)
   - `rating` (number, default: 0)
   - `totalOrders` (number, default: 0)
   - `createdAt` (datetime)
   - `updatedAt` (datetime)

   **products** collection:
   - `sellerId` (string, required)
   - `name` (string, required)
   - `description` (string, required)
   - `images` (string[], required)
   - `price` (number, required)
   - `category` (string, required)
   - `region` (string, required)
   - `state` (string, required)
   - `stock` (number, required)
   - `status` (string, required) - enum: pending, approved, rejected, out_of_stock
   - `rating` (number, default: 0)
   - `reviewCount` (number, default: 0)
   - `tags` (string[], optional)
   - `createdAt` (datetime)
   - `updatedAt` (datetime)

   **orders** collection:
   - `buyerId` (string, required)
   - `items` (object[], required)
   - `totalAmount` (number, required)
   - `status` (string, required) - enum: pending, payment_pending, payment_confirmed, processing, shipped, delivered, cancelled, refunded
   - `paymentId` (string, optional)
   - `paymentStatus` (string, required) - enum: pending, success, failed
   - `deliveryAddress` (string, required)
   - `deliveryTime` (string, optional)
   - `trackingInfo` (string, optional)
   - `createdAt` (datetime)
   - `updatedAt` (datetime)

   **categories** collection:
   - `name` (string, required)
   - `icon` (string, required)
   - `description` (string, optional)

5. **Set up Appwrite Storage**

   Create the following buckets:
   - `product-images` - for product photos
   - `seller-documents` - for seller verification documents

6. **Configure Razorpay**
   - Sign up at [razorpay.com](https://razorpay.com)
   - Get your test API keys
   - Add payment configuration (to be implemented)

## 🚀 Running the App

```bash
# Start the development server
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios

# Run on Web
npm run web
```

## 📱 App Structure

```
grambazaar/
├── app/                    # Expo Router pages
│   ├── (auth)/            # Authentication screens
│   │   ├── login.tsx
│   │   └── signup.tsx
│   ├── (buyer)/           # Buyer screens
│   │   ├── index.tsx      # Home
│   │   ├── browse.tsx
│   │   ├── cart.tsx
│   │   ├── orders.tsx
│   │   └── profile.tsx
│   ├── (seller)/          # Seller screens
│   │   ├── index.tsx      # Dashboard
│   │   ├── products.tsx
│   │   ├── orders.tsx
│   │   └── profile.tsx
│   └── (admin)/           # Admin screens
│       ├── index.tsx      # Dashboard
│       ├── sellers.tsx
│       ├── products.tsx
│       └── orders.tsx
├── src/
│   ├── config/            # Configuration files
│   │   ├── appwrite.ts
│   │   └── theme.ts
│   ├── services/          # API services
│   │   ├── authService.ts
│   │   └── productService.ts
│   ├── stores/            # Zustand stores
│   │   ├── authStore.ts
│   │   └── cartStore.ts
│   └── types/             # TypeScript types
│       └── index.ts
└── assets/                # Images and assets
```

## 🔐 User Roles

1. **Buyer**: Browse and purchase products
2. **Seller**: List and manage products, receive orders
3. **Admin**: Verify sellers, approve products, monitor platform

## 🎨 Design System

The app uses React Native Paper with a custom earthy color palette inspired by rural craftsmanship:

- **Primary**: #8B4513 (Earthy Brown)
- **Secondary**: #D2691E (Chocolate Brown)
- **Tertiary**: #CD853F (Golden Brown)
- **Background**: #FFFAF0 (Floral White)

## 📝 Next Steps

1. Implement product details screen
2. Add product upload functionality for sellers
3. Implement seller verification workflow
4. Integrate Razorpay payment gateway
5. Add order management features
6. Implement real-time notifications
7. Add search and filtering
8. Implement WhatsApp integration for seller communication
9. Add Google Maps for location selection
10. Implement reviews and ratings

## 🤝 Contributing

This is a project scaffold. Contributions and enhancements are welcome!

## 📄 License

MIT License

## 📞 Support

For support, please contact the development team.
