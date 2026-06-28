// src/screens/SettingsScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  StatusBar,
  ScrollView,
  Image,
  Alert,
  Platform,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";

import { auth, db } from "../lib/firebase";
import { theme } from "../theme";

type HeaderState = {
  userName: string;
  userPhotoURL: string | null;
  isPro: boolean;

  familyId: string | null;
  familyName: string;

  badge: string;
};

const { width: SCREEN_W } = Dimensions.get("window");
const TAB_FOOTER_H = 92;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function SectionTitle({ children, icon }: { children: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Ionicons name={icon} size={14} color={theme.colors.muted} />
      <Text style={styles.sectionTitle}>{children}</Text>
    </View>
  );
}

function GroupCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.groupCard}>{children}</View>;
}

function RowDivider() {
  return <View style={styles.divider} />;
}

function SettingsRow({
  icon,
  title,
  subtitle,
  onPress,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress: () => void;
  color: string;
}) {
  const bg = `${color}14`;
  const br = `${color}2A`;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.88 }]}>
      <View style={[styles.rowIconCircle, { backgroundColor: bg, borderColor: br }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        {!!subtitle && (
          <Text style={styles.rowSub} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>

      <View style={styles.chevCircle}>
        <Ionicons name="chevron-forward" size={16} color={theme.colors.muted} />
      </View>
    </Pressable>
  );
}

function LogoutCard({ onLogout }: { onLogout: () => void }) {
  return (
    <View style={styles.logoutWrap}>
      <View style={styles.logoutTopRow}>
        <View style={styles.logoutIcon}>
          <Ionicons name="log-out-outline" size={18} color="#B91C1C" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.logoutTitle}>Logout safely</Text>
          <Text style={styles.logoutSub}>Sign out from this device. You can login again anytime.</Text>
        </View>
      </View>

      <Pressable onPress={onLogout} style={({ pressed }) => [styles.logoutBtnShell, pressed && { opacity: 0.92 }]}>
        <LinearGradient colors={["#EF4444", "#B91C1C"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logoutBtn}>
          <View style={styles.logoutBtnLeft}>
            <View style={styles.logoutBtnBadge}>
              <Ionicons name="shield-checkmark-outline" size={14} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.logoutBtnText}>Logout</Text>
              <Text style={styles.logoutBtnHint}>Recommended if you changed password</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.95)" />
        </LinearGradient>
      </Pressable>

      <Text style={styles.logoutFoot}>Your data stays safe in your account.</Text>
    </View>
  );
}

export default function SettingsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();

  const rootNav = useMemo(() => navigation?.getParent?.("RootStack") ?? navigation?.getParent?.(), [navigation]);

  const goRoot = (routeName: string) => {
    if (!rootNav) {
      Alert.alert("Navigation", "Root navigator not found. Restart with: npx expo start -c");
      return;
    }
    rootNav.navigate(routeName as never);
  };

  const [h, setH] = useState<HeaderState>({
    userName: "Parent",
    userPhotoURL: null,
    isPro: false,

    familyId: null,
    familyName: "Family",

    badge: "ACCOUNT",
  });

  const userUnsubRef = useRef<null | (() => void)>(null);
  const familyUnsubRef = useRef<null | (() => void)>(null);

  // ✅ REAL FIX: realtime user profile + family name
  useEffect(() => {
    const u = auth.currentUser;
    if (!u) return;

    userUnsubRef.current?.();
    familyUnsubRef.current?.();

    userUnsubRef.current = onSnapshot(
      doc(db, "users", u.uid),
      (snap) => {
        const d: any = snap.data() || {};
        const fid = (d?.familyId as string | undefined) || null;

        const name =
          (d?.name as string) ||
          (d?.fullName as string) ||
          (d?.displayName as string) ||
          (u.displayName as string) ||
          "Parent";

        const photo =
          (d?.photoURL as string) ||
          (d?.avatarUrl as string) ||
          (d?.profilePhotoURL as string) ||
          (d?.photoBase64 ? `data:image/jpeg;base64,${d.photoBase64}` : "") ||
          (u.photoURL as string) ||
          "";

        const isPro = !!d?.isPro;

        setH((p) => ({
          ...p,
          userName: name,
          userPhotoURL: photo ? String(photo) : null,
          isPro,
          badge: isPro ? "ACCOUNT PRO" : "ACCOUNT",
          familyId: fid,
        }));

        if (!fid) {
          familyUnsubRef.current?.();
          familyUnsubRef.current = null;
          setH((p) => ({ ...p, familyName: "Family" }));
          return;
        }

        familyUnsubRef.current?.();
        familyUnsubRef.current = onSnapshot(
          doc(db, "families", fid),
          (fSnap) => {
            const f: any = fSnap.data() || {};
            setH((p) => ({
              ...p,
              familyName: f?.name || "Family",
            }));
          },
          () => {}
        );
      },
      () => {}
    );

    return () => {
      userUnsubRef.current?.();
      familyUnsubRef.current?.();
    };
  }, []);

  const doLogout = () => {
    Alert.alert("Logout", "Do you want to logout?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: () => signOut(auth) },
    ]);
  };

  const avatarSize = clamp(Math.round(SCREEN_W * 0.14), 56, 70);
  const bottomPad = TAB_FOOTER_H + Math.max(insets.bottom, 12) + 18;

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 10) }]}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <LinearGradient
        pointerEvents="none"
        colors={["rgba(11,18,32,0.10)", "rgba(11,18,32,0.03)", "rgba(10, 17, 31, 0.08)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.topBar}>
        <Text style={styles.screenTitle}>Settings</Text>
        <View style={styles.topRight}>
          <View style={styles.glassCircle}>
            <Ionicons name="options-outline" size={18} color={theme.colors.text} />
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomPad }}>
        {/* HERO */}
        <View style={styles.heroWrap}>
          <LinearGradient
            colors={["#2559c2", "#0a0a2e", "#112B5C"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <LinearGradient
              pointerEvents="none"
              colors={["rgba(255,255,255,0.10)", "rgba(255,255,255,0.00)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />

            <View style={styles.heroTopRow}>
              <View style={styles.heroPill}>
                <Ionicons name="sparkles-outline" size={12} color="rgba(255,255,255,0.95)" />
                <Text style={styles.heroPillText}>{h.badge}</Text>
              </View>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable
                  onPress={() => goRoot("EditProfile")}
                  hitSlop={10}
                  style={({ pressed }) => [styles.heroIconBtn, pressed && { opacity: 0.86 }]}
                >
                  <Ionicons name="create-outline" size={18} color="#fff" />
                </Pressable>

                <Pressable
                  onPress={() => goRoot("Security")}
                  hitSlop={10}
                  style={({ pressed }) => [styles.heroIconBtn, pressed && { opacity: 0.86 }]}
                >
                  <Ionicons name="shield-checkmark-outline" size={18} color="#fff" />
                </Pressable>
              </View>
            </View>

            <View style={styles.heroMainRow}>
              <View style={[styles.heroAvatarWrap, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]}>
                {h.userPhotoURL ? (
                  <Image source={{ uri: h.userPhotoURL }} style={{ width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }} />
                ) : (
                  <View style={[styles.heroAvatarFallback, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]}>
                    <Ionicons name="person-outline" size={22} color="rgba(255,255,255,0.95)" />
                  </View>
                )}
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.heroTitle} numberOfLines={1}>
                  {h.userName}
                </Text>
                <Text style={styles.heroSub} numberOfLines={1}>
                  Parent • {h.familyName}
                </Text>

                <View style={styles.heroMiniRow}>
                  <View style={styles.heroMiniChip}>
                    <Ionicons name="people-outline" size={14} color="rgba(255,255,255,0.92)" />
                    <Text style={styles.heroMiniText}>Family</Text>
                  </View>
                  <View style={styles.heroMiniChip}>
                    <Ionicons name="shield-checkmark-outline" size={14} color="rgba(255,255,255,0.92)" />
                    <Text style={styles.heroMiniText}>Secure</Text>
                  </View>
                  <View style={styles.heroMiniChip}>
                    <Ionicons name="sync-outline" size={14} color="rgba(255,255,255,0.92)" />
                    <Text style={styles.heroMiniText}>Live</Text>
                  </View>
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>

        <SectionTitle icon="home-outline">FAMILY</SectionTitle>
        <GroupCard>
          <SettingsRow icon="people-outline" title="Family settings" subtitle="Create/Join family, members, roles" onPress={() => goRoot("FamilySettings")} color="#4F46E5" />
          <RowDivider />
          <SettingsRow icon="person-add-outline" title="Invite & members" subtitle="Invite code + admins and members (live)" onPress={() => goRoot("FamilyMembers")} color="#0EA5E9" />
          <RowDivider />
          <SettingsRow icon="speedometer-outline" title="Budget limits" subtitle="Monthly limits and alerts" onPress={() => goRoot("BudgetLimits")} color="#F59E0B" />
        </GroupCard>

        <SectionTitle icon="options-outline">PREFERENCES</SectionTitle>
        <GroupCard>
          <SettingsRow icon="card-outline" title="Currency" subtitle="Change app currency" onPress={() => goRoot("CurrencySettings")} color="#10B981" />
          <RowDivider />
          <SettingsRow icon="language-outline" title="Language" subtitle="English, Urdu, Arabic" onPress={() => goRoot("LanguageSettings")} color="#8B5CF6" />
          <RowDivider />
          <SettingsRow icon="notifications-outline" title="Notifications" subtitle="Reminders and alerts" onPress={() => goRoot("NotificationSettings")} color="#06B6D4" />
        </GroupCard>

        <SectionTitle icon="apps-outline">APP</SectionTitle>
        <GroupCard>
          <SettingsRow icon="lock-closed-outline" title="Security" subtitle="Password reset and account safety" onPress={() => goRoot("Security")} color="#EF4444" />
          <RowDivider />
          <SettingsRow icon="cloud-upload-outline" title="Backup" subtitle="Cloud backup and restore" onPress={() => goRoot("Backup")} color="#14B8A6" />
          <RowDivider />
          <SettingsRow icon="document-text-outline" title="Data export" subtitle="Export transactions to CSV" onPress={() => goRoot("DataExport")} color="#F97316" />
          <RowDivider />
          <SettingsRow
            icon="headset-outline"
            title="Support"
            subtitle="Help, contact, FAQs"
            onPress={() => goRoot("Support")}
            color="#3B82F6"
          />
          <RowDivider />
          <SettingsRow
            icon="ribbon-outline"
            title="About app"
            subtitle="Version, privacy, terms, credits"
            onPress={() => goRoot("AboutApp")}
            color="#6366F1"
          />
        </GroupCard>

        <SectionTitle icon="person-circle-outline">ACCOUNT</SectionTitle>
        <GroupCard>
          <SettingsRow icon="people-circle-outline" title="Manage accounts" subtitle="Switch or add accounts on this device" onPress={() => goRoot("ManageAccounts")} color="#8B5CF6" />
        </GroupCard>

        <View style={{ marginTop: 12 }}>
          <LogoutCard onLogout={doLogout} />
        </View>

        <Text style={styles.bottomNote}>FamilyMate • Settings</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 18, backgroundColor: theme.colors.background },

  topBar: { paddingTop: 6, paddingBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  screenTitle: { fontFamily: theme.font.bold, fontSize: 26, color: theme.colors.text },
  topRight: { alignItems: "flex-end" },
  glassCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },

  heroWrap: { marginTop: 10 },
  heroCard: {
    borderRadius: 26,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.12 : 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 14 },
    elevation: 4,
    overflow: "hidden",
  },

  heroTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },
  heroPillText: { fontFamily: theme.font.bold, fontSize: 11, color: "rgba(255,255,255,0.95)", letterSpacing: 0.35 },

  heroIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.26)",
  },

  heroMainRow: { marginTop: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  heroAvatarWrap: {
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.50)",
    backgroundColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  heroAvatarFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.10)" },

  heroTitle: { fontFamily: theme.font.bold, fontSize: 18, color: "#fff" },
  heroSub: { marginTop: 4, fontFamily: theme.font.medium, fontSize: 12, color: "rgba(255,255,255,0.88)" },

  heroMiniRow: { marginTop: 10, flexDirection: "row", gap: 10, flexWrap: "wrap" },
  heroMiniChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  heroMiniText: { fontFamily: theme.font.bold, fontSize: 12, color: "rgba(255,255,255,0.95)" },

  sectionTitleRow: { marginTop: 18, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontFamily: theme.font.medium, fontSize: 12, color: theme.colors.muted, letterSpacing: 0.85 },

  groupCard: {
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.97)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.06)",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.05 : 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },

  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 14, gap: 12 },
  rowIconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  rowTitle: { fontFamily: theme.font.bold, fontSize: 14, color: theme.colors.text },
  rowSub: { marginTop: 3, fontFamily: theme.font.regular, fontSize: 12, color: theme.colors.muted },

  chevCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(17,24,39,0.05)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.07)",
  },

  divider: { height: 1, backgroundColor: "rgba(17,24,39,0.06)", marginLeft: 66 },

  logoutWrap: {
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.97)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.18)",
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.05 : 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  logoutTopRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  logoutIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239,68,68,0.10)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.18)",
  },
  logoutTitle: { fontFamily: theme.font.bold, fontSize: 15, color: theme.colors.text },
  logoutSub: { marginTop: 4, fontFamily: theme.font.regular, fontSize: 12, color: theme.colors.muted, lineHeight: 17 },

  logoutBtnShell: { borderRadius: 18, overflow: "hidden" },
  logoutBtn: { height: 56, borderRadius: 18, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  logoutBtnLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, paddingRight: 10 },
  logoutBtnBadge: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.20)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  logoutBtnText: { fontFamily: theme.font.bold, color: "#fff", fontSize: 15 },
  logoutBtnHint: { marginTop: 2, fontFamily: theme.font.medium, color: "rgba(255,255,255,0.88)", fontSize: 11 },

  logoutFoot: { marginTop: 10, textAlign: "center", fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 11 },

  bottomNote: { marginTop: 16, textAlign: "center", fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 11 },
});
