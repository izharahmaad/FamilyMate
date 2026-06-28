import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import Svg, {
  Circle,
  G,
  Path,
  Defs,
  LinearGradient as SvgLG,
  Stop,
  Line,
} from "react-native-svg";

import * as XLSX from "xlsx";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { getAuth } from "firebase/auth";
import {
  Timestamp,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
  limit,
} from "firebase/firestore";

import { db } from "../lib/firebase";
import { theme } from "../theme";

type RangeKey = "today" | "week" | "month";
type TxType = "expense" | "income";

type TxRow = {
  id: string;
  title: string;
  category?: string;
  amountPkr: number;
  type: TxType;
  byUid?: string;
  byName?: string;
  receiptUrl?: string;
  createdAt?: any; // Firestore Timestamp
};

const CAT_LABEL: Record<string, string> = {
  groceries: "Groceries",
  rent: "Rent",
  transport: "Transport",
  bills: "Bills",
  food: "Eating Out",
  health: "Health",
  other: "Other",
};

const CAT_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  groceries: "cart-outline",
  rent: "home-outline",
  transport: "car-outline",
  bills: "flash-outline",
  food: "restaurant-outline",
  health: "medkit-outline",
  other: "apps-outline",
};

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

function toISODate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function startOfWeekMonday(d: Date) {
  const x = startOfDay(d);
  const day = x.getDay(); // 0 Sun ... 6 Sat
  const diff = day === 0 ? 6 : day - 1; // Monday=0
  return addDays(x, -diff);
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function rangeBounds(range: RangeKey) {
  const now = new Date();
  const start =
    range === "today"
      ? startOfDay(now)
      : range === "week"
      ? startOfWeekMonday(now)
      : startOfMonth(now);

  const endExclusive = addDays(startOfDay(now), 1);
  return { start, end: endExclusive };
}

function formatTimeHHMM(d: Date) {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function timeAgoShort(from: Date, to: Date) {
  const ms = Math.max(0, to.getTime() - from.getTime());
  const min = Math.floor(ms / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const days = Math.floor(hr / 24);
  return `${days}d`;
}

async function writeXlsxAndShare(params: {
  filePrefix: string;
  summary: Record<string, any>[];
  transactions: Record<string, any>[];
}) {
  const wb = XLSX.utils.book_new();
  const wsSummary = XLSX.utils.json_to_sheet(params.summary);
  const wsTx = XLSX.utils.json_to_sheet(params.transactions);

  XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");
  XLSX.utils.book_append_sheet(wb, wsTx, "Transactions");

  const b64 = XLSX.write(wb, { type: "base64", bookType: "xlsx" });

  const fileName = `${params.filePrefix}_${toISODate(new Date())}.xlsx`;

  const baseDir = FileSystem.documentDirectory ?? "";
  if (!baseDir) throw new Error("FileSystem.documentDirectory not available");

  const uri = baseDir + fileName;

  await FileSystem.writeAsStringAsync(uri, b64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      dialogTitle: "Save analytics Excel file",
      UTI: "org.openxmlformats.spreadsheetml.sheet",
    });
  } else {
    Alert.alert("Saved", `Saved inside app storage:\n${uri}`);
  }

  return uri;
}

/** FIXED donut: cumulative length so segments move when data changes */
function SegmentedDonut({
  size = 168,
  stroke = 18,
  segments,
  centerTop,
  centerBottom,
}: {
  size?: number;
  stroke?: number;
  segments: { label: string; value: number; color: string }[];
  centerTop: string;
  centerBottom: string;
}) {
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;

  const total = Math.max(
    1e-9,
    segments.reduce((a, s) => a + Math.max(0, s.value), 0)
  );

  let startLen = 0;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <G rotation={-90} originX={size / 2} originY={size / 2}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="rgba(255,255,255,0.20)"
            strokeWidth={stroke}
            fill="transparent"
          />
          {segments.map((s, idx) => {
            const v = Math.max(0, s.value);
            const len = (v / total) * C;
            const dasharray = `${Math.max(0, len)} ${Math.max(0, C - len)}`;
            const dashoffset = C - startLen;
            startLen += len;

            return (
              <Circle
                key={`${s.label}-${idx}-${Math.round(v)}-${Math.round(total)}`}
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke={s.color}
                strokeWidth={stroke}
                fill="transparent"
                strokeLinecap="round"
                strokeDasharray={dasharray}
                strokeDashoffset={dashoffset}
              />
            );
          })}
        </G>
      </Svg>

      <View style={styles.donutCenter}>
        <Text style={styles.donutTop}>{centerTop}</Text>
        <Text style={styles.donutBottom}>{centerBottom}</Text>
      </View>
    </View>
  );
}

/** FIXED tiny pie: cumulative length so it updates correctly */
function TinyPie({
  size = 84,
  stroke = 12,
  values,
  colors,
}: {
  size?: number;
  stroke?: number;
  values: number[];
  colors: string[];
}) {
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;

  const clean = values.map((v) => Math.max(0, v));
  const total = Math.max(1e-9, clean.reduce((a, v) => a + v, 0));

  let startLen = 0;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <G rotation={-90} originX={size / 2} originY={size / 2}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="rgba(10,18,38,0.10)"
            strokeWidth={stroke}
            fill="transparent"
          />
          {clean.map((v, idx) => {
            const len = (v / total) * C;
            const dasharray = `${Math.max(0, len)} ${Math.max(0, C - len)}`;
            const dashoffset = C - startLen;
            startLen += len;

            return (
              <Circle
                key={`tiny-${idx}-${Math.round(v)}-${Math.round(total)}`}
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke={colors[idx % colors.length]}
                strokeWidth={stroke}
                fill="transparent"
                strokeLinecap="round"
                strokeDasharray={dasharray}
                strokeDashoffset={dashoffset}
              />
            );
          })}
        </G>
      </Svg>
    </View>
  );
}

/** Bigger navy background wave with grid lines */
function NavyWaveChart({
  values,
  height = 148,
  stroke = "#EAF0FF",
}: {
  values: number[];
  height?: number;
  stroke?: string;
}) {
  const width = 320;
  const padX = 10;
  const padY = 12;

  const maxV = Math.max(1, ...values.map((v) => Math.max(0, v)));
  const pts = values.map((v, i) => {
    const x = padX + (i * (width - padX * 2)) / Math.max(1, values.length - 1);
    const y = padY + (1 - Math.max(0, v) / maxV) * (height - padY * 2);
    return { x, y };
  });

  const d = useMemo(() => {
    if (pts.length === 0) return "";
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;

    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const cur = pts[i];
      const midX = (prev.x + cur.x) / 2;
      path += ` Q ${midX} ${prev.y} ${cur.x} ${cur.y}`;
    }
    return path;
  }, [values.join(",")]);

  const areaD = useMemo(() => {
    if (!d) return "";
    const last = pts[pts.length - 1];
    const first = pts[0];
    return `${d} L ${last.x} ${height} L ${first.x} ${height} Z`;
  }, [d]);

  const gridColor = "rgba(255,255,255,0.14)";
  const hTicks = 4;
  const vTicks = Math.min(6, Math.max(3, values.length));

  return (
    <View style={{ height }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <SvgLG id="navyFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={stroke} stopOpacity="0.20" />
            <Stop offset="1" stopColor={stroke} stopOpacity="0.00" />
          </SvgLG>
        </Defs>

        {Array.from({ length: hTicks + 1 }).map((_, i) => {
          const y = padY + (i * (height - padY * 2)) / hTicks;
          return (
            <Line
              key={`h-${i}`}
              x1={padX}
              x2={width - padX}
              y1={y}
              y2={y}
              stroke={gridColor}
              strokeWidth={1}
            />
          );
        })}
        {Array.from({ length: vTicks }).map((_, i) => {
          const x = padX + (i * (width - padX * 2)) / Math.max(1, vTicks - 1);
          return (
            <Line
              key={`v-${i}`}
              x1={x}
              x2={x}
              y1={padY}
              y2={height - padY}
              stroke={gridColor}
              strokeWidth={1}
            />
          );
        })}

        {areaD ? <Path d={areaD} fill="url(#navyFill)" /> : null}
        {d ? (
          <Path
            d={d}
            fill="none"
            stroke={stroke}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
      </Svg>
    </View>
  );
}

function ExportCircle({
  label,
  icon,
  onPress,
  disabled,
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [{ opacity: disabled ? 0.55 : pressed ? 0.9 : 1 }, { alignItems: "center" }]}
    >
      <LinearGradient
        colors={[theme.colors.primary, theme.colors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.exportCircle}
      >
        <Ionicons name={icon} size={18} color="#fff" />
      </LinearGradient>
      <Text style={styles.exportCircleText}>{label}</Text>
    </Pressable>
  );
}

export default function AnalyticsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const auth = getAuth();

  const [familyId, setFamilyId] = useState<string | null>(null);
  const [familyName, setFamilyName] = useState<string>("Family");

  const [range, setRange] = useState<RangeKey>("month");

  const [familyBudget, setFamilyBudget] = useState<number>(0);
  const [familySpentMonth, setFamilySpentMonth] = useState<number>(0);

  const [loading, setLoading] = useState(true);
  const [tx, setTx] = useState<TxRow[]>([]);
  const [exporting, setExporting] = useState(false);

  const unsubTxRef = useRef<null | (() => void)>(null);

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

    const unsub = onSnapshot(
      doc(db, "families", familyId),
      (snap) => {
        const d = snap.data() as any;
        setFamilyBudget(Number(d?.monthBudgetPkr ?? 0));
        setFamilySpentMonth(Number(d?.monthSpentPkr ?? 0));
        setFamilyName(d?.name ?? "Family");
      },
      (err) => Alert.alert("Error", err.message)
    );

    return unsub;
  }, [familyId]);

  useEffect(() => {
    if (!familyId) return;

    unsubTxRef.current?.();
    setLoading(true);

    const { start, end } = rangeBounds(range);
    const startTs = Timestamp.fromDate(start);
    const endTs = Timestamp.fromDate(end);

    const q = query(
      collection(db, "families", familyId, "transactions"),
      where("createdAt", ">=", startTs),
      where("createdAt", "<", endTs),
      orderBy("createdAt", "desc"),
      limit(500)
    );

    const unsub = onSnapshot(
      q,
      (qs) => {
        const rows: TxRow[] = qs.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            title: (data.title ?? "") as string,
            category: (data.category ?? "other") as string,
            amountPkr: Number(data.amountPkr ?? 0),
            type: (data.type ?? "expense") as TxType,
            byUid: data.byUid ?? "",
            byName: data.byName ?? "",
            receiptUrl: data.receiptUrl ?? "",
            createdAt: data.createdAt,
          };
        });

        setTx(rows);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        Alert.alert("Error", err.message);
      }
    );

    unsubTxRef.current = unsub;
    return () => unsub();
  }, [familyId, range]);

  const computed = useMemo(() => {
    const expenses = tx.filter((t) => t.type === "expense");
    const incomes = tx.filter((t) => t.type === "income");

    const expenseTotal = expenses.reduce((s, t) => s + (Number(t.amountPkr) || 0), 0);
    const incomeTotal = incomes.reduce((s, t) => s + (Number(t.amountPkr) || 0), 0);
    const net = incomeTotal - expenseTotal;

    const byCategory: Record<string, number> = {};
    for (const e of expenses) {
      const k = (e.category || "other").toString();
      byCategory[k] = (byCategory[k] ?? 0) + (Number(e.amountPkr) || 0);
    }
    const catSorted = Object.entries(byCategory)
      .map(([k, v]) => ({ key: k, total: v }))
      .sort((a, b) => b.total - a.total);

    const byMember: Record<string, { name: string; total: number }> = {};
    for (const e of expenses) {
      const k = (e.byUid || "unknown").toString();
      const nm = (e.byName || "Member").toString();
      if (!byMember[k]) byMember[k] = { name: nm, total: 0 };
      byMember[k].total += (Number(e.amountPkr) || 0);
    }
    const memSorted = Object.entries(byMember)
      .map(([uid, v]) => ({ uid, name: v.name, total: v.total }))
      .sort((a, b) => b.total - a.total);

    const withReceipt = expenses.filter((e) => !!(e.receiptUrl && e.receiptUrl.trim())).length;
    const receiptPct = expenses.length ? Math.round((withReceipt / expenses.length) * 100) : 0;

    const avgExpense = expenses.length ? expenseTotal / expenses.length : 0;
    const anomalies = expenses
      .filter((e) => (Number(e.amountPkr) || 0) > avgExpense * 2 && (Number(e.amountPkr) || 0) >= 1000)
      .slice(0, 5);

    const days = range === "today" ? 12 : range === "week" ? 7 : 30;

    const now = startOfDay(new Date());
    const buckets: { day: string; total: number; count: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = addDays(now, -i);
      buckets.push({ day: toISODate(d), total: 0, count: 0 });
    }
    const idxByDay = new Map(buckets.map((b, i) => [b.day, i]));

    for (const e of expenses) {
      const ts: any = e.createdAt;
      const dt = ts?.toDate ? ts.toDate() : null;
      if (!dt) continue;
      const key = toISODate(dt);
      const idx = idxByDay.get(key);
      if (idx != null) {
        buckets[idx].total += (Number(e.amountPkr) || 0);
        buckets[idx].count += 1;
      }
    }

    const maxDay = Math.max(1, ...buckets.map((b) => b.total));

    const newestTx = tx.length ? tx[0] : null;
    const newestDate: Date | null = newestTx?.createdAt?.toDate ? newestTx.createdAt.toDate() : null;

    const mostActive = buckets.reduce(
      (best, b) => (b.count > best.count ? b : best),
      { day: "", total: 0, count: -1 }
    );

    let streak = 0;
    if (range === "today") streak = tx.length > 0 ? 1 : 0;
    else {
      for (let i = buckets.length - 1; i >= 0; i--) {
        if (buckets[i].count > 0) streak += 1;
        else break;
      }
    }

    return {
      expenseTotal,
      incomeTotal,
      net,
      catSorted,
      memSorted,
      receiptPct,
      anomalies,
      dayBuckets: buckets.map((b) => ({ day: b.day, total: b.total })),
      maxDay,
      countExpenses: expenses.length,
      countAll: tx.length,
      newestDate,
      streak,
      mostActiveDay: mostActive.day,
      mostActiveCount: Math.max(0, mostActive.count),
    };
  }, [tx, range]);

  const budget = useMemo(() => {
    const spent = Number(familySpentMonth || 0);
    const bud = Number(familyBudget || 0);
    const ratio = bud > 0 ? clamp01(spent / bud) : 0;

    const now = new Date();
    const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayOfMonth = now.getDate();
    const daysLeft = Math.max(0, dim - dayOfMonth);

    const avgPerDaySoFar = dayOfMonth > 0 ? spent / dayOfMonth : 0;
    const projected = avgPerDaySoFar * dim;

    return { spent, bud, ratio, daysLeft, projected };
  }, [familySpentMonth, familyBudget]);

  const heroColor = theme.colors.primary;

  const usedPctThisRange = useMemo(() => {
    const bud = Math.max(0, Number(familyBudget || 0));
    const spent = Math.max(0, Number(familySpentMonth || 0));
    return bud > 0 ? Math.round((spent / bud) * 100) : 0;
  }, [familyBudget, familySpentMonth]);

  const donutSegments = useMemo(() => {
    const spent = Math.max(0, computed.expenseTotal);
    const income = Math.max(0, computed.incomeTotal);
    const other = Math.max(0, Math.max(income - spent, 0));
    return [
      { label: "Expenses", value: spent, color: "#FFB020" },
      { label: "Income", value: income, color: "#22C55E" },
      { label: "Net", value: other, color: "#60A5FA" },
    ];
  }, [computed.expenseTotal, computed.incomeTotal]);

  const tinyColors = useMemo(() => ["#22C55E", "#0EA5E9", "#F59E0B", "#A78BFA"], []);
  const tinyValues = useMemo(() => {
    const top = computed.catSorted.slice(0, 4).map((c) => Math.max(1, c.total));
    while (top.length < 4) top.push(1);
    return top;
  }, [computed.catSorted]);

  const exportXlsx = async (exportRange: RangeKey) => {
    if (!familyId) return Alert.alert("Family", "No family connected.");
    if (exporting) return;

    try {
      setExporting(true);

      const { start, end } = rangeBounds(exportRange);
      const startTs = Timestamp.fromDate(start);
      const endTs = Timestamp.fromDate(end);

      const q = query(
        collection(db, "families", familyId, "transactions"),
        where("createdAt", ">=", startTs),
        where("createdAt", "<", endTs),
        orderBy("createdAt", "desc"),
        limit(5000)
      );

      const rows: TxRow[] =
        exportRange === range
          ? tx
          : await new Promise<TxRow[]>((resolve, reject) => {
              const unsub = onSnapshot(
                q,
                (qs) => {
                  unsub();
                  const out = qs.docs.map((d) => {
                    const data = d.data() as any;
                    return {
                      id: d.id,
                      title: (data.title ?? "") as string,
                      category: (data.category ?? "other") as string,
                      amountPkr: Number(data.amountPkr ?? 0),
                      type: (data.type ?? "expense") as TxType,
                      byUid: data.byUid ?? "",
                      byName: data.byName ?? "",
                      receiptUrl: data.receiptUrl ?? "",
                      createdAt: data.createdAt,
                    };
                  });
                  resolve(out);
                },
                reject
              );
            });

      const expenses = rows.filter((t) => t.type === "expense");
      const incomes = rows.filter((t) => t.type === "income");
      const expenseTotal = expenses.reduce((s, t) => s + (Number(t.amountPkr) || 0), 0);
      const incomeTotal = incomes.reduce((s, t) => s + (Number(t.amountPkr) || 0), 0);

      const catTotals: Record<string, number> = {};
      for (const e of expenses) {
        const k = (e.category || "other").toString();
        catTotals[k] = (catTotals[k] ?? 0) + (Number(e.amountPkr) || 0);
      }

      const rb = rangeBounds(exportRange);
      const summary: Record<string, any>[] = [
        { Key: "Range", Value: exportRange.toUpperCase() },
        { Key: "From", Value: toISODate(rb.start) },
        { Key: "To", Value: toISODate(addDays(rb.end, -1)) },
        { Key: "Total expenses (PKR)", Value: Math.round(expenseTotal) },
        { Key: "Total income (PKR)", Value: Math.round(incomeTotal) },
        { Key: "Net (income-expense)", Value: Math.round(incomeTotal - expenseTotal) },
        { Key: "Transactions", Value: rows.length },
      ];

      Object.entries(catTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([k, v], idx) => {
          summary.push({
            Key: `Top category ${idx + 1}`,
            Value: `${CAT_LABEL[k] ?? k}: ${Math.round(v)}`,
          });
        });

      const txSheet = rows.map((t) => {
        const dt = t.createdAt?.toDate ? t.createdAt.toDate() : null;
        return {
          Date: dt ? dt.toISOString().slice(0, 10) : "",
          Time: dt ? dt.toTimeString().slice(0, 5) : "",
          Type: t.type,
          Title: t.title,
          Category: CAT_LABEL[t.category ?? "other"] ?? (t.category ?? "other"),
          AmountPKR: Number(t.amountPkr || 0),
          By: t.byName || t.byUid || "",
          Receipt: t.receiptUrl && t.receiptUrl.trim() ? "Yes" : "No",
        };
      });

      await writeXlsxAndShare({
        filePrefix: `FamilyMate_${exportRange}_Analytics`,
        summary,
        transactions: txSheet,
      });

      Alert.alert("Export ready", "Excel file created. Choose where to save/share it.");
    } catch (e: any) {
      Alert.alert("Export failed", e?.message || "Could not export");
    } finally {
      setExporting(false);
    }
  };

  const RangePill = ({ k, label }: { k: RangeKey; label: string }) => {
    const active = range === k;
    return (
      <Pressable onPress={() => setRange(k)} style={[styles.pill, active ? styles.pillActive : styles.pillIdle]}>
        <Text style={[styles.pillText, active ? styles.pillTextActive : styles.pillTextIdle]}>{label}</Text>
      </Pressable>
    );
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
        <View style={styles.centerBox}>
          <Ionicons name="analytics-outline" size={34} color={theme.colors.muted} />
          <Text style={styles.emptyTitle}>No family connected</Text>
          <Text style={styles.emptySub}>Create a family or join using an invite code.</Text>
        </View>
      </View>
    );
  }

  const now = new Date();
  const latestLabel = computed.newestDate ? `${toISODate(computed.newestDate)} ${formatTimeHHMM(computed.newestDate)}` : "—";
  const latestAgo = computed.newestDate ? timeAgoShort(computed.newestDate, now) : "—";

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 10) }]}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <LinearGradient
        pointerEvents="none"
        colors={["rgba(210, 214, 224, 0.16)", "rgba(218, 221, 228, 0.04)", "rgba(10,18,38,0.10)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation?.goBack?.()} hitSlop={10} style={styles.glassCircle}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
        </Pressable>

        <View style={styles.headerTitleWrap}>
          <View style={styles.glassMiniCircle}>
            <Ionicons name="stats-chart-outline" size={16} color={theme.colors.text} />
          </View>
          <Text style={styles.title} numberOfLines={1}>
            Analytics
          </Text>
        </View>

        <Pressable
          onPress={() =>
            Alert.alert("Family", familyName, [
              { text: "Export Today", onPress: () => exportXlsx("today") },
              { text: "Export Week", onPress: () => exportXlsx("week") },
              { text: "Export Month", onPress: () => exportXlsx("month") },
              { text: "Cancel", style: "cancel" },
            ])
          }
          hitSlop={10}
          style={styles.glassCircle}
        >
          <Ionicons name="download-outline" size={18} color={theme.colors.text} />
        </Pressable>
      </View>

      <View style={styles.rangeRow}>
        <RangePill k="today" label="Today" />
        <RangePill k="week" label="Week" />
        <RangePill k="month" label="Month" />
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading analytics…</Text>
        </View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}>
          <ScrollView contentContainerStyle={{ paddingBottom: 160 + Math.max(insets.bottom, 10) }} showsVerticalScrollIndicator={false}>
            <View style={styles.heroWrap}>
              <LinearGradient colors={[heroColor, heroColor]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
                <LinearGradient
                  pointerEvents="none"
                  colors={["#2559c2", "#0a0a2e", "#112B5C"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />

                <View style={styles.heroTopRow}>
                  <View style={styles.heroPill}>
                    <Ionicons name="sparkles-outline" size={12} color="rgba(255,255,255,0.95)" />
                    <Text style={styles.heroPillText}>{range.toUpperCase()}</Text>
                  </View>
                  <View style={styles.heroPill}>
                    <Ionicons name="pie-chart-outline" size={12} color="rgba(255,255,255,0.95)" />
                    <Text style={styles.heroPillText}>{computed.countAll} tx</Text>
                  </View>
                </View>

                <View style={styles.heroMain}>
                  <SegmentedDonut
                    segments={donutSegments}
                    centerTop={formatPKR(computed.expenseTotal)}
                    centerBottom="Expenses"
                  />

                  <View style={{ flex: 1 }}>
                    <Text style={styles.heroK}>Total spent</Text>
                    <Text style={styles.heroV}>{formatPKR(computed.expenseTotal)}</Text>

                    <View style={styles.heroStatsRow}>
                      <View style={styles.heroMini}>
                        <Text style={styles.heroMiniK}>Income</Text>
                        <Text style={styles.heroMiniV}>{formatPKR(computed.incomeTotal)}</Text>
                      </View>
                      <View style={styles.heroMini}>
                        <Text style={styles.heroMiniK}>Net</Text>
                        <Text style={styles.heroMiniV}>{formatPKR(computed.net)}</Text>
                      </View>
                    </View>

                    <View style={styles.heroStatsRow}>
                      <View style={styles.heroMini}>
                        <Text style={styles.heroMiniK}>Receipt rate</Text>
                        <Text style={styles.heroMiniV}>{computed.receiptPct}%</Text>
                      </View>
                      <View style={styles.heroMini}>
                        <Text style={styles.heroMiniK}>Budget used</Text>
                        <Text style={styles.heroMiniV}>{usedPctThisRange}%</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </LinearGradient>
            </View>

            {/* Trend (navy background + grid, bigger) */}
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>Wave trend</Text>
                <Ionicons name="pulse-outline" size={18} color={theme.colors.primary} />
              </View>

              <View style={styles.navyChartPanel}>
                <LinearGradient
                  pointerEvents="none"
                  colors={["rgba(11,18,32,0.86)", "rgba(11,18,32,0.60)"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <NavyWaveChart values={computed.dayBuckets.map((b) => b.total)} height={148} />
              </View>

              <View style={styles.waveMeta}>
                <Text style={styles.mutedSmall}>
                  {range === "today" ? "Today" : range === "week" ? "This week" : "This month"} • Peak: {formatPKR(computed.maxDay)}
                </Text>
              </View>
            </View>

            {/* NEW: Created at */}
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>Created at</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="time-outline" size={18} color={theme.colors.primary} />
                  <Ionicons name="sparkles-outline" size={18} color={theme.colors.primary} />
                </View>
              </View>

              <View style={styles.createdGrid}>
                <View style={styles.createdBox}>
                  <View style={styles.createdIcon}>
                    <Ionicons name="notifications-outline" size={18} color={theme.colors.primary} />
                  </View>
                  <Text style={styles.createdK}>Latest activity</Text>
                  <Text style={styles.createdV}>{latestLabel}</Text>
                  <Text style={styles.createdS}>{latestAgo}</Text>
                </View>

                <View style={styles.createdBox}>
                  <View style={styles.createdIcon}>
                    <Ionicons name="flame-outline" size={18} color={theme.colors.primary} />
                  </View>
                  <Text style={styles.createdK}>Streak</Text>
                  <Text style={styles.createdV}>{computed.streak} days</Text>
                  <Text style={styles.createdS}>
                    {computed.mostActiveDay ? `Top: ${computed.mostActiveDay}` : "Top: —"}
                  </Text>
                </View>
              </View>
            </View>

            {/* Highlights header icon changed */}
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>Highlights</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="person-circle-outline" size={18} color={theme.colors.primary} />
                  <Ionicons name="stats-chart-outline" size={18} color={theme.colors.primary} />
                </View>
              </View>

              <View style={styles.highlightsRow}>
                <View style={styles.tinyChartBox}>
                  <TinyPie values={tinyValues} colors={tinyColors} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.hlTitle}>Top categories</Text>
                    <Text style={styles.hlSub}>Based on this range expenses.</Text>

                    {computed.catSorted.slice(0, 4).map((c, i) => (
                      <View key={c.key} style={styles.legendRow}>
                        <View style={[styles.legendDot, { backgroundColor: tinyColors[i] }]} />
                        <Text style={styles.legendText} numberOfLines={1}>
                          {CAT_LABEL[c.key] ?? c.key}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.resultBox}>
                  <Text style={styles.resultK}>Result</Text>
                  <Text style={styles.resultV}>
                    {computed.expenseTotal <= 0 ? "No spend" : computed.receiptPct >= 60 ? "Clean" : "Needs receipts"}
                  </Text>
                  <Text style={styles.resultSub}>{computed.receiptPct}% receipts</Text>
                </View>
              </View>
            </View>

            {/* TOP CATEGORIES */}
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>Top categories</Text>
                <Ionicons name="grid-outline" size={18} color={theme.colors.primary} />
              </View>

              {computed.catSorted.length === 0 ? (
                <Text style={styles.mutedSmall}>No expense data in this range.</Text>
              ) : (
                computed.catSorted.slice(0, 6).map((c) => {
                  const pct = computed.expenseTotal > 0 ? Math.round((c.total / computed.expenseTotal) * 100) : 0;
                  const icon = CAT_ICON[c.key] ?? "apps-outline";
                  return (
                    <View key={c.key} style={styles.rowLine}>
                      <View style={styles.rowLeft}>
                        <View style={styles.rowIcon}>
                          <Ionicons name={icon} size={18} color={theme.colors.primary} />
                        </View>
                        <View>
                          <Text style={styles.rowTitle}>{CAT_LABEL[c.key] ?? c.key}</Text>
                          <Text style={styles.rowSub}>{pct}% of spending</Text>
                        </View>
                      </View>
                      <Text style={styles.rowRight}>{formatPKR(c.total)}</Text>
                    </View>
                  );
                })
              )}
            </View>

            {/* TOP SPENDERS */}
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>Top spenders</Text>
                <Ionicons name="people-outline" size={18} color={theme.colors.primary} />
              </View>

              {computed.memSorted.length === 0 ? (
                <Text style={styles.mutedSmall}>No expense data in this range.</Text>
              ) : (
                computed.memSorted.slice(0, 5).map((m, idx) => (
                  <View key={m.uid} style={styles.rowLine}>
                    <View style={styles.rowLeft}>
                      <View style={[styles.rankBubble, idx === 0 ? styles.rankFirst : styles.rankOther]}>
                        <Text style={styles.rankText}>{idx + 1}</Text>
                      </View>
                      <View>
                        <Text style={styles.rowTitle}>{m.name || "Member"}</Text>
                        <Text style={styles.rowSub}>UID: {m.uid.slice(0, 8)}…</Text>
                      </View>
                    </View>
                    <Text style={styles.rowRight}>{formatPKR(m.total)}</Text>
                  </View>
                ))
              )}
            </View>

            {/* RECEIPTS */}
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>Receipts</Text>
                <Ionicons name="receipt-outline" size={18} color={theme.colors.primary} />
              </View>

              <View style={styles.kpiRow}>
                <View style={styles.kpiBox}>
                  <Text style={styles.kpiValue}>{computed.receiptPct}%</Text>
                  <Text style={styles.kpiLabel}>With receipt photo</Text>
                </View>
                <View style={styles.kpiBox}>
                  <Text style={styles.kpiValue}>{computed.countExpenses}</Text>
                  <Text style={styles.kpiLabel}>Expenses in range</Text>
                </View>
              </View>
            </View>

            {/* ANOMALIES */}
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>Anomalies</Text>
                <Ionicons name="alert-circle-outline" size={18} color={theme.colors.primary} />
              </View>

              {computed.anomalies.length === 0 ? (
                <Text style={styles.mutedSmall}>No unusual expenses detected in this range.</Text>
              ) : (
                computed.anomalies.map((a) => (
                  <View key={a.id} style={styles.rowLine}>
                    <View style={styles.rowLeft}>
                      <View
                        style={[
                          styles.rowIcon,
                          { backgroundColor: "rgba(239,68,68,0.10)", borderColor: "rgba(239,68,68,0.18)" },
                        ]}
                      >
                        <Ionicons name="trending-up-outline" size={18} color={theme.colors.error} />
                      </View>
                      <View>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                          {a.title || "Expense"}
                        </Text>
                        <Text style={styles.rowSub}>{CAT_LABEL[a.category ?? "other"] ?? a.category ?? "other"}</Text>
                      </View>
                    </View>
                    <Text style={[styles.rowRight, { color: theme.colors.error }]}>{formatPKR(a.amountPkr)}</Text>
                  </View>
                ))
              )}
            </View>

            {/* EXPORT EXCEL - CIRCULAR BUTTONS */}
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>Export Excel (.xlsx)</Text>
                <Ionicons name="download-outline" size={18} color={theme.colors.primary} />
              </View>

              <View style={styles.exportCircleRow}>
                <ExportCircle label="Today" icon="time-outline" onPress={() => exportXlsx("today")} disabled={exporting} />
                <ExportCircle label="Week" icon="calendar-outline" onPress={() => exportXlsx("week")} disabled={exporting} />
                <ExportCircle label="Month" icon="calendar-number-outline" onPress={() => exportXlsx("month")} disabled={exporting} />
                <ExportCircle label="Year" icon="albums-outline" onPress={() => exportXlsx("month")} disabled={exporting} />
              </View>

              {exporting ? (
                <View style={{ marginTop: 10, flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <ActivityIndicator color={theme.colors.primary} />
                  <Text style={styles.mutedSmall}>Preparing Excel…</Text>
                </View>
              ) : null}
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

  rangeRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  pill: { flex: 1, height: 40, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  pillIdle: { backgroundColor: "rgba(255,255,255,0.9)", borderColor: theme.colors.border },
  pillActive: { backgroundColor: "rgba(59,130,246,0.12)", borderColor: "rgba(20, 35, 59, 0.25)" },
  pillText: { fontFamily: theme.font.bold, fontSize: 13 },
  pillTextIdle: { color: theme.colors.muted },
  pillTextActive: { color: theme.colors.primary },

  heroWrap: {
    marginTop: 14,
    borderRadius: theme.radius.xl,
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.10 : 0.20,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  hero: { borderRadius: theme.radius.xl, padding: 16, overflow: "hidden" },

  heroTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
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

  heroMain: { marginTop: 14, flexDirection: "row", gap: 14, alignItems: "center" },
  heroK: { fontFamily: theme.font.medium, color: "rgba(255,255,255,0.86)", fontSize: 12 },
  heroV: { marginTop: 6, fontFamily: theme.font.bold, color: "#fff", fontSize: 20 },

  donutCenter: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  donutTop: { fontFamily: theme.font.bold, color: "#fff", fontSize: 14 },
  donutBottom: { marginTop: 4, fontFamily: theme.font.medium, color: "rgba(255,255,255,0.86)", fontSize: 11 },

  heroStatsRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  heroMini: {
    flex: 1,
    borderRadius: 18,
    padding: 10,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
  },
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
    padding: 14,
  },
  cardTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  cardTitle: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 15 },

  mutedSmall: { marginTop: 4, fontFamily: theme.font.regular, color: theme.colors.muted, fontSize: 12, lineHeight: 16 },

  waveMeta: { marginTop: 6 },

  navyChartPanel: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(11,18,32,0.55)",
    padding: 10,
  },

  createdGrid: { flexDirection: "row", gap: 12 },
  createdBox: {
    flex: 1,
    borderRadius: 20,
    padding: 12,
    backgroundColor: "rgba(10,18,38,0.06)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.08)",
  },
  createdIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(59,130,246,0.10)",
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.18)",
  },
  createdK: { marginTop: 10, fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 13 },
  createdV: { marginTop: 6, fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 14 },
  createdS: { marginTop: 4, fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 12 },

  highlightsRow: { flexDirection: "row", gap: 12, marginTop: 4 },
  tinyChartBox: {
    flex: 1.4,
    borderRadius: 20,
    padding: 12,
    backgroundColor: "rgba(10,18,38,0.06)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.08)",
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  hlTitle: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 13 },
  hlSub: { marginTop: 2, fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 11 },

  legendRow: { marginTop: 6, flexDirection: "row", alignItems: "center", gap: 8 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: theme.font.medium, color: theme.colors.text, fontSize: 11 },

  resultBox: {
    flex: 1,
    borderRadius: 20,
    padding: 12,
    backgroundColor: "rgba(91,95,239,0.10)",
    borderWidth: 1,
    borderColor: "rgba(91,95,239,0.18)",
    justifyContent: "center",
  },
  resultK: { fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 11 },
  resultV: { marginTop: 6, fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 16 },
  resultSub: { marginTop: 4, fontFamily: theme.font.bold, color: theme.colors.primary, fontSize: 12 },

  rowLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(17,24,39,0.06)",
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, paddingRight: 10 },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(59,130,246,0.10)",
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.18)",
  },
  rowTitle: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 14 },
  rowSub: { marginTop: 2, fontFamily: theme.font.regular, color: theme.colors.muted, fontSize: 12 },
  rowRight: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 13 },

  rankBubble: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  rankFirst: { backgroundColor: "rgba(245,158,11,0.14)", borderColor: "rgba(245,158,11,0.25)" },
  rankOther: { backgroundColor: "rgba(107,114,128,0.10)", borderColor: "rgba(107,114,128,0.18)" },
  rankText: { fontFamily: theme.font.bold, color: theme.colors.text },

  kpiRow: { flexDirection: "row", gap: 10 },
  kpiBox: { flex: 1, padding: 12, borderRadius: 16, backgroundColor: "rgba(59,130,246,0.08)", borderWidth: 1, borderColor: "rgba(59,130,246,0.14)" },
  kpiValue: { fontFamily: theme.font.bold, color: theme.colors.primary, fontSize: 22 },
  kpiLabel: { marginTop: 4, fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 12 },

  exportCircleRow: { marginTop: 12, flexDirection: "row", justifyContent: "space-between" },
  exportCircle: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center" },
  exportCircleText: { marginTop: 8, fontFamily: theme.font.bold, color: theme.colors.muted, fontSize: 12 },

  centerBox: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  loadingText: { marginTop: 10, color: theme.colors.muted, fontFamily: theme.font.medium },

  emptyTitle: { marginTop: 10, fontFamily: theme.font.bold, fontSize: 18, color: theme.colors.text },
  emptySub: { marginTop: 6, fontFamily: theme.font.regular, color: theme.colors.muted, textAlign: "center" },
});
