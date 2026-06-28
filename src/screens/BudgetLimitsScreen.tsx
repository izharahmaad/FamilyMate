import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
  Alert,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { doc, onSnapshot, setDoc } from "firebase/firestore";

import { auth, db } from "../lib/firebase";
import { theme } from "../theme";

function money0(v: number) {
  if (!Number.isFinite(v)) return "0";
  return Math.round(v).toString();
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function cleanNumberText(s: string) {
  return (s || "").replace(/[^\d]/g, "");
}

function IconCircle({ icon, color }: { icon: keyof typeof Ionicons.glyphMap; color: string }) {
  return (
    <View style={[styles.iconCircle, { backgroundColor: `${color}14`, borderColor: `${color}2A` }]}>
      <Ionicons name={icon} size={18} color={color} />
    </View>
  );
}

export default function BudgetLimitsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [familyId, setFamilyId] = useState<string | null>(null);
  const [familyName, setFamilyName] = useState<string>("Family");

  const [monthBudgetPkr, setMonthBudgetPkr] = useState<number>(0);
  const [monthSpentPkr, setMonthSpentPkr] = useState<number>(0);

  const [draftBudget, setDraftBudget] = useState<string>("");
  const [baseBudget, setBaseBudget] = useState<number>(0);

  const userId = auth.currentUser?.uid || null;

  const userRef = useMemo(() => (userId ? doc(db, "users", userId) : null), [userId]);
  const familyRef = useMemo(() => (familyId ? doc(db, "families", familyId) : null), [familyId]);

  const userUnsubRef = useRef<null | (() => void)>(null);
  const famUnsubRef = useRef<null | (() => void)>(null);

  useEffect(() => {
    if (!userRef) return;

    userUnsubRef.current?.();
    famUnsubRef.current?.();

    userUnsubRef.current = onSnapshot(
      userRef,
      (snap) => {
        const d: any = snap.data() || {};
        const fid = (d?.familyId as string | undefined) || null;
        setFamilyId(fid);
        if (!fid) {
          setLoading(false);
          setFamilyName("Family");
          setMonthBudgetPkr(0);
          setMonthSpentPkr(0);
          setDraftBudget("0");
          setBaseBudget(0);
        }
      },
      (err) => {
        setLoading(false);
        Alert.alert("Budget Limits", err?.message || "Failed to load user");
      }
    );

    return () => {
      userUnsubRef.current?.();
      famUnsubRef.current?.();
    };
  }, [userRef]);

  useEffect(() => {
    if (!familyRef) return;

    setLoading(true);
    famUnsubRef.current?.();

    famUnsubRef.current = onSnapshot(
      familyRef,
      (snap) => {
        const f: any = snap.data() || {};
        const b = Number(f?.monthBudgetPkr ?? 0);
        const s = Number(f?.monthSpentPkr ?? 0);

        const bud = Number.isFinite(b) ? b : 0;
        const spent = Number.isFinite(s) ? s : 0;

        setFamilyName(f?.name || "Family");
        setMonthBudgetPkr(bud);
        setMonthSpentPkr(spent);

        setDraftBudget(String(Math.round(bud)));
        setBaseBudget(Math.round(bud));
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        Alert.alert("Budget Limits", err?.message || "Failed to load family");
      }
    );

    return () => famUnsubRef.current?.();
  }, [familyRef]);

  const usedPct = monthBudgetPkr > 0 ? Math.round((monthSpentPkr / monthBudgetPkr) * 100) : 0;
  const progress = monthBudgetPkr > 0 ? clamp01(monthSpentPkr / monthBudgetPkr) : 0;

  const remaining = monthBudgetPkr - monthSpentPkr;
  const remainingColor = remaining < 0 ? "#EF4444" : remaining < monthBudgetPkr * 0.15 ? "#F59E0B" : "#10B981";

  const isDirty = useMemo(() => {
    const v = Number(cleanNumberText(draftBudget) || 0);
    return Math.round(v) !== Math.round(baseBudget || 0);
  }, [draftBudget, baseBudget]);

  const canSave = useMemo(() => {
    const v = Number(cleanNumberText(draftBudget) || 0);
    return Number.isFinite(v) && v >= 0 && !saving && !!familyRef;
  }, [draftBudget, saving, familyRef]);

  const saveBudget = async () => {
    if (!familyRef) {
      Alert.alert("Budget Limits", "No family linked.");
      return;
    }

    const next = Number(cleanNumberText(draftBudget) || 0);
    if (!Number.isFinite(next) || next < 0) {
      Alert.alert("Budget Limits", "Please enter a valid number.");
      return;
    }

    try {
      setSaving(true);
      await setDoc(familyRef, { monthBudgetPkr: Math.round(next) }, { merge: true });
    } catch (e: any) {
      Alert.alert("Budget Limits", e?.message || "Could not update budget");
    } finally {
      setSaving(false);
    }
  };

  const resetDraft = () => setDraftBudget(String(Math.round(monthBudgetPkr || 0)));

  const applyPreset = (mode: "starter" | "balanced" | "aggressive") => {
    const spent = Math.max(0, Number(monthSpentPkr || 0));
    const bud = Math.max(0, Number(monthBudgetPkr || 0));

    if (mode === "starter") {
      const next = Math.max(bud, spent + 30000);
      setDraftBudget(String(Math.round(next)));
      return;
    }
    if (mode === "balanced") {
      const next = Math.max(bud, spent > 0 ? spent / 0.75 : bud);
      setDraftBudget(String(Math.round(next)));
      return;
    }
    const next = Math.max(bud, spent > 0 ? spent / 0.6 : bud);
    setDraftBudget(String(Math.round(next)));
  };

  const setToSpent = () => {
    const next = Math.max(0, Math.round(monthSpentPkr || 0));
    setDraftBudget(String(next));
  };

  const setWatch80 = () => {
    const spent = Math.max(0, Number(monthSpentPkr || 0));
    const next = spent > 0 ? Math.round(spent / 0.8) : 0;
    setDraftBudget(String(next));
  };

  const help = () => {
    Alert.alert("Budget tools", "Use presets or rules, then tap Save. Changes apply to the whole family.");
  };

  const topRight = () => {
    Alert.alert("Insights", `Used ${usedPct}%. Remaining ${money0(remaining)} PKR.`);
  };

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 10) }]}>
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(10,18,38,0.16)", "rgba(10,18,38,0.04)", "rgba(10,18,38,0.10)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.glassCircle}>
            <Ionicons name="chevron-back" size={18} color={theme.colors.text} />
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Budget Limits</Text>
            <Text style={styles.subTitle}>{familyName}</Text>
          </View>

          <Pressable onPress={topRight} hitSlop={10} style={styles.glassCircle}>
            <Ionicons name="stats-chart-outline" size={18} color={theme.colors.text} />
          </Pressable>

          {(loading || saving) ? <ActivityIndicator color={theme.colors.primary} /> : null}
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 92 + Math.max(insets.bottom, 10) }}
          keyboardShouldPersistTaps="handled"
        >
          <LinearGradient
            colors={[theme.colors.primary, theme.colors.primaryDark, "#0B1220"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <LinearGradient
              pointerEvents="none"
              colors={["#2559c2", "#0a0a2e", "#112B5C"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />

            <View style={styles.heroTop}>
              <View style={styles.heroPill}>
                <Ionicons name="pie-chart-outline" size={12} color="rgba(255,255,255,0.95)" />
                <Text style={styles.heroPillText}>{usedPct}% used</Text>
              </View>

              <View style={styles.heroPill}>
                <Ionicons name="wallet-outline" size={12} color="rgba(255,255,255,0.95)" />
                <Text style={styles.heroPillText}>PKR</Text>
              </View>
            </View>

            <Text style={styles.heroK}>This month</Text>
            <Text style={styles.heroV}>
              {money0(monthSpentPkr)} / {money0(monthBudgetPkr)} PKR
            </Text>

            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>

            <View style={styles.heroBottomRow}>
              <View style={styles.heroMini}>
                <Text style={styles.heroMiniK}>Remaining</Text>
                <Text style={[styles.heroMiniV, { color: remainingColor }]}>{money0(remaining)} PKR</Text>
              </View>
              <View style={styles.heroMini}>
                <Text style={styles.heroMiniK}>Spent</Text>
                <Text style={styles.heroMiniV}>{money0(monthSpentPkr)} PKR</Text>
              </View>
              <View style={styles.heroMini}>
                <Text style={styles.heroMiniK}>Limit</Text>
                <Text style={styles.heroMiniV}>{money0(monthBudgetPkr)} PKR</Text>
              </View>
            </View>
          </LinearGradient>

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <IconCircle icon="create-outline" color="#F59E0B" />
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Set monthly limit</Text>
                <Text style={styles.sectionSub}>Edit the family monthly budget.</Text>
              </View>

              {isDirty ? (
                <Pressable onPress={resetDraft} hitSlop={10} style={styles.smallGhost}>
                  <Ionicons name="refresh-outline" size={16} color={theme.colors.text} />
                </Pressable>
              ) : (
                <Pressable onPress={help} hitSlop={10} style={styles.smallGhost}>
                  <Ionicons name="help-circle-outline" size={18} color={theme.colors.text} />
                </Pressable>
              )}
            </View>

            <View style={styles.divider} />

            <View style={styles.inputRow}>
              <Text style={styles.currencyTag}>PKR</Text>
              <TextInput
                value={draftBudget}
                onChangeText={setDraftBudget}
                placeholder="Monthly limit"
                placeholderTextColor="rgba(100,116,139,0.8)"
                keyboardType="number-pad"
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <IconCircle icon="options-outline" color={theme.colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Presets</Text>
                <Text style={styles.sectionSub}>One-tap budget suggestions based on current spending.</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.bigActions}>
              <Pressable onPress={() => applyPreset("starter")} style={({ pressed }) => [styles.bigAction, pressed && { opacity: 0.92 }]}>
                <Ionicons name="rocket-outline" size={18} color={theme.colors.text} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.bigActionTitle}>Starter</Text>
                  <Text style={styles.bigActionSub}>Adds a small buffer above current spend.</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
              </Pressable>

              <Pressable onPress={() => applyPreset("balanced")} style={({ pressed }) => [styles.bigAction, pressed && { opacity: 0.92 }]}>
                <Ionicons name="speedometer-outline" size={18} color={theme.colors.text} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.bigActionTitle}>Balanced</Text>
                  <Text style={styles.bigActionSub}>Targets ~75% usage for safety.</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
              </Pressable>

              <Pressable onPress={() => applyPreset("aggressive")} style={({ pressed }) => [styles.bigAction, pressed && { opacity: 0.92 }]}>
                <Ionicons name="flame-outline" size={18} color={theme.colors.text} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.bigActionTitle}>Aggressive</Text>
                  <Text style={styles.bigActionSub}>Higher buffer for heavy months.</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
              </Pressable>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <IconCircle icon="shield-checkmark-outline" color="#10B981" />
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Rules</Text>
                <Text style={styles.sectionSub}>Quick fixes based on budget health.</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.bigActions}>
              <Pressable onPress={setToSpent} style={({ pressed }) => [styles.bigAction, pressed && { opacity: 0.92 }]}>
                <Ionicons name="checkmark-circle-outline" size={18} color={theme.colors.text} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.bigActionTitle}>Set to spent</Text>
                  <Text style={styles.bigActionSub}>Makes remaining = 0 for this month.</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
              </Pressable>

              <Pressable onPress={setWatch80} style={({ pressed }) => [styles.bigAction, pressed && { opacity: 0.92 }]}>
                <Ionicons name="warning-outline" size={18} color={theme.colors.text} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.bigActionTitle}>80% watch line</Text>
                  <Text style={styles.bigActionSub}>Sets limit so spent becomes 80%.</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
              </Pressable>
            </View>
          </View>
        </ScrollView>

        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <Pressable
            disabled={!canSave}
            onPress={saveBudget}
            style={({ pressed }) => [{ opacity: !canSave ? 0.55 : pressed ? 0.92 : 1 }]}
          >
            <LinearGradient
              colors={[theme.colors.primary, theme.colors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.longBtn}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={18} color="#fff" />
                  <Text style={styles.longBtnText}>Save changes</Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 18, backgroundColor: theme.colors.background },

  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingBottom: 10 },
  title: { fontFamily: theme.font.bold, fontSize: 18, color: theme.colors.text },
  subTitle: { marginTop: 2, fontFamily: theme.font.medium, fontSize: 12, color: theme.colors.muted },

  glassCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
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

  hero: {
    marginTop: 10,
    borderRadius: 26,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.12 : 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 14 },
    elevation: 4,
    overflow: "hidden",
  },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
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

  heroK: { marginTop: 14, fontFamily: theme.font.medium, color: "rgba(255,255,255,0.88)", fontSize: 12 },
  heroV: { marginTop: 6, fontFamily: theme.font.bold, color: "#fff", fontSize: 18 },

  progressTrack: { marginTop: 12, height: 10, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.18)", overflow: "hidden" },
  progressFill: { height: 10, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.92)" },

  heroBottomRow: { marginTop: 14, flexDirection: "row", gap: 10 },
  heroMini: { flex: 1, borderRadius: 18, padding: 10, backgroundColor: "rgba(255,255,255,0.14)", borderWidth: 1, borderColor: "rgba(255,255,255,0.20)" },
  heroMiniK: { fontFamily: theme.font.medium, color: "rgba(255,255,255,0.85)", fontSize: 11 },
  heroMiniV: { marginTop: 4, fontFamily: theme.font.bold, color: "#fff", fontSize: 12 },

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

  iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1 },

  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  sectionTitle: { fontFamily: theme.font.bold, fontSize: 14, color: theme.colors.text },
  sectionSub: { marginTop: 3, fontFamily: theme.font.regular, fontSize: 12, color: theme.colors.muted, lineHeight: 16 },

  divider: { height: 1, backgroundColor: "rgba(17,24,39,0.06)", marginLeft: 14 },

  inputRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 14 },
  currencyTag: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(17,24,39,0.06)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.10)",
    fontFamily: theme.font.bold,
    color: theme.colors.text,
  },
  input: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    paddingHorizontal: 14,
    backgroundColor: "rgba(255,255,255,0.90)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.08)",
    fontFamily: theme.font.bold,
    color: theme.colors.text,
  },

  smallGhost: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(17,24,39,0.06)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },

  bigActions: { paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  bigAction: {
    height: 58,
    borderRadius: 18,
    paddingHorizontal: 14,
    backgroundColor: "rgba(10,18,38,0.06)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.08)",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  bigActionTitle: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 13 },
  bigActionSub: { marginTop: 2, fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 11 },

  bottomBar: {
    borderTopWidth: 1,
    borderTopColor: "rgba(17,24,39,0.08)",
    paddingTop: 10,
    backgroundColor: "rgba(255,255,255,0.42)",
  },
  longBtn: {
    height: 54,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  longBtnText: { fontFamily: theme.font.bold, color: "#fff", fontSize: 16 },
});
