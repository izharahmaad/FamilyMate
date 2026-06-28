import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  Image,
  ScrollView,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  writeBatch,
  increment,
} from "firebase/firestore";

import { auth, db } from "../lib/firebase";
import { theme } from "../theme";

type CatKey =
  | "groceries"
  | "rent"
  | "transport"
  | "bills"
  | "food"
  | "health"
  | "education"
  | "other";

const CATS: {
  key: CatKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  hint: string;
}[] = [
  { key: "groceries", label: "Groceries", icon: "cart-outline", hint: "Vegetables, milk, home items" },
  { key: "rent", label: "Rent", icon: "home-outline", hint: "House, room, rent" },
  { key: "transport", label: "Transport", icon: "car-outline", hint: "Fuel, bus, rickshaw" },
  { key: "bills", label: "Bills", icon: "flash-outline", hint: "Electricity, gas, internet" },
  { key: "food", label: "Eating Out", icon: "restaurant-outline", hint: "Cafe, restaurant, snacks" },
  { key: "health", label: "Health", icon: "medkit-outline", hint: "Medicine, clinic" },
  { key: "education", label: "Education", icon: "school-outline", hint: "School, fees, books" },
  { key: "other", label: "Other", icon: "apps-outline", hint: "Anything else" },
];

// NOTE: don't hardcode keys in production; move to server/env
const IMGBB_KEY = "e7c0f9b29f8e6158c3ea1a12f12300e5";

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

function todayISODate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function uploadToImgBB(base64: string, onStage?: (pct: number) => void) {
  onStage?.(10);

  const form = new FormData();
  form.append("key", IMGBB_KEY);
  form.append("image", base64);

  onStage?.(35);
  const res = await fetch("https://api.imgbb.com/1/upload", {
    method: "POST",
    body: form,
  });
  onStage?.(75);

  const json = await res.json();
  if (!json?.success) throw new Error(json?.error?.message || "Image upload failed");

  onStage?.(100);
  return json.data.url as string;
}

function parseAmountLoose(s: string) {
  const cleaned = s.replace(/[^\d.]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export default function AddExpenseScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const NAVY = "#0B1220";

  const [familyId, setFamilyId] = useState<string | null>(null);

  // ✅ Amount starts empty (no forced .00)
  const [amountText, setAmountText] = useState("");
  const amountNumber = useMemo(() => Number(amountText), [amountText]);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<CatKey>("groceries");
  const [dateISO] = useState(todayISODate());

  const [receiptBase64, setReceiptBase64] = useState<string | null>(null);
  const [uploadPct, setUploadPct] = useState(0);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const u = auth.currentUser;
    if (!u) return;

    (async () => {
      const uSnap = await getDoc(doc(db, "users", u.uid));
      setFamilyId((uSnap.data() as any)?.familyId || null);
    })().catch((e) => Alert.alert("Error", e?.message || "Failed to load family"));
  }, []);

  async function pickFromGallery() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert("Permission", "Media permission is required.");

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      base64: true,
      quality: 0.7,
      allowsEditing: true,
      aspect: [4, 3],
    });

    if (!res.canceled && res.assets?.[0]?.base64) {
      setReceiptBase64(res.assets[0].base64);
      setUploadPct(0);
    }
  }

  async function takeWithCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert("Permission", "Camera permission is required.");

    const res = await ImagePicker.launchCameraAsync({
      base64: true,
      quality: 0.7,
      allowsEditing: true,
      aspect: [4, 3],
    });

    if (!res.canceled && res.assets?.[0]?.base64) {
      setReceiptBase64(res.assets[0].base64);
      setUploadPct(0);
    }
  }

  function removeReceipt() {
    setReceiptBase64(null);
    setUploadPct(0);
  }

  function bumpAmount(delta: number) {
    const n = parseAmountLoose(amountText);
    const next = Math.max(0, Math.round((n + delta) * 100) / 100);
    setAmountText(next === 0 ? "" : String(next));
  }

  function clearAmount() {
    setAmountText("");
  }

  async function saveExpense() {
    const u = auth.currentUser;
    if (!u) return Alert.alert("Auth", "Please login again.");
    if (!familyId) return Alert.alert("Family", "Family not ready yet.");

    const amt = Number(amountNumber);
    if (!Number.isFinite(amt) || amt <= 0) return Alert.alert("Validation", "Enter amount > 0");
    if (!title.trim()) return Alert.alert("Validation", "Enter title");

    setSaving(true);
    setUploadPct(0);

    try {
      let receiptUrl = "";
      if (receiptBase64) receiptUrl = await uploadToImgBB(receiptBase64, setUploadPct);

      const batch = writeBatch(db);

      const txRef = doc(collection(db, "families", familyId, "transactions"));
      batch.set(txRef, {
        title: title.trim(),
        category,
        dateISO,
        amountPkr: amt,
        type: "expense",
        currency: "PKR",
        receiptUrl,
        byUid: u.uid,
        byName: u.email || "Member",
        createdAt: serverTimestamp(),
      });

      batch.update(doc(db, "families", familyId), {
        monthSpentPkr: increment(amt),
      });

      await batch.commit();
      navigation.goBack();
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to save expense");
    } finally {
      setSaving(false);
      setUploadPct(0);
    }
  }

  const preview = useMemo(
    () => formatPKR(Number.isFinite(amountNumber) ? amountNumber : 0),
    [amountNumber]
  );

  const canSave =
    !!title.trim() && Number.isFinite(amountNumber) && amountNumber > 0 && !saving;

  return (
    <View style={styles.root}>
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(11,18,32,0.10)", "rgba(11,18,32,0.02)", "rgba(11,18,32,0.08)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 10) }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.headerBtn}>
          <View style={styles.glassCircle}>
            <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
          </View>
          <Text style={styles.headerBtnText}>Back</Text>
        </Pressable>

        <View style={styles.headerMid}>
          <Text style={styles.h1}>Add Expense</Text>
          <Text style={styles.h2}>Quick entry</Text>
        </View>

        <View style={styles.headerRight}>
          <View style={styles.glassCircle}>
            <Ionicons name="add-circle-outline" size={20} color={theme.colors.primary} />
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <ScrollView
          contentContainerStyle={{
            paddingBottom: 120 + Math.max(insets.bottom, 10),
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* HERO */}
          <View style={styles.heroWrap}>
            <LinearGradient
              colors={["#2559c2", "#0a0a2e", "#112B5C"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              <View style={styles.heroTopRow}>
                <View style={styles.heroPill}>
                  <Ionicons name="calendar-outline" size={12} color="rgba(255,255,255,0.95)" />
                  <Text style={styles.heroPillText}>{dateISO}</Text>
                </View>

                <View style={styles.heroPill}>
                  <Ionicons name="wallet-outline" size={12} color="rgba(255,255,255,0.95)" />
                  <Text style={styles.heroPillText}>PKR</Text>
                </View>
              </View>

              <Text style={styles.heroLabel}>Amount</Text>

              <View style={styles.amountRow}>
                <Text style={styles.ccy}>PKR</Text>
                <TextInput
                  value={amountText}
                  onChangeText={setAmountText}
                  keyboardType={Platform.OS === "ios" ? "decimal-pad" : "numeric"}
                  style={styles.amountInput}
                  placeholder="0"
                  placeholderTextColor="rgba(255,255,255,0.55)"
                  returnKeyType="done"
                />
              </View>

              <Text style={styles.previewText}>{preview}</Text>

              <View style={styles.chipsRow}>
                <Pressable onPress={() => bumpAmount(100)} style={styles.chip}>
                  <Text style={styles.chipText}>+100</Text>
                </Pressable>
                <Pressable onPress={() => bumpAmount(500)} style={styles.chip}>
                  <Text style={styles.chipText}>+500</Text>
                </Pressable>
                <Pressable onPress={() => bumpAmount(1000)} style={styles.chip}>
                  <Text style={styles.chipText}>+1000</Text>
                </Pressable>
                <Pressable onPress={clearAmount} style={[styles.chip, styles.chipGhost]}>
                  <Ionicons name="close-circle-outline" size={16} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.chipText}>Clear</Text>
                </Pressable>
              </View>
            </LinearGradient>
          </View>

          {/* DETAILS */}
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.sectionTitle}>Details</Text>
              <Ionicons name="create-outline" size={18} color={theme.colors.primary} />
            </View>

            <Text style={styles.label}>Title</Text>
            <View style={styles.inputRow}>
              <Ionicons name="pricetag-outline" size={18} color={theme.colors.muted} />
              <TextInput
                value={title}
                onChangeText={setTitle}
                style={styles.textInput}
                placeholder="e.g. Fuel, Dinner, Internet bill"
                placeholderTextColor="rgba(17,24,39,0.40)"
                returnKeyType="next"
              />
            </View>

            <View style={styles.rowLine}>
              <View style={styles.rowLeft}>
                <View style={styles.rowIcon}>
                  <Ionicons name="calendar-outline" size={18} color={theme.colors.primary} />
                </View>
                <View>
                  <Text style={styles.rowTitle}>Date</Text>
                  <Text style={styles.rowSub}>Auto selected</Text>
                </View>
              </View>
              <Text style={styles.rowRight}>{dateISO}</Text>
            </View>
          </View>

          {/* CATEGORY (navy touch) */}
          <View style={styles.card}>
            <View style={styles.catHeaderWrap}>
              <View style={styles.catHeaderNavy}>
                <Ionicons name="grid-outline" size={18} color="#EAF0FF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Category</Text>
                <Text style={styles.catSub}>Pick the best match</Text>
              </View>
            </View>

            <View style={styles.grid}>
              {CATS.map((c) => {
                const active = c.key === category;
                return (
                  <Pressable
                    key={c.key}
                    onPress={() => setCategory(c.key)}
                    style={[styles.catCard, active ? styles.catActive : styles.catIdle]}
                  >
                    {active ? (
                      <LinearGradient
                        colors={[theme.colors.primary, theme.colors.primaryDark]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.catGradient}
                      >
                        <View style={styles.catTop}>
                          <Ionicons name={c.icon} size={20} color="#fff" />
                          <View style={styles.tickPill}>
                            <Ionicons name="checkmark" size={14} color="#fff" />
                          </View>
                        </View>
                        <Text style={[styles.catLabel, { color: "#fff" }]}>{c.label}</Text>
                        <Text
                          style={[styles.catHint, { color: "rgba(255,255,255,0.85)" }]}
                          numberOfLines={1}
                        >
                          {c.hint}
                        </Text>
                      </LinearGradient>
                    ) : (
                      <>
                        <View style={styles.catTop}>
                          <View style={styles.catIconIdle}>
                            <Ionicons name={c.icon} size={18} color={theme.colors.primary} />
                          </View>
                        </View>
                        <Text style={styles.catLabel}>{c.label}</Text>
                        <Text style={styles.catHint} numberOfLines={1}>
                          {c.hint}
                        </Text>
                      </>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* RECEIPT */}
          <View style={styles.card}>
            <View style={styles.receiptHeader}>
              <View style={styles.cardTitleRowTight}>
                <Text style={styles.sectionTitle}>Receipt</Text>
                <Ionicons name="receipt-outline" size={18} color={theme.colors.primary} />
              </View>
              {receiptBase64 ? (
                <Pressable onPress={removeReceipt} hitSlop={8}>
                  <Text style={styles.link}>Remove</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.receiptActions}>
              <Pressable onPress={takeWithCamera} style={styles.actionBtn}>
                <Ionicons name="camera-outline" size={18} color={theme.colors.text} />
                <Text style={styles.actionText}>Camera</Text>
              </Pressable>

              <Pressable onPress={pickFromGallery} style={styles.actionBtn}>
                <Ionicons name="images-outline" size={18} color={theme.colors.text} />
                <Text style={styles.actionText}>Gallery</Text>
              </Pressable>
            </View>

            <View style={styles.receiptBox}>
              {receiptBase64 ? (
                <Image
                  source={{ uri: `data:image/jpeg;base64,${receiptBase64}` }}
                  style={styles.receiptImg}
                />
              ) : (
                <View style={{ alignItems: "center", gap: 8 }}>
                  <View style={styles.receiptIconCircle}>
                    <Ionicons name="receipt-outline" size={22} color={theme.colors.primary} />
                  </View>
                  <Text style={styles.receiptEmptyTitle}>Add receipt (optional)</Text>
                  <Text style={styles.receiptEmptySub}>Helps track and verify expenses later.</Text>
                </View>
              )}
            </View>

            {saving && receiptBase64 ? (
              <View style={{ marginTop: 12 }}>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${uploadPct}%` }]} />
                </View>
                <Text style={styles.progressText}>Uploading receipt… {uploadPct}%</Text>
              </View>
            ) : null}
          </View>

          <View style={{ height: 10 }} />
        </ScrollView>

        {/* Sticky bottom bar */}
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <View style={styles.bottomLeft}>
            <Text style={styles.bottomK}>Total</Text>
            <Text style={styles.bottomV} numberOfLines={1}>
              {preview}
            </Text>
          </View>

          <Pressable
            onPress={saveExpense}
            disabled={!canSave}
            style={[styles.saveBtn, !canSave ? { opacity: 0.55 } : null]}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Ionicons name="checkmark" size={18} color="#fff" />
            )}
            <Text style={styles.saveText}>{saving ? "Saving..." : "Save Expense"}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },

  header: {
    paddingHorizontal: 14,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerBtn: { width: 94, flexDirection: "row", alignItems: "center", gap: 8 },
  headerBtnText: { fontFamily: theme.font.medium, color: theme.colors.text },
  headerMid: { alignItems: "center", flex: 1 },
  headerRight: { width: 94, alignItems: "flex-end" },
  h1: { fontFamily: theme.font.bold, fontSize: 18, color: theme.colors.text },
  h2: { marginTop: 2, fontFamily: theme.font.medium, fontSize: 12, color: theme.colors.muted },

  glassCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },

  heroWrap: { marginTop: 6, marginHorizontal: 18, borderRadius: 24, overflow: "hidden" },
  heroCard: { borderRadius: 24, padding: 16, overflow: "hidden" },
  heroTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heroPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
  },
  heroPillText: { fontFamily: theme.font.bold, fontSize: 11, color: "rgba(255,255,255,0.95)", letterSpacing: 0.2 },

  heroLabel: { marginTop: 12, fontFamily: theme.font.medium, color: "rgba(255,255,255,0.82)" },

  amountRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 12,
  },
  ccy: { fontFamily: theme.font.bold, fontSize: 22, color: "rgba(255,255,255,0.55)" },
  amountInput: {
    fontFamily: theme.font.bold,
    fontSize: 62,
    color: "#fff",
    padding: 0,
    textAlign: "center",
    minWidth: 120,
  },
  previewText: {
    marginTop: 8,
    textAlign: "center",
    fontFamily: theme.font.medium,
    color: "rgba(255,255,255,0.88)",
  },

  chipsRow: { marginTop: 14, flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chipGhost: { backgroundColor: "rgba(255,255,255,0.12)" },
  chipText: { fontFamily: theme.font.bold, color: "rgba(255,255,255,0.95)", fontSize: 12 },

  card: {
    marginTop: 14,
    marginHorizontal: 18,
    backgroundColor: "rgba(255,255,255,0.97)",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.06)",
  },
  cardTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  cardTitleRowTight: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  sectionTitle: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 16 },

  label: { fontFamily: theme.font.medium, color: theme.colors.muted, marginBottom: 8 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(17,24,39,0.04)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.06)",
  },
  textInput: { flex: 1, fontFamily: theme.font.medium, color: theme.colors.text },

  rowLine: { marginTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowLeft: { flexDirection: "row", gap: 12, alignItems: "center" },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(91,95,239,0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(91,95,239,0.18)",
  },
  rowTitle: { fontFamily: theme.font.bold, color: theme.colors.text },
  rowSub: { marginTop: 2, fontFamily: theme.font.regular, color: theme.colors.muted, fontSize: 12 },
  rowRight: { fontFamily: theme.font.bold, color: theme.colors.text },

  catHeaderWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  catHeaderNavy: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#0B1220",
    borderWidth: 1,
    borderColor: "rgba(11,18,32,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  catSub: { marginTop: 2, fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 12 },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },
  catCard: { width: "48%", borderRadius: 18, padding: 12, borderWidth: 1, minHeight: 98 },
  catIdle: { borderColor: "rgba(17,24,39,0.08)", backgroundColor: "rgba(17,24,39,0.02)" },
  catActive: { borderColor: "transparent", backgroundColor: "transparent", overflow: "hidden", padding: 0 },
  catGradient: { flex: 1, borderRadius: 18, padding: 12, justifyContent: "center" },
  catTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  catIconIdle: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "rgba(91,95,239,0.10)",
    borderWidth: 1,
    borderColor: "rgba(91,95,239,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  tickPill: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  catLabel: { marginTop: 10, fontFamily: theme.font.bold, color: theme.colors.text },
  catHint: { marginTop: 3, fontFamily: theme.font.regular, color: theme.colors.muted, fontSize: 12 },

  receiptHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  link: { fontFamily: theme.font.bold, color: theme.colors.primary },

  receiptActions: { flexDirection: "row", gap: 12, marginBottom: 12, marginTop: 10 },
  actionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(17,24,39,0.04)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.06)",
  },
  actionText: { fontFamily: theme.font.bold, color: theme.colors.text },

  receiptBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(17,24,39,0.20)",
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 180,
    backgroundColor: "rgba(255,255,255,0.7)",
  },
  receiptImg: { width: "100%", height: 220, borderRadius: 14 },
  receiptIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(91,95,239,0.12)",
    borderWidth: 1,
    borderColor: "rgba(91,95,239,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  receiptEmptyTitle: { fontFamily: theme.font.bold, color: theme.colors.text },
  receiptEmptySub: { marginTop: 2, fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 12 },

  progressTrack: { height: 10, backgroundColor: "rgba(17,24,39,0.10)", borderRadius: 999, overflow: "hidden" },
  progressFill: { height: 10, borderRadius: 999, backgroundColor: theme.colors.primary },
  progressText: { marginTop: 8, fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 12 },

  bottomBar: {
    paddingTop: 10,
    paddingHorizontal: 18,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderTopWidth: 1,
    borderTopColor: "rgba(17,24,39,0.06)",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  bottomLeft: { flex: 1 },
  bottomK: { fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 12 },
  bottomV: { marginTop: 3, fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 16 },

  // ✅ full round/capsule button [web:702]
  saveBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 999,
    height: 54,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  saveText: { color: "#fff", fontFamily: theme.font.bold },
});
