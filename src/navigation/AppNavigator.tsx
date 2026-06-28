// src/navigation/AppNavigator.tsx
import React from "react";
import { createBottomTabNavigator, type BottomTabBarProps } from "@react-navigation/bottom-tabs";
import type { AppStackParamList, RootStackParamList } from "./types";
import type { NavigationProp } from "@react-navigation/native";

import HomeScreen from "../screens/HomeScreen";
import AnalyticsScreen from "../screens/AnalyticsScreen";
import BudgetScreen from "../screens/BudgetScreen";
import SettingsScreen from "../screens/SettingsScreen";

import FloatingFooter, { FooterTabKey } from "../components/FloatingFooter";

const Tab = createBottomTabNavigator<AppStackParamList>();

type TabBarProps = BottomTabBarProps & {
  navigation: BottomTabBarProps["navigation"] & {
    getParent: (id?: string) => NavigationProp<RootStackParamList> | undefined;
  };
};

function CustomTabBar({ state, navigation }: TabBarProps) {
  const activeRoute = state.routes[state.index]?.name as FooterTabKey;

  return (
    <FloatingFooter
      activeTab={activeRoute}
      onTabPress={(t) => navigation.navigate(t as never)}
      onAddPress={() => {
        // ✅ open modal on RootStack
        navigation.getParent("RootStack")?.navigate("AddExpense");
      }}
    />
  );
}

export default function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomTabBar {...(props as any)} />}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Analytics" component={AnalyticsScreen} />
      <Tab.Screen name="Budget" component={BudgetScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
