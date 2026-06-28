import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  StatusBar,
  Platform,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { doc, onSnapshot, collection, limit, orderBy, query } from "firebase/firestore";
import Svg, { Path, Defs, LinearGradient as SvgLG, Stop, Circle, Line } from "react-native-svg";

// ✅ added for typing (fix red underline on navigate)
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";

import { theme } from "../theme";
import { auth, db } from "../lib/firebase";

type Activity = {
  id: string;
  title: string;
  by: string;
  when: string;
  amount: number;
  currency: string;
  receiptUrl?: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  category?: string;
  createdAt?: any;
  dateISO?: string;
};

type WaveRange = "day" | "week" | "month" | "year";

const ORANGE = "#F59E0B";
const GREEN = "#10B981";
const RED = "#EF4444";

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}
function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function money0(v: number) {
  if (!Number.isFinite(v)) return "0";
  return Math.round(v).toString();
}
function money2(v: number) {
  if (!Number.isFinite(v)) return "0.00";
  return v.toFixed(2);
}
function monthShort(i: number) {
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][i] || "";
}
function weekdayShort(d: Date) {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
}

function Card({ children, style }: any) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function IconCircleButton({
  icon,
  onPress,
  dot,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  dot?: boolean;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={10} style={styles.iconCircleBtn}>
      <Ionicons name={icon} size={20} color={theme.colors.text} />
      {dot ? <View style={styles.notifDot} /> : null}
    </Pressable>
  );
}

function Chip({
  icon,
  text,
  tone = "primary",
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  tone?: "primary" | "orange" | "green" | "red";
}) {
  const c = tone === "orange" ? ORANGE : tone === "green" ? GREEN : tone === "red" ? RED : theme.colors.primary;

  const bg =
    tone === "orange"
      ? "rgba(245,158,11,0.12)"
      : tone === "green"
      ? "rgba(16,185,129,0.12)"
      : tone === "red"
      ? "rgba(239,68,68,0.10)"
      : "rgba(91,95,239,0.10)";

  const br =
    tone === "orange"
      ? "rgba(245,158,11,0.20)"
      : tone === "green"
      ? "rgba(16,185,129,0.20)"
      : tone === "red"
      ? "rgba(239,68,68,0.18)"
      : "rgba(91,95,239,0.16)";

  return (
    <View style={[styles.chip, { backgroundColor: bg, borderColor: br }]}>
      <Ionicons name={icon} size={14} color={c} />
      <Text style={[styles.chipText, { color: c }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

function ProgressBar({ value, accent = theme.colors.primary }: { value: number; accent?: string }) {
  const v = clamp01(value);
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${v * 100}%`, backgroundColor: accent }]} />
    </View>
  );
}

function ShortcutCircle({
  icon,
  label,
  onPress,
  tone = "neutral",
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  tone?: "neutral" | "primary" | "orange";
}) {
  const ring =
    tone === "orange"
      ? "rgba(245,158,11,0.22)"
      : tone === "primary"
      ? "rgba(91,95,239,0.22)"
      : "rgba(17,24,39,0.10)";

  const bg =
    tone === "orange"
      ? "rgba(245,158,11,0.10)"
      : tone === "primary"
      ? "rgba(91,95,239,0.10)"
      : "rgba(17,24,39,0.02)";

  const iconColor = tone === "orange" ? ORANGE : theme.colors.primary;

  return (
    <Pressable onPress={onPress} style={styles.shortcutCircleItem}>
      <View style={[styles.shortcutCircle, { backgroundColor: bg, borderColor: ring }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <Text style={styles.shortcutCircleText} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function SmallPill({
  icon,
  title,
  value,
  tone = "neutral",
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  value: string;
  tone?: "neutral" | "orange" | "green" | "primary";
}) {
  const bg =
    tone === "orange"
      ? "rgba(245,158,11,0.10)"
      : tone === "green"
      ? "rgba(16,185,129,0.10)"
      : tone === "primary"
      ? "rgba(91,95,239,0.09)"
      : "rgba(17,24,39,0.03)";

  const br =
    tone === "orange"
      ? "rgba(245,158,11,0.18)"
      : tone === "green"
      ? "rgba(16,185,129,0.16)"
      : tone === "primary"
      ? "rgba(91,95,239,0.16)"
      : "rgba(17,24,39,0.08)";

  const ic =
    tone === "orange"
      ? ORANGE
      : tone === "green"
      ? GREEN
      : tone === "primary"
      ? theme.colors.primary
      : theme.colors.muted;

  return (
    <View style={[styles.smallPill, { backgroundColor: bg, borderColor: br }]}>
      <View style={styles.smallPillIcon}>
        <Ionicons name={icon} size={16} color={ic} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.smallPillTitle}>{title}</Text>
        <Text style={styles.smallPillValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function ActivityRow({ item }: { item: Activity }) {
  const amountAbs = Math.abs(item.amount);
  const isExpense = item.amount >= 0;
  const sign = isExpense ? "-" : "+";
  const amountColor = isExpense ? theme.colors.text : GREEN;

  return (
    <View style={styles.activityRow}>
      <View style={[styles.activityIcon, { backgroundColor: item.tint }]}>
        <Ionicons name={item.icon} size={20} color={theme.colors.text} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.activityTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.activityMeta} numberOfLines={1}>
          {item.by} • {item.when}
          {item.receiptUrl ? " • Receipt" : ""}
        </Text>
      </View>

      <View style={{ alignItems: "flex-end" }}>
        <Text style={[styles.activityAmount, { color: amountColor }]}>
          {sign}
          {money2(amountAbs)}
        </Text>
        <Text style={styles.activityCurrency}>{item.currency}</Text>
      </View>
    </View>
  );
}

function catStyle(cat?: string) {
  const c = (cat || "").toLowerCase();
  if (c.includes("rent") || c.includes("house")) {
    return { icon: "home-outline" as const, color: "#6366F1", bg: "rgba(99,102,241,0.12)", br: "rgba(99,102,241,0.20)" };
  }
  if (c.includes("bill") || c.includes("utility") || c.includes("electric")) {
    return { icon: "flash-outline" as const, color: ORANGE, bg: "rgba(245,158,11,0.12)", br: "rgba(245,158,11,0.20)" };
  }
  if (c.includes("food") || c.includes("restaurant")) {
    return { icon: "restaurant-outline" as const, color: "#EC4899", bg: "rgba(236,72,153,0.10)", br: "rgba(236,72,153,0.18)" };
  }
  if (c.includes("fuel") || c.includes("petrol") || c.includes("trans")) {
    return { icon: "car-outline" as const, color: "#0EA5E9", bg: "rgba(14,165,233,0.10)", br: "rgba(14,165,233,0.18)" };
  }
  if (c.includes("shopping")) {
    return { icon: "bag-handle-outline" as const, color: "#8B5CF6", bg: "rgba(139,92,246,0.10)", br: "rgba(139,92,246,0.18)" };
  }
  return { icon: "pricetag-outline" as const, color: theme.colors.primary, bg: "rgba(91,95,239,0.10)", br: "rgba(91,95,239,0.16)" };
}

function WaveChart({
  buckets,
  accent = "#5B5FEF",
  onPress,
  labels,
}: {
  buckets: number[];
  accent?: string;
  onPress?: () => void;
  labels: string[];
}) {
  const W = 360;
  const H = 190;
  const P = 16;

  const vals = buckets.map((v) => Math.abs(v));
  const max = Math.max(...vals, 1);

  const denom = Math.max(buckets.length - 1, 1);
  const pts = vals.map((v, i) => {
    const x = P + (i * (W - P * 2)) / denom;
    const y = P + (1 - v / max) * (H - P * 2);
    return { x, y };
  });

  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const cx = (pts[i].x + pts[i + 1].x) / 2;
    const cy = (pts[i].y + pts[i + 1].y) / 2;
    d += ` Q ${pts[i].x} ${pts[i].y} ${cx} ${cy}`;
  }
  d += ` T ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;

  const area = `${d} L ${pts[pts.length - 1].x} ${H - P} L ${pts[0].x} ${H - P} Z`;
  const gridColor = "rgba(15,23,42,0.06)";

  const gridV = Math.min(7, Math.max(4, buckets.length));

  return (
    <Pressable onPress={onPress} style={{ marginTop: 12 }}>
      <View style={styles.waveBox}>
        <Svg pointerEvents="none" width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
          <Defs>
            <SvgLG id="fill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={accent} stopOpacity="0.20" />
              <Stop offset="1" stopColor={accent} stopOpacity="0.02" />
            </SvgLG>
            <SvgLG id="stroke" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={accent} stopOpacity="0.55" />
              <Stop offset="1" stopColor={accent} stopOpacity="1" />
            </SvgLG>
          </Defs>

          {Array.from({ length: 5 }).map((_, i) => {
            const y = P + (i * (H - P * 2)) / 4;
            return (
              <Line
                key={`h-${i}`}
                x1={P}
                y1={y}
                x2={W - P}
                y2={y}
                stroke={gridColor}
                strokeWidth={1}
                strokeDasharray="4 6"
              />
            );
          })}

          {Array.from({ length: gridV }).map((_, i) => {
            const x = P + (i * (W - P * 2)) / Math.max(gridV - 1, 1);
            return (
              <Line
                key={`v-${i}`}
                x1={x}
                y1={P}
                x2={x}
                y2={H - P}
                stroke={gridColor}
                strokeWidth={1}
                strokeDasharray="3 7"
              />
            );
          })}

          <Path d={area} fill="url(#fill)" />
          <Path d={d} fill="none" stroke="url(#stroke)" strokeWidth={4} strokeLinecap="round" />

          {pts.map((p, idx) => (
            <Circle key={idx} cx={p.x} cy={p.y} r={5} fill="#fff" stroke={accent} strokeWidth={2} />
          ))}
        </Svg>

        <View style={styles.waveDaysRow}>
          {labels.map((x, idx) => (
            <Text key={`${x}-${idx}`} style={styles.waveDay} numberOfLines={1}>
              {x}
            </Text>
          ))}
        </View>

        <View style={styles.waveLegendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: accent }]} />
            <Text style={styles.legendText}>Tap for details</Text>
          </View>
          <Text style={styles.legendText}>Max: {money0(max)} PKR</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function HomeScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const uid = auth.currentUser?.uid || null;

  const [setupLoading, setSetupLoading] = useState(true);
  const [familyId, setFamilyId] = useState<string | null>(null);

  const [familyName, setFamilyName] = useState("Family");
  const [familyPhotoURL, setFamilyPhotoURL] = useState<string | null>(null);

  const [membersCount, setMembersCount] = useState(0);

  const [monthBudgetPkr, setMonthBudgetPkr] = useState(0);
  const [monthSpentPkr, setMonthSpentPkr] = useState(0);

  const [transactions, setTransactions] = useState<Activity[]>([]);
  const [allTx, setAllTx] = useState<Activity[]>([]);

  const [waveRange, setWaveRange] = useState<WaveRange>("week");
  const [waveModalOpen, setWaveModalOpen] = useState(false);

  const familyUnsubRef = useRef<null | (() => void)>(null);
  const membersUnsubRef = useRef<null | (() => void)>(null);
  const txRecentUnsubRef = useRef<null | (() => void)>(null);
  const txAllUnsubRef = useRef<null | (() => void)>(null);

  // ✅ typed root navigation (fix red underline) [web:322]
  function rootNav() {
    return (
      (navigation?.getParent?.("RootStack") as NativeStackNavigationProp<RootStackParamList> | undefined) ??
      (navigation as NativeStackNavigationProp<RootStackParamList>)
    );
  }

  const goBudget = () => navigation.navigate("Budget");

  useEffect(() => {
    familyUnsubRef.current?.();
    membersUnsubRef.current?.();
    txRecentUnsubRef.current?.();
    txAllUnsubRef.current?.();

    familyUnsubRef.current = null;
    membersUnsubRef.current = null;
    txRecentUnsubRef.current = null;
    txAllUnsubRef.current = null;

    setSetupLoading(true);
    setFamilyId(null);
    setFamilyName("Family");
    setFamilyPhotoURL(null);
    setMembersCount(0);
    setMonthBudgetPkr(0);
    setMonthSpentPkr(0);
    setTransactions([]);
    setAllTx([]);

    if (!uid) {
      setSetupLoading(false);
      return;
    }

    const unsubUser = onSnapshot(
      doc(db, "users", uid),
      (snap) => {
        if (!snap.exists()) {
          setSetupLoading(true);
          setFamilyId(null);
          return;
        }

        const userData = snap.data() as any;
        const fid = userData?.familyId as string | undefined;

        if (!fid) {
          setSetupLoading(true);
          setFamilyId(null);
          return;
        }

        setFamilyId(fid);

        familyUnsubRef.current?.();
        membersUnsubRef.current?.();
        txRecentUnsubRef.current?.();
        txAllUnsubRef.current?.();

        familyUnsubRef.current = onSnapshot(
          doc(db, "families", fid),
          (fSnap) => {
            if (!fSnap.exists()) {
              setSetupLoading(true);
              return;
            }
            const f = fSnap.data() as any;
            setFamilyName(f?.name || "Family");
            const b64 = (f?.photoBase64 || "") as string;
            setFamilyPhotoURL(b64 ? `data:image/jpeg;base64,${b64}` : null);

            setMonthBudgetPkr(Number(f?.monthBudgetPkr ?? 0));
            setMonthSpentPkr(Number(f?.monthSpentPkr ?? 0));

            setSetupLoading(false);
          },
          (err) => {
            console.log("Family snapshot error:", err);
            setSetupLoading(false);
          }
        );

        membersUnsubRef.current = onSnapshot(
          collection(db, "families", fid, "members"),
          (qSnap) => setMembersCount(qSnap.size),
          (err) => console.log("Members snapshot error:", err)
        );

        const txRef = collection(db, "families", fid, "transactions");

        txRecentUnsubRef.current = onSnapshot(
          query(txRef, orderBy("createdAt", "desc"), limit(3)),
          (qSnap) => {
            const rows: Activity[] = qSnap.docs.map((d) => {
              const x = d.data() as any;
              const amount = Number(x?.amountPkr ?? x?.amount ?? x?.amountKwd ?? 0);
              const currency = (x?.currency || "PKR") as string;
              const ts = x?.createdAt?.toDate ? x.createdAt.toDate() : null;
              const when = ts ? ts.toLocaleString() : x?.dateISO || "Now";
              const cs = catStyle(x?.category);

              return {
                id: d.id,
                title: x?.title || "Transaction",
                by: x?.byName || "Member",
                when,
                amount,
                currency,
                receiptUrl: x?.receiptUrl || "",
                icon: cs.icon,
                tint: amount >= 0 ? "rgba(239, 68, 68, 0.10)" : "rgba(16, 185, 129, 0.12)",
                category: x?.category || "other",
                createdAt: x?.createdAt,
                dateISO: x?.dateISO,
              };
            });
            setTransactions(rows);
          },
          (err) => console.log("Transactions snapshot error:", err)
        );

        txAllUnsubRef.current = onSnapshot(
          query(txRef, orderBy("createdAt", "desc"), limit(365)),
          (qSnap) => {
            const rows: Activity[] = qSnap.docs.map((d) => {
              const x = d.data() as any;
              const amount = Number(x?.amountPkr ?? x?.amount ?? x?.amountKwd ?? 0);
              const currency = (x?.currency || "PKR") as string;
              const ts = x?.createdAt?.toDate ? x.createdAt.toDate() : null;
              const when = ts ? ts.toLocaleString() : x?.dateISO || "Now";
              const cs = catStyle(x?.category);

              return {
                id: d.id,
                title: x?.title || "Transaction",
                by: x?.byName || "Member",
                when,
                amount,
                currency,
                receiptUrl: x?.receiptUrl || "",
                icon: cs.icon,
                tint: amount >= 0 ? "rgba(239, 68, 68, 0.10)" : "rgba(16, 185, 129, 0.12)",
                category: x?.category || "other",
                createdAt: x?.createdAt,
                dateISO: x?.dateISO,
              };
            });
            setAllTx(rows);
          },
          (err) => console.log("Transactions snapshot error:", err)
        );
      },
      (err) => {
        Alert.alert("Firestore", err?.message || "Permission error");
        setSetupLoading(false);
      }
    );

    return () => {
      unsubUser();
      familyUnsubRef.current?.();
      membersUnsubRef.current?.();
      txRecentUnsubRef.current?.();
      txAllUnsubRef.current?.();
    };
  }, [uid]);

  const wave = useMemo(() => {
    const now = new Date();

    const txDate = (t: Activity) => {
      const anyT: any = t as any;
      const ts = anyT?.createdAt?.toDate ? anyT.createdAt.toDate() : null;
      return ts || (anyT?.dateISO ? new Date(anyT.dateISO) : now);
    };

    const today = startOfDay(now);
    const startWeek = new Date(today);
    startWeek.setDate(today.getDate() - 6);
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startYear = new Date(now.getFullYear(), 0, 1);

    let todayTotal = 0;
    let weekTotal = 0;
    let monthTotal = 0;
    let yearTotal = 0;

    for (const t of allTx) {
      const d = txDate(t);
      const amt = Number(t.amount || 0);
      if (d >= startYear) yearTotal += amt;
      if (d >= startMonth) monthTotal += amt;
      if (d >= startWeek) weekTotal += amt;
      if (startOfDay(d).getTime() === today.getTime()) todayTotal += amt;
    }

    if (waveRange === "day") {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);

      const buckets = Array(24).fill(0);
      for (const t of allTx) {
        const d = txDate(t);
        if (d < start) continue;
        buckets[d.getHours()] += Math.abs(Number(t.amount || 0));
      }

      const labels = Array.from({ length: 24 }).map((_, i) => (i % 3 === 0 ? String(i) : "·"));
      return { buckets, labels, todayTotal, weekTotal, monthTotal, yearTotal };
    }

    if (waveRange === "week") {
      const buckets = Array(7).fill(0);
      const labels = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date(startWeek);
        d.setDate(startWeek.getDate() + i);
        return weekdayShort(d).toUpperCase();
      });

      for (const t of allTx) {
        const d = txDate(t);
        if (d < startWeek) continue;
        const idx = Math.floor((startOfDay(d).getTime() - startWeek.getTime()) / 86400000);
        if (idx < 0 || idx > 6) continue;
        buckets[idx] += Math.abs(Number(t.amount || 0));
      }

      return { buckets, labels, todayTotal, weekTotal, monthTotal, yearTotal };
    }

    if (waveRange === "month") {
      const daysInThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const buckets = Array(daysInThisMonth).fill(0);
      const labels = Array.from({ length: daysInThisMonth }).map((_, i) => {
        const day = i + 1;
        return day % 5 === 0 ? String(day) : "·";
      });

      for (const t of allTx) {
        const d = txDate(t);
        if (d < startMonth) continue;
        if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) continue;
        const idx = d.getDate() - 1;
        if (idx < 0 || idx >= buckets.length) continue;
        buckets[idx] += Math.abs(Number(t.amount || 0));
      }

      return { buckets, labels, todayTotal, weekTotal, monthTotal, yearTotal };
    }

    const buckets = Array(12).fill(0);
    const labels = Array.from({ length: 12 }).map((_, i) => monthShort(i));
    for (const t of allTx) {
      const d = txDate(t);
      if (d < startYear) continue;
      if (d.getFullYear() !== now.getFullYear()) continue;
      buckets[d.getMonth()] += Math.abs(Number(t.amount || 0));
    }

    return { buckets, labels, todayTotal, weekTotal, monthTotal, yearTotal };
  }, [allTx, waveRange]);

  const waveStats = useMemo(() => {
    const absBuckets = wave.buckets.map((v) => Math.abs(v));
    const max = Math.max(...absBuckets, 1);
    const min = Math.min(...absBuckets, 0);
    const sum = absBuckets.reduce((s, v) => s + v, 0);
    const avg = absBuckets.length ? sum / absBuckets.length : 0;
    return { absBuckets, max, min, sum, avg };
  }, [wave.buckets]);

  const usedPct = monthBudgetPkr > 0 ? Math.round((monthSpentPkr / monthBudgetPkr) * 100) : 0;

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const day = now.getDate();
  const daysLeft = Math.max(0, daysInMonth - day);

  const projected = useMemo(() => {
    const avgPerDay = day > 0 ? monthSpentPkr / day : 0;
    return avgPerDay * daysInMonth;
  }, [monthSpentPkr, day, daysInMonth]);

  const smartDaily = useMemo(() => {
    const remaining = monthBudgetPkr - monthSpentPkr;
    const perDay = daysLeft > 0 ? remaining / daysLeft : remaining;
    return { remaining, perDay: Math.max(0, perDay) };
  }, [monthBudgetPkr, monthSpentPkr, daysLeft]);

  const topBills = useMemo(() => {
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const txDate = (t: Activity) => {
      const anyT: any = t as any;
      const ts = anyT?.createdAt?.toDate ? anyT.createdAt.toDate() : null;
      return ts || (anyT?.dateISO ? new Date(anyT.dateISO) : now);
    };

    const monthTx = allTx
      .filter((t) => txDate(t) >= startMonth)
      .map((t) => {
        const cs = catStyle(t.category);
        return {
          id: t.id,
          title: t.title || "Expense",
          amount: Math.abs(Number(t.amount || 0)),
          category: t.category || "other",
          icon: cs.icon,
          color: cs.color,
          bg: cs.bg,
          br: cs.br,
        };
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);

    return monthTx;
  }, [allTx]);

  const rangeLabel = waveRange === "day" ? "Today" : waveRange === "week" ? "Last 7 days" : waveRange === "month" ? "This month" : "This year";

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <Modal
        visible={waveModalOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setWaveModalOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setWaveModalOpen(false)}>
          <View />
        </Pressable>

        <View style={styles.waveMenuWrap} pointerEvents="box-none">
          <View style={styles.waveMenuArrow} />

          <View style={styles.waveMenuCard}>
            <View style={styles.waveMenuTop}>
              <View style={styles.modalIcon}>
                <Ionicons name="analytics-outline" size={18} color={theme.colors.primary} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Spending Wave</Text>
                <Text style={styles.modalSub}>{rangeLabel} • Realtime</Text>
              </View>

              <Pressable onPress={() => setWaveModalOpen(false)} hitSlop={10} style={styles.waveMenuCloseCircle}>
                <Ionicons name="close" size={18} color={theme.colors.text} />
              </Pressable>
            </View>

            <View style={styles.waveTabsRow}>
              <Pressable onPress={() => setWaveRange("day")} style={[styles.waveTab, waveRange === "day" && styles.waveTabActive]}>
                <Text style={[styles.waveTabText, waveRange === "day" && styles.waveTabTextActive]}>Day</Text>
              </Pressable>
              <Pressable onPress={() => setWaveRange("week")} style={[styles.waveTab, waveRange === "week" && styles.waveTabActive]}>
                <Text style={[styles.waveTabText, waveRange === "week" && styles.waveTabTextActive]}>Week</Text>
              </Pressable>
              <Pressable onPress={() => setWaveRange("month")} style={[styles.waveTab, waveRange === "month" && styles.waveTabActive]}>
                <Text style={[styles.waveTabText, waveRange === "month" && styles.waveTabTextActive]}>Month</Text>
              </Pressable>
              <Pressable onPress={() => setWaveRange("year")} style={[styles.waveTab, waveRange === "year" && styles.waveTabActive]}>
                <Text style={[styles.waveTabText, waveRange === "year" && styles.waveTabTextActive]}>Year</Text>
              </Pressable>
            </View>

            <View style={styles.modalGrid}>
              <View style={styles.modalCell}>
                <Text style={styles.modalK}>Total</Text>
                <Text style={styles.modalV}>{money0(waveStats.sum)} PKR</Text>
              </View>
              <View style={styles.modalCell}>
                <Text style={styles.modalK}>Average</Text>
                <Text style={styles.modalV}>{money0(waveStats.avg)} PKR</Text>
              </View>
              <View style={styles.modalCell}>
                <Text style={styles.modalK}>Max</Text>
                <Text style={styles.modalV}>{money0(waveStats.max)} PKR</Text>
              </View>
              <View style={styles.modalCell}>
                <Text style={styles.modalK}>Min</Text>
                <Text style={styles.modalV}>{money0(waveStats.min)} PKR</Text>
              </View>
            </View>

            <View style={styles.modalBars}>
              {waveStats.absBuckets.slice(0, 12).map((v, idx) => {
                const h = 68 * (v / Math.max(waveStats.max, 1));
                const label = wave.labels[idx] || "";
                return (
                  <View key={idx} style={styles.modalBarCol}>
                    <View style={styles.modalBarTrack}>
                      <View style={[styles.modalBarFill, { height: Math.max(6, h) }]} />
                    </View>
                    <Text style={styles.modalBarLabel} numberOfLines={1}>
                      {label}
                    </Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.menuHintRow}>
              <Ionicons name="information-circle-outline" size={14} color={theme.colors.muted} />
              <Text style={styles.menuHintText}>Updates automatically when transactions change.</Text>
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: Math.max(insets.top, 12),
          paddingBottom: 170 + Math.max(insets.bottom, 10),
        }}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.familyName}>{familyName}</Text>
            <Text style={styles.subline}>{membersCount} members</Text>
          </View>

          {/* ✅ Notification button -> new screen */}
          <IconCircleButton
            icon="notifications-outline"
            dot
            onPress={() => rootNav().navigate("Notifications")}
          />

          <View style={styles.avatarWrap}>
            {familyPhotoURL ? (
              <Image source={{ uri: familyPhotoURL }} style={styles.avatarImg} />
            ) : (
              <Ionicons name="people-circle-outline" size={52} color="rgba(17,24,39,0.55)" />
            )}
          </View>
        </View>

        {setupLoading ? (
          <View style={{ paddingHorizontal: 18, paddingTop: 8 }}>
            <View style={styles.loadingCard}>
              <ActivityIndicator color={theme.colors.primary} />
              <Text style={styles.loadingText}>Setting up your family…</Text>
            </View>
          </View>
        ) : (
          <>
            <View style={{ paddingHorizontal: 18 }}>
              <LinearGradient
                colors={["#101127", "#6D28D9", "#071744"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroGrad}
              >
                <View style={styles.heroTopRow}>
                  <Text style={styles.heroK}>MONTHLY SPENT</Text>
                  <Chip icon="pie-chart-outline" text={`${usedPct}% used`} tone="orange" />
                </View>

                <View style={styles.heroAmountRow}>
                  <Text style={styles.heroV}>{money2(monthSpentPkr)}</Text>
                  <Text style={styles.heroUnit}> PKR</Text>
                </View>

                <View style={{ marginTop: 14 }}>
                  <ProgressBar
                    value={monthBudgetPkr > 0 ? monthSpentPkr / monthBudgetPkr : 0}
                    accent={"rgba(255,255,255,0.92)"}
                  />
                </View>

                <View style={styles.heroMetaRow}>
                  <Text style={styles.heroMeta}>Budget: {money2(monthBudgetPkr)} PKR</Text>
                  <Text style={styles.heroMeta}>Projected: {money0(projected)} PKR</Text>
                </View>

                <View style={styles.heroBottomRow}>
                  <View style={styles.heroTag}>
                    <Ionicons name="speedometer-outline" size={14} color={ORANGE} />
                    <Text style={styles.heroTagText}>Daily: {money0(smartDaily.perDay)} PKR</Text>
                  </View>
                  <View style={styles.heroTag}>
                    <Ionicons name="calendar-outline" size={14} color={ORANGE} />
                    <Text style={styles.heroTagText}>Days left: {daysLeft}</Text>
                  </View>
                </View>
              </LinearGradient>
            </View>

            <View style={styles.shortcutsCircleRow}>
              <ShortcutCircle icon="key-outline" label="Join" onPress={() => rootNav().navigate("JoinFamily")} />
              <ShortcutCircle icon="home-outline" label="Create" onPress={() => rootNav().navigate("CreateFamily")} />
              <ShortcutCircle icon="people-outline" label="Members" onPress={() => rootNav().navigate("FamilyMembers")} tone="primary" />
              <ShortcutCircle icon="wallet-outline" label="Budget" onPress={goBudget} tone="orange" />
            </View>

            <View style={{ paddingHorizontal: 18, marginTop: 10 }}>
              <Pressable
                onPress={() => rootNav().navigate("FixedDailyPlan")}
                style={{
                  borderRadius: 18,
                  padding: 14,
                  backgroundColor: "rgba(255,255,255,0.95)",
                  borderWidth: 1,
                  borderColor: "rgba(17,24,39,0.06)",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "rgba(245,158,11,0.10)",
                      borderWidth: 1,
                      borderColor: "rgba(245,158,11,0.18)",
                    }}
                  >
                    <Ionicons name="calendar-outline" size={18} color={ORANGE} />
                  </View>
                  <View>
                    <Text style={{ fontFamily: theme.font.bold, color: theme.colors.text }}>Fixed daily plan</Text>
                    <Text style={{ marginTop: 2, fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 12 }}>
                      Split salary/fixed expense across month
                    </Text>
                  </View>
                </View>

                <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
              </Pressable>
            </View>

            <Card style={styles.waveCard}>
              <View style={styles.waveHeaderRow}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons name="analytics-outline" size={18} color={theme.colors.primary} />
                    <Text style={styles.sectionTitle}>Spending Wave</Text>
                  </View>
                  <Text style={styles.sectionSub}>Tap the chart to view details</Text>
                </View>

                <Chip icon="calendar-outline" text={rangeLabel} tone="primary" />
              </View>

              <WaveChart buckets={wave.buckets} labels={wave.labels} accent={theme.colors.primary} onPress={() => setWaveModalOpen(true)} />

              <View style={styles.waveSummaryRow}>
                <SmallPill icon="wallet-outline" title="Remaining" value={`${money0(monthBudgetPkr - monthSpentPkr)} PKR`} tone="orange" />
                <SmallPill icon="today-outline" title="Today" value={`${money0(wave.todayTotal)} PKR`} tone="neutral" />
                <SmallPill icon="calendar-outline" title="This week" value={`${money0(wave.weekTotal)} PKR`} tone="primary" />
              </View>
            </Card>

            <View style={styles.sectionHeaderRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="flash-outline" size={18} color={ORANGE} />
                <Text style={styles.sectionTitleInline}>Top bills</Text>
              </View>
            </View>

            <Card style={styles.billsCard}>
              {topBills.length === 0 ? (
                <Text style={styles.smallMuted}>No bills yet this month.</Text>
              ) : (
                topBills.map((b, idx) => (
                  <View key={b.id} style={[styles.billRow, idx !== topBills.length - 1 && styles.billRowDivider]}>
                    <View style={[styles.billIconCircle, { backgroundColor: b.bg, borderColor: b.br }]}>
                      <Ionicons name={b.icon} size={18} color={b.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.billTitle} numberOfLines={1}>
                        {b.title}
                      </Text>
                      <Text style={styles.billSub} numberOfLines={1}>
                        {String(b.category).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.billAmount}>-{money0(b.amount)} PKR</Text>
                  </View>
                ))
              )}
            </Card>

            <Card style={styles.smartCard}>
              <View style={styles.smartTopRow}>
                <View style={styles.smartIcon}>
                  <Ionicons name="shield-checkmark-outline" size={18} color={theme.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.smartTitle}>Smart Budget</Text>
                  <Text style={styles.smartSub}>Recommended daily: {money0(smartDaily.perDay)} PKR</Text>
                </View>
                <Chip icon="pie-chart-outline" text={`${usedPct}% used`} tone="orange" />
              </View>

              <View style={{ marginTop: 12 }}>
                <ProgressBar value={monthBudgetPkr > 0 ? monthSpentPkr / monthBudgetPkr : 0} accent={theme.colors.primary} />
              </View>

              <View style={styles.smartBottomRow}>
                <View style={styles.smartMini}>
                  <Ionicons name="wallet-outline" size={14} color={ORANGE} />
                  <Text style={styles.smartMiniText}>Remaining: {money0(monthBudgetPkr - monthSpentPkr)} PKR</Text>
                </View>

                <Pressable onPress={goBudget} style={styles.smartBtn}>
                  <Ionicons name="options-outline" size={16} color={theme.colors.primary} />
                  <Text style={styles.smartBtnText}>Adjust</Text>
                </Pressable>
              </View>
            </Card>

            <View style={styles.sectionHeaderRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="swap-vertical-outline" size={18} color={theme.colors.primary} />
                <Text style={styles.sectionTitleInline}>Recent flows</Text>
              </View>

              <Pressable onPress={() => rootNav().navigate("Transactions")} hitSlop={8} style={styles.linkBtn}>
                <Text style={styles.viewAll}>View history</Text>
                <Ionicons name="arrow-forward-outline" size={16} color={theme.colors.primary} />
              </Pressable>
            </View>

            <View style={{ marginTop: 10 }}>
              {transactions.map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => {
                    if (!familyId) return;
                    rootNav().navigate("TxDetails", { familyId, txId: a.id });
                  }}
                  style={{ marginBottom: 12 }}
                >
                  <ActivityRow item={a} />
                </Pressable>
              ))}

              {transactions.length === 0 && (
                <Text style={[styles.smallMuted, { paddingHorizontal: 18 }]}>No recent transactions yet.</Text>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <Pressable onPress={() => rootNav().navigate("AddExpense")} style={[styles.fab, { bottom: 18 + Math.max(insets.bottom, 10) }]}>
        <LinearGradient colors={[theme.colors.primary, theme.colors.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabInner}>
          <Ionicons name="add" size={30} color="#fff" />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },

  headerRow: { paddingHorizontal: 18, paddingBottom: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  greeting: { fontFamily: theme.font.regular, color: theme.colors.muted, fontSize: 14 },
  familyName: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 24, marginTop: 2 },
  subline: { marginTop: 4, fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 12 },

  iconCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  notifDot: { position: "absolute", right: 13, top: 13, width: 8, height: 8, borderRadius: 4, backgroundColor: RED },

  avatarWrap: { width: 54, height: 54, justifyContent: "center", alignItems: "center" },
  avatarImg: { width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(17,24,39,0.06)", borderWidth: 2, borderColor: "rgba(91,95,239,0.22)" },

  loadingCard: {
    height: 64,
    borderRadius: 16,
    backgroundColor: "rgba(29, 19, 43, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(16, 25, 46, 0.06)",
    paddingHorizontal: 14,
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  loadingText: { fontFamily: theme.font.medium, color: theme.colors.muted },

  card: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(16, 21, 32, 0.06)",
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.06 : 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },

  heroGrad: { borderRadius: 26, padding: 16, minHeight: 175 },
  heroTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  heroK: { fontFamily: theme.font.medium, color: "rgba(255,255,255,0.85)", letterSpacing: 0.8 },

  heroAmountRow: { flexDirection: "row", alignItems: "flex-end", marginTop: 10 },
  heroV: { fontFamily: theme.font.bold, fontSize: 34, color: "#fff" },
  heroUnit: { fontFamily: theme.font.medium, fontSize: 14, color: "rgba(255,255,255,0.85)", marginBottom: 6 },

  chip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, maxWidth: 190 },
  chipText: { fontFamily: theme.font.bold, fontSize: 12 },

  progressTrack: { height: 10, backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 999, overflow: "hidden" },
  progressFill: { height: 10, borderRadius: 999 },

  heroMetaRow: { marginTop: 12, flexDirection: "row", justifyContent: "space-between", gap: 10 },
  heroMeta: { fontFamily: theme.font.medium, color: "rgba(255,255,255,0.88)", fontSize: 12 },

  heroBottomRow: { marginTop: 14, flexDirection: "row", gap: 10 },
  heroTag: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.16)" },
  heroTagText: { fontFamily: theme.font.bold, color: "#fff", fontSize: 12 },

  shortcutsCircleRow: { marginTop: 14, paddingHorizontal: 18, flexDirection: "row", justifyContent: "space-between" },
  shortcutCircleItem: { alignItems: "center", width: 78 },
  shortcutCircle: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  shortcutCircleText: { marginTop: 8, fontFamily: theme.font.bold, fontSize: 12, color: theme.colors.text },

  waveCard: { marginHorizontal: 18, marginTop: 12 },
  waveHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  sectionTitle: { fontFamily: theme.font.bold, fontSize: 16, color: theme.colors.text },
  sectionSub: { marginTop: 2, fontFamily: theme.font.medium, fontSize: 12, color: theme.colors.muted },

  waveBox: { borderRadius: 18, backgroundColor: "rgba(19, 20, 44, 0.06)", borderWidth: 1, borderColor: "rgba(91,95,239,0.10)", padding: 12 },
  waveDaysRow: { marginTop: 6, flexDirection: "row", justifyContent: "space-between", gap: 6 },
  waveDay: { flex: 1, textAlign: "center", fontFamily: theme.font.medium, fontSize: 10, color: theme.colors.muted },
  waveLegendRow: { marginTop: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 11 },

  waveSummaryRow: { marginTop: 14, flexDirection: "row", gap: 12 },
  smallPill: { flex: 1, minHeight: 64, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 999, borderWidth: 1 },
  smallPillIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.70)", alignItems: "center", justifyContent: "center" },
  smallPillTitle: { fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 11 },
  smallPillValue: { marginTop: 2, fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 13, lineHeight: 16 },

  sectionHeaderRow: { marginTop: 18, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitleInline: { fontFamily: theme.font.bold, fontSize: 18, color: theme.colors.text },

  billsCard: { marginHorizontal: 18, marginTop: 10 },
  billRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  billRowDivider: { borderBottomWidth: 1, borderBottomColor: "rgba(17,24,39,0.06)" },
  billIconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  billTitle: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 14 },
  billSub: { marginTop: 2, fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 11 },
  billAmount: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 13 },

  smartCard: { marginHorizontal: 18, marginTop: 12 },
  smartTopRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  smartIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(91,95,239,0.10)", alignItems: "center", justifyContent: "center" },
  smartTitle: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 14 },
  smartSub: { marginTop: 2, fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 12 },
  smartBottomRow: { marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  smartMini: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 999, backgroundColor: "rgba(245,158,11,0.10)", borderWidth: 1, borderColor: "rgba(245,158,11,0.18)" },
  smartMiniText: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 11 },
  smartBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 16, backgroundColor: "rgba(91,95,239,0.10)", borderWidth: 1, borderColor: "rgba(91,95,239,0.18)" },
  smartBtnText: { fontFamily: theme.font.bold, color: theme.colors.primary, fontSize: 12 },

  linkBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  viewAll: { fontFamily: theme.font.medium, color: theme.colors.primary },

  activityRow: { marginHorizontal: 18, backgroundColor: "rgba(255,255,255,0.95)", borderRadius: 18, paddingVertical: 14, paddingHorizontal: 14, borderWidth: 1, borderColor: "rgba(17,24,39,0.06)", flexDirection: "row", alignItems: "center", gap: 12 },
  activityIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  activityTitle: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 16 },
  activityMeta: { marginTop: 3, fontFamily: theme.font.regular, color: theme.colors.muted, fontSize: 12 },
  activityAmount: { fontFamily: theme.font.bold, fontSize: 16 },
  activityCurrency: { marginTop: 2, fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 12 },
  smallMuted: { fontFamily: theme.font.regular, color: theme.colors.muted },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)" },

  waveMenuWrap: { position: "absolute", top: 110, left: 18, right: 18, alignItems: "flex-end" },
  waveMenuArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 12,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "rgba(255,255,255,0.97)",
    marginRight: 26,
  },
  waveMenuCard: {
    width: "100%",
    maxWidth: 390,
    backgroundColor: "rgba(255,255,255,0.97)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.10)",
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.10 : 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6,
  },

  waveMenuTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  modalIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(91,95,239,0.10)", alignItems: "center", justifyContent: "center" },
  modalTitle: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 15 },
  modalSub: { marginTop: 2, fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 12 },

  waveMenuCloseCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(17,24,39,0.06)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.10)",
  },

  waveTabsRow: { marginTop: 12, flexDirection: "row", gap: 10 },
  waveTab: {
    flex: 1,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(17,24,39,0.04)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  waveTabActive: { backgroundColor: "rgba(91,95,239,0.10)", borderColor: "rgba(91,95,239,0.20)" },
  waveTabText: { fontFamily: theme.font.bold, color: theme.colors.muted, fontSize: 12 },
  waveTabTextActive: { color: theme.colors.primary },

  modalGrid: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  modalCell: { width: "47%", borderRadius: 16, backgroundColor: "rgba(17,24,39,0.03)", borderWidth: 1, borderColor: "rgba(17,24,39,0.08)", padding: 10 },
  modalK: { fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 11 },
  modalV: { marginTop: 4, fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 12 },

  modalBars: { marginTop: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  modalBarCol: { alignItems: "center", width: 26 },
  modalBarTrack: { width: 10, height: 68, borderRadius: 999, backgroundColor: "rgba(148,163,184,0.25)", justifyContent: "flex-end", overflow: "hidden" },
  modalBarFill: { width: 10, borderRadius: 999, backgroundColor: theme.colors.primary },
  modalBarLabel: { marginTop: 6, fontFamily: theme.font.bold, fontSize: 10, color: theme.colors.muted },

  menuHintRow: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  menuHintText: { fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 11, flex: 1 },

  fab: { position: "absolute", alignSelf: "center", width: 72, height: 72, borderRadius: 36 },
  fabInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.18 : 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
});
