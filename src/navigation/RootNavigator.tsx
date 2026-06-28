// src/navigation/RootNavigator.tsx
import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { onAuthStateChanged, type User } from "firebase/auth";

import { auth } from "../lib/firebase";
import type { RootStackParamList } from "./types";

import AuthNavigator from "./AuthNavigator";
import AppNavigator from "./AppNavigator";

// Screens
import AddExpenseScreen from "../screens/AddExpenseScreen";
import ManageAccountsScreen from "../screens/ManageAccountsScreen";

import AboutAppScreen from "../screens/AboutAppScreen";
import FamilyMembersScreen from "../screens/FamilyMembersScreen";
import FamilySettingsScreen from "../screens/FamilySettingsScreen";
import CreateFamilyScreen from "../screens/CreateFamilyScreen";
import JoinFamilyScreen from "../screens/JoinFamilyScreen";
import BudgetLimitsScreen from "../screens/BudgetLimitsScreen";
import NotificationSettingsScreen from "../screens/NotificationSettingsScreen";
import CurrencySettingsScreen from "../screens/CurrencySettingsScreen";
import LanguageSettingsScreen from "../screens/LanguageSettingsScreen";
import SecurityScreen from "../screens/SecurityScreen";
import EditProfileScreen from "../screens/EditProfileScreen";
import BackupScreen from "../screens/BackupScreen";
import DataExportScreen from "../screens/DataExportScreen";
import SupportScreen from "../screens/SupportScreen";

import FixedDailyPlanScreen from "../screens/FixedDailyPlanScreen";
import TransactionsScreen from "../screens/TransactionsScreen";
import TransactionDetailsScreen from "../screens/TransactionDetailsScreen";

import NotificationsScreen from "../screens/NotificationsScreen";


const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setBooting(false);
    });
    return unsub;
  }, []);

  if (booting) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator
        id="RootStack"
        screenOptions={{ headerShown: false }}
      >
        {/* Auth gate */}
        {user ? (
          <Stack.Screen name="App" component={AppNavigator} />
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}

        {/* Root-level screens accessible from anywhere */}
        <Stack.Screen name="Notifications" component={NotificationsScreen} />

        <Stack.Screen name="ManageAccounts" component={ManageAccountsScreen} />
        <Stack.Screen name="AboutApp" component={AboutAppScreen} />
        <Stack.Screen name="FamilyMembers" component={FamilyMembersScreen} />
        <Stack.Screen name="FamilySettings" component={FamilySettingsScreen} />
        <Stack.Screen name="CreateFamily" component={CreateFamilyScreen} />
        <Stack.Screen name="JoinFamily" component={JoinFamilyScreen} />
        <Stack.Screen name="BudgetLimits" component={BudgetLimitsScreen} />
        <Stack.Screen
          name="NotificationSettings"
          component={NotificationSettingsScreen}
        />
        <Stack.Screen name="CurrencySettings" component={CurrencySettingsScreen} />
        <Stack.Screen name="LanguageSettings" component={LanguageSettingsScreen} />
        <Stack.Screen name="Security" component={SecurityScreen} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="Backup" component={BackupScreen} />
        <Stack.Screen name="DataExport" component={DataExportScreen} />
        <Stack.Screen name="Support" component={SupportScreen} />

        <Stack.Screen name="Transactions" component={TransactionsScreen} />
        <Stack.Screen name="TxDetails" component={TransactionDetailsScreen} />
        <Stack.Screen name="FixedDailyPlan" component={FixedDailyPlanScreen} />

        {/* Modal group */}
        <Stack.Group screenOptions={{ presentation: "modal" }}>
          <Stack.Screen name="AddExpense" component={AddExpenseScreen} />
        </Stack.Group>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
