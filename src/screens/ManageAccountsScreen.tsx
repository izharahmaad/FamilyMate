import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { signOut } from "firebase/auth";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";

import { auth } from "../lib/firebase";
import { theme } from "../theme";
import { getSavedAccounts, removeSavedAccount, upsertSavedAccount, SavedAccount } from "../lib/accountStore";

type Provider = "google" | "email";

const ui = {
  card: "rgba(255,255,255,0.97)",
  stroke: "rgba(17,24,39,0.06)",
  stroke2: "rgba(17,24,39,0.10)",
  soft: "rgba(17,24,39,0.04)",
};

function initials(name?: string) {
  const s = (name || "").trim();
  if (!s) return "U";
  const parts = s.split(" ").filter(Boolean);
  const a = parts[0]?.[0] || "U";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return (a + b).toUpperCase();
}

function Divider({ inset = 64 }: { inset?: number }) {
  return <View style={[styles.divider, { marginLeft: inset }]} />;
}

function Card({ children, style }: any) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function StatPill({
  label,
  value,
  icon,
  tint,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
}) {
  return (
    <View style={[styles.statPill, { borderColor: `${tint}22`, backgroundColor: `${tint}0D` }]}>
      <View style={[styles.statIcon, { backgroundColor: `${tint}14`, borderColor: `${tint}22` }]}>
        <Ionicons name={icon} size={16} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.statValue} numberOfLines={1}>
          {value}
        </Text>
        <Text style={styles.statLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

function QuickCircle({
  icon,
  label,
  onPress,
  tint,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  tint: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.quickCircleWrap, { opacity: disabled ? 0.55 : pressed ? 0.88 : 1 }]}
    >
      <View style={[styles.quickCircle, { backgroundColor: `${tint}14`, borderColor: `${tint}22` }]}>
        <Ionicons name={icon} size={22} color={tint} />
      </View>
      <Text style={styles.quickCircleText} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function SheetAction({
  icon,
  title,
  subtitle,
  onPress,
  tone = "neutral",
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress: () => void;
  tone?: "neutral" | "primary" | "danger";
}) {
  const c = tone === "primary" ? theme.colors.primary : tone === "danger" ? "#EF4444" : theme.colors.text;

  const bg =
    tone === "primary"
      ? "rgba(91,95,239,0.10)"
      : tone === "danger"
      ? "rgba(239,68,68,0.08)"
      : "rgba(17,24,39,0.04)";

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.sheetRow, { backgroundColor: bg }, pressed && { opacity: 0.92 }]}>
      <View style={[styles.sheetIcon, { borderColor: `${c}22`, backgroundColor: `${c}10` }]}>
        <Ionicons name={icon} size={18} color={c} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.sheetTitle} numberOfLines={1}>
          {title}
        </Text>
        {!!subtitle && (
          <Text style={styles.sheetSub} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>

      <Ionicons name="chevron-forward" size={16} color={theme.colors.muted} />
    </Pressable>
  );
}

export default function ManageAccountsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<SavedAccount[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);

  const user = auth.currentUser;

  const current = useMemo(() => {
    const email = user?.email || "";
    const name = user?.displayName || (email ? email.split("@")[0] : "User");
    const provider: Provider = user?.providerData?.[0]?.providerId?.includes("google") ? "google" : "email";
    return {
      uid: user?.uid || "",
      email,
      name,
      photoURL: user?.photoURL || "",
      provider,
    };
  }, [user?.uid, user?.email, user?.displayName, user?.photoURL, user?.providerData]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await getSavedAccounts();
    setAccounts(list);
    setLoading(false);
  }, []);

  const autoSaveCurrentSilently = useCallback(async () => {
    const u = auth.currentUser;
    if (!u?.uid) return;

    const email = u.email || "";
    const fallbackName = u.displayName || (email ? email.split("@")[0] : "User");

    await upsertSavedAccount({
      uid: u.uid,
      email,
      displayName: fallbackName,
      photoURL: u.photoURL || "",
      provider: (u.providerData?.[0]?.providerId?.includes("google") ? "google" : "email") as any,
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        try {
          await autoSaveCurrentSilently();
          if (!alive) return;
          await refresh();
        } catch {
          // ignore
        }
      })();
      return () => {
        alive = false;
      };
    }, [autoSaveCurrentSilently, refresh])
  );

  const currentSaved = useMemo(() => {
    if (!current.uid) return false;
    return accounts.some((x) => x.uid === current.uid);
  }, [accounts, current.uid]);

  const rememberCurrent = async () => {
    if (!auth.currentUser) return;

    await upsertSavedAccount({
      uid: auth.currentUser.uid,
      email: auth.currentUser.email || "",
      displayName: auth.currentUser.displayName || (auth.currentUser.email ? auth.currentUser.email.split("@")[0] : "User"),
      photoURL: auth.currentUser.photoURL || "",
      provider: (auth.currentUser.providerData?.[0]?.providerId?.includes("google") ? "google" : "email") as any,
    });

    await refresh();
    Alert.alert("Saved", "This account is saved on this device.");
  };

  const openAuthSignup = async (prefillEmail?: string) => {
    setSheetOpen(false);
    await signOut(auth);
    requestAnimationFrame(() => {
      navigation.navigate("Auth", {
        screen: "Signup",
        params: { email: prefillEmail, fromManageAccounts: true },
      });
    });
  };

  const openAuthLogin = async (prefillEmail?: string) => {
    setSheetOpen(false);
    await signOut(auth);
    requestAnimationFrame(() => {
      navigation.navigate("Auth", {
        screen: "Login",
        params: { email: prefillEmail, fromManageAccounts: true },
      });
    });
  };

  const doLogoutCurrent = () => {
    Alert.alert("Logout", "Sign out from current account?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: () => signOut(auth) },
    ]);
  };

  const openSavedAccount = async (a: SavedAccount) => {
    if (!a?.email) {
      Alert.alert("Open account", "This saved account has no email. Remove it and add again.");
      return;
    }

    const key = a.uid || a.email;
    setBusyKey(key);

    try {
      await upsertSavedAccount({ ...a });
      await signOut(auth);

      requestAnimationFrame(() => {
        navigation.navigate("Auth", {
          screen: "Login",
          params: { email: a.email, fromManageAccounts: true },
        });
      });
    } catch (e: any) {
      Alert.alert("Open failed", e?.message || "Try again.");
    } finally {
      setBusyKey(null);
    }
  };

  const removeAccount = (a: SavedAccount) => {
    Alert.alert("Remove account", "Remove this saved account from this device?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await removeSavedAccount(a.uid);
          await refresh();
        },
      },
    ]);
  };

  const onBackPress = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate(auth.currentUser ? "App" : "Auth");
  };

  const savedCount = accounts.length;
  const providerLabel = current.provider === "google" ? "Google" : "Email";

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 10) }]}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* light subtle background gradient like your example */}
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(11,18,32,0.10)", "rgba(11,18,32,0.03)", "rgba(11,18,32,0.08)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Header same as Family example */}
      <View style={styles.headerBar}>
        <Pressable onPress={onBackPress} hitSlop={12} style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.9 }]}>
          <Ionicons name="chevron-back" size={18} color={theme.colors.text} />
        </Pressable>

        <View pointerEvents="none" style={styles.centerTitle}>
          <View style={styles.centerTitlePill}>
            <Ionicons name="people-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.centerTitleText}>Accounts</Text>
          </View>
        </View>

        <Pressable onPress={() => setSheetOpen(true)} hitSlop={12} style={({ pressed }) => [styles.rightBtn, pressed && { opacity: 0.9 }]}>
          <Ionicons name="add" size={20} color={theme.colors.primary} />
        </Pressable>

        <View style={styles.rightGhost}>{loading ? <ActivityIndicator color={theme.colors.primary} /> : null}</View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 18 + insets.bottom }}>
        {/* Hero: navy gradient (ONLY hero is dark like example) */}
        <View style={styles.heroWrap}>
          <LinearGradient
            colors={["#2559c2", "#0a0a2e", "#112B5C"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={{ flex: 1 }}>
              <View style={styles.heroLabelRow}>
                <View style={styles.heroPillMini}>
                  <Ionicons name="shield-checkmark-outline" size={12} color="rgba(255,255,255,0.95)" />
                  <Text style={styles.heroLabel}>ACCOUNT CENTER</Text>
                </View>

                <View style={styles.heroPillMini}>
                  <Ionicons name={loading ? "sync-outline" : "checkmark-circle-outline"} size={12} color="rgba(255,255,255,0.95)" />
                  <Text style={styles.heroLabel}>{loading ? "SYNC" : "READY"}</Text>
                </View>
              </View>

              <Text style={styles.heroName} numberOfLines={1}>
                {current.name || "User"}
              </Text>
              <Text style={styles.heroHint} numberOfLines={2}>
                Switch accounts quickly on this device.
              </Text>
            </View>

            <View style={styles.heroCount}>
              <Text style={styles.heroCountNum}>{savedCount}</Text>
              <Text style={styles.heroCountText}>Saved</Text>
            </View>
          </LinearGradient>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatPill label="Provider" value={providerLabel} icon={current.provider === "google" ? "logo-google" : "mail-outline"} tint="#3B82F6" />
          <StatPill label="Current" value={currentSaved ? "Saved" : "Not saved"} icon="bookmark-outline" tint={theme.colors.primary} />
        </View>

        {/* Quick actions */}
        <Text style={styles.section}>Quick actions</Text>
        <View style={styles.quickRow}>
          <QuickCircle icon="add" label="Add" onPress={() => setSheetOpen(true)} tint="#22C55E" />
          <QuickCircle icon="bookmark-outline" label={currentSaved ? "Saved" : "Save"} onPress={rememberCurrent} tint="#3B82F6" disabled={!current.uid || currentSaved} />
          <QuickCircle icon="log-out-outline" label="Logout" onPress={doLogoutCurrent} tint="#EF4444" />
        </View>

        {/* Saved accounts */}
        <View style={styles.sectionRow}>
          <Text style={styles.section}>Saved accounts</Text>
          <Pressable onPress={refresh} hitSlop={10} style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.9 }]}>
            <Ionicons name="refresh" size={16} color={theme.colors.primary} />
          </Pressable>
        </View>

        <Card>
          {accounts.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="people-circle-outline" size={22} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.emptyTitle}>No accounts saved</Text>
                <Text style={styles.emptySub}>Tap Save to keep your current account on this device.</Text>
              </View>
            </View>
          ) : (
            accounts.map((a, idx) => {
              const isCurrent = a.uid && auth.currentUser?.uid === a.uid;
              const key = a.uid || a.email || String(idx);
              const isBusy = busyKey === key;

              return (
                <View key={key}>
                  <View style={styles.accRow}>
                    <Pressable
                      disabled={isCurrent || isBusy}
                      onPress={() => openSavedAccount(a)}
                      style={({ pressed }) => [styles.accMain, pressed && !isCurrent && { opacity: 0.92 }]}
                    >
                      <View style={styles.avatarWrap}>
                        {a.photoURL ? (
                          <Image source={{ uri: a.photoURL }} style={styles.avatarImg} />
                        ) : (
                          <View style={styles.avatarFallback}>
                            <Text style={styles.avatarInitials}>{initials(a.displayName || a.email)}</Text>
                          </View>
                        )}
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.accName} numberOfLines={1}>
                          {a.displayName || (a.email ? a.email.split("@")[0] : "User")}
                        </Text>
                        <Text style={styles.accMeta} numberOfLines={1}>
                          {a.email || "No email"} {a.provider ? `• ${a.provider}` : ""}
                        </Text>
                      </View>

                      {isCurrent ? (
                        <View style={styles.activePill}>
                          <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                          <Text style={styles.activePillText}>Active</Text>
                        </View>
                      ) : (
                        <View style={[styles.switchBtn, isBusy && { opacity: 0.6 }]}>
                          {isBusy ? <ActivityIndicator color="#fff" /> : <Ionicons name="log-in-outline" size={16} color="#fff" />}
                          <Text style={styles.switchBtnText}>{isBusy ? "Opening" : "Open"}</Text>
                        </View>
                      )}
                    </Pressable>

                    <Pressable onPress={() => removeAccount(a)} hitSlop={10} style={({ pressed }) => [styles.trashBtn, pressed && { opacity: 0.9 }]}>
                      <Ionicons name="trash-outline" size={18} color={theme.colors.muted} />
                    </Pressable>
                  </View>

                  {idx !== accounts.length - 1 ? <Divider inset={64} /> : null}
                </View>
              );
            })
          )}
        </Card>
      </ScrollView>

      {/* Bottom sheet */}
      <Modal visible={sheetOpen} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setSheetOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setSheetOpen(false)}>
          <Pressable style={[styles.sheet, { paddingBottom: 14 + insets.bottom }]} onPress={() => {}}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetHeadTitle}>Add account</Text>
                <Text style={styles.sheetHeadSub}>Choose how you want to continue.</Text>
              </View>

              <Pressable onPress={() => setSheetOpen(false)} hitSlop={10} style={styles.sheetClose}>
                <Ionicons name="close" size={18} color={theme.colors.muted} />
              </Pressable>
            </View>

            <SheetAction icon="person-add-outline" title="Create new account" subtitle="Sign up" tone="primary" onPress={() => openAuthSignup()} />
            <SheetAction icon="log-in-outline" title="Log in" subtitle="Use an existing account" onPress={() => openAuthLogin()} />
            <SheetAction icon="bookmark-outline" title="Save current account" subtitle="Keep it for quick switching" onPress={rememberCurrent} />

            <Pressable onPress={() => setSheetOpen(false)} style={({ pressed }) => [styles.sheetCancel, pressed && { opacity: 0.92 }]}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 18, backgroundColor: theme.colors.background },

  /* header like example */
  headerBar: { marginTop: 6, height: 46, justifyContent: "center" },
  backBtn: {
    position: "absolute",
    left: 0,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  rightBtn: {
    position: "absolute",
    right: 48,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  rightGhost: { position: "absolute", right: 0, width: 42, height: 42, alignItems: "center", justifyContent: "center" },

  centerTitle: { position: "absolute", left: 0, right: 0, alignItems: "center", justifyContent: "center" },
  centerTitlePill: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.10)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  centerTitleText: { fontFamily: theme.font.bold, fontSize: 14, color: theme.colors.text },

  /* hero */
  heroWrap: { marginTop: 14, borderRadius: 26, overflow: "hidden" },
  hero: {
    borderRadius: 26,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.12 : 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 14 },
    elevation: 4,
  },
  heroLabelRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  heroPillMini: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  heroLabel: { fontFamily: theme.font.bold, color: "rgba(255,255,255,0.90)", fontSize: 11, letterSpacing: 0.7 },
  heroName: { marginTop: 10, fontFamily: theme.font.bold, fontSize: 20, color: "#fff" },
  heroHint: { marginTop: 6, fontFamily: theme.font.regular, color: "rgba(255,255,255,0.86)" },

  heroCount: {
    width: 92,
    height: 92,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroCountNum: { fontFamily: theme.font.bold, fontSize: 22, color: "#fff" },
  heroCountText: { marginTop: 2, fontFamily: theme.font.medium, fontSize: 12, color: "rgba(255,255,255,0.85)" },

  /* stats */
  statsRow: { marginTop: 12, flexDirection: "row", gap: 10 },
  statPill: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: ui.card,
    borderColor: "rgba(17,24,39,0.06)",
  },
  statIcon: { width: 38, height: 38, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  statValue: { fontFamily: theme.font.bold, fontSize: 16, color: theme.colors.text },
  statLabel: { marginTop: 2, fontFamily: theme.font.medium, fontSize: 12, color: theme.colors.muted },

  /* sections */
  section: { marginTop: 18, marginBottom: 10, fontFamily: theme.font.medium, fontSize: 13, color: theme.colors.muted, letterSpacing: 0.3 },
  sectionRow: { marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(91,95,239,0.10)",
    borderWidth: 1,
    borderColor: "rgba(91,95,239,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  /* quick */
  quickRow: { flexDirection: "row", justifyContent: "space-around", alignItems: "flex-start", paddingVertical: 6 },
  quickCircleWrap: { width: 96, alignItems: "center", gap: 8 },
  quickCircle: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.97)" },
  quickCircleText: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 12 },

  /* cards + list */
  card: {
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.97)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.06)",
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.05 : 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
    overflow: "hidden",
    padding: 14,
  },
  divider: { height: 1, backgroundColor: "rgba(17,24,39,0.06)", marginTop: 12, marginBottom: 12 },

  empty: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 18,
    backgroundColor: "rgba(91,95,239,0.12)",
    borderWidth: 1,
    borderColor: "rgba(91,95,239,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 14 },
  emptySub: { marginTop: 4, fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 12, lineHeight: 16 },

  accRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  accMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  avatarWrap: { width: 46, height: 46, borderRadius: 18, overflow: "hidden", backgroundColor: ui.soft, borderWidth: 1, borderColor: "rgba(17,24,39,0.10)" },
  avatarImg: { width: 46, height: 46 },
  avatarFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  avatarInitials: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 12 },

  accName: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 14 },
  accMeta: { marginTop: 3, fontFamily: theme.font.regular, color: theme.colors.muted, fontSize: 12 },

  switchBtn: { height: 36, paddingHorizontal: 12, borderRadius: 999, backgroundColor: theme.colors.primary, flexDirection: "row", alignItems: "center", gap: 8 },
  switchBtnText: { fontFamily: theme.font.bold, color: "#fff", fontSize: 12 },

  activePill: { height: 30, paddingHorizontal: 10, borderRadius: 999, backgroundColor: "rgba(16,185,129,0.12)", borderWidth: 1, borderColor: "rgba(16,185,129,0.20)", flexDirection: "row", alignItems: "center", gap: 8 },
  activePillText: { fontFamily: theme.font.bold, color: "#10B981", fontSize: 12 },

  trashBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: ui.soft, borderWidth: 1, borderColor: "rgba(17,24,39,0.08)" },

  /* sheet */
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "flex-end", paddingHorizontal: 18, paddingBottom: 14 },
  sheet: { borderRadius: 22, backgroundColor: "rgba(255,255,255,0.98)", borderWidth: 1, borderColor: "rgba(17,24,39,0.10)", padding: 14 },
  sheetHandle: { alignSelf: "center", width: 46, height: 5, borderRadius: 999, backgroundColor: "rgba(148,163,184,0.65)", marginBottom: 10 },

  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sheetHeadTitle: { fontFamily: theme.font.bold, fontSize: 16, color: theme.colors.text },
  sheetHeadSub: { marginTop: 3, fontFamily: theme.font.medium, fontSize: 12, color: theme.colors.muted },
  sheetClose: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: ui.soft, borderWidth: 1, borderColor: "rgba(17,24,39,0.08)" },

  sheetRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 18, borderWidth: 1, borderColor: "rgba(17,24,39,0.08)", marginTop: 10 },
  sheetIcon: { width: 42, height: 42, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  sheetTitle: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 14 },
  sheetSub: { marginTop: 3, fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 12 },

  sheetCancel: { marginTop: 12, height: 46, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: ui.soft, borderWidth: 1, borderColor: "rgba(17,24,39,0.08)" },
  sheetCancelText: { fontFamily: theme.font.bold, color: theme.colors.text },
});
