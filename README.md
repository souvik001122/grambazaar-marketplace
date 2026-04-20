# GramBazaar Marketplace

GramBazaar is a trusted rural marketplace project that connects local artisans with buyers and tourists.
The repository is maintained for academic evaluation with startup-ready engineering practices.

## Project Goals
- Build a role-based marketplace across buyer, seller, and admin journeys.
- Maintain clear lab-wise academic traceability.
- Keep architecture scalable for future startup-level evolution.

## Core Features
- Authentication with role-aware onboarding and session control.
- Seller onboarding, verification flow, and product management.
- Buyer search, region explore, cart, checkout, and order tracking.
- Admin moderation for sellers, products, and operational oversight.
- Reviews, notifications, and issue escalation workflows.

## Tech Stack
- Frontend: React Native (Expo) + TypeScript
- Backend Platform: Appwrite (Auth, Database, Storage)
- State Management: Context + store-based flows
- Navigation: Expo Router / React Navigation

## Branch Strategy
- `main`: stable and review-ready baseline
- `develop`: active development and integration
- `feature/*`: optional for large isolated features

## Commit Conventions
- `[LAB-x]` lab-wise academic timeline commits
- `[FEAT]` feature delivery commits
- `[FIX]` bug fixes and stability commits
- `[DOCS]` documentation updates
- `[INIT]` repository bootstrap commits

## Repository Structure
```
grambazaar-marketplace/
├── app/
├── src/
├── assets/
├── docs/
│   ├── lab1/
│   ├── lab2/
│   ├── ...
│   ├── architecture.md
│   ├── api-design.md
│   └── README.md
├── .env.example
├── package.json
└── README.md
```

## Labs Documentation
- Lab-wise records are in `docs/lab1` to `docs/lab12`.
- Each lab file includes objective, deliverables, related code areas, and status.

## Setup
1. Install dependencies:
```bash
npm install
```
2. Configure Appwrite values in `src/config/appwrite.ts` and `.env` as required.
3. Run locally:
```bash
npm start
```

## Roadmap Direction
- April phase focus: polishing, regression fixes, performance tuning, and final testing.
- Future startup path: payment hardening, observability, and recommendation intelligence.

## Contribution and Review
- Use `develop` for daily work.
- Merge to `main` only after stability checks.
- Keep changes documented in matching lab and commit format.
- Follow the full contribution standard in `CONTRIBUTING.md`.

## Project Team
- Shubham Kumar (231210099)
- Souvik Das (231210104)
- Vivek Bhardwaj (231210125)
- Yuvraj Pegu (231210129)
