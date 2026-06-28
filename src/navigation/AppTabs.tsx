// src/navigation/AppTabs.tsx
import React from "react";
import {
  createBottomTabNavigator,
  type BottomTabBarProps,
} from "@react-navigation/bottom-tabs";
import type { NavigationProp } from "@react-navigation/native";

import HomeScreen from "../screens/HomeScreen";
import SettingsScreen from "../screens/SettingsScreen";
import AnalyticsScreen from "../screens/AnalyticsScreen";
import BudgetScreen from "../screens/BudgetScreen";

import FloatingFooter, { FooterTabKey } from "../components/FloatingFooter";
import type { RootStackParamList } from "./types";

export type AppTabParamList = {
  Home: undefined;
  Analytics: undefined;
  Budget: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<AppTabParamList>();

type TabBarProps = BottomTabBarProps;

function CustomTabBar({ state, navigation }: TabBarProps) {
  const activeRoute = state.routes[state.index]?.name as FooterTabKey;

  const rootNav = navigation.getParent("RootStack") as NavigationProp<RootStackParamList> | undefined;

  return (
    <FloatingFooter
      activeTab={activeRoute}
      onTabPress={(t) => navigation.navigate(t as keyof AppTabParamList)}
      onAddPress={() => {
        // Open modal on RootStack
        rootNav?.navigate("AddExpense");
      }}
    />
  );
}

export default function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Analytics" component={AnalyticsScreen} />
      <Tab.Screen name="Budget" component={BudgetScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
