# Architecture Overview

## High-Level
- Frontend: React Native (Expo) + TypeScript
- Backend Services: Appwrite (Auth, Database, Storage, Functions where needed)
- State Management: Context + stores for auth/cart workflows

## Major Modules
- Authentication and role-based navigation
- Seller onboarding, profile, products, and orders
- Buyer browse/search/explore/cart/orders/reviews
- Admin moderation, approvals, logs, and oversight

## Non-Functional Goals
- Performance on low-end Android devices
- Clear module boundaries for future startup scaling
- Strong documentation for academic auditability
