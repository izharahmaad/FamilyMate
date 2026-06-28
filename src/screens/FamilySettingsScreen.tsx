import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  StatusBar,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";

import { getAuth } from "firebase/auth";
import { doc, onSnapshot, collection } from "firebase/firestore";

import { db } from "../lib/firebase";
import { theme } from "../theme";

type MemberRole = "admin" | "member";
type MemberRow = { id: string; uid: string; role: MemberRole; name?: string; email?: string };

function Row({
  icon,
  title,
  subtitle,
  onPress,
  right,
  tone = "default",
  disabled = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress: () => void;
  right?: React.ReactNode;
  tone?: "default" | "info" | "danger";
  disabled?: boolean;
}) {
  const toneColor =
    tone === "danger" ? theme.colors.error : tone === "info" ? "#3B82F6" : theme.colors.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.row,
        tone === "info" ? styles.rowInfo : null,
        tone === "danger" ? styles.rowDanger : null,
        { opacity: disabled ? 0.55 : pressed ? 0.86 : 1 },
      ]}
    >
      <View style={styles.rowLeft}>
        <View style={[styles.rowIconWrap, { backgroundColor: `${toneColor}14`, borderColor: `${toneColor}2A` }]}>
          <Ionicons name={icon} size={18} color={toneColor} />
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
      </View>

      {right ?? (
        <View style={styles.chevCircle}>
          <Ionicons name="chevron-forward" size={16} color={theme.colors.muted} />
        </View>
      )}
    </Pressable>
  );
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
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
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
      style={({ pressed }) => [
        styles.quickCircleWrap,
        { opacity: disabled ? 0.55 : pressed ? 0.88 : 1 },
      ]}
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

export default function FamilySettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const auth = getAuth();

  const [familyId, setFamilyId] = useState<string | null>(null);
  const [familyName, setFamilyName] = useState<string>("");
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);

  const rootNav = navigation.getParent("RootStack") ?? navigation.getParent();

  const go = (routeName: string) => {
    if (!rootNav) return Alert.alert("Navigation", "Root navigator not found");
    rootNav.navigate(routeName);
  };

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const unsub = onSnapshot(
      doc(db, "users", uid),
      (snap) => {
        const data = snap.data() as any;
        setFamilyId(data?.familyId ?? null);
      },
      () => setFamilyId(null)
    );

    return unsub;
  }, []);

  useEffect(() => {
    if (!familyId) {
      setFamilyName("");
      return;
    }

    const unsub = onSnapshot(
      doc(db, "families", familyId),
      (snap) => {
        const data = snap.data() as any;
        setFamilyName(data?.name ?? "");
      },
      () => setFamilyName("")
    );

    return unsub;
  }, [familyId]);

  useEffect(() => {
    if (!familyId) {
      setMembers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = onSnapshot(
      collection(db, "families", familyId, "members"),
      (qs) => {
        const rows: MemberRow[] = qs.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            uid: data?.uid ?? d.id,
            role: (data?.role === "admin" ? "admin" : "member") as MemberRole,
            name: data?.name ?? "",
            email: data?.email ?? "",
          };
        });
        setMembers(rows);
        setLoading(false);
      },
      () => {
        setMembers([]);
        setLoading(false);
      }
    );

    return unsub;
  }, [familyId]);

  const myUid = auth.currentUser?.uid ?? "";

  const stats = useMemo(() => {
    const admins = members.filter((m) => m.role === "admin").length;
    const regular = members.length - admins;
    const me = members.find((m) => m.uid === myUid) ?? null;
    const canManage = me?.role === "admin";
    return { admins, regular, total: members.length, me, canManage };
  }, [members, myUid]);

  const hasFamily = !!familyId;

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 10) }]}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <LinearGradient
        pointerEvents="none"
        colors={["rgba(11,18,32,0.10)", "rgba(11,18,32,0.03)", "rgba(11,18,32,0.08)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.headerBar}>
        <Pressable
          onPress={() => navigation.goBack?.()}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.9 }]}
        >
          <Ionicons name="chevron-back" size={18} color={theme.colors.text} />
        </Pressable>

        <View pointerEvents="none" style={styles.centerTitle}>
          <View style={styles.centerTitlePill}>
            <Ionicons name="people-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.centerTitleText}>Family</Text>
          </View>
        </View>

        <View style={styles.rightGhost} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 18 + insets.bottom }}>
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
                  <Ionicons name="home-outline" size={12} color="rgba(255,255,255,0.95)" />
                  <Text style={styles.heroLabel}>HOUSEHOLD</Text>
                </View>

                <View style={styles.heroPillMini}>
                  <Ionicons name="sync-outline" size={12} color="rgba(255,255,255,0.95)" />
                  <Text style={styles.heroLabel}>LIVE</Text>
                </View>
              </View>

              <Text style={styles.heroName} numberOfLines={1}>
                {familyName || (hasFamily ? "Family" : "No family")}
              </Text>
              <Text style={styles.heroHint} numberOfLines={2}>
                Invite is inside “Family members”.
              </Text>
            </View>

            <View style={styles.heroCount}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.heroCountNum}>{stats.total}</Text>
                  <Text style={styles.heroCountText}>Members</Text>
                </>
              )}
            </View>
          </LinearGradient>
        </View>

        <View style={styles.statsRow}>
          <StatPill label="Admins" value={loading ? "—" : String(stats.admins)} icon="shield-checkmark-outline" tint="#3B82F6" />
          <StatPill label="Members" value={loading ? "—" : String(stats.regular)} icon="people-outline" tint={theme.colors.primary} />
        </View>

        <Text style={styles.section}>Quick actions</Text>
        <View style={styles.quickRow}>
          <QuickCircle icon="add" label="Create" onPress={() => go("CreateFamily")} tint="#22C55E" />
          <QuickCircle icon="key-outline" label="Join" onPress={() => go("JoinFamily")} tint="#F59E0B" />
          <QuickCircle icon="people-outline" label="Members" onPress={() => go("FamilyMembers")} tint="#3B82F6" disabled={!hasFamily} />
        </View>

        <Text style={styles.section}>Actions</Text>
        <View style={styles.card}>
          <Row
            icon="people-outline"
            title="Family members"
            subtitle="Invite code + admins and members (live)"
            onPress={() => go("FamilyMembers")}
            tone="info"
            disabled={!hasFamily}
          />
          <View style={styles.divider} />
          <Row icon="add-circle-outline" title="Create family" subtitle="Create a new household and get invite code" onPress={() => go("CreateFamily")} />
          <View style={styles.divider} />
          <Row icon="log-in-outline" title="Join family" subtitle="Join with invite code" onPress={() => go("JoinFamily")} />
        </View>

        <Text style={styles.section}>Account</Text>
        <View style={styles.card}>
          <Row icon="shield-checkmark-outline" title="Security" subtitle="Password reset and safety" onPress={() => go("Security")} />
        </View>

        {hasFamily ? (
          <View style={styles.tipCard}>
            <View style={styles.tipIcon}>
              <Ionicons name="ticket-outline" size={18} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tipTitle}>Invite code</Text>
              <Text style={styles.tipText}>Open “Family members” to copy and share the invite code.</Text>
            </View>
          </View>
        ) : null}

        {!stats.canManage && hasFamily ? (
          <View style={styles.noteBox}>
            <Ionicons name="information-circle-outline" size={18} color={theme.colors.muted} />
            <View style={{ flex: 1 }}>
              <Text style={styles.noteTitle}>Limited access</Text>
              <Text style={styles.noteText}>You are a member. Only admins can manage roles.</Text>
            </View>
          </View>
        ) : null}
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
  rightGhost: { position: "absolute", right: 0, width: 42, height: 42 },

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

  statsRow: { marginTop: 12, flexDirection: "row", gap: 10 },
  statPill: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: theme.colors.card,
    borderColor: "rgba(17,24,39,0.06)",
  },
  statIcon: { width: 38, height: 38, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  statValue: { fontFamily: theme.font.bold, fontSize: 16, color: theme.colors.text },
  statLabel: { marginTop: 2, fontFamily: theme.font.medium, fontSize: 12, color: theme.colors.muted },

  section: { marginTop: 18, marginBottom: 10, fontFamily: theme.font.medium, fontSize: 13, color: theme.colors.muted, letterSpacing: 0.3 },

  quickRow: { flexDirection: "row", justifyContent: "space-around", alignItems: "flex-start", paddingVertical: 6 },
  quickCircleWrap: { width: 96, alignItems: "center", gap: 8 },
  quickCircle: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.97)" },
  quickCircleText: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 12 },

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
  },
  divider: { height: 1, backgroundColor: "rgba(17,24,39,0.06)", marginLeft: 62 },

  row: { paddingHorizontal: 14, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowInfo: { backgroundColor: "rgba(59,130,246,0.06)" },
  rowDanger: { backgroundColor: "rgba(239,68,68,0.06)" },
  rowLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: 12 },
  rowIconWrap: { width: 38, height: 38, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  rowTitle: { fontFamily: theme.font.bold, fontSize: 15, color: theme.colors.text },
  rowSub: { marginTop: 4, fontFamily: theme.font.regular, fontSize: 13, color: theme.colors.muted },
  chevCircle: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(17,24,39,0.05)", borderWidth: 1, borderColor: "rgba(17,24,39,0.07)" },

  tipCard: { marginTop: 12, borderRadius: 20, padding: 12, backgroundColor: "rgba(91,95,239,0.08)", borderWidth: 1, borderColor: "rgba(91,95,239,0.14)", flexDirection: "row", alignItems: "flex-start", gap: 10 },
  tipIcon: { width: 40, height: 40, borderRadius: 16, backgroundColor: "rgba(91,95,239,0.12)", borderWidth: 1, borderColor: "rgba(91,95,239,0.16)", alignItems: "center", justifyContent: "center" },
  tipTitle: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 13 },
  tipText: { marginTop: 4, fontFamily: theme.font.regular, color: theme.colors.muted, lineHeight: 18 },

  noteBox: { marginTop: 10, borderRadius: 20, padding: 14, backgroundColor: "rgba(107,114,128,0.06)", borderWidth: 1, borderColor: "rgba(107,114,128,0.12)", flexDirection: "row", gap: 10, alignItems: "flex-start" },
  noteTitle: { fontFamily: theme.font.bold, color: theme.colors.text },
  noteText: { marginTop: 6, fontFamily: theme.font.regular, color: theme.colors.muted, lineHeight: 18 },
});
