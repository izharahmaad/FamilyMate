import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Alert,
  Switch,
  ActivityIndicator,
  StatusBar,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { doc, onSnapshot, setDoc } from "firebase/firestore";

import { auth, db } from "../lib/firebase";
import { theme } from "../theme";

type NotifPrefs = {
  budgetAlerts: boolean;
  billReminders: boolean;
  activityUpdates: boolean;
  weeklySummary: boolean;
};

const DEFAULTS: NotifPrefs = {
  budgetAlerts: true,
  billReminders: true,
  activityUpdates: false,
  weeklySummary: true,
};

function IconCircle({ icon, color }: { icon: keyof typeof Ionicons.glyphMap; color: string }) {
  return (
    <View style={[styles.iconCircle, { backgroundColor: `${color}12`, borderColor: `${color}22` }]}>
      <Ionicons name={icon} size={18} color={color} />
    </View>
  );
}

function ToggleRow({
  icon,
  color,
  title,
  subtitle,
  value,
  onValueChange,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  subtitle: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.row, disabled && { opacity: 0.65 }]}>
      <IconCircle icon={icon} color={color} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.rowSub} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>

      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: "rgba(148,163,184,0.45)", true: `${color}55` }}
        thumbColor={Platform.OS === "android" ? (value ? color : "#fff") : undefined}
      />
    </View>
  );
}

function ActionBtn({
  icon,
  label,
  onPress,
  tone = "soft",
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  tone?: "soft" | "danger";
}) {
  const bg =
    tone === "danger" ? "rgba(239,68,68,0.10)" : "rgba(255,255,255,0.85)";
  const br =
    tone === "danger" ? "rgba(239,68,68,0.18)" : "rgba(17,24,39,0.08)";
  const txt = tone === "danger" ? "#EF4444" : theme.colors.text;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.actionBtn, { backgroundColor: bg, borderColor: br }, pressed && { opacity: 0.9 }]}>
      <Ionicons name={icon} size={18} color={txt} />
      <Text style={[styles.actionBtnText, { color: txt }]}>{label}</Text>
    </Pressable>
  );
}

export default function NotificationSettingsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();

  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [pausedAll, setPausedAll] = useState(false);
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULTS);

  const saveTimer = useRef<any>(null);
  const pendingPrefsRef = useRef<NotifPrefs>(DEFAULTS);
  const pendingPausedRef = useRef<boolean>(false);

  const ignoreSnapshotRef = useRef(false);

  const docRef = useMemo(() => (uid ? doc(db, "users", uid) : null), [uid]);

  useEffect(() => {
    const t = setInterval(() => {
      const next = auth.currentUser?.uid ?? null;
      setUid((prev) => (prev === next ? prev : next));
    }, 400);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!docRef) {
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(
      docRef,
      { includeMetadataChanges: true },
      (snap) => {
        const d: any = snap.data() || {};
        const n = d?.settings?.notifications || {};
        const merged: NotifPrefs = {
          budgetAlerts: typeof n.budgetAlerts === "boolean" ? n.budgetAlerts : DEFAULTS.budgetAlerts,
          billReminders: typeof n.billReminders === "boolean" ? n.billReminders : DEFAULTS.billReminders,
          activityUpdates: typeof n.activityUpdates === "boolean" ? n.activityUpdates : DEFAULTS.activityUpdates,
          weeklySummary: typeof n.weeklySummary === "boolean" ? n.weeklySummary : DEFAULTS.weeklySummary,
        };

        const paused = typeof n.pausedAll === "boolean" ? n.pausedAll : false;

        setSaving(snap.metadata.hasPendingWrites);

        if (ignoreSnapshotRef.current && snap.metadata.hasPendingWrites) {
          setLoading(false);
          return;
        }

        pendingPrefsRef.current = merged;
        pendingPausedRef.current = paused;
        setPrefs(merged);
        setPausedAll(paused);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        Alert.alert("Notifications", err?.message || "Failed to load preferences");
      }
    );

    return () => unsub();
  }, [docRef]);

  const scheduleSave = (nextPrefs: NotifPrefs, nextPausedAll: boolean) => {
    if (!docRef) return;

    pendingPrefsRef.current = nextPrefs;
    pendingPausedRef.current = nextPausedAll;

    ignoreSnapshotRef.current = true;
    setSaving(true);

    if (saveTimer.current) clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(async () => {
      try {
        await setDoc(
          docRef,
          { settings: { notifications: { ...pendingPrefsRef.current, pausedAll: pendingPausedRef.current } } },
          { merge: true }
        );
      } catch (e: any) {
        Alert.alert("Save failed", e?.message || "Could not update settings");
        ignoreSnapshotRef.current = false;
      } finally {
        setTimeout(() => {
          ignoreSnapshotRef.current = false;
        }, 500);
      }
    }, 250);
  };

  const setKey = (key: keyof NotifPrefs, v: boolean) => {
    const next = { ...prefs, [key]: v };
    setPrefs(next);
    scheduleSave(next, pausedAll);
  };

  const togglePausedAll = (v: boolean) => {
    setPausedAll(v);
    scheduleSave(prefs, v);
  };

  const resetDefaults = () => {
    Alert.alert("Reset", "Reset notification settings to default?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset",
        style: "destructive",
        onPress: () => {
          setPrefs(DEFAULTS);
          setPausedAll(false);
          scheduleSave(DEFAULTS, false);
        },
      },
    ]);
  };

  const enabled = !pausedAll;

  if (!uid) {
    return (
      <View style={[styles.root, { paddingTop: Math.max(insets.top, 10), justifyContent: "center", alignItems: "center" }]}>
        <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
        <Text style={{ fontFamily: theme.font.medium, color: theme.colors.muted }}>Please login again.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 10) }]}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <View style={styles.headerBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.9 }]}>
          <Ionicons name="chevron-back" size={18} color={theme.colors.text} />
        </Pressable>

        <View pointerEvents="none" style={styles.centerTitle}>
          <View style={styles.centerTitlePill}>
            <Ionicons name="notifications-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.centerTitleText}>Notifications</Text>
          </View>
        </View>

        <View style={styles.rightGhost}>
          {loading ? <ActivityIndicator color={theme.colors.primary} /> : null}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 18 + insets.bottom }}>
        <View style={styles.hero}>
          <View style={styles.heroLeft}>
            <View style={styles.heroIcon}>
              <Ionicons name={pausedAll ? "notifications-off-outline" : "notifications-outline"} size={18} color={pausedAll ? "#64748B" : theme.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroK}>Status</Text>
              <Text style={styles.heroV} numberOfLines={1}>
                {pausedAll ? "Paused" : "Active"}
              </Text>
            </View>
          </View>

          <View style={{ alignItems: "flex-end", gap: 8 }}>
            <View style={[styles.statePill, { backgroundColor: saving ? "rgba(100,116,139,0.12)" : "rgba(34,197,94,0.12)", borderColor: saving ? "rgba(100,116,139,0.18)" : "rgba(34,197,94,0.18)" }]}>
              <Ionicons name={saving ? "sync-outline" : "checkmark-circle-outline"} size={14} color={saving ? "#64748B" : "#16A34A"} />
              <Text style={[styles.statePillText, { color: saving ? "#64748B" : "#16A34A" }]}>{saving ? "Saving…" : "Saved"}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <ToggleRow
            icon="power-outline"
            color="#64748B"
            title="Pause all notifications"
            subtitle="Turn off all alerts and reminders (you can re-enable anytime)"
            value={pausedAll}
            onValueChange={togglePausedAll}
            disabled={loading}
          />

          <View style={styles.divider} />

          <ToggleRow
            icon="pie-chart-outline"
            color="#CA8A04"
            title="Budget alerts"
            subtitle="Warn when spending reaches your limit"
            value={prefs.budgetAlerts}
            onValueChange={(v) => setKey("budgetAlerts", v)}
            disabled={loading || !enabled}
          />
          <View style={styles.divider} />

          <ToggleRow
            icon="alarm-outline"
            color="#0284C7"
            title="Bill reminders"
            subtitle="Get reminders for upcoming bills"
            value={prefs.billReminders}
            onValueChange={(v) => setKey("billReminders", v)}
            disabled={loading || !enabled}
          />
          <View style={styles.divider} />

          <ToggleRow
            icon="swap-vertical-outline"
            color="#16A34A"
            title="Activity updates"
            subtitle="Notify when family adds transactions"
            value={prefs.activityUpdates}
            onValueChange={(v) => setKey("activityUpdates", v)}
            disabled={loading || !enabled}
          />
          <View style={styles.divider} />

          <ToggleRow
            icon="calendar-outline"
            color="#7C3AED"
            title="Weekly summary"
            subtitle="Weekly report of spending and budgets"
            value={prefs.weeklySummary}
            onValueChange={(v) => setKey("weeklySummary", v)}
            disabled={loading || !enabled}
          />
        </View>

        <View style={styles.actionsRow}>
          <ActionBtn icon="refresh-outline" label="Reset defaults" onPress={resetDefaults} />
          <ActionBtn
            icon="help-circle-outline"
            label="Preview"
            onPress={() => Alert.alert("Preview", "This is UI settings only. Connect real push notifications later.")}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 18, backgroundColor: theme.colors.background },

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
  rightGhost: { position: "absolute", right: 0, width: 42, height: 42, alignItems: "center", justifyContent: "center" },

  hero: {
    marginTop: 10,
    borderRadius: 24,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.97)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.06)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.05 : 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  heroLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  heroIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(17,24,39,0.04)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroK: { fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 12 },
  heroV: { marginTop: 4, fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 14 },

  statePill: {
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statePillText: { fontFamily: theme.font.bold, fontSize: 12 },

  card: {
    marginTop: 12,
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

  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  iconCircle: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  rowTitle: { fontFamily: theme.font.bold, fontSize: 14, color: theme.colors.text },
  rowSub: { marginTop: 3, fontFamily: theme.font.regular, fontSize: 12, color: theme.colors.muted, lineHeight: 16 },

  divider: { height: 1, backgroundColor: "rgba(17,24,39,0.06)", marginLeft: 68 },

  actionsRow: { marginTop: 12, flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1,
    height: 46,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  actionBtnText: { fontFamily: theme.font.bold, fontSize: 13 },
});
