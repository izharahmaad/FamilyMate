import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Platform,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "../theme";

function daysInMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function toNumberSafe(s: string) {
  const x = Number(String(s).replace(/,/g, "").trim());
  return Number.isFinite(x) ? x : 0;
}

const STORAGE_KEY = "fixed_daily_monthly_amount";

// VIP gradient ONLY for Monthly plan section
const VIP_GRAD = ["#2559c2", "#0a0a2e", "#112B5C"] as const;

export default function FixedDailyPlanScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [monthly, setMonthly] = useState("");

  const now = new Date();
  const nDays = daysInMonth(now);
  const today = now.getDate();

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) setMonthly(saved);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, monthly);
      } catch {}
    })();
  }, [monthly]);

  const monthlyValue = useMemo(() => toNumberSafe(monthly), [monthly]);
  const perDay = useMemo(() => (nDays > 0 ? monthlyValue / nDays : 0), [monthlyValue, nDays]);
  const shouldHaveSpent = useMemo(() => perDay * today, [perDay, today]);
  const remaining = useMemo(() => monthlyValue - shouldHaveSpent, [monthlyValue, shouldHaveSpent]);
  const monthProgress = useMemo(() => (nDays > 0 ? (today / nDays) * 100 : 0), [today, nDays]);

  const rows = useMemo(() => {
    const out: { day: number; cost: number; status: "past" | "today" | "future" }[] = [];
    for (let i = 1; i <= nDays; i++) {
      let status: "past" | "today" | "future" = "future";
      if (i < today) status = "past";
      else if (i === today) status = "today";
      out.push({ day: i, cost: perDay, status });
    }
    return out;
  }, [nDays, perDay, today]);

  const applyPreset = (value: number) => setMonthly(String(value));

  const monthName = now.toLocaleString("en-US", { month: "long" });
  const headerSubtitle = `${monthName} • ${nDays} days`;

  const PURPLE = theme.colors.primary;

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 10) }]}>
      {/* Subtle app background like other screens */}
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(11,18,32,0.10)", "rgba(11,18,32,0.03)", "rgba(11,18,32,0.08)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* HEADER */}
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={theme.colors.text} />
        </Pressable>

        <View style={styles.headerCenter}>
          <View style={styles.headerIconCircle}>
            <Ionicons name="wallet-outline" size={18} color={PURPLE} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Daily budget plan</Text>
            <Text style={styles.headerSubtitle}>Split one monthly amount into calm daily spend</Text>
          </View>
        </View>

        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 28 + Math.max(insets.bottom, 10),
        }}
      >
        {/* MONTHLY PLAN (VIP GRADIENT) */}
        <View style={{ paddingHorizontal: 18 }}>
          <LinearGradient colors={VIP_GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
            {/* Shine */}
            <LinearGradient
              pointerEvents="none"
              colors={["rgba(255,255,255,0.12)", "rgba(255,255,255,0.00)"]}
              start={{ x: 0.12, y: 0 }}
              end={{ x: 0.88, y: 1 }}
              style={StyleSheet.absoluteFill}
            />

            <View style={styles.heroTopRow}>
              <View>
                <Text style={styles.heroK}>Monthly plan</Text>
                <Text style={styles.heroTitle}>{headerSubtitle}</Text>
              </View>

              <View style={styles.heroBadge}>
                <Ionicons name="calendar-outline" size={16} color="#FACC15" />
                <Text style={styles.heroBadgeText}>Day {today}</Text>
              </View>
            </View>

            <View style={styles.heroAmountRow}>
              <Text style={styles.heroAmount}>{monthlyValue ? monthlyValue.toLocaleString() : "0"}</Text>
              <Text style={styles.heroUnit}> PKR</Text>
            </View>

            <View style={styles.heroRow}>
              <View style={styles.heroChip}>
                <Ionicons name="cash-outline" size={14} color="#E5E7EB" />
                <Text style={styles.heroChipText}>Per day: {perDay.toFixed(0)} PKR</Text>
              </View>
              <View style={styles.heroChip}>
                <Ionicons name="trending-up-outline" size={14} color="#E5E7EB" />
                <Text style={styles.heroChipText}>Should spent: {shouldHaveSpent.toFixed(0)} PKR</Text>
              </View>
            </View>

            <View style={styles.heroProgressRow}>
              <Text style={styles.heroProgressLabel}>Month progress • {monthProgress.toFixed(0)}%</Text>
              <View style={styles.heroProgressTrack}>
                <View
                  style={[
                    styles.heroProgressFill,
                    { width: `${Math.max(0, Math.min(100, monthProgress))}%` },
                  ]}
                />
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* INPUT + SUMMARY CARD */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Monthly fixed amount</Text>
          <Text style={styles.fieldHint}>Salary or fixed expenses you want to spread across this month.</Text>

          <View style={styles.inputRow}>
            <Text style={styles.currencyLabel}>PKR</Text>
            <TextInput
              value={monthly}
              onChangeText={setMonthly}
              placeholder="10,000"
              keyboardType="numeric"
              style={styles.input}
              placeholderTextColor={"rgba(148,163,184,0.9)"}
            />
          </View>

          <View style={styles.presetsRow}>
            {[10000, 20000, 50000].map((v) => (
              <Pressable key={v} onPress={() => applyPreset(v)} style={styles.presetChip}>
                <Text style={styles.presetText}>{v.toLocaleString()}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryK}>Days in month</Text>
              <Text style={styles.summaryV}>{nDays}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryK}>Per day</Text>
              <Text style={styles.summaryV}>{perDay.toFixed(2)} PKR</Text>
            </View>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryK}>Should spent till today</Text>
              <Text style={styles.summaryV}>{shouldHaveSpent.toFixed(0)} PKR</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryK}>Remaining (planned)</Text>
              <Text style={styles.summaryV}>{remaining.toFixed(0)} PKR</Text>
            </View>
          </View>
        </View>

        {/* DAY LIST */}
        <View style={{ paddingHorizontal: 18, marginTop: 8 }}>
          <Text style={styles.listTitle}>Day-by-day view</Text>
          <Text style={styles.listSub}>Past days are checked, today is highlighted, future days stay clean.</Text>
        </View>

        <View style={{ paddingHorizontal: 18, marginTop: 10 }}>
          {rows.map((r) => {
            const isPast = r.status === "past";
            const isToday = r.status === "today";

            return (
              <View
                key={r.day}
                style={[
                  styles.dayRow,
                  isPast && styles.dayRowPast,
                  isToday && styles.dayRowToday,
                ]}
              >
                <View style={styles.dayLeftBlock}>
                  {isPast ? (
                    <View style={styles.iconCirclePast}>
                      <Ionicons name="checkmark" size={14} color="#10B981" />
                    </View>
                  ) : isToday ? (
                    <View style={styles.iconCircleToday}>
                      <Ionicons name="ellipse" size={10} color={PURPLE} />
                    </View>
                  ) : (
                    <View style={styles.iconCircleFuture} />
                  )}

                  <View>
                    <Text style={styles.dayLabel}>Day {r.day}</Text>
                    <Text style={styles.dayStatus}>{isPast ? "Completed" : isToday ? "Today" : "Upcoming"}</Text>
                  </View>
                </View>

                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.dayAmount}>{r.cost.toFixed(0)} PKR</Text>
                  <Text style={styles.dayAmountSub}>planned</Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },

  headerRow: {
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    justifyContent: "center",
  },
  headerIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(129,140,248,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 16 },
  headerSubtitle: { fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 11 },

  heroCard: {
    borderRadius: 24,
    padding: 16,
    marginTop: 4,
    overflow: "hidden",
    shadowColor: "#0a0a2e",
    shadowOpacity: Platform.OS === "ios" ? 0.22 : 0.30,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6,
  },
  heroTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heroK: { fontFamily: theme.font.medium, color: "rgba(226,232,240,0.95)", fontSize: 12, letterSpacing: 0.6 },
  heroTitle: { marginTop: 2, fontFamily: theme.font.bold, color: "#FFFFFF", fontSize: 16 },
  heroBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(15,23,42,0.35)" },
  heroBadgeText: { fontFamily: theme.font.bold, fontSize: 12, color: "#FACC15" },
  heroAmountRow: { flexDirection: "row", alignItems: "flex-end", marginTop: 14 },
  heroAmount: { fontFamily: theme.font.bold, fontSize: 30, color: "#FFFFFF" },
  heroUnit: { fontFamily: theme.font.medium, fontSize: 14, color: "rgba(241,245,249,0.9)", marginLeft: 4, marginBottom: 4 },
  heroRow: { marginTop: 12, flexDirection: "row", gap: 10 },
  heroChip: { flex: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(15,23,42,0.35)" },
  heroChipText: { fontFamily: theme.font.medium, color: "rgba(241,245,249,0.92)", fontSize: 12 },
  heroProgressRow: { marginTop: 14 },
  heroProgressLabel: { fontFamily: theme.font.medium, color: "rgba(226,232,240,0.9)", fontSize: 11, marginBottom: 4 },
  heroProgressTrack: { height: 8, borderRadius: 999, backgroundColor: "rgba(15,23,42,0.45)", overflow: "hidden" },
  heroProgressFill: { height: 8, borderRadius: 999, backgroundColor: "#FACC15" },

  card: {
    marginTop: 14,
    marginHorizontal: 18,
    backgroundColor: "rgba(255,255,255,0.97)",
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.05 : 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  fieldLabel: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 13 },
  fieldHint: { marginTop: 3, fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 11 },

  inputRow: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 10 },
  currencyLabel: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(15,23,42,0.04)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)",
    fontFamily: theme.font.bold,
    color: theme.colors.text,
    fontSize: 13,
  },
  input: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    paddingHorizontal: 12,
    backgroundColor: "rgba(248,250,252,0.9)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.5)",
    fontFamily: theme.font.bold,
    color: theme.colors.text,
    fontSize: 15,
  },

  presetsRow: { marginTop: 10, flexDirection: "row", gap: 8 },
  presetChip: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.5)",
    backgroundColor: "rgba(248,250,252,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  presetText: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 12 },

  summaryRow: { marginTop: 12, flexDirection: "row", gap: 10 },
  summaryItem: { flex: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: "rgba(248,250,252,0.9)" },
  summaryK: { fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 11 },
  summaryV: { marginTop: 4, fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 13 },

  listTitle: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 16 },
  listSub: { marginTop: 2, fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 11 },

  dayRow: {
    backgroundColor: "rgba(255,255,255,0.97)",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  dayRowPast: { backgroundColor: "rgba(16,185,129,0.04)", borderColor: "rgba(16,185,129,0.25)" },
  dayRowToday: { backgroundColor: "rgba(79,70,229,0.05)", borderColor: "rgba(79,70,229,0.35)" },

  dayLeftBlock: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconCirclePast: { width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(16,185,129,0.15)", alignItems: "center", justifyContent: "center" },
  iconCircleToday: { width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(79,70,229,0.15)", alignItems: "center", justifyContent: "center" },
  iconCircleFuture: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: "rgba(148,163,184,0.55)" },

  dayLabel: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 13 },
  dayStatus: { marginTop: 2, fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 11 },
  dayAmount: { fontFamily: theme.font.bold, color: theme.colors.primary, fontSize: 13 },
  dayAmountSub: { marginTop: 2, fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 11 },
});
