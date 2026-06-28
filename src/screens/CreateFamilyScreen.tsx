import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Share,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";

import { getAuth } from "firebase/auth";
import { addDoc, collection, doc, serverTimestamp, setDoc } from "firebase/firestore";

import { db } from "../lib/firebase";
import { theme } from "../theme";

function makeInviteCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function HeaderCenterPill({ title, icon }: { title: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View pointerEvents="none" style={styles.centerTitle}>
      <View style={styles.centerTitlePill}>
        <Ionicons name={icon} size={16} color={theme.colors.primary} />
        <Text style={styles.centerTitleText}>{title}</Text>
      </View>
    </View>
  );
}

function IconSquare({ icon, tint }: { icon: keyof typeof Ionicons.glyphMap; tint: string }) {
  return (
    <View style={[styles.heroIcon, { backgroundColor: `${tint}12`, borderColor: `${tint}22` }]}>
      <Ionicons name={icon} size={24} color={tint} />
    </View>
  );
}

function SmallIconBtn({
  icon,
  onPress,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={10}
      style={({ pressed }) => [
        styles.iconBtn,
        { opacity: disabled ? 0.45 : pressed ? 0.88 : 1 },
      ]}
    >
      <Ionicons name={icon} size={18} color={theme.colors.primary} />
    </Pressable>
  );
}

export default function CreateFamilyScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const auth = getAuth();

  const [familyName, setFamilyName] = useState("");
  const [inviteCode, setInviteCode] = useState(makeInviteCode(6));
  const [loading, setLoading] = useState(false);

  const canCreate = useMemo(() => familyName.trim().length >= 2 && !loading, [familyName, loading]);

  const regenerateCode = () => setInviteCode(makeInviteCode(6));

  const copyCode = async () => {
    await Clipboard.setStringAsync(inviteCode);
    Alert.alert("Copied", "Invite code copied.");
  };

  const shareCode = async () => {
    try {
      await Share.share({
        message: `Join my family on FamilyMate.\nInvite code: ${inviteCode}`,
      });
    } catch {}
  };

  const onCreate = async () => {
    const user = auth.currentUser;
    if (!user) return Alert.alert("Login required", "Please login again.");
    if (!canCreate) return Alert.alert("Family name", "Enter at least 2 characters.");

    try {
      setLoading(true);

      const uid = user.uid;

      const familyRef = await addDoc(collection(db, "families"), {
        name: familyName.trim(),
        inviteCode,
        createdBy: uid,
        monthBudgetPkr: 0,
        monthSpentPkr: 0,
        createdAt: serverTimestamp(),
      });

      const familyId = familyRef.id;

      await setDoc(doc(db, "families", familyId, "members", uid), {
        uid,
        role: "admin",
        name: user.displayName ?? "Parent",
        email: user.email ?? "",
        joinedAt: serverTimestamp(),
      });

      await setDoc(
        doc(db, "users", uid),
        {
          familyId,
          name: user.displayName ?? "Parent",
          email: user.email ?? "",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await setDoc(doc(db, "invites", inviteCode), {
        familyId,
        createdAt: serverTimestamp(),
      });

      Alert.alert("Family created", `Invite code: ${inviteCode}`, [
        { text: "Copy", onPress: copyCode },
        { text: "Share", onPress: shareCode },
        { text: "OK" },
      ]);

      navigation?.goBack?.();
    } catch (e: any) {
      Alert.alert("Error", `${e?.code || ""} ${e?.message || "Failed to create family"}`);
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

        <HeaderCenterPill title="Create family" icon="home-outline" />

        <View style={styles.rightGhost} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 18 + insets.bottom }}>
          <View style={styles.container}>
            <View style={styles.heroCard}>
              <View style={styles.heroTop}>
                <IconSquare icon="people-outline" tint={theme.colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>Create your family</Text>
                  <Text style={styles.subtitle}>
                    Make a household and invite others with a short code.
                  </Text>
                </View>
              </View>

              <View style={styles.heroChips}>
                <View style={styles.chip}>
                  <Ionicons name="shield-checkmark-outline" size={14} color={theme.colors.primary} />
                  <Text style={styles.chipText}>Secure</Text>
                </View>
                <View style={styles.chip}>
                  <Ionicons name="flash-outline" size={14} color={theme.colors.primary} />
                  <Text style={styles.chipText}>Fast setup</Text>
                </View>
                <View style={styles.chip}>
                  <Ionicons name="ticket-outline" size={14} color={theme.colors.primary} />
                  <Text style={styles.chipText}>Invite code</Text>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Family name</Text>

              <View style={styles.inputWrap}>
                <View style={styles.inputIcon}>
                  <Ionicons name="people-outline" size={18} color={theme.colors.muted} />
                </View>

                <TextInput
                  value={familyName}
                  onChangeText={setFamilyName}
                  placeholder="e.g., Khan Family"
                  placeholderTextColor="rgba(107,114,128,0.65)"
                  style={styles.input}
                  autoCapitalize="words"
                />

                {!!familyName && (
                  <Ionicons name="checkmark-circle" size={18} color={"#10B981"} />
                )}
              </View>

              <View style={styles.codeCard}>
                <View style={styles.codeLeft}>
                  <Text style={styles.codeLabel}>Invite code</Text>
                  <Text style={styles.codeValue}>{inviteCode}</Text>
                </View>

                <View style={styles.codeActions}>
                  <SmallIconBtn icon="refresh" onPress={regenerateCode} />
                  <SmallIconBtn icon="copy-outline" onPress={copyCode} />
                  <SmallIconBtn icon="share-social-outline" onPress={shareCode} />
                </View>
              </View>

              <Pressable
                disabled={!canCreate}
                onPress={onCreate}
                style={({ pressed }) => [
                  styles.primaryBtnShell,
                  { opacity: !canCreate ? 0.55 : pressed ? 0.92 : 1 },
                ]}
              >
                <LinearGradient
                  colors={[theme.colors.primary, theme.colors.primaryDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryBtn}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="sparkles-outline" size={18} color="#fff" />
                      <Text style={styles.primaryText}>Create family</Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>

              <View style={styles.noteBox}>
                <Ionicons name="information-circle-outline" size={18} color={theme.colors.muted} />
                <Text style={styles.noteText}>
                  After creating, share the invite code with your family to join.
                </Text>
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

  container: { paddingHorizontal: 18, paddingTop: 10 },

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
  },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  title: { fontFamily: theme.font.bold, fontSize: 22, color: theme.colors.text },
  subtitle: { marginTop: 4, fontFamily: theme.font.regular, fontSize: 13, color: theme.colors.muted, lineHeight: 18 },

  heroChips: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: {
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
  chipText: { fontFamily: theme.font.bold, color: theme.colors.primary, fontSize: 12 },

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

  label: { fontFamily: theme.font.medium, fontSize: 13, color: theme.colors.muted, letterSpacing: 0.3, marginBottom: 8 },

  inputWrap: {
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
  input: { flex: 1, fontFamily: theme.font.bold, fontSize: 15, color: theme.colors.text },

  codeCard: {
    marginTop: 12,
    borderRadius: 18,
    padding: 12,
    backgroundColor: "rgba(91,95,239,0.07)",
    borderWidth: 1,
    borderColor: "rgba(91,95,239,0.14)",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  codeLeft: { flex: 1 },
  codeLabel: { fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 12 },
  codeValue: { marginTop: 2, fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 20, letterSpacing: 2 },

  codeActions: { flexDirection: "row", gap: 10 },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },

  primaryBtnShell: { marginTop: 12, borderRadius: 999, overflow: "hidden" },
  primaryBtn: { height: 56, borderRadius: 999, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10 },
  primaryText: { fontFamily: theme.font.bold, color: "#fff", fontSize: 15 },

  noteBox: {
    marginTop: 12,
    borderRadius: 18,
    padding: 12,
    backgroundColor: "rgba(107,114,128,0.06)",
    borderWidth: 1,
    borderColor: "rgba(107,114,128,0.12)",
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  noteText: { flex: 1, fontFamily: theme.font.regular, color: theme.colors.muted, lineHeight: 18 },
});
