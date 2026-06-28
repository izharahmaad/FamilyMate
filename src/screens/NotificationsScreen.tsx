import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Switch,
  Alert,
  ScrollView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  writeBatch,
  getDocs,
  deleteDoc,
} from "firebase/firestore";

import { theme } from "../theme";
import { auth, db } from "../lib/firebase";

type NotifItem = {
  id: string;
  title: string;
  body?: string;
  createdAtLabel: string;
  read: boolean;
  tone: "primary" | "orange" | "green" | "red";
  icon: keyof typeof Ionicons.glyphMap;
};

type RowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
};

const ORANGE = "#F59E0B";
const GREEN = "#10B981";
const RED = "#EF4444";

function toneColors(tone: NotifItem["tone"]) {
  if (tone === "orange") return { c: ORANGE, bg: "rgba(245,158,11,0.10)", br: "rgba(245,158,11,0.18)" };
  if (tone === "green") return { c: GREEN, bg: "rgba(16,185,129,0.10)", br: "rgba(16,185,129,0.18)" };
  if (tone === "red") return { c: RED, bg: "rgba(239,68,68,0.10)", br: "rgba(239,68,68,0.18)" };
  return { c: theme.colors.primary, bg: "rgba(91,95,239,0.10)", br: "rgba(91,95,239,0.18)" };
}

function Row({ icon, title, subtitle, right, onPress }: RowProps) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && onPress ? { opacity: 0.92 } : null]}
    >
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={18} color={theme.colors.primary} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        {!!subtitle && (
          <Text style={styles.rowSub} numberOfLines={2}>
            {subtitle}
          </Text>
        )}
      </View>

      {right ?? <Ionicons name="chevron-forward" size={16} color={theme.colors.muted} />}
    </Pressable>
  );
}

function NotifCard({
  item,
  onPress,
}: {
  item: NotifItem;
  onPress?: () => void;
}) {
  const t = toneColors(item.tone);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.notifCard, pressed ? { transform: [{ scale: 0.995 }] } : null]}>
      <View style={[styles.notifIcon, { backgroundColor: t.bg, borderColor: t.br }]}>
        <Ionicons name={item.icon} size={18} color={t.c} />
      </View>

      <View style={{ flex: 1 }}>
        <View style={styles.notifTopRow}>
          <Text style={styles.notifTitle} numberOfLines={1}>
            {item.title}
          </Text>
          {!item.read ? <View style={[styles.unreadDot, { backgroundColor: t.c }]} /> : null}
        </View>

        {!!item.body ? (
          <Text style={styles.notifBody} numberOfLines={2}>
            {item.body}
          </Text>
        ) : null}

        <Text style={styles.notifMeta}>{item.createdAtLabel}</Text>
      </View>
    </Pressable>
  );
}

export default function NotificationsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();

  // UI toggles (local; can be connected to DB later)
  const [pushEnabled, setPushEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);

  // Realtime list
  const [loading, setLoading] = useState(true);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [items, setItems] = useState<NotifItem[]>([]);

  const unsubRef = useRef<null | (() => void)>(null);

  const statusText = useMemo(() => {
    if (!pushEnabled) return "Disabled";
    const bits: string[] = [];
    if (soundEnabled) bits.push("Sound");
    if (vibrationEnabled) bits.push("Vibration");
    return bits.length ? bits.join(" • ") : "Enabled";
  }, [pushEnabled, soundEnabled, vibrationEnabled]);

  const unreadCount = useMemo(() => items.filter((x) => !x.read).length, [items]);

  const onBack = () => {
    if (navigation?.canGoBack?.()) navigation.goBack();
    else navigation.navigate(auth.currentUser ? "App" : "Auth");
  };

  // 1) Get familyId realtime from user doc (same pattern you use in Home)
  useEffect(() => {
    unsubRef.current?.();
    unsubRef.current = null;

    const uid = auth.currentUser?.uid;
    if (!uid) {
      setFamilyId(null);
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubUser = onSnapshot(
      doc(db, "users", uid),
      (snap) => {
        const fid = (snap.data() as any)?.familyId as string | undefined;
        setFamilyId(fid || null);
      },
      () => {
        setFamilyId(null);
        setLoading(false);
      }
    );

    return () => {
      unsubUser();
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, []);

  // 2) Listen realtime to family notifications collection [web:427]
  useEffect(() => {
    unsubRef.current?.();
    unsubRef.current = null;

    if (!familyId) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // You can change this path if you use a different structure
    const ref = collection(db, "families", familyId, "notifications");
    const q = query(ref, orderBy("createdAt", "desc"), limit(50));

    unsubRef.current = onSnapshot(
      q,
      (qSnap) => {
        const rows: NotifItem[] = qSnap.docs.map((d) => {
          const x = d.data() as any;
          const ts = x?.createdAt?.toDate ? x.createdAt.toDate() : null;
          const createdAtLabel = ts ? ts.toLocaleString() : "Now";

          const type = String(x?.type || "").toLowerCase();
          const tone: NotifItem["tone"] =
            type.includes("warning") ? "orange" :
            type.includes("success") ? "green" :
            type.includes("error") ? "red" :
            "primary";

          const icon: NotifItem["icon"] =
            type.includes("bill") ? "flash-outline" :
            type.includes("budget") ? "wallet-outline" :
            type.includes("member") ? "people-outline" :
            "notifications-outline";

          return {
            id: d.id,
            title: x?.title || "Notification",
            body: x?.body || "",
            createdAtLabel,
            read: Boolean(x?.read),
            tone,
            icon,
          };
        });

        setItems(rows);
        setLoading(false);
      },
      (err) => {
        console.log("Notifications snapshot error:", err);
        setLoading(false);
      }
    );

    return () => {
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, [familyId]);

  const markAllRead = async () => {
    try {
      if (!familyId) return;
      const ref = collection(db, "families", familyId, "notifications");
      const qSnap = await getDocs(query(ref, orderBy("createdAt", "desc"), limit(200)));
      const batch = writeBatch(db);
      qSnap.docs.forEach((d) => batch.update(d.ref, { read: true }));
      await batch.commit();
    } catch (e: any) {
      Alert.alert("Notifications", e?.message || "Failed to mark as read");
    }
  };

  const clearAll = async () => {
    try {
      if (!familyId) return;
      Alert.alert("Clear all?", "This will delete all notifications for this family.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            const ref = collection(db, "families", familyId, "notifications");
            const qSnap = await getDocs(query(ref, orderBy("createdAt", "desc"), limit(200)));
            const batch = writeBatch(db);
            qSnap.docs.forEach((d) => batch.delete(d.ref));
            await batch.commit();
          },
        },
      ]);
    } catch (e: any) {
      Alert.alert("Notifications", e?.message || "Failed to clear");
    }
  };

  const openSystemSettings = () => {
    Alert.alert(
      "System Settings",
      Platform.OS === "ios"
        ? "Open iPhone Settings → Notifications → FamilyMate."
        : "Open Android Settings → Apps → FamilyMate → Notifications."
    );
  };

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 10) }]}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={18} color={theme.colors.text} />
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subTitle}>
            {statusText}
            {unreadCount > 0 ? ` • ${unreadCount} unread` : ""}
          </Text>
        </View>

        <Pressable onPress={markAllRead} hitSlop={10} style={styles.iconBtn}>
          <Ionicons name="checkmark-done-outline" size={18} color={theme.colors.text} />
        </Pressable>

        <Pressable onPress={clearAll} hitSlop={10} style={styles.iconBtn}>
          <Ionicons name="trash-outline" size={18} color={theme.colors.text} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 + insets.bottom }}>
        <LinearGradient
          colors={["rgba(91,95,239,0.14)", "rgba(14,165,233,0.10)", "rgba(245,158,11,0.10)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroK}>REALTIME</Text>
              <Text style={styles.heroV} numberOfLines={1}>
                Activity updates
              </Text>
              <Text style={styles.heroSub} numberOfLines={2}>
                New notifications appear instantly when Firestore changes.
              </Text>
            </View>

            <View style={styles.heroBadge}>
              <Ionicons name="pulse-outline" size={18} color={theme.colors.primary} />
              <Text style={styles.heroBadgeText}>{loading ? "Syncing" : "Live"}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Preferences</Text>

          <View style={styles.prefRow}>
            <View style={styles.prefLeft}>
              <View style={[styles.prefIcon, { backgroundColor: "rgba(91,95,239,0.10)", borderColor: "rgba(91,95,239,0.18)" }]}>
                <Ionicons name="notifications-outline" size={18} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.prefTitle}>Push notifications</Text>
                <Text style={styles.prefSub}>Receive important updates</Text>
              </View>
            </View>
            <Switch value={pushEnabled} onValueChange={setPushEnabled} />
          </View>

          <View style={styles.divider} />

          <View style={styles.prefRow}>
            <View style={styles.prefLeft}>
              <View style={[styles.prefIcon, { backgroundColor: "rgba(245,158,11,0.10)", borderColor: "rgba(245,158,11,0.18)" }]}>
                <Ionicons name="volume-high-outline" size={18} color={ORANGE} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.prefTitle}>Sound</Text>
                <Text style={styles.prefSub}>Play sound for notifications</Text>
              </View>
            </View>
            <Switch value={soundEnabled} onValueChange={setSoundEnabled} disabled={!pushEnabled} />
          </View>

          <View style={styles.divider} />

          <View style={styles.prefRow}>
            <View style={styles.prefLeft}>
              <View style={[styles.prefIcon, { backgroundColor: "rgba(16,185,129,0.10)", borderColor: "rgba(16,185,129,0.18)" }]}>
                <Ionicons name="phone-portrait-outline" size={18} color={GREEN} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.prefTitle}>Vibration</Text>
                <Text style={styles.prefSub}>Vibrate on new notifications</Text>
              </View>
            </View>
            <Switch value={vibrationEnabled} onValueChange={setVibrationEnabled} disabled={!pushEnabled} />
          </View>

          <View style={styles.divider} />

          <Row
            icon="settings-outline"
            title="Open system notification settings"
            subtitle="Manage permissions from phone settings"
            onPress={openSystemSettings}
          />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitleLarge}>Latest</Text>
          <View style={styles.miniPill}>
            <Ionicons name="time-outline" size={14} color={theme.colors.muted} />
            <Text style={styles.miniPillText}>Last 50</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={theme.colors.primary} />
            <Text style={styles.loadingText}>Loading notifications…</Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyBox}>
            <View style={styles.emptyIcon}>
              <Ionicons name="notifications-off-outline" size={22} color={theme.colors.muted} />
            </View>
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptySub}>When your family activity changes, updates will appear here.</Text>
          </View>
        ) : (
          <View style={{ marginTop: 10 }}>
            {items.map((n) => (
              <NotifCard
                key={n.id}
                item={n}
                onPress={async () => {
                  try {
                    if (!familyId) return;
                    await updateDoc(doc(db, "families", familyId, "notifications", n.id), { read: true });
                  } catch {}
                }}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 18, backgroundColor: theme.colors.background },

  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingBottom: 10 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(17,24,39,0.06)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontFamily: theme.font.bold, fontSize: 18, color: theme.colors.text },
  subTitle: { marginTop: 2, fontFamily: theme.font.medium, fontSize: 12, color: theme.colors.muted },

  hero: {
    marginTop: 8,
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(91,95,239,0.12)",
    backgroundColor: "rgba(255,255,255,0.7)",
  },
  heroK: { fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 11, letterSpacing: 0.8 },
  heroV: { marginTop: 6, fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 18 },
  heroSub: { marginTop: 4, fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 12 },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.08)",
  },
  heroBadgeText: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 12 },

  card: {
    marginTop: 12,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.98)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.08)",
    padding: 14,
  },

  sectionTitle: { fontFamily: theme.font.bold, fontSize: 14, color: theme.colors.text, marginBottom: 8 },

  prefRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 10 },
  prefLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  prefIcon: { width: 40, height: 40, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  prefTitle: { fontFamily: theme.font.bold, fontSize: 14, color: theme.colors.text },
  prefSub: { marginTop: 2, fontFamily: theme.font.medium, fontSize: 12, color: theme.colors.muted },

  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: "rgba(91,95,239,0.10)",
    borderWidth: 1,
    borderColor: "rgba(91,95,239,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { fontFamily: theme.font.bold, fontSize: 14, color: theme.colors.text },
  rowSub: { marginTop: 3, fontFamily: theme.font.medium, fontSize: 12, color: theme.colors.muted },

  divider: { height: 1, backgroundColor: "rgba(17,24,39,0.06)", marginVertical: 8 },

  sectionHeader: { marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitleLarge: { fontFamily: theme.font.bold, fontSize: 18, color: theme.colors.text },
  miniPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(17,24,39,0.04)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.08)",
  },
  miniPillText: { fontFamily: theme.font.bold, color: theme.colors.muted, fontSize: 12 },

  loadingBox: {
    marginTop: 12,
    borderRadius: 18,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.08)",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  loadingText: { fontFamily: theme.font.medium, color: theme.colors.muted },

  emptyBox: {
    marginTop: 12,
    borderRadius: 22,
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.08)",
    alignItems: "center",
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(17,24,39,0.04)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { marginTop: 10, fontFamily: theme.font.bold, fontSize: 14, color: theme.colors.text },
  emptySub: { marginTop: 6, fontFamily: theme.font.medium, fontSize: 12, color: theme.colors.muted, textAlign: "center" },

  notifCard: {
    marginHorizontal: 0,
    marginBottom: 12,
    borderRadius: 18,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.08)",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  notifIcon: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  notifTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  notifTitle: { flex: 1, fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 14 },
  unreadDot: { width: 9, height: 9, borderRadius: 5 },
  notifBody: { marginTop: 4, fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 12 },
  notifMeta: { marginTop: 6, fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 11 },
});
