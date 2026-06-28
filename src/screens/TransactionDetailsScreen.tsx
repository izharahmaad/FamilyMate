import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ActivityIndicator,
  Linking,
  Alert,
  ScrollView,
  Modal,
  StatusBar,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import Feather from "@expo/vector-icons/Feather";
import { LinearGradient } from "expo-linear-gradient";
import { doc, onSnapshot } from "firebase/firestore";
import * as Clipboard from "expo-clipboard";

import { db } from "../lib/firebase";
import { theme } from "../theme";

const HEADER_H = 56;

const ui = {
  card: "rgba(255,255,255,0.97)",
  stroke: "rgba(17,24,39,0.06)",
  stroke2: "rgba(17,24,39,0.10)",
  soft: "rgba(17,24,39,0.04)",

  heroChipBg: "rgba(255,255,255,0.14)",
  heroChipStroke: "rgba(255,255,255,0.22)",
  heroSub: "rgba(255,255,255,0.86)",

  liveGreen: "#22C55E",
  liveAmber: "#F59E0B",
};

function catUI(cat?: string): {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  label: string;
  accent: string;
} {
  const c = (cat || "other").toLowerCase();

  if (c.includes("rent") || c.includes("home"))
    return { icon: "home-outline", tint: "rgba(59,130,246,0.12)", label: "Rent", accent: "#3B82F6" };
  if (c.includes("groc"))
    return { icon: "cart-outline", tint: "rgba(34,197,94,0.12)", label: "Groceries", accent: "#22C55E" };
  if (c.includes("trans") || c.includes("fuel"))
    return { icon: "car-outline", tint: "rgba(245,158,11,0.14)", label: "Transport", accent: "#F59E0B" };
  if (c.includes("bill") || c.includes("util"))
    return { icon: "flash-outline", tint: "rgba(168,85,247,0.12)", label: "Bills", accent: "#A855F7" };
  if (c.includes("food") || c.includes("eat"))
    return { icon: "restaurant-outline", tint: "rgba(236,72,153,0.12)", label: "Eating out", accent: "#EC4899" };
  if (c.includes("health") || c.includes("med"))
    return { icon: "medkit-outline", tint: "rgba(14,165,233,0.12)", label: "Health", accent: "#0EA5E9" };

  return { icon: "apps-outline", tint: "rgba(91,95,239,0.12)", label: cat || "Other", accent: theme.colors.primary };
}

function money(amount: number, currency: string) {
  const dec = currency === "KWD" ? 3 : 2;
  return Math.abs(amount).toFixed(dec);
}

function shortId(s?: string) {
  const x = (s || "").trim();
  if (!x) return "";
  if (x.length <= 10) return x;
  return `${x.slice(0, 6)}…${x.slice(-3)}`;
}

function Pill({
  icon,
  text,
  tone = "neutral",
  tint,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  tone?: "neutral" | "primary" | "hero";
  tint?: string;
}) {
  const cfg =
    tone === "hero"
      ? { bg: ui.heroChipBg, br: ui.heroChipStroke, fg: "#fff" }
      : tone === "primary"
      ? { bg: `${(tint || theme.colors.primary)}14`, br: `${(tint || theme.colors.primary)}22`, fg: tint || theme.colors.primary }
      : { bg: ui.soft, br: ui.stroke2, fg: theme.colors.muted };

  return (
    <View style={[styles.pill, { backgroundColor: cfg.bg, borderColor: cfg.br }]}>
      <Ionicons name={icon} size={12} color={cfg.fg} />
      <Text style={[styles.pillText, { color: cfg.fg }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

function CircleAction({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={10}
      style={({ pressed }) => [
        styles.actionCircle,
        disabled && { opacity: 0.55 },
        pressed && !disabled && { transform: [{ scale: 0.985 }], opacity: 0.92 },
      ]}
    >
      <Ionicons name={icon} size={18} color={disabled ? theme.colors.muted : theme.colors.primary} />
      <Text style={[styles.actionCircleText, disabled && { color: theme.colors.muted }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function InfoRow({
  icon,
  k,
  v,
  onCopy,
  copyLabel,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  k: string;
  v: string;
  onCopy?: () => void;
  copyLabel?: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={16} color={theme.colors.primary} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.infoK}>{k}</Text>
        <Text style={styles.infoV}>{v || "—"}</Text>
      </View>

      {onCopy ? (
        <Pressable onPress={onCopy} hitSlop={10} style={({ pressed }) => [styles.copyMini, pressed && { opacity: 0.85 }]}>
          <Ionicons name="copy-outline" size={16} color={theme.colors.muted} />
          <Text style={styles.copyMiniText}>{copyLabel || "Copy"}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function TransactionDetailsScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { familyId, txId } = route.params as { familyId: string; txId: string };

  const [loading, setLoading] = useState(true);
  const [tx, setTx] = useState<any>(null);
  const [listenError, setListenError] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    const ref = doc(db, "families", familyId, "transactions", txId);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        setTx(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        setLoading(false);
        setListenError("");
      },
      (e) => {
        setLoading(false);
        setListenError(e?.message || "Syncing…");
      }
    );

    return unsub;
  }, [familyId, txId]);

  const amount = Number(tx?.amountPkr ?? tx?.amount ?? tx?.amountKwd ?? 0);
  const currency = tx?.currency || "PKR";
  const ts = tx?.createdAt?.toDate ? tx.createdAt.toDate() : null;
  const when = ts ? ts.toLocaleString() : tx?.dateISO || "—";
  const receiptUrl = tx?.receiptUrl || "";
  const cat = catUI(tx?.category);

  const whoName = (tx?.byName || "").trim() || "Member";
  const whoUid = (tx?.byUid || "").trim();

  const amountStr = useMemo(() => `-${money(amount, currency)} ${currency}`, [amount, currency]);
  const liveOk = !listenError;

  async function openReceipt(url: string) {
    try {
      const ok = await Linking.canOpenURL(url);
      if (!ok) return Alert.alert("Receipt", "Can't open this URL");
      await Linking.openURL(url);
    } catch {
      Alert.alert("Receipt", "Could not open receipt.");
    }
  }

  async function copyText(label: string, value: string) {
    if (!value) return;
    await Clipboard.setStringAsync(value);
    Alert.alert("Copied", `${label} copied.`);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
        <ActivityIndicator color={theme.colors.primary} />
        <Text style={styles.muted}>Loading…</Text>
      </View>
    );
  }

  if (!tx) {
    return (
      <View style={styles.center}>
        <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
        <Text style={styles.muted}>Transaction not found.</Text>
        <Pressable onPress={() => navigation.goBack()} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Back</Text>
        </Pressable>
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

      {/* Header: back left, copy right, title centered (no clash) */}
      <View style={[styles.headerBar, { paddingTop: insets.top }]}>
        <View style={styles.headerInner}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12}
            style={({ pressed }) => [styles.navBtn, { left: 18 }, pressed && { opacity: 0.9 }]}
          >
            <Ionicons name="chevron-back" size={18} color={theme.colors.text} />
          </Pressable>

          <View pointerEvents="none" style={styles.centerTitle}>
            <View style={[styles.detailsLivePill, !liveOk && { opacity: 0.72 }]}>
              <Feather name="file-text" size={16} color={theme.colors.primary} />
              <Text style={styles.detailsLiveText}>Details</Text>
              <View style={[styles.liveDot, { backgroundColor: liveOk ? ui.liveGreen : ui.liveAmber }]} />
              <Text style={[styles.detailsLiveSub, { color: liveOk ? ui.liveGreen : ui.liveAmber }]}>
                {liveOk ? "Live" : "Sync"}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() => copyText("Tx ID", txId)}
            hitSlop={12}
            style={({ pressed }) => [styles.navBtn, { right: 18 }, pressed && { opacity: 0.9 }]}
          >
            <Ionicons name="copy-outline" size={20} color={theme.colors.text} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 14,
          paddingBottom: 44 + Math.max(insets.bottom, 10),
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroWrap}>
          <LinearGradient
            colors={["#2559c2", "#0a0a2e", "#112B5C"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroRow}>
              <View style={[styles.heroIcon, { backgroundColor: ui.heroChipBg, borderColor: ui.heroChipStroke }]}>
                <Ionicons name={cat.icon} size={22} color="#fff" />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.heroTitle} numberOfLines={1}>
                  {tx?.title || "Transaction"}
                </Text>

                <View style={styles.heroChips}>
                  <Pill icon="pricetag-outline" text={cat.label} tone="hero" />
                  <Pill icon="cash-outline" text={currency} tone="hero" />
                  {whoUid ? <Pill icon="key-outline" text={shortId(whoUid)} tone="hero" /> : null}
                </View>
              </View>
            </View>

            <View style={styles.amountWrap}>
              <View style={styles.amountPill}>
                <Text style={styles.amountBig}>{amountStr}</Text>
              </View>
              <Text style={styles.amountSub}>Use quick actions to copy values or open the receipt.</Text>
            </View>
          </LinearGradient>
        </View>

        <View style={styles.actionsRow}>
          <CircleAction icon="calculator-outline" label="Amount" onPress={() => copyText("Amount", amountStr)} />
          <CircleAction icon="person-outline" label="Member" onPress={() => copyText("Member", whoName)} />
          <CircleAction icon="time-outline" label="Date" onPress={() => copyText("Date/time", when)} />
          <CircleAction
            icon="receipt-outline"
            label="Receipt"
            disabled={!receiptUrl}
            onPress={() => (receiptUrl ? setPreviewOpen(true) : Alert.alert("Receipt", "No receipt attached."))}
          />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.headerIconCircle}>
              <Feather name="file-text" size={16} color={theme.colors.primary} />
            </View>
            <Text style={styles.cardTitle}>Transaction info</Text>
          </View>

          <InfoRow icon="person-outline" k="Created by" v={whoName} onCopy={() => copyText("Created by", whoName)} />
          {whoUid ? (
            <>
              <View style={styles.sep} />
              <InfoRow icon="key-outline" k="Creator UID" v={shortId(whoUid)} onCopy={() => copyText("Creator UID", whoUid)} />
            </>
          ) : null}

          <View style={styles.sep} />
          <InfoRow icon="time-outline" k="Date / time" v={when} onCopy={() => copyText("Date/time", when)} />

          <View style={styles.sep} />
          <InfoRow icon="bookmark-outline" k="Category" v={cat.label} />
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Receipt</Text>
          <Pill
            icon={receiptUrl ? "attach-outline" : "remove-outline"}
            text={receiptUrl ? "Attached" : "None"}
            tone="primary"
            tint={receiptUrl ? theme.colors.primary : "#64748B"}
          />
        </View>

        {receiptUrl ? (
          <View style={styles.card}>
            <Pressable onPress={() => setPreviewOpen(true)} style={styles.receiptThumbWrap}>
              <Image source={{ uri: receiptUrl }} style={styles.receiptImg} />
              <View style={styles.receiptOverlay}>
                <View style={styles.receiptOverlayPill}>
                  <Ionicons name="expand-outline" size={16} color="#fff" />
                  <Text style={styles.receiptOverlayText}>Tap to preview</Text>
                </View>
              </View>
            </Pressable>

            <View style={styles.receiptBtns}>
              <Pressable onPress={() => openReceipt(receiptUrl)} style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.92 }]}>
                <Ionicons name="open-outline" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>Open</Text>
              </Pressable>

              <Pressable onPress={() => setPreviewOpen(true)} style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.92 }]}>
                <Ionicons name="expand-outline" size={18} color={theme.colors.text} />
                <Text style={styles.ghostBtnText}>Full screen</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.emptyRow}>
              <View style={styles.emptyIcon}>
                <Ionicons name="image-outline" size={18} color={theme.colors.muted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.emptyTitle}>No receipt attached</Text>
                <Text style={styles.muted}>Attach receipt when adding expense for better tracking.</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      <Modal visible={previewOpen} transparent animationType="fade" onRequestClose={() => setPreviewOpen(false)}>
        <View style={styles.modalWrap}>
          <View style={[styles.modalTop, { paddingTop: insets.top }]}>
            <Pressable onPress={() => setPreviewOpen(false)} hitSlop={12} style={styles.modalClose}>
              <Ionicons name="close" size={26} color="#fff" />
            </Pressable>
          </View>

          <View style={styles.modalBody}>
            {receiptUrl ? <Image source={{ uri: receiptUrl }} style={styles.modalImg} resizeMode="contain" /> : null}
          </View>

          <View style={[styles.modalBottom, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <Pressable onPress={() => openReceipt(receiptUrl)} style={({ pressed }) => [styles.modalBtn, pressed && { opacity: 0.92 }]}>
              <Ionicons name="download-outline" size={18} color="#fff" />
              <Text style={styles.modalBtnText}>Open / Download</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },

  headerBar: {},
  headerInner: { height: HEADER_H, justifyContent: "center" },

  navBtn: {
    position: "absolute",
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
  detailsLivePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 999,
    backgroundColor: ui.card,
    borderWidth: 1,
    borderColor: ui.stroke,
  },
  detailsLiveText: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 13 },
  liveDot: { width: 8, height: 8, borderRadius: 4, opacity: 0.95 },
  detailsLiveSub: { fontFamily: theme.font.bold, fontSize: 12 },

  heroWrap: { borderRadius: 26, overflow: "hidden" },
  hero: {
    borderRadius: 26,
    padding: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.12 : 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 14 },
    elevation: 4,
  },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  heroIcon: { width: 50, height: 50, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  heroTitle: { fontFamily: theme.font.bold, color: "#fff", fontSize: 18 },
  heroChips: { marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 },

  amountWrap: { marginTop: 16 },
  amountPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  amountBig: { fontFamily: theme.font.bold, color: theme.colors.primary, fontSize: 22 },
  amountSub: { marginTop: 8, fontFamily: theme.font.medium, color: ui.heroSub, fontSize: 12 },

  pill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, maxWidth: 190 },
  pillText: { fontFamily: theme.font.bold, fontSize: 11 },

  actionsRow: { marginTop: 14, flexDirection: "row", justifyContent: "space-between" },
  actionCircle: { width: 78, height: 78, borderRadius: 39, backgroundColor: ui.card, borderWidth: 1, borderColor: ui.stroke, alignItems: "center", justifyContent: "center", gap: 6 },
  actionCircleText: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 11 },

  card: { marginTop: 14, backgroundColor: ui.card, borderRadius: 22, padding: 14, borderWidth: 1, borderColor: ui.stroke },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  headerIconCircle: { width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(91,95,239,0.10)", alignItems: "center", justifyContent: "center" },
  cardTitle: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 14 },

  infoRow: { flexDirection: "row", gap: 12, alignItems: "center", paddingVertical: 10 },
  infoIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(91,95,239,0.10)", alignItems: "center", justifyContent: "center" },
  infoK: { fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 11 },
  infoV: { marginTop: 2, fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 13 },
  sep: { height: 1, backgroundColor: ui.stroke },

  copyMini: { height: 34, paddingHorizontal: 10, borderRadius: 999, backgroundColor: ui.soft, borderWidth: 1, borderColor: ui.stroke2, flexDirection: "row", alignItems: "center", gap: 6 },
  copyMiniText: { fontFamily: theme.font.bold, color: theme.colors.muted, fontSize: 12 },

  sectionRow: { marginTop: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontFamily: theme.font.bold, fontSize: 16, color: theme.colors.text },

  receiptThumbWrap: { borderRadius: 22, overflow: "hidden", backgroundColor: ui.soft },
  receiptImg: { width: "100%", height: 320, backgroundColor: ui.soft },
  receiptOverlay: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 12 },
  receiptOverlayPill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, height: 34, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.45)", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)" },
  receiptOverlayText: { fontFamily: theme.font.bold, color: "#fff", fontSize: 12 },

  receiptBtns: { marginTop: 12, flexDirection: "row", gap: 12 },
  primaryBtn: { flex: 1, height: 50, borderRadius: 999, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10 },
  primaryBtnText: { color: "#fff", fontFamily: theme.font.bold },
  ghostBtn: { flex: 1, height: 50, borderRadius: 999, backgroundColor: ui.soft, borderWidth: 1, borderColor: ui.stroke2, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10 },
  ghostBtnText: { color: theme.colors.text, fontFamily: theme.font.bold },

  emptyRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  emptyIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: ui.soft, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 14 },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: theme.colors.background },
  muted: { fontFamily: theme.font.medium, color: theme.colors.muted },

  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)" },
  modalTop: { paddingHorizontal: 10, flexDirection: "row", justifyContent: "flex-end" },
  modalClose: { padding: 10, borderRadius: 999 },
  modalBody: { flex: 1, paddingHorizontal: 12, justifyContent: "center" },
  modalImg: { width: "100%", height: "100%" },
  modalBottom: { paddingHorizontal: 18, paddingTop: 10 },
  modalBtn: { height: 54, borderRadius: 999, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10 },
  modalBtnText: { color: "#fff", fontFamily: theme.font.bold },
});
