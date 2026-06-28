import React from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "../theme";

export type FooterTabKey = "Home" | "Analytics" | "Budget" | "Settings";

type Props = {
  activeTab: FooterTabKey;
  onTabPress: (t: FooterTabKey) => void;
  onAddPress: () => void;
};

const TAB_W = 72;
const FAB_OUTER = 74;
const FAB_RING = 6;
const FAB_INNER = FAB_OUTER - FAB_RING * 2;

function TabItem({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.tabItem} hitSlop={10}>
      <Ionicons name={icon} size={22} color={active ? theme.colors.primary : "rgba(17,24,39,0.45)"} />
      <Text style={[styles.tabLabel, active ? styles.tabLabelActive : null]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function FloatingFooter({ activeTab, onTabPress, onAddPress }: Props) {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 10);

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <View style={[styles.bar, { paddingBottom: bottomPad }]}>
        <View style={styles.row}>
          <View style={styles.side}>
            <TabItem label="Home" icon="home" active={activeTab === "Home"} onPress={() => onTabPress("Home")} />
            <TabItem
              label="Analytics"
              icon="stats-chart"
              active={activeTab === "Analytics"}
              onPress={() => onTabPress("Analytics")}
            />
          </View>

          <View style={{ width: FAB_OUTER }} />

          <View style={styles.side}>
            <TabItem label="Budget" icon="wallet" active={activeTab === "Budget"} onPress={() => onTabPress("Budget")} />
            <TabItem
              label="Settings"
              icon="settings"
              active={activeTab === "Settings"}
              onPress={() => onTabPress("Settings")}
            />
          </View>
        </View>
      </View>

      <Pressable onPress={onAddPress} hitSlop={14} style={[styles.fabOuter, { bottom: bottomPad + 26 }]}>
        <View style={styles.fabRing}>
          <LinearGradient
            colors={[theme.colors.primary, theme.colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fabInner}
          >
            <Ionicons name="add" size={30} color="#fff" />
          </LinearGradient>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: 0, pointerEvents: "box-none" },

  bar: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.96)",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderColor: "rgba(17,24,39,0.06)",
    paddingTop: 10,
    paddingHorizontal: 18,
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.06 : 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -6 },
    elevation: 18,
  },

  row: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center" },

  side: { width: TAB_W * 2, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },

  tabItem: { width: TAB_W, alignItems: "center", justifyContent: "center" },
  tabLabel: { marginTop: 6, fontFamily: theme.font.medium, fontSize: 11, color: "rgba(17,24,39,0.45)" },
  tabLabelActive: { color: theme.colors.primary, fontFamily: theme.font.bold },

  fabOuter: {
    position: "absolute",
    alignSelf: "center",
    width: FAB_OUTER,
    height: FAB_OUTER,
    borderRadius: FAB_OUTER / 2,
    shadowColor: theme.colors.primary,
    shadowOpacity: Platform.OS === "ios" ? 0.26 : 0.34,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 22,
  },
  fabRing: {
    flex: 1,
    borderRadius: FAB_OUTER / 2,
    backgroundColor: "#fff",
    borderWidth: FAB_RING,
    borderColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  fabInner: { width: FAB_INNER, height: FAB_INNER, borderRadius: FAB_INNER / 2, justifyContent: "center", alignItems: "center" },
});
