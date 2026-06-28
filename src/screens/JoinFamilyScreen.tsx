import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";

import { getAuth } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { db } from "../lib/firebase";
import { theme } from "../theme";

function formatCodePretty(code: string) {
  const c = code.trim().toUpperCase().replace(/\s+/g, "");
  if (!c) return "";
  if (c.length <= 3) return c;
  if (c.length <= 6) return `${c.slice(0, 3)} ${c.slice(3)}`;
  return `${c.slice(0, 3)} ${c.slice(3, 6)} ${c.slice(6, 9)}`;
}

export default function JoinFamilyScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const auth = getAuth();

  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);

  const cleaned = useMemo(() => inviteCode.trim().toUpperCase().replace(/\s+/g, ""), [inviteCode]);
  const canJoin = cleaned.length >= 4;

  const pretty = useMemo(() => formatCodePretty(inviteCode), [inviteCode]);

  const stateMeta = useMemo(() => {
    if (!cleaned) return { label: "Paste or type invite code", color: theme.colors.muted, icon: "key-outline" as const };
    if (cleaned.length < 4) return { label: "Too short", color: "#F59E0B", icon: "alert-circle-outline" as const };
    return { label: "Ready to join", color: "#22C55E", icon: "checkmark-circle-outline" as const };
  }, [cleaned]);

  const pasteFromClipboard = async () => {
    try {
      const txt = await Clipboard.getStringAsync();
      if (!txt) return Alert.alert("Clipboard", "Nothing copied yet.");
      setInviteCode(txt.trim().toUpperCase());
    } catch {
      Alert.alert("Clipboard", "Cannot read clipboard on this device.");
    }
  };

  const scanQr = async () => {
    Alert.alert("Scan QR", "Coming soon. For now, use clipboard paste or type the code.");
  };

  const onJoin = async () => {
    const user = auth.currentUser;
    if (!user) return Alert.alert("Login required", "Please login again.");
    if (!canJoin) return Alert.alert("Invite code", "Enter invite code (example: XY92B1).");

    try {
      setLoading(true);

      const uid = user.uid;

      const inviteSnap = await getDoc(doc(db, "invites", cleaned));
      if (!inviteSnap.exists()) {
        return Alert.alert("Not found", "Invalid invite code.");
      }

      const invite = inviteSnap.data() as any;
      const familyId = invite?.familyId;
      if (!familyId) return Alert.alert("Invalid invite", "Invite is missing familyId.");

      const myMemberRef = doc(db, "families", familyId, "members", uid);
      const myMemberSnap = await getDoc(myMemberRef);
      if (myMemberSnap.exists()) {
        await setDoc(
          doc(db, "users", uid),
          { familyId, email: user.email ?? "", updatedAt: serverTimestamp() },
          { merge: true }
        );
        return Alert.alert("Already joined", "You are already in this family.");
      }

      await setDoc(myMemberRef, {
        uid,
        role: "member",
        name: user.displayName ?? "",
        email: user.email ?? "",
        joinedAt: serverTimestamp(),
      });

      await setDoc(
        doc(db, "users", uid),
        { familyId, email: user.email ?? "", updatedAt: serverTimestamp() },
        { merge: true }
      );

      Alert.alert("Joined", "Joined successfully!");
      navigation?.goBack?.();
    } catch (e: any) {
      Alert.alert("Error", `${e?.code || ""} ${e?.message || "Failed to join family"}`);
    } finally {
      setLoading(false);
    }
  };

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
          onPress={() => navigation?.goBack?.()}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.9 }]}
        >
          <Ionicons name="chevron-back" size={18} color={theme.colors.text} />
        </Pressable>

        <View pointerEvents="none" style={styles.centerTitle}>
          <View style={styles.centerTitlePill}>
            <Ionicons name="people-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.centerTitleText}>Join family</Text>
          </View>
        </View>

        <View style={styles.rightGhost} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 18 + insets.bottom }}>
          <View style={styles.container}>
            <View style={styles.heroCard}>
              <View style={styles.heroIcon}>
                <Ionicons name="key-outline" size={24} color={theme.colors.primary} />
              </View>
              <Text style={styles.title}>Join a family</Text>
              <Text style={styles.subtitle}>Enter the invite code from your parent/admin.</Text>

              <View style={styles.heroBadges}>
                <View style={styles.badge}>
                  <Ionicons name="shield-checkmark-outline" size={14} color={theme.colors.primary} />
                  <Text style={styles.badgeText}>Secure</Text>
                </View>
                <View style={styles.badge}>
                  <Ionicons name="flash-outline" size={14} color={theme.colors.primary} />
                  <Text style={styles.badgeText}>Fast</Text>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.cardTopRow}>
                <Text style={styles.label}>Invite code</Text>
                <View style={[styles.statePill, { borderColor: `${stateMeta.color}26`, backgroundColor: `${stateMeta.color}10` }]}>
                  <Ionicons name={stateMeta.icon} size={14} color={stateMeta.color} />
                  <Text style={[styles.statePillText, { color: stateMeta.color }]}>{stateMeta.label}</Text>
                </View>
              </View>

              <View style={styles.inputWrap}>
                <View style={styles.inputIcon}>
                  <Ionicons name="key-outline" size={18} color={theme.colors.muted} />
                </View>

                <TextInput
                  value={inviteCode}
                  onChangeText={(t) => setInviteCode(t.toUpperCase())}
                  placeholder="XY92B1"
                  placeholderTextColor="rgba(107,114,128,0.65)"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  style={styles.input}
                />

                <Pressable onPress={pasteFromClipboard} hitSlop={10} style={styles.smallIconBtn}>
                  <Ionicons name="clipboard-outline" size={18} color={theme.colors.primary} />
                </Pressable>

                <Pressable onPress={() => setInviteCode("")} hitSlop={10} style={styles.smallIconBtn}>
                  <Ionicons name="close-circle" size={18} color={theme.colors.muted} />
                </Pressable>
              </View>

              {!!cleaned ? (
                <View style={styles.prettyRow}>
                  <Ionicons name="text-outline" size={16} color={theme.colors.muted} />
                  <Text style={styles.prettyText}>Formatted: {pretty}</Text>
                </View>
              ) : null}

              <View style={styles.secondaryActions}>
                <Pressable onPress={pasteFromClipboard} style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.9 }]}>
                  <Ionicons name="clipboard-outline" size={18} color={theme.colors.primary} />
                  <Text style={styles.secondaryBtnText}>Paste</Text>
                </Pressable>

                <Pressable onPress={scanQr} style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.9 }]}>
                  <Ionicons name="qr-code-outline" size={18} color={theme.colors.primary} />
                  <Text style={styles.secondaryBtnText}>Scan QR</Text>
                </Pressable>
              </View>

              <Text style={styles.hint}>Tip: Copy the code from WhatsApp then press Paste.</Text>

              <Pressable
                disabled={!canJoin || loading}
                onPress={onJoin}
                style={({ pressed }) => [styles.joinBtnShell, { opacity: !canJoin || loading ? 0.55 : pressed ? 0.92 : 1 }]}
              >
                <LinearGradient
                  colors={[theme.colors.primary, theme.colors.primaryDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.joinBtn}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="log-in-outline" size={18} color="#fff" />
                      <Text style={styles.joinText}>Join now</Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>
            </View>

            <View style={styles.features}>
              <View style={styles.featureRow}>
                <Ionicons name="shield-checkmark-outline" size={18} color={theme.colors.primary} />
                <Text style={styles.featureText}>No long IDs, only short code.</Text>
              </View>
              <View style={styles.featureRow}>
                <Ionicons name="flash-outline" size={18} color={theme.colors.primary} />
                <Text style={styles.featureText}>Instant sync after joining (real-time).</Text>
              </View>
              <View style={styles.featureRow}>
                <Ionicons name="people-outline" size={18} color={theme.colors.primary} />
                <Text style={styles.featureText}>Parents = admin, siblings = member.</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },

  headerBar: { paddingHorizontal: 18, marginTop: 6, height: 46, justifyContent: "center" },
  backBtn: {
    position: "absolute",
    left: 18,
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
  rightGhost: { position: "absolute", right: 18, width: 42, height: 42 },

  container: { flex: 1, paddingHorizontal: 18, paddingTop: 10 },

  heroCard: {
    marginTop: 10,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.97)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.06)",
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.05 : 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
    alignItems: "center",
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "rgba(91,95,239,0.10)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.06)",
  },
  title: { marginTop: 10, fontFamily: theme.font.bold, fontSize: 24, color: theme.colors.text },
  subtitle: { marginTop: 6, fontFamily: theme.font.regular, fontSize: 13, color: theme.colors.muted, textAlign: "center" },

  heroBadges: { marginTop: 12, flexDirection: "row", gap: 10, flexWrap: "wrap" },
  badge: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(91,95,239,0.10)",
    borderWidth: 1,
    borderColor: "rgba(91,95,239,0.16)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  badgeText: { fontFamily: theme.font.bold, color: theme.colors.primary, fontSize: 12 },

  card: {
    marginTop: 12,
    backgroundColor: "rgba(255,255,255,0.97)",
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.06)",
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.05 : 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },

  cardTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  label: { fontFamily: theme.font.medium, fontSize: 13, color: theme.colors.muted, letterSpacing: 0.3 },

  statePill: {
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statePillText: { fontFamily: theme.font.bold, fontSize: 11 },

  inputWrap: {
    marginTop: 10,
    height: 56,
    borderRadius: 18,
    backgroundColor: "rgba(11,18,32,0.03)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.10)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 10,
  },
  inputIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.75)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  input: { flex: 1, fontFamily: theme.font.bold, fontSize: 18, color: theme.colors.text, letterSpacing: 1 },
  smallIconBtn: { paddingLeft: 6, paddingVertical: 8 },

  prettyRow: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  prettyText: { flex: 1, fontFamily: theme.font.medium, color: theme.colors.muted },

  secondaryActions: { marginTop: 12, flexDirection: "row", gap: 10 },
  secondaryBtn: {
    flex: 1,
    height: 46,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.08)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  secondaryBtnText: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 13 },

  hint: { marginTop: 10, fontFamily: theme.font.regular, fontSize: 12, color: theme.colors.muted, lineHeight: 16 },

  joinBtnShell: { marginTop: 12, borderRadius: 999, overflow: "hidden" },
  joinBtn: { height: 56, borderRadius: 999, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10 },
  joinText: { fontFamily: theme.font.bold, color: "#fff", fontSize: 16 },

  features: { marginTop: 14, gap: 10 },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.70)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.06)",
  },
  featureText: { flex: 1, fontFamily: theme.font.medium, color: theme.colors.text },
});
