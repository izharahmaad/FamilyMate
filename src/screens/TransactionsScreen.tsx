import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import Feather from "@expo/vector-icons/Feather";
import { LinearGradient } from "expo-linear-gradient";
import { collection, doc, limit, onSnapshot, orderBy, query } from "firebase/firestore";

import { auth, db } from "../lib/firebase";
import { theme } from "../theme";

type TxRow = {
  id: string;
  title: string;
  byName: string;
  byUid?: string;
  when: string;
  amount: number;
  currency: string;
  category?: string;
  receiptUrl?: string;
};

const HEADER_H = 56; // consistent tap targets on both platforms

const ui = {
  bg: theme.colors.background,
  card: "rgba(255,255,255,0.97)",
  stroke: "rgba(17,24,39,0.06)",
  soft: "rgba(17,24,39,0.04)",
  chip: "rgba(17,24,39,0.03)",
  liveGreen: "#22C55E",
  liveAmber: "#F59E0B",
};

function catIcon(cat?: string): keyof typeof Ionicons.glyphMap {
  const c = (cat || "other").toLowerCase();
  if (c.includes("groc")) return "cart-outline";
  if (c.includes("rent") || c.includes("home")) return "home-outline";
  if (c.includes("trans") || c.includes("fuel")) return "car-outline";
  if (c.includes("bill") || c.includes("util")) return "flash-outline";
  if (c.includes("food") || c.includes("eat")) return "restaurant-outline";
  if (c.includes("health") || c.includes("med")) return "medkit-outline";
  return "apps-outline";
}

function catTone(cat?: string) {
  const c = (cat || "other").toLowerCase();

  if (c.includes("groc")) return { bg: "rgba(34,197,94,0.10)", br: "rgba(34,197,94,0.22)", fg: "#16A34A" };
  if (c.includes("rent") || c.includes("home")) return { bg: "rgba(59,130,246,0.10)", br: "rgba(59,130,246,0.22)", fg: "#3B82F6" };
  if (c.includes("trans") || c.includes("fuel")) return { bg: "rgba(245,158,11,0.12)", br: "rgba(245,158,11,0.22)", fg: "#F59E0B" };
  if (c.includes("bill") || c.includes("util")) return { bg: "rgba(168,85,247,0.10)", br: "rgba(168,85,247,0.22)", fg: "#A855F7" };
  if (c.includes("food") || c.includes("eat")) return { bg: "rgba(236,72,153,0.10)", br: "rgba(236,72,153,0.22)", fg: "#EC4899" };
  if (c.includes("health") || c.includes("med")) return { bg: "rgba(14,165,233,0.10)", br: "rgba(14,165,233,0.22)", fg: "#0EA5E9" };

  return { bg: "rgba(91,95,239,0.10)", br: "rgba(91,95,239,0.22)", fg: theme.colors.primary };
}

function fmtAmount(amount: number, currency: string) {
  const dec = currency === "KWD" ? 3 : 2;
  return `-${Math.abs(amount).toFixed(dec)}`;
}

function whoLabel(byName: string, byUid?: string) {
  const w = (byName || "").trim();
  if (w) return w;
  const u = (byUid || "").trim();
  return u ? u.slice(0, 6) + "…" : "Member";
}

function decimalsFor(currency: string) {
  return currency === "KWD" ? 3 : 2;
}

function FilterChip({
  text,
  active,
  onPress,
  tint,
}: {
  text: string;
  active: boolean;
  onPress: () => void;
  tint: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        {
          borderColor: `${tint}22`,
          backgroundColor: active ? `${tint}14` : "rgba(255,255,255,0.90)",
        },
        pressed && { opacity: 0.9 },
      ]}
    >
      <Text style={[styles.filterChipText, { color: active ? tint : theme.colors.text }]} numberOfLines={1}>
        {text}
      </Text>
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

export default function TransactionsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();

  const [familyId, setFamilyId] = useState<string | null>(null);
  const [rows, setRows] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [listenError, setListenError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // 2 new features (UI-only)
  const [catFilter, setCatFilter] = useState<string>("all");
  const [sortMode, setSortMode] = useState<"newest" | "oldest">("newest");

  const unsubTxRef = useRef<null | (() => void)>(null);

  useEffect(() => {
    const u = auth.currentUser;
    if (!u) return;

    const unsubUser = onSnapshot(doc(db, "users", u.uid), (snap) => {
      const fid = (snap.data() as any)?.familyId || null;
      setFamilyId(fid);

      unsubTxRef.current?.();
      setListenError("");

      if (!fid) {
        setRows([]);
        setLoading(false);
        return;
      }

      const txRef = collection(db, "families", fid, "transactions");
      const qTx = query(txRef, orderBy("createdAt", "desc"), limit(200));

      unsubTxRef.current = onSnapshot(
        qTx,
        (qSnap) => {
          const out: TxRow[] = [];
          qSnap.forEach((d) => {
            const x = d.data() as any;
            const ts = x?.createdAt?.toDate ? x.createdAt.toDate() : null;

            out.push({
              id: d.id,
              title: x?.title || "Transaction",
              byName: x?.byName || "Member",
              byUid: x?.byUid || "",
              when: ts ? ts.toLocaleString() : "Now",
              amount: Number(x?.amountPkr ?? x?.amount ?? x?.amountKwd ?? 0),
              currency: x?.currency || "PKR",
              category: x?.category || "other",
              receiptUrl: x?.receiptUrl || "",
            });
          });

          setRows(out);
          setLoading(false);
          setRefreshing(false);
          setListenError("");
        },
        (err) => {
          setLoading(false);
          setRefreshing(false);
          setListenError(err?.message || "Reconnecting…");
        }
      );
    });

    return () => {
      unsubTxRef.current?.();
      unsubUser();
    };
  }, []);

  const liveOk = !listenError;

  const stats = useMemo(() => {
    let total = 0;
    let withReceipt = 0;
    const ccyCount: Record<string, number> = {};

    for (const r of rows) {
      const amt = Math.abs(Number(r.amount) || 0);
      total += amt;
      if (r.receiptUrl) withReceipt += 1;
      const c = (r.currency || "PKR").toUpperCase();
      ccyCount[c] = (ccyCount[c] || 0) + 1;
    }

    const topCurrency = Object.entries(ccyCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "PKR";
    return { total, withReceipt, topCurrency };
  }, [rows]);

  const statsText = useMemo(() => {
    const dec = decimalsFor(stats.topCurrency);
    return stats.total.toFixed(dec);
  }, [stats.total, stats.topCurrency]);

  const categoryChips = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of rows) {
      const c = (r.category || "other").toLowerCase();
      counts[c] = (counts[c] || 0) + 1;
    }
    const top = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([c]) => c);

    return ["all", ...top];
  }, [rows]);

  const visibleRows = useMemo(() => {
    const filtered = catFilter === "all" ? rows : rows.filter((r) => (r.category || "other").toLowerCase() === catFilter);
    if (sortMode === "newest") return filtered;
    return [...filtered].reverse();
  }, [rows, catFilter, sortMode]);

  if (loading) {
    return (
      <View style={styles.center}>
        <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
        <ActivityIndicator color={theme.colors.primary} />
        <Text style={styles.muted}>Loading transactions…</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <LinearGradient
        pointerEvents="none"
        colors={["rgba(11,18,32,0.10)", "rgba(11,18,32,0.03)", "rgba(11,18,32,0.08)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Fixed header area (responsive) */}
      <View style={[styles.headerBar, { paddingTop: insets.top }]}>
        <View style={styles.headerInner}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.9 }]}
          >
            <Ionicons name="chevron-back" size={18} color={theme.colors.text} />
          </Pressable>

          <View pointerEvents="none" style={styles.centerTitle}>
            <View style={[styles.centerTitlePill, !liveOk && { opacity: 0.8 }]}>
              <Feather name="file-text" size={15} color={theme.colors.primary} />
              <Text style={styles.centerTitleText}>Transactions</Text>
              <View style={[styles.liveDot, { backgroundColor: liveOk ? ui.liveGreen : ui.liveAmber }]} />
              <Text style={[styles.liveText, { color: liveOk ? ui.liveGreen : ui.liveAmber }]}>
                {liveOk ? "Live" : "Sync"}
              </Text>
            </View>
          </View>

          <View style={styles.rightGhost} />
        </View>
      </View>

      <FlatList
        data={visibleRows}
        keyExtractor={(x) => x.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: 18, // header is outside list now; this is normal top spacing
          paddingHorizontal: 18,
          paddingBottom: 120 + Math.max(insets.bottom, 10),
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              setTimeout(() => setRefreshing(false), 900);
            }}
            tintColor={theme.colors.primary}
          />
        }
        ListHeaderComponent={
          <>
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
                      <Ionicons name="analytics-outline" size={12} color="rgba(255,255,255,0.95)" />
                      <Text style={styles.heroLabel}>LAST 200</Text>
                    </View>

                    <View style={styles.heroPillMini}>
                      <Ionicons
                        name={liveOk ? "sync-outline" : "cloud-offline-outline"}
                        size={12}
                        color="rgba(255,255,255,0.95)"
                      />
                      <Text style={styles.heroLabel}>{liveOk ? "LIVE" : "SYNCING"}</Text>
                    </View>
                  </View>

                  <Text style={styles.heroName} numberOfLines={1}>
                    {statsText} {stats.topCurrency}
                  </Text>
                  <Text style={styles.heroHint} numberOfLines={2}>
                    Total spent (absolute) from your latest transactions.
                  </Text>
                </View>

                <View style={styles.heroCount}>
                  <Text style={styles.heroCountNum}>{rows.length}</Text>
                  <Text style={styles.heroCountText}>Rows</Text>
                </View>
              </LinearGradient>
            </View>

            <View style={styles.statsRow}>
              <StatPill label="Receipts" value={String(stats.withReceipt)} icon="receipt-outline" tint="#3B82F6" />
              <StatPill
                label="Members"
                value={String(new Set(rows.map((r) => (r.byUid || r.byName || "").trim()).filter(Boolean)).size)}
                icon="people-outline"
                tint={theme.colors.primary}
              />
            </View>

            <Text style={styles.section}>Controls</Text>
            <View style={styles.controlsCard}>
              <View style={styles.controlsTop}>
                <Text style={styles.controlsTitle}>Sort</Text>
                <Pressable
                  onPress={() => setSortMode((p) => (p === "newest" ? "oldest" : "newest"))}
                  style={({ pressed }) => [styles.sortBtn, pressed && { opacity: 0.9 }]}
                >
                  <Ionicons name="swap-vertical-outline" size={16} color={theme.colors.primary} />
                  <Text style={styles.sortBtnText}>{sortMode === "newest" ? "Newest" : "Oldest"}</Text>
                </Pressable>
              </View>

              <Text style={[styles.controlsTitle, { marginTop: 10 }]}>Category</Text>
              <View style={styles.chipsRow}>
                {categoryChips.map((c) => {
                  const label = c === "all" ? "All" : c.charAt(0).toUpperCase() + c.slice(1);
                  const tint = c === "all" ? theme.colors.primary : catTone(c).fg;
                  return (
                    <FilterChip
                      key={c}
                      text={label}
                      active={catFilter === c}
                      onPress={() => setCatFilter(c)}
                      tint={tint}
                    />
                  );
                })}
              </View>

              {!!listenError ? (
                <View style={styles.banner}>
                  <Ionicons name="cloud-offline-outline" size={16} color={theme.colors.text} />
                  <Text style={styles.bannerText} numberOfLines={2}>
                    {listenError}
                  </Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.section}>Transactions</Text>
          </>
        }
        renderItem={({ item }) => {
          const c = catTone(item.category);
          const who = whoLabel(item.byName, item.byUid);
          const amountText = fmtAmount(item.amount, item.currency);

          return (
            <Pressable
              onPress={() => {
                if (!familyId) return;
                navigation.navigate("TxDetails", { familyId, txId: item.id });
              }}
              hitSlop={6}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.92 }]}
            >
              <View style={styles.rowLeft}>
                <View style={[styles.rowIconWrap, { backgroundColor: c.bg, borderColor: c.br }]}>
                  <Ionicons name={catIcon(item.category)} size={18} color={c.fg} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {item.title}
                  </Text>

                  <View style={styles.metaRow}>
                    <View style={styles.metaChip}>
                      <Ionicons name="person-outline" size={12} color={theme.colors.muted} />
                      <Text style={styles.metaChipText} numberOfLines={1}>
                        {who}
                      </Text>
                    </View>

                    <View style={styles.metaChip}>
                      <Ionicons name="time-outline" size={12} color={theme.colors.muted} />
                      <Text style={styles.metaChipText} numberOfLines={1}>
                        {item.when}
                      </Text>
                    </View>

                    {item.receiptUrl ? (
                      <View style={[styles.metaChip, styles.metaChipAccent]}>
                        <Ionicons name="receipt-outline" size={12} color={theme.colors.primary} />
                        <Text style={[styles.metaChipText, { color: theme.colors.primary }]}>Receipt</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>

              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.amount}>{amountText}</Text>
                <Text style={styles.ccy}>{item.currency}</Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.bg },

  headerBar: {
    backgroundColor: "transparent",
  },
  headerInner: {
    height: HEADER_H,
    paddingHorizontal: 18,
    justifyContent: "center",
  },

  backBtn: {
    position: "absolute",
    left: 18,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.78)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },

  centerTitle: { position: "absolute", left: 18, right: 18, alignItems: "center", justifyContent: "center" },
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

  rightGhost: { position: "absolute", right: 18, width: 42, height: 42 },

  liveDot: { width: 8, height: 8, borderRadius: 4, opacity: 0.95 },
  liveText: { fontFamily: theme.font.bold, fontSize: 12 },

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
  heroName: { marginTop: 10, fontFamily: theme.font.bold, fontSize: 22, color: "#fff" },
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
    backgroundColor: ui.card,
    borderColor: "rgba(17,24,39,0.06)",
  },
  statIcon: { width: 38, height: 38, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  statValue: { fontFamily: theme.font.bold, fontSize: 16, color: theme.colors.text },
  statLabel: { marginTop: 2, fontFamily: theme.font.medium, fontSize: 12, color: theme.colors.muted },

  section: { marginTop: 18, marginBottom: 10, fontFamily: theme.font.medium, fontSize: 13, color: theme.colors.muted, letterSpacing: 0.3 },

  controlsCard: {
    borderRadius: 22,
    backgroundColor: ui.card,
    borderWidth: 1,
    borderColor: ui.stroke,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.05 : 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  controlsTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  controlsTitle: { fontFamily: theme.font.bold, fontSize: 13, color: theme.colors.text },

  sortBtn: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(91,95,239,0.10)",
    borderWidth: 1,
    borderColor: "rgba(91,95,239,0.18)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sortBtnText: { fontFamily: theme.font.bold, color: theme.colors.primary, fontSize: 12 },

  chipsRow: { marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  filterChip: { height: 34, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, justifyContent: "center" },
  filterChipText: { fontFamily: theme.font.bold, fontSize: 12 },

  banner: {
    marginTop: 12,
    backgroundColor: "rgba(245,158,11,0.14)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.22)",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bannerText: { fontFamily: theme.font.medium, color: theme.colors.text, flex: 1 },

  row: {
    borderRadius: 22,
    backgroundColor: ui.card,
    borderWidth: 1,
    borderColor: ui.stroke,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.05 : 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  rowLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: 12, paddingRight: 10 },
  rowIconWrap: { width: 42, height: 42, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  rowTitle: { fontFamily: theme.font.bold, fontSize: 15, color: theme.colors.text },

  metaRow: { marginTop: 6, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: ui.chip,
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.07)",
    maxWidth: 170,
  },
  metaChipAccent: { backgroundColor: "rgba(91,95,239,0.08)", borderColor: "rgba(91,95,239,0.16)" },
  metaChipText: { fontFamily: theme.font.bold, fontSize: 11, color: theme.colors.muted },

  amount: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 14 },
  ccy: { marginTop: 2, fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 12 },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: ui.bg },
  muted: { fontFamily: theme.font.medium, color: theme.colors.muted },
});
