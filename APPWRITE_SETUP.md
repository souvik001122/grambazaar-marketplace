# Appwrite Database Setup Guide for GramBazaar

## Project Information
- **Project ID**: `697aea5a0009bbcaf972`
- **Database ID**: `697aeb4a003d2872de00`
- **Endpoint**: `https://cloud.appwrite.io/v1`

---

## Collections to Create

### 1. **users** Collection

**Collection ID**: `users`

**Attributes**:
| Attribute | Type | Size | Required | Array | Default |
|-----------|------|------|----------|-------|---------|
| email | String | 255 | Yes | No | - |
| name | String | 255 | Yes | No | - |
| phone | String | 20 | No | No | - |
| role | String | 50 | Yes | No | buyer |
| profileImage | String | 2000 | No | No | - |
| createdAt | String | 50 | Yes | No | - |
| updatedAt | String | 50 | Yes | No | - |

**Indexes**:
- `email` (unique, ASC)
- `role` (fulltext, ASC)

**Permissions**:
- **Create**: Any
- **Read**: Users (role:member)
- **Update**: Users (role:member)
- **Delete**: Users (role:member)

---

### 2. **sellers** Collection

**Collection ID**: `sellers`

**Attributes**:
| Attribute | Type | Size | Required | Array | Default |
|-----------|------|------|----------|-------|---------|
| userId | String | 255 | Yes | No | - |
| businessName | String | 255 | Yes | No | - |
| description | String | 5000 | Yes | No | - |
| region | String | 100 | Yes | No | - |
| state | String | 100 | Yes | No | - |
| city | String | 100 | Yes | No | - |
| district | String | 100 | No | No | - |
| village | String | 120 | No | No | - |
| address | String | 500 | Yes | No | - |
| craftType | String | 100 | Yes | No | - |
| phone | String | 20 | No | No | - |
| latitude | Float | - | No | No | - |
| longitude | Float | - | No | No | - |
| verificationStatus | String | 50 | Yes | No | pending |
| verificationDocuments | String | 2000 | No | Yes | - |
| paymentUpiId | String | 120 | No | No | - |
| paymentQrImageUrl | String | 2000 | No | No | - |
| paymentBankAccountName | String | 150 | No | No | - |
| paymentBankAccountNumber | String | 32 | No | No | - |
| paymentBankIfsc | String | 20 | No | No | - |
| verifiedBadge | Boolean | - | Yes | No | false |
| rating | Float | - | Yes | No | 0 |
| totalOrders | Integer | - | Yes | No | 0 |
| createdAt | String | 50 | Yes | No | - |
| updatedAt | String | 50 | Yes | No | - |

**Indexes**:
- `userId` (unique, ASC)
- `verificationStatus` (fulltext, ASC)
- `region` (fulltext, ASC)
- `state` (fulltext, ASC)
- `district` (fulltext, ASC)

**Canonical mapping note (strict forms)**:
- Store seller `region` and `state` with the same state value.
- Store seller `city` with district value.
- Store seller `village` with selected locality/village value.

**Permissions**:
- **Create**: Any
- **Read**: Any
- **Update**: Users (role:member)
- **Delete**: Users (role:member)

---

### 3. **products** Collection

**Collection ID**: `products`

**Attributes**:
| Attribute | Type | Size | Required | Array | Default |
|-----------|------|------|----------|-------|---------|
| sellerId | String | 255 | Yes | No | - |
| name | String | 255 | Yes | No | - |
| description | String | 5000 | Yes | No | - |
| images | String | 2000 | Yes | Yes | - |
| price | Float | - | Yes | No | 0 |
| category | String | 100 | Yes | No | - |
| region | String | 100 | Yes | No | - |
| state | String | 100 | Yes | No | - |
| stock | Integer | - | Yes | No | 0 |
| status | String | 50 | Yes | No | pending |
| rating | Float | - | Yes | No | 0 |
| reviewCount | Integer | - | Yes | No | 0 |
| tags | String | 100 | No | Yes | - |
| createdAt | String | 50 | Yes | No | - |
| updatedAt | String | 50 | Yes | No | - |

**Indexes**:
- `sellerId` (fulltext, ASC)
- `category` (fulltext, ASC)
- `status` (fulltext, ASC)
- `region` (fulltext, ASC)
- `state` (fulltext, ASC)

**Canonical mapping note (strict forms)**:
- Store product `region` and `state` with the same seller state value for reliable filtering.

**Permissions**:
- **Create**: Users (role:member)
- **Read**: Any
- **Update**: Users (role:member)
- **Delete**: Users (role:member)

---

### 4. **orders** Collection

**Collection ID**: `orders`

**Attributes**:
| Attribute | Type | Size | Required | Array | Default |
|-----------|------|------|----------|-------|---------|
| buyerId | String | 255 | Yes | No | - |
| items | String | 10000 | Yes | No | - |
| totalAmount | Float | - | Yes | No | 0 |
| status | String | 50 | Yes | No | pending |
| paymentId | String | 255 | No | No | - |
| paymentStatus | String | 50 | Yes | No | pending |
| deliveryAddress | String | 1000 | Yes | No | - |
| deliveryTime | String | 50 | No | No | - |
| trackingInfo | String | 500 | No | No | - |
| createdAt | String | 50 | Yes | No | - |
| updatedAt | String | 50 | Yes | No | - |

**Note**: `items` is stored as JSON string (stringify OrderItem array)

**Indexes**:
- `buyerId` (fulltext, ASC)
- `status` (fulltext, ASC)
- `createdAt` (fulltext, DESC)

**Permissions**:
- **Create**: Users (role:member)
- **Read**: Users (role:member)
- **Update**: Users (role:member)
- **Delete**: Users (role:member)

---

### 5. **categories** Collection

**Collection ID**: `categories`

**Attributes**:
| Attribute | Type | Size | Required | Array | Default |
|-----------|------|------|----------|-------|---------|
| name | String | 255 | Yes | No | - |
| icon | String | 100 | Yes | No | - |
| description | String | 1000 | Yes | No | - |

**Indexes**:
- `name` (unique, ASC)

**Permissions**:
- **Create**: Users (role:member)
- **Read**: Any
- **Update**: Users (role:member)
- **Delete**: Users (role:member)

---

## Storage Buckets to Create

### 1. **product-images** Bucket

**Bucket ID**: `product-images`

**Settings**:
- **Maximum File Size**: 10 MB
- **Allowed File Extensions**: jpg, jpeg, png, webp, gif
- **Compression**: gzip
- **Encryption**: Yes
- **Antivirus**: Yes

**Permissions**:
- **Create**: Users (role:member)
- **Read**: Any
- **Update**: Users (role:member)
- **Delete**: Users (role:member)

---

### 2. **seller-documents** Bucket

**Bucket ID**: `seller-documents`

**Settings**:
- **Maximum File Size**: 5 MB
- **Allowed File Extensions**: jpg, jpeg, png, pdf
- **Compression**: gzip
- **Encryption**: Yes
- **Antivirus**: Yes

**Permissions**:
- **Create**: Users (role:member)
- **Read**: Users (role:member)
- **Update**: Users (role:member)
- **Delete**: Users (role:member)

---

## Setup Steps

### Step 1: Create Collections

1. Go to [Appwrite Console](https://cloud.appwrite.io)
2. Open your **GramBazzar** project
3. Navigate to **Databases** → Select database `697aeb4a003d2872de00`
4. Click **"Create Collection"**
5. For each collection above:
   - Enter the **Collection ID** (exact match)
   - Enter a **Collection Name**
   - Click **Create**
   - Add all attributes from the tables above
   - Create the indexes
   - Set permissions

### Step 2: Create Storage Buckets

1. In your Appwrite Console
2. Navigate to **Storage**
3. Click **"Create Bucket"**
4. For each bucket above:
   - Enter the **Bucket ID** (exact match)
   - Enter a **Bucket Name**
   - Configure settings as specified
   - Set permissions
   - Click **Create**

### Step 3: Add Sample Categories

After creating the `categories` collection, add some sample categories:

```json
[
  {
    "name": "Handicrafts",
    "icon": "hand-saw",
    "description": "Traditional handmade crafts"
  },
  {
    "name": "Textiles",
    "icon": "tshirt-crew",
    "description": "Handwoven fabrics and garments"
  },
  {
    "name": "Pottery",
    "icon": "pot",
    "description": "Clay pottery and ceramics"
  },
  {
    "name": "Jewelry",
    "icon": "diamond-stone",
    "description": "Handcrafted jewelry and accessories"
  },
  {
    "name": "Woodwork",
    "icon": "tree",
    "description": "Wooden crafts and furniture"
  },
  {
    "name": "Art",
    "icon": "palette",
    "description": "Paintings and artwork"
  }
]
```

### Step 4: Platform Configuration

1. In your Appwrite Console
2. Go to **Settings** → **Platforms**
3. Add the following platforms:

**Web Platform**:
- **Name**: GramBazaar Web
- **Hostname**: `localhost` (for development)

**For Production**: Add your actual domain

---

## Verification Checklist

- [ ] All 5 collections created with correct IDs
- [ ] All attributes added to each collection
- [ ] All indexes created
- [ ] Permissions configured for all collections
- [ ] Both storage buckets created
- [ ] Storage bucket permissions configured
- [ ] Platform added in settings
- [ ] Sample categories added

---

## Testing

After setup, test by:
1. Restarting your Expo app: `npx expo start -c`
2. Login with your account
3. Browse products (should show empty list initially)
4. Try adding a product (if you're a seller)

---

## Troubleshooting

**Collection not found**: Make sure the Collection ID exactly matches the one in `src/config/appwrite.ts`

**Permission denied**: Check that permissions are set correctly for each collection

**Platform error**: Ensure you've added your platform in Settings → Platforms

---

## Next Steps

After database setup:
1. Create seller profile if you're a seller
2. Add products through the seller dashboard
3. Test the buyer flow by browsing and adding items to cart
4. Integrate payment gateway (Razorpay) for actual orders
