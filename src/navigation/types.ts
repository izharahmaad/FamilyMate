// src/navigation/types.ts
import type { NavigatorScreenParams } from "@react-navigation/native";

export type AuthStackParamList = {
  Onboarding: undefined;
  Login: { email?: string; fromManageAccounts?: boolean } | undefined;
  Signup: { email?: string; fromManageAccounts?: boolean } | undefined;
  ForgotPassword: { email?: string } | undefined;
};

export type AppStackParamList = {
  Home: undefined;
  Analytics: undefined;
  Budget: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  App: NavigatorScreenParams<AppStackParamList>;

  // ✅ New screen
  Notifications: undefined;

  AboutApp: undefined;

  // Modal
  AddExpense: undefined;

  FamilyMembers: undefined;
  FamilySettings: undefined;
  CreateFamily: undefined;
  JoinFamily: undefined;
  BudgetLimits: undefined;
  NotificationSettings: undefined;
  CurrencySettings: undefined;
  LanguageSettings: undefined;
  Security: undefined;
  EditProfile: undefined;
  Backup: undefined;
  DataExport: undefined;
  Support: undefined;

  ManageAccounts: undefined;

  FixedDailyPlan: undefined;
  Transactions: undefined;
  TxDetails: { familyId: string; txId: string };
};
