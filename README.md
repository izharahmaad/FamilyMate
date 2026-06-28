<div align="center">

<img src="https://img.shields.io/badge/FamilyMate-v1.0.0-6C63FF?style=for-the-badge&logo=heart&logoColor=white" alt="FamilyMate" />

# 💰 FamilyMate

### *The Smart Family Finance Manager — Budget Together, Spend Wisely*

> A shared mobile platform for families to track expenses, plan budgets, and build financial transparency powered by real-time Firebase sync and a clean React Native experience.


<img src="https://img.shields.io/github/stars/izharahmaad/familymate?style=social" />
&nbsp;
<img src="https://img.shields.io/github/forks/izharahmaad/familymate?style=social" />
&nbsp;
<img src="https://img.shields.io/github/watchers/izharahmaad/familymate?style=social" />

</div>

***

## 📋 Table of Contents

- [Overview](#-overview)
- [Why FamilyMate?](#-why-familymate)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Architecture](#-project-architecture)
- [Getting Started](#-getting-started)
- [Environment Setup](#-environment-setup)
- [Running the App](#-running-the-app)
- [Building APK](#-building-apk)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [Author](#-author)
- [License](#-license)

***

## 🎯 Overview

**FamilyMate** is a full-stack cross-platform mobile application that solves one of the most overlooked household challenges — shared family financial management. In most Pakistani households, financial responsibilities are divided among multiple members with no centralized visibility. Records are scattered, budgets are informal, and month-end spending is always a surprise.

FamilyMate creates a **shared digital financial space** where every member of the family can view, manage, and contribute to their collective budget in real time. With intelligent daily spending projections, live budget progress tracking, and multi-account support, FamilyMate transforms chaotic household finances into a clear, structured, and collaborative system.

> Built for families who want financial clarity without financial complexity.

***

## 💡 Why FamilyMate?

| Problem | FamilyMate Solution |
|---|---|
| Scattered expense records across members | Shared family space with centralized transaction history |
| No visibility into daily spending limits | Daily spending target auto-calculated from monthly budget |
| Hard to track if budget is on or off track | Live balance with "should have spent by today" calculation |
| No shared access for family members | Join family via unique code — all members see the same data |
| Data lost when offline | Local storage backup keeps data accessible without internet |
| No export or backup option | Excel export and full data backup built in |

***

## ✨ Features

### 🏠 Family Management
- **Create Family Space** — Set up a shared family account with a unique invite code
- **Join Family** — Members join using the family code — no complex setup
- **Family Members Screen** — View all members, roles, and contribution overview
- **Family Settings** — Manage family name, invite code, and member permissions

### 💸 Expense Tracking
- **Add Expense** — Log transactions with category, amount, notes, and date
- **Transaction History** — Full filterable and searchable transaction list
- **Transaction Details** — Deep-dive into any individual expense record
- **Multi-Account Support** — Manage multiple spending accounts in one place

### 📊 Budget Planning
- **Monthly Budget Setup** — Set a fixed monthly budget for the entire family
- **Fixed Daily Plan** — Auto-converts monthly budget into a precise daily spending target
- **Smart Balance Display** — Shows how much *should* have been spent by today vs actual
- **Budget Limits Screen** — Set category-specific spending caps
- **Budget Progress Screen** — Visual progress indicators for overall and category budgets

### 📈 Analytics
- **Analytics Dashboard** — Spending trends, category breakdowns, and monthly comparisons
- **Visual Charts** — Clear data visualization for income vs expense patterns
- **Spending Insights** — Understand where the family budget goes each month

### ⚙️ Settings & Utilities
- **Currency Settings** — Support for PKR and other currencies
- **Language Settings** — Localization-ready architecture
- **Notification Settings** — Budget alert and expense reminder controls
- **Security Screen** — Password management and account security
- **Data Export** — Export transaction history to Excel (`.xlsx`)
- **Backup Screen** — Cloud backup and restore for all family data
- **Edit Profile** — Update personal info, avatar, and display name
- **Onboarding** — Beautiful illustrated walkthrough for new users

***

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React Native | Cross-platform mobile UI (Android + iOS) |
| Expo SDK | Build pipeline, OTA updates, and native module access |
| TypeScript | Full type-safe development across all screens and services |
| React Navigation | Stack, tab, and modal navigation |

### Backend & Services
| Technology | Purpose |
|---|---|
| Firebase Authentication | Secure email/password user auth |
| Cloud Firestore | Real-time NoSQL cloud database for shared family data |
| Local Storage | Offline-first budget planning data persistence |

### Utilities
| Technology | Purpose |
|---|---|
| `exportXlsx.ts` | Custom Excel export utility for transaction data |
| `accountStore.ts` | Zustand/local state management for active account |
| Expo EAS Build | Production APK and IPA generation |

***

## 📁 Project Architecture

FamilyMate follows a clean, modular structure keeping screens, navigation, business logic, and utilities clearly separated.

```
FamilyMate/
├── app.json                        # Expo project configuration
├── App.tsx                         # Root component and provider setup
├── index.ts                        # App entry point
├── eas.json                        # EAS Build profiles
├── tsconfig.json                   # TypeScript configuration
├── assets/
│   ├── icon.png                    # App icon
│   ├── splash-icon.png             # Splash screen
│   ├── adaptive-icon.png           # Android adaptive icon
│   ├── logo.png                    # FamilyMate brand logo
│   ├── avatar-family.png           # Default family avatar
│   ├── branding/                   # Brand assets
│   └── onboarding/                 # Onboarding screen illustrations
│       ├── family.jpg
│       ├── budget.jpg
│       ├── analytics.jpg
│       └── receipt.jpg
└── src/
    ├── components/
    │   └── FloatingFooter.tsx      # Persistent floating action footer
    ├── lib/
    │   ├── firebase.ts             # Firebase initialization and config
    │   └── accountStore.ts        # Active account state management
    ├── navigation/
    │   ├── RootNavigator.tsx       # Auth-aware root navigator
    │   ├── AuthNavigator.tsx       # Login / Signup / Forgot Password flow
    │   ├── AppNavigator.tsx        # Authenticated app flow
    │   ├── AppTabs.tsx             # Bottom tab bar navigator
    │   └── types.ts                # TypeScript navigation param types
    ├── screens/
    │   ├── OnboardingScreen.tsx    # First-launch illustrated walkthrough
    │   ├── LoginScreen.tsx         # Email/password login
    │   ├── SignupScreen.tsx        # New user registration
    │   ├── ForgotPasswordScreen.tsx
    │   ├── HomeScreen.tsx          # Dashboard — budget summary and quick actions
    │   ├── AddExpenseScreen.tsx    # Log a new expense transaction
    │   ├── TransactionsScreen.tsx  # Full transaction history with filters
    │   ├── TransactionDetailsScreen.tsx
    │   ├── BudgetScreen.tsx        # Monthly budget overview
    │   ├── BudgetLimitsScreen.tsx  # Category-level spending limits
    │   ├── FixedDailyPlanScreen.tsx # Daily target calculator
    │   ├── AnalyticsScreen.tsx     # Charts and spending insights
    │   ├── CreateFamilyScreen.tsx  # Create a new family space
    │   ├── JoinFamilyScreen.tsx    # Join via invite code
    │   ├── FamilyMembersScreen.tsx # Member list and roles
    │   ├── FamilySettingsScreen.tsx
    │   ├── ManageAccountsScreen.tsx
    │   ├── EditProfileScreen.tsx
    │   ├── SettingsScreen.tsx
    │   ├── CurrencySettingsScreen.tsx
    │   ├── LanguageSettingsScreen.tsx
    │   ├── NotificationSettingsScreen.tsx
    │   ├── NotificationsScreen.tsx
    │   ├── SecurityScreen.tsx
    │   ├── DataExportScreen.tsx    # Excel export
    │   ├── BackupScreen.tsx        # Cloud backup and restore
    │   ├── SupportScreen.tsx
    │   └── AboutAppScreen.tsx
    ├── theme/
    │   └── index.ts                # Colors, typography, and spacing tokens
    └── utils/
        └── exportXlsx.ts           # Excel file generation utility
```

***

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18 or later → [Download](https://nodejs.org/)
- **npm** or **yarn**
- **Expo CLI** — `npm install -g expo-cli`
- **EAS CLI** — `npm install -g eas-cli`
- **Android Studio** with emulator **or** physical device with USB debugging
- A **Firebase project** with Authentication and Firestore enabled

***

## ⚙️ Environment Setup

### 1. Clone the Repository

```bash
git clone https://github.com/izharahmaad/familymate.git
cd familymate
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Firebase

Add your Firebase project credentials to `src/lib/firebase.ts`:

```typescript
// src/lib/firebase.ts
const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_AUTH_DOMAIN',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_STORAGE_BUCKET',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};
```

> ⚠️ **Never commit your real Firebase credentials.** Add `src/lib/firebase.ts` to `.gitignore`.

***

## ▶️ Running the App

```bash
# Start Expo development server
npx expo start

# Run on Android
npx expo run:android

# Run on physical device — scan QR in Expo Go
```

***

## 📦 Building APK

```bash
# Configure EAS
eas build:configure

# Preview APK (installable)
eas build --platform android --profile preview

# Production build
eas build --platform android --profile production
```

***

## 🗺️ Roadmap

### v1.1.0
- [ ] **Receipt Scanner** — OCR-based expense logging by scanning receipts
- [ ] **Recurring Expenses** — Auto-log fixed monthly bills (rent, utilities)
- [ ] **Spending Alerts** — Push notifications when category limits are approaching

### v1.2.0
- [ ] **Income Tracking** — Log multiple income sources alongside expenses
- [ ] **Bill Splitting** — Split shared expenses among specific family members
- [ ] **Monthly Reports** — Auto-generated PDF summaries via email

### v2.0.0
- [ ] **Urdu Language Support** — Full RTL Urdu interface
- [ ] **JazzCash / EasyPaisa Integration** — Link mobile wallets for auto-import
- [ ] **AI Spending Advisor** — ML-based insights and savings suggestions
- [ ] **Web Dashboard** — Browser-based companion for desktop access

***

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit using Conventional Commits: `git commit -m "feat: add receipt scanner"`
4. Push and open a Pull Request

***

## 👨‍💻 Author

<div align="center">

**Izhar Ahmad**

*Full-Stack Developer | React Native | Firebase | TypeScript | Clean Architecture | Problem Solver*


*"Building tools that solve real problems for real people."*

</div>

***

## 📄 License

Licensed under the **MIT License** — see [LICENSE](LICENSE) for details.

***

<div align="center">

⭐ **Star this repo** if FamilyMate helped or inspired you!

</div>
