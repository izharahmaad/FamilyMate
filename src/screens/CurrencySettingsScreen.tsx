import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { doc, onSnapshot, setDoc } from "firebase/firestore";

import { auth, db } from "../lib/firebase";
import { theme } from "../theme";

type CurrencyCode = "PKR" | "KWD" | "USD" | "SAR" | "AED" | "EUR" | "GBP";

const CURRENCIES: Array<{ code: CurrencyCode; name: string; symbol: string; color: string }> = [
  { code: "PKR", name: "Pakistani Rupee", symbol: "₨", color: "#16A34A" },
  { code: "KWD", name: "Kuwaiti Dinar", symbol: "د.ك", color: "#4F46E5" },
  { code: "USD", name: "US Dollar", symbol: "$", color: "#0284C7" },
  { code: "SAR", name: "Saudi Riyal", symbol: "﷼", color: "#CA8A04" },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ", color: "#0F766E" },
  { code: "EUR", name: "Euro", symbol: "€", color: "#7C3AED" },
  { code: "GBP", name: "British Pound", symbol: "£", color: "#EA580C" },
];

function Chip({
  icon,
  text,
  color,
  tone = "soft",
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  color: string;
  tone?: "soft" | "solid";
}) {
  const bg = tone === "solid" ? color : `${color}14`;
  const br = tone === "solid" ? `${color}55` : `${color}2A`;
  const txt = tone === "solid" ? "#fff" : color;

  return (
    <View style={[styles.chip, { backgroundColor: bg, borderColor: br }]}>
      <Ionicons name={icon} size={14} color={txt} />
      <Text style={[styles.chipText, { color: txt }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

function CurrencyRow({
  code,
  name,
  symbol,
  color,
  selected,
  onPress,
}: {
  code: CurrencyCode;
  name: string;
  symbol: string;
  color: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.92 }]}>
      <View style={[styles.iconCircle, { backgroundColor: `${color}12`, borderColor: `${color}22` }]}>
        <Text style={[styles.symbol, { color }]}>{symbol}</Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {code}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {name}
        </Text>
      </View>

      {selected ? (
        <View style={[styles.checkCircle, { backgroundColor: `${color}14`, borderColor: `${color}26` }]}>
          <Ionicons name="checkmark" size={16} color={color} />
        </View>
      ) : (
        <View style={styles.chevCircle}>
          <Ionicons name="chevron-forward" size={16} color={theme.colors.muted} />
        </View>
      )}
    </Pressable>
  );
}

export default function CurrencySettingsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();

  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currency, setCurrency] = useState<CurrencyCode>("PKR");

  const userRef = useMemo(() => (uid ? doc(db, "users", uid) : null), [uid]);

  const saveTimer = useRef<any>(null);
  const pendingRef = useRef<CurrencyCode>("PKR");
  const ignoreSnapshotRef = useRef(false);

  const selectedMeta = useMemo(
    () => CURRENCIES.find((x) => x.code === currency) || CURRENCIES[0],
    [currency]
  );

  useEffect(() => {
    const t = setInterval(() => {
      const next = auth.currentUser?.uid ?? null;
      setUid((prev) => (prev === next ? prev : next));
    }, 400);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!userRef) {
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(
      userRef,
      { includeMetadataChanges: true },
      (snap) => {
        const d: any = snap.data() || {};
        const c = d?.settings?.currency as CurrencyCode | undefined;

        setSaving(snap.metadata.hasPendingWrites);

        if (ignoreSnapshotRef.current && snap.metadata.hasPendingWrites) {
          setLoading(false);
          return;
        }

        if (c && CURRENCIES.some((x) => x.code === c)) {
          pendingRef.current = c;
          setCurrency(c);
        }
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        Alert.alert("Currency", err?.message || "Failed to load currency");
      }
    );

    return () => unsub();
  }, [userRef]);

  const scheduleSave = (next: CurrencyCode) => {
    if (!userRef) return;

    pendingRef.current = next;
    ignoreSnapshotRef.current = true;
    setSaving(true);

    if (saveTimer.current) clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(async () => {
      try {
        await setDoc(userRef, { settings: { currency: pendingRef.current } }, { merge: true });
      } catch (e: any) {
        Alert.alert("Save failed", e?.message || "Could not update currency");
        ignoreSnapshotRef.current = false;
      } finally {
        setTimeout(() => {
          ignoreSnapshotRef.current = false;
        }, 500);
      }
    }, 250);
  };

  const choose = (c: CurrencyCode) => {
    setCurrency(c);
    scheduleSave(c);
  };

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
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.9 }]}
        >
          <Ionicons name="chevron-back" size={18} color={theme.colors.text} />
        </Pressable>

        <View pointerEvents="none" style={styles.centerTitle}>
          <View style={styles.centerTitlePill}>
            <Ionicons name="cash-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.centerTitleText}>Currency</Text>
          </View>
        </View>

        <View style={styles.rightGhost}>
          {loading ? <ActivityIndicator color={theme.colors.primary} /> : null}
        </View>
      </View>

      <View style={styles.hero}>
        <View style={styles.heroLeft}>
          <View style={[styles.heroIcon, { backgroundColor: `${selectedMeta.color}12`, borderColor: `${selectedMeta.color}22` }]}>
            <Text style={[styles.heroSymbol, { color: selectedMeta.color }]}>{selectedMeta.symbol}</Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.heroK}>Selected</Text>
            <Text style={styles.heroV} numberOfLines={1}>
              {selectedMeta.code} • {selectedMeta.name}
            </Text>
          </View>
        </View>

        <View style={{ alignItems: "flex-end", gap: 8 }}>
          <Chip icon="pricetag-outline" text={selectedMeta.code} color={selectedMeta.color} />
          <Chip
            icon={saving ? "sync-outline" : "checkmark-circle-outline"}
            text={saving ? "Saving…" : "Saved"}
            color={saving ? "#64748B" : "#16A34A"}
            tone="soft"
          />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 18 + insets.bottom }}>
        <View style={styles.card}>
          {CURRENCIES.map((c, idx) => {
            const selected = c.code === currency;
            return (
              <View key={c.code}>
                <CurrencyRow
                  code={c.code}
                  name={c.name}
                  symbol={c.symbol}
                  color={c.color}
                  selected={selected}
                  onPress={() => choose(c.code)}
                />
                {idx !== CURRENCIES.length - 1 ? <View style={styles.divider} /> : null}
              </View>
            );
          })}
        </View>

        <View style={styles.footerSpace} />
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
  heroIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  heroSymbol: { fontFamily: theme.font.bold, fontSize: 16 },
  heroK: { fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 12 },
  heroV: { marginTop: 4, fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 14 },

  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 160,
  },
  chipText: { fontFamily: theme.font.bold, fontSize: 12 },

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
  iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  symbol: { fontFamily: theme.font.bold, fontSize: 16 },
  rowTitle: { fontFamily: theme.font.bold, fontSize: 14, color: theme.colors.text },
  rowSub: { marginTop: 3, fontFamily: theme.font.regular, fontSize: 12, color: theme.colors.muted },

  divider: { height: 1, backgroundColor: "rgba(17,24,39,0.06)", marginLeft: 72 },

  checkCircle: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  chevCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(17,24,39,0.05)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.07)",
  },

  footerSpace: { height: 10 },
});
