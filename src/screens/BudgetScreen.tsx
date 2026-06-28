import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  StatusBar,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, G } from "react-native-svg";

import { getAuth } from "firebase/auth";
import { doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";

import { db } from "../lib/firebase";
import { theme } from "../theme";

function formatPKR(n: number) {
  try {
    return new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: "PKR",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `PKR ${Math.round(n)}`;
  }
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function daysInMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function fmtDateTime(ts: any) {
  try {
    const d: Date | null = ts?.toDate ? ts.toDate() : null;
    if (!d) return "—";
    return d.toLocaleString();
  } catch {
    return "—";
  }
}

function DonutChart({
  percent,
  size = 118,
  stroke = 14,
  accent = "rgba(255,255,255,0.92)",
}: {
  percent: number;
  size?: number;
  stroke?: number;
  accent?: string;
}) {
  const p = clamp01(percent / 100);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * p;
  const gap = c - dash;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <G rotation={-90} originX={size / 2} originY={size / 2}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="rgba(255,255,255,0.22)"
            strokeWidth={stroke}
            fill="transparent"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={accent}
            strokeWidth={stroke}
            fill="transparent"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${gap}`}
          />
        </G>
      </Svg>

      <View style={styles.donutCenter}>
        <Text style={styles.donutPct}>{Math.round(percent)}%</Text>
        <Text style={styles.donutLabel}>Used</Text>
      </View>
    </View>
  );
}

export default function BudgetScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const auth = getAuth();

  const [familyId, setFamilyId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [monthBudgetPkr, setMonthBudgetPkr] = useState<number>(0);
  const [monthSpentPkr, setMonthSpentPkr] = useState<number>(0);
  const [budgetUpdatedAt, setBudgetUpdatedAt] = useState<any>(null);

  const [budgetInput, setBudgetInput] = useState<string>("");

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const unsub = onSnapshot(
      doc(db, "users", uid),
      (snap) => {
        const d = snap.data() as any;
        setFamilyId(d?.familyId ?? null);
      },
      (err) => Alert.alert("Error", err.message)
    );

    return unsub;
  }, []);

  useEffect(() => {
    if (!familyId) return;

    setLoading(true);
    const unsub = onSnapshot(
      doc(db, "families", familyId),
      (snap) => {
        const d = snap.data() as any;
        const bud = Number(d?.monthBudgetPkr ?? 0);
        const spent = Number(d?.monthSpentPkr ?? 0);

        setMonthBudgetPkr(bud);
        setMonthSpentPkr(spent);
        setBudgetUpdatedAt(d?.monthBudgetUpdatedAt ?? null);

        setBudgetInput((prev) => (prev.trim().length ? prev : String(Math.round(bud || 0))));
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        Alert.alert("Error", err.message);
      }
    );

    return unsub;
  }, [familyId]);

  const metrics = useMemo(() => {
    const bud = Number(monthBudgetPkr || 0);
    const spent = Number(monthSpentPkr || 0);

    const ratio = bud > 0 ? clamp01(spent / bud) : 0;
    const pctUsed = bud > 0 ? Math.round((spent / bud) * 100) : 0;

    const remaining = bud - spent;

    const now = new Date();
    const dim = daysInMonth(now);
    const day = now.getDate();
    const daysLeft = Math.max(0, dim - day);

    const avgPerDaySoFar = day > 0 ? spent / day : 0;
    const projected = avgPerDaySoFar * dim;

    const dailyLimit = daysLeft > 0 ? Math.max(0, remaining / daysLeft) : Math.max(0, remaining);

    let status: "On track" | "Watch" | "Over" = "On track";
    if (bud > 0 && spent > bud) status = "Over";
    else if (bud > 0 && spent > bud * 0.8) status = "Watch";

    return { bud, spent, ratio, pctUsed, remaining, daysLeft, projected, dailyLimit, status };
  }, [monthBudgetPkr, monthSpentPkr]);

  const colors = useMemo(() => {
    if (metrics.status === "Over") return { grad: ["#EF4444", "#B91C1C"] as const, accent: theme.colors.error };
    if (metrics.status === "Watch") return { grad: ["#F59E0B", "#D97706"] as const, accent: "#D97706" };
    return { grad: [theme.colors.primary, theme.colors.primaryDark] as const, accent: theme.colors.primary };
  }, [metrics.status]);

  const canSave = useMemo(() => {
    const v = Number(budgetInput);
    return Number.isFinite(v) && v >= 0 && !saving;
  }, [budgetInput, saving]);

  const saveBudget = async (value?: number) => {
    if (!familyId) return Alert.alert("Family", "Family not ready.");

    const v = Number(value ?? budgetInput);
    if (!Number.isFinite(v) || v < 0) return Alert.alert("Budget", "Enter a valid budget (0 or more).");

    try {
      setSaving(true);

      await updateDoc(doc(db, "families", familyId), {
        monthBudgetPkr: Math.round(v),
        monthBudgetUpdatedAt: serverTimestamp(),
      });
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to update budget");
    } finally {
      setSaving(false);
    }
  };

  const bump = (delta: number) => {
    const base = Number(budgetInput);
    const next = Number.isFinite(base) ? Math.max(0, base + delta) : Math.max(0, (monthBudgetPkr || 0) + delta);
    setBudgetInput(String(Math.round(next)));
  };

  const quickSetPlus = (delta: number) => {
    const base = Number.isFinite(Number(metrics.bud)) ? metrics.bud : 0;
    const next = Math.max(0, Math.round(base + delta));
    setBudgetInput(String(next));
  };

  const quickSetProjected = () => {
    setBudgetInput(String(Math.max(0, Math.round(metrics.projected))));
  };

  if (!auth.currentUser) {
    return (
      <View style={[styles.root, { paddingTop: Math.max(insets.top, 10), justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: theme.colors.muted }}>Please login again.</Text>
      </View>
    );
  }

  if (!familyId) {
    return (
      <View style={[styles.root, { paddingTop: Math.max(insets.top, 10) }]}>
        <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
        <LinearGradient
          pointerEvents="none"
          colors={["#2559c2", "#0a0a2e", "#112B5C"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.centerBox}>
          <Ionicons name="wallet-outline" size={34} color={theme.colors.muted} />
          <Text style={styles.emptyTitle}>No family connected</Text>
          <Text style={styles.emptySub}>Create a family or join using an invite code.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 10) }]}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* White background + navy touch */}
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(10,18,38,0.12)", "rgba(10,18,38,0.02)", "rgba(10,18,38,0.08)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation?.goBack?.()} hitSlop={10} style={styles.glassCircle}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
        </Pressable>

        <View style={styles.headerTitleWrap}>
          <View style={styles.glassMiniCircle}>
            <Ionicons name="wallet-outline" size={16} color={theme.colors.text} />
          </View>
          <Text style={styles.title} numberOfLines={1}>
            Monthly budget
          </Text>
        </View>

        <View style={{ width: 44 }} />
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingBottom: 24 + Math.max(insets.bottom, 10),
            }}
          >
            {/* HERO */}
            <View style={styles.heroWrap}>
              <LinearGradient colors={colors.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
                <LinearGradient
                  pointerEvents="none"
                  colors={["rgba(10,18,38,0.22)", "rgba(10,18,38,0.00)", "rgba(10,18,38,0.12)"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />

                <View style={styles.heroTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.heroK}>Spent this month</Text>
                    <Text style={styles.heroV}>{formatPKR(metrics.spent)}</Text>
                    <Text style={styles.heroSub}>Budget: {metrics.bud > 0 ? formatPKR(metrics.bud) : "Not set"}</Text>

                    <View style={styles.heroMiniRow}>
                      <View style={styles.healthChip}>
                        <Ionicons name="pie-chart-outline" size={14} color="rgba(255,255,255,0.95)" />
                        <Text style={styles.healthChipText}>{metrics.pctUsed}% used</Text>
                      </View>
                      <View style={styles.healthChipSoft}>
                        <Ionicons name="shield-checkmark-outline" size={14} color="rgba(255,255,255,0.95)" />
                        <Text style={styles.healthChipText}>{metrics.status}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.donutWrap}>
                    <DonutChart percent={metrics.bud > 0 ? metrics.pctUsed : 0} />
                  </View>
                </View>

                <View style={styles.progressBg}>
                  <View style={[styles.progressFill, { width: `${Math.round(metrics.ratio * 100)}%` }]} />
                </View>

                <View style={styles.heroRow}>
                  <View style={styles.heroCell}>
                    <Text style={styles.heroCellK}>Remaining</Text>
                    <Text style={styles.heroCellV}>{formatPKR(metrics.remaining)}</Text>
                  </View>
                  <View style={styles.heroCell}>
                    <Text style={styles.heroCellK}>Days left</Text>
                    <Text style={styles.heroCellV}>{metrics.daysLeft}</Text>
                  </View>
                  <View style={styles.heroCell}>
                    <Text style={styles.heroCellK}>Daily limit</Text>
                    <Text style={styles.heroCellV}>{formatPKR(metrics.dailyLimit)}</Text>
                  </View>
                </View>

                <View style={styles.heroFooter}>
                  <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.heroFooterText}>Last updated: {fmtDateTime(budgetUpdatedAt)}</Text>
                </View>
              </LinearGradient>
            </View>

            {/* Set budget */}
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>Set budget</Text>
                <Ionicons name="create-outline" size={18} color={colors.accent} />
              </View>

              <View style={styles.inputRow}>
                <Ionicons name="cash-outline" size={18} color={theme.colors.muted} />
                <Text style={styles.ccy}>PKR</Text>
                <TextInput
                  value={budgetInput}
                  onChangeText={setBudgetInput}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="rgba(107,114,128,0.65)"
                  style={styles.input}
                />
              </View>

              <View style={styles.quickAdjustRow}>
                <Pressable onPress={() => bump(-5000)} style={styles.quickAdjustBtn}>
                  <Ionicons name="remove-circle-outline" size={18} color={theme.colors.text} />
                  <Text style={styles.quickAdjustText}>-5k</Text>
                </Pressable>
                <Pressable onPress={() => bump(5000)} style={styles.quickAdjustBtn}>
                  <Ionicons name="add-circle-outline" size={18} color={theme.colors.text} />
                  <Text style={styles.quickAdjustText}>+5k</Text>
                </Pressable>
                <Pressable onPress={() => bump(10000)} style={styles.quickAdjustBtn}>
                  <Ionicons name="add-circle-outline" size={18} color={theme.colors.text} />
                  <Text style={styles.quickAdjustText}>+10k</Text>
                </Pressable>
              </View>

              {/* ✅ small feature area (icons changed) */}
              <View style={styles.quickSetRow}>
                <Pressable onPress={() => quickSetPlus(50000)} style={styles.pillBtn}>
                  <Ionicons name="trending-up-outline" size={16} color={theme.colors.primary} />
                  <Text style={styles.pillText}>Add 50k</Text>
                </Pressable>

                <Pressable onPress={quickSetProjected} style={styles.pillBtnSoft}>
                  <Ionicons name="analytics-outline" size={16} color={theme.colors.text} />
                  <Text style={styles.pillTextSoft}>Use projected</Text>
                </Pressable>

                <View style={{ flex: 1 }} />

                <View style={styles.liveDotWrap}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>Live</Text>
                </View>
              </View>

              <View style={styles.rowLine}>
                <Text style={styles.rowLeftText}>Projected spend (current speed)</Text>
                <Text style={styles.rowRightText}>{formatPKR(metrics.projected)}</Text>
              </View>

              <Pressable
                disabled={!canSave}
                onPress={() => saveBudget()}
                style={({ pressed }) => [{ opacity: !canSave ? 0.55 : pressed ? 0.92 : 1, marginTop: 14 }]}
              >
                <LinearGradient
                  colors={[theme.colors.primary, theme.colors.primaryDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.saveBtn}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="save-outline" size={18} color="#fff" />
                      <Text style={styles.saveText}>Save budget</Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>

              <Text style={styles.smallMuted}>Budget updates in real time for the whole family.</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 18, backgroundColor: theme.colors.background },

  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
  headerTitleWrap: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, justifyContent: "center" },

  // ✅ glass buttons (transparent look)
  glassCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.08 : 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  glassMiniCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.32)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },

  title: { fontFamily: theme.font.bold, fontSize: 20, color: theme.colors.text },

  heroWrap: {
    marginTop: 14,
    borderRadius: theme.radius.xl,
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.08 : 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  hero: { borderRadius: theme.radius.xl, padding: 16, overflow: "hidden" },

  heroTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  heroK: { fontFamily: theme.font.medium, color: "rgba(255,255,255,0.88)", letterSpacing: 0.6 },
  heroV: { marginTop: 8, fontFamily: theme.font.bold, fontSize: 34, color: "#fff" },
  heroSub: { marginTop: 6, fontFamily: theme.font.regular, color: "rgba(255,255,255,0.92)" },

  heroMiniRow: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  healthChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  healthChipSoft: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  healthChipText: { fontFamily: theme.font.bold, color: "#fff", fontSize: 12 },

  donutWrap: { alignItems: "flex-end", justifyContent: "center" },
  donutCenter: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  donutPct: { fontFamily: theme.font.bold, fontSize: 18, color: "#fff" },
  donutLabel: { marginTop: 2, fontFamily: theme.font.medium, fontSize: 11, color: "rgba(255,255,255,0.88)" },

  progressBg: { marginTop: 14, width: "100%", height: 10, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.22)", overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.92)" },

  heroRow: { marginTop: 14, flexDirection: "row", gap: 10 },
  heroCell: { flex: 1, padding: 10, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.16)", borderWidth: 1, borderColor: "rgba(255,255,255,0.22)" },
  heroCellK: { fontFamily: theme.font.medium, color: "rgba(255,255,255,0.85)", fontSize: 12 },
  heroCellV: { marginTop: 4, fontFamily: theme.font.bold, color: "#fff", fontSize: 13 },

  heroFooter: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  heroFooterText: { fontFamily: theme.font.regular, color: "rgba(255,255,255,0.92)", fontSize: 12 },

  card: {
    marginTop: 12,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.10)",
    borderRadius: theme.radius.xl,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.05 : 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  cardTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  cardTitle: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 15 },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.10)",
    backgroundColor: "rgba(255,255,255,0.96)",
    paddingHorizontal: 12,
    gap: 10,
  },
  ccy: { fontFamily: theme.font.bold, color: theme.colors.muted },
  input: { flex: 1, fontFamily: theme.font.bold, fontSize: 16, color: theme.colors.text },

  quickAdjustRow: { marginTop: 12, flexDirection: "row", gap: 10 },
  quickAdjustBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(10,18,38,0.06)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.08)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  quickAdjustText: { fontFamily: theme.font.bold, color: theme.colors.text },

  quickSetRow: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  pillBtn: {
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(91,95,239,0.10)",
    borderWidth: 1,
    borderColor: "rgba(91,95,239,0.18)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pillText: { fontFamily: theme.font.bold, color: theme.colors.primary, fontSize: 12 },

  pillBtnSoft: {
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(10,18,38,0.06)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.08)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pillTextSoft: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 12 },

  liveDotWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(10,18,38,0.06)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.08)",
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#10B981" },
  liveText: { fontFamily: theme.font.bold, color: theme.colors.muted, fontSize: 12 },

  rowLine: { marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowLeftText: { fontFamily: theme.font.medium, color: theme.colors.muted },
  rowRightText: { fontFamily: theme.font.bold, color: theme.colors.text },

  saveBtn: { height: 54, borderRadius: 999, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10 },
  saveText: { fontFamily: theme.font.bold, color: "#fff", fontSize: 16 },

  smallMuted: { marginTop: 10, fontFamily: theme.font.regular, color: theme.colors.muted, fontSize: 12, lineHeight: 16 },

  centerBox: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  loadingText: { marginTop: 10, color: theme.colors.muted, fontFamily: theme.font.medium },

  emptyTitle: { marginTop: 10, fontFamily: theme.font.bold, fontSize: 18, color: theme.colors.text },
  emptySub: { marginTop: 6, fontFamily: theme.font.regular, color: theme.colors.muted, textAlign: "center" },
});
