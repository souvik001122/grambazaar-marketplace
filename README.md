# GramBazaar

GramBazaar is a region-focused marketplace that connects verified rural artisans with buyers looking for authentic, unique, and locality-specific products.

It is designed to work as an online + offline bridge:
- Buyers can discover trusted artisans and products by region.
- Buyers can contact or order online.
- Buyers can also visit artisan shops offline using location and map directions.
- Artisans get a simple platform without the complexity of large e-commerce systems.

## Problem Statement

Rural artisans often struggle with digital visibility, online buyer access, and trust-building. At the same time, buyers and tourists find it difficult to identify genuine regional products and verified sellers.

GramBazaar addresses this gap through a trusted, verification-driven, region-first marketplace model.

## Core Objectives

- Digitize and empower rural artisans.
- Build a verified seller ecosystem.
- Promote regional heritage and traditional products.
- Improve artisan income opportunities.
- Enable simple, trustworthy product discovery for buyers.
- Maintain a scalable architecture for future expansion.

## Key Features

### Buyer
- Region-based product discovery and search.
- Product filters (region, category, price, rating, verified sellers).
- Seller trust signals (verification, ratings, profile).
- Direct contact options (call / WhatsApp / request flow).
- Reviews, reports, wishlist, and profile management.

### Seller (Artisan)
- Guided seller onboarding and verification workflow.
- Product upload and lifecycle management (pending/active/rejected).
- Seller dashboard with stats, notifications, and activity.
- Trust score visibility and account health monitoring.
- Shop location setup (address + latitude/longitude).

### Admin
- Seller verification and product approval workflows.
- Moderation for reports and disputes.
- Trust and quality governance with audit logs.
- Analytics for users, sellers, regions, and product trends.

## Seller Shop Location (Online + Offline Bridge)

GramBazaar supports seller shop location so tourists and local buyers can physically visit artisan shops.

- Seller provides location details during profile/setup.
- Product and seller pages show region/shop location.
- Buyers can open map directions directly.

Example direction URL format:
`https://www.google.com/maps?q=<latitude>,<longitude>`

## Tech Stack

- Frontend: React Native (Expo) + TypeScript
- Backend: Appwrite (Authentication, Database, Storage)
- State Management: Context + store modules
- Navigation: Expo Router / React Navigation
- Notifications: Expo push notification flow

## Repository Structure

```text
gramBazaar-main/
├── app/
├── src/
│   ├── components/
│   ├── navigation/
│   ├── screens/
│   ├── services/
│   ├── stores/
│   ├── types/
│   └── utils/
├── docs/
│   ├── lab1/ ... lab12/
│   ├── architecture.md
│   ├── api-design.md
│   └── lab-traceability-matrix.md
├── package.json
└── README.md
```

## Getting Started

### Prerequisites
- Node.js LTS
- npm
- Expo CLI (optional, if not using `npx`)

### Installation

```bash
npm install
```

### Run The App

```bash
npm start
```

### Run On Web

```bash
npm run web
# or
expo start --web
```

### Platform Targets

```bash
npm run android
npm run ios
```

## Appwrite Setup Notes

- Configure Appwrite project and credentials in project config files before running.
- Keep database schema, attributes, indexes, and permissions aligned with service-layer expectations.
- When backend validation rules change, update setup/migration scripts accordingly.

## Branching And Commits

- `main`: stable/review-ready branch.
- `develop`: active integration branch.
- `feature/*`: optional for isolated large features.

Commit prefixes used in this repository:
- `[INIT]`
- `[DOCS]`
- `[LAB-x]`
- `[FEAT]`
- `[FIX]`
- `[MERGE]`

## Lab Traceability

- Lab tracking is maintained in `docs/lab1` to `docs/lab12`.
- Cross-lab mapping is maintained in `docs/lab-traceability-matrix.md`.

## Contributing

Please read `CONTRIBUTING.md` for workflow, commit hygiene, pull request checks, and quality rules.

## Team

- Shubham Kumar (231210099)
- Souvik Das (231210104)
- Vivek Bhardwaj (231210125)
- Yuvraj Pegu (231210129)
