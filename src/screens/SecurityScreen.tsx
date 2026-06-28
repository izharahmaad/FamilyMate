import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  StatusBar,
  Alert,
  TextInput,
  Modal,
  Linking,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { getAuth, sendPasswordResetEmail } from "firebase/auth";
import * as Clipboard from "expo-clipboard";

import { theme } from "../theme";

const SUPPORT_EMAIL = "[email protected]"; // change this

function Pill({
  icon,
  text,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  color: string;
}) {
  return (
    <View style={[styles.pill, { backgroundColor: `${color}12`, borderColor: `${color}22` }]}>
      <Ionicons name={icon} size={14} color={color} />
      <Text style={[styles.pillText, { color }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

export default function SecurityScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const auth = getAuth();

  const currentEmail = auth.currentUser?.email ?? "";
  const [email, setEmail] = useState(currentEmail);

  const [sending, setSending] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [sentFor, setSentFor] = useState<string | null>(null);

  const canSend = useMemo(() => {
    const e = email.trim();
    return e.length >= 6 && e.includes("@") && e.includes(".");
  }, [email]);

  const onSendReset = async () => {
    try {
      if (!canSend) return Alert.alert("Missing", "Enter a valid email address.");
      setSending(true);
      const to = email.trim().toLowerCase();
      await sendPasswordResetEmail(auth, to); // official flow [web:890]
      setSentFor(to);
      Alert.alert("Sent", "Password reset email sent. Check inbox and spam.");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to send reset email");
    } finally {
      setSending(false);
    }
  };

  const openEmailApp = async () => {
    // Best-effort: opens default mail app compose screen
    const url = sentFor ? `mailto:${sentFor}` : "mailto:";
    const ok = await Linking.canOpenURL(url);
    if (!ok) return Alert.alert("Not available", "Could not open an email app on this device.");
    Linking.openURL(url);
  };

  const copySupport = async () => {
    await Clipboard.setStringAsync(SUPPORT_EMAIL);
    Alert.alert("Copied", "Support email copied.");
  };

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 10) }]}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Header */}
      <View style={styles.headerBar}>
        <Pressable
          onPress={() => (navigation?.goBack ? navigation.goBack() : null)}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.9 }]}
        >
          <Ionicons name="chevron-back" size={18} color={theme.colors.text} />
        </Pressable>

        <View pointerEvents="none" style={styles.centerTitle}>
          <View style={styles.centerTitlePill}>
            <Ionicons name="shield-checkmark-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.centerTitleText}>Security</Text>
          </View>
        </View>

        <View style={styles.rightGhost} />
      </View>

      {/* Hero */}
      <View style={styles.hero}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroTitle}>Protect your account</Text>
          <Text style={styles.heroSub}>
            Reset password securely using an email link.
          </Text>
        </View>

        <View style={{ alignItems: "flex-end", gap: 8 }}>
          <Pill icon="lock-closed-outline" text="Secure link" color="#16A34A" />
          <Pill icon="information-circle-outline" text="Tips" color={theme.colors.primary} />
        </View>
      </View>

      {/* Form Card */}
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.sectionTitle}>Password reset</Text>

          <Pressable onPress={() => setTipsOpen(true)} style={({ pressed }) => [styles.helpBtn, pressed && { opacity: 0.9 }]}>
            <Ionicons name="help-circle-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.helpBtnText}>Help</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Email for reset link</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={theme.colors.muted}
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />

        <Pressable
          onPress={onSendReset}
          disabled={!canSend || sending}
          style={({ pressed }) => [
            styles.primaryBtn,
            pressed && { opacity: 0.9 },
            (!canSend || sending) && styles.btnDisabled,
          ]}
        >
          <Ionicons name={sending ? "time-outline" : "paper-plane-outline"} size={18} color="#fff" />
          <Text style={styles.primaryText}>{sending ? "Sending..." : "Send reset email"}</Text>
        </Pressable>

        {/* New feature #1: Open mail app (only if sent once) */}
        <Pressable
          onPress={openEmailApp}
          disabled={!sentFor}
          style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.9 }, !sentFor && { opacity: 0.5 }]}
        >
          <Ionicons name="mail-outline" size={18} color={theme.colors.text} />
          <Text style={styles.secondaryText}>Open email app</Text>
        </Pressable>

        {/* New feature #2: Copy support email */}
        <Pressable onPress={copySupport} style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.9 }]}>
          <Ionicons name="copy-outline" size={18} color={theme.colors.text} />
          <Text style={styles.secondaryText}>Copy support email</Text>
        </Pressable>
      </View>

      {/* Tips small window (modal bottom sheet) */}
      <Modal visible={tipsOpen} transparent animationType="fade" onRequestClose={() => setTipsOpen(false)}>
        <Pressable style={styles.sheetOverlay} onPress={() => setTipsOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: 14 + insets.bottom }]}>
          <View style={styles.sheetHandle} />

          <View style={styles.sheetHeader}>
            <View style={styles.sheetIcon}>
              <Ionicons name="bulb-outline" size={18} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle}>Security tips</Text>
              <Text style={styles.sheetSub}>Read this if reset email doesn’t arrive.</Text>
            </View>
            <Pressable onPress={() => setTipsOpen(false)} hitSlop={10} style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.9 }]}>
              <Ionicons name="close" size={18} color={theme.colors.text} />
            </Pressable>
          </View>

          <View style={styles.tipBox}>
            <Text style={styles.tipH}>1) Check spam + promotions</Text>
            <Text style={styles.tipP}>
              Reset emails often land in Spam/Promotions. Search for “reset” and your app name, then mark as “Not spam”.
            </Text>
          </View>

          <View style={styles.tipBox}>
            <Text style={styles.tipH}>2) Use the same login email</Text>
            <Text style={styles.tipP}>
              The reset link will only work for the account that matches the email you entered. If you have multiple emails, try the one you used at signup.
            </Text>
          </View>

          <View style={styles.tipBox}>
            <Text style={styles.tipH}>3) Still stuck? Contact support</Text>
            <Text style={styles.tipP}>
              If you don’t receive an email within 5–10 minutes, copy the support email and tell them your account email (never share your password).
            </Text>
          </View>

          <Pressable onPress={() => setTipsOpen(false)} style={({ pressed }) => [styles.sheetBtn, pressed && { opacity: 0.9 }]}>
            <Text style={styles.sheetBtnText}>I understand</Text>
          </Pressable>
        </View>
      </Modal>
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
  rightGhost: { position: "absolute", right: 0, width: 42, height: 42 },

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
  heroTitle: { fontFamily: theme.font.bold, fontSize: 16, color: theme.colors.text },
  heroSub: { marginTop: 6, fontFamily: theme.font.regular, fontSize: 12, color: theme.colors.muted, lineHeight: 16 },

  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 160,
  },
  pillText: { fontFamily: theme.font.bold, fontSize: 12 },

  card: {
    marginTop: 12,
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
  },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sectionTitle: { fontFamily: theme.font.bold, fontSize: 14, color: theme.colors.text },
  helpBtn: {
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.18)",
    backgroundColor: "rgba(59,130,246,0.08)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  helpBtnText: { fontFamily: theme.font.bold, fontSize: 12, color: theme.colors.primary },

  label: { marginBottom: 8, fontFamily: theme.font.medium, color: theme.colors.muted },
  input: {
    height: 54,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    fontFamily: theme.font.regular,
    color: theme.colors.text,
  },

  primaryBtn: {
    marginTop: 12,
    height: 56,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  btnDisabled: { opacity: 0.5 },
  primaryText: { fontFamily: theme.font.bold, color: "#fff", fontSize: 15 },

  secondaryBtn: {
    marginTop: 10,
    height: 52,
    borderRadius: theme.radius.lg,
    backgroundColor: "rgba(17,24,39,0.04)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.08)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  secondaryText: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 14 },

  sheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "rgba(255,255,255,0.98)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.06)",
    padding: 14,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(148,163,184,0.65)",
    marginBottom: 10,
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  sheetIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(59,130,246,0.10)",
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: { fontFamily: theme.font.bold, fontSize: 14, color: theme.colors.text },
  sheetSub: { marginTop: 2, fontFamily: theme.font.regular, fontSize: 12, color: theme.colors.muted },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(17,24,39,0.04)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },

  tipBox: {
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.06)",
    backgroundColor: "rgba(17,24,39,0.03)",
    marginBottom: 10,
  },
  tipH: { fontFamily: theme.font.bold, fontSize: 13, color: theme.colors.text },
  tipP: { marginTop: 6, fontFamily: theme.font.regular, fontSize: 12, color: theme.colors.muted, lineHeight: 16 },

  sheetBtn: {
    marginTop: 6,
    height: 52,
    borderRadius: 16,
    backgroundColor: theme.colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetBtnText: { fontFamily: theme.font.bold, fontSize: 14, color: "#fff" },
});
