// src/screens/SignupScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import * as ImagePicker from "expo-image-picker";

import { auth, db } from "../lib/firebase";
import { theme } from "../theme";
import type { AuthStackParamList } from "../navigation/types";
import { upsertSavedAccount } from "../lib/accountStore";

type Props = NativeStackScreenProps<AuthStackParamList, "Signup">;

const UI = { error: "#EF4444" };

// Dark navy theme (same as Login)
const NAVY_0 = "#0B1220";
const NAVY_1 = "#0F1A33";
const TEXT = "rgba(255,255,255,0.92)";
const TEXT_MUTED = "rgba(255,255,255,0.72)";
const PLACEHOLDER = "rgba(255,255,255,0.45)";

function makeInviteCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function FinanceTexture() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* Base navy gradient */}
      <LinearGradient
        colors={[NAVY_0, NAVY_1, NAVY_0]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Soft primary glow */}
      <LinearGradient
        colors={["rgba(91,95,239,0.22)", "rgba(91,95,239,0.08)", "rgba(0,0,0,0.00)"]}
        start={{ x: 0.12, y: 0 }}
        end={{ x: 0.88, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Texture shapes */}
      <View style={[styles.texReceipt, { top: 96, left: 16, opacity: 0.10 }]}>
        <View style={styles.texReceiptHeader} />
        <View style={styles.texReceiptLine} />
        <View style={[styles.texReceiptLine, { width: 132 }]} />
        <View style={[styles.texReceiptLine, { width: 156 }]} />
        <View style={[styles.texReceiptLine, { width: 110 }]} />
        <View style={styles.texReceiptFooter} />
      </View>

      <View style={[styles.texChart, { bottom: 140, left: 18, opacity: 0.10 }]}>
        <View style={[styles.texBar, { height: 12 }]} />
        <View style={[styles.texBar, { height: 22 }]} />
        <View style={[styles.texBar, { height: 16 }]} />
        <View style={[styles.texBar, { height: 30 }]} />
      </View>

      <View style={[styles.texDots, { top: 230, right: 18, opacity: 0.08 }]}>
        {Array.from({ length: 18 }).map((_, i) => (
          <View key={i} style={styles.texDot} />
        ))}
      </View>

      <View style={[styles.texTrendWrap, { top: 110, right: -46, opacity: 0.06 }]}>
        <View style={styles.texTrendLine} />
        <View style={[styles.texTrendLine, { top: 34, width: 210 }]} />
        <View style={[styles.texTrendLine, { top: 68, width: 240 }]} />
      </View>
    </View>
  );
}

export default function SignupScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();

  const [familyName, setFamilyName] = useState("");
  const [familyPhotoBase64, setFamilyPhotoBase64] = useState<string | null>(null);

  const [email, setEmail] = useState(route.params?.email ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (route.params?.email) setEmail(route.params.email);
  }, [route.params?.email]);

  const emailError = useMemo(() => {
    if (!email.length) return "";
    if (!email.trim().includes("@")) return "Enter a valid email address.";
    return "";
  }, [email]);

  const passwordError = useMemo(() => {
    if (!password.length) return "";
    if (password.length < 6) return "Password must be at least 6 characters.";
    return "";
  }, [password]);

  const confirmError = useMemo(() => {
    if (!confirm.length) return "";
    if (confirm !== password) return "Passwords do not match.";
    return "";
  }, [confirm, password]);

  const familyNameError = useMemo(() => {
    if (!familyName.length) return "";
    if (familyName.trim().length < 2) return "Family name is too short.";
    return "";
  }, [familyName]);

  const canSubmit = useMemo(() => {
    return (
      !loading &&
      !emailError &&
      !passwordError &&
      !confirmError &&
      !familyNameError &&
      !!familyName.trim() &&
      !!email.trim() &&
      !!password &&
      !!confirm
    );
  }, [loading, emailError, passwordError, confirmError, familyNameError, familyName, email, password, confirm]);

  const mapAuthError = (code?: string) => {
    switch (code) {
      case "auth/email-already-in-use":
        return "This email is already registered.";
      case "auth/invalid-email":
        return "Please enter a valid email.";
      case "auth/weak-password":
        return "Password is too weak (min 6 characters).";
      default:
        return "Signup failed. Try again.";
    }
  };

  const pickFamilyPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Please allow photo library access.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets?.[0]?.base64) {
      setFamilyPhotoBase64(result.assets[0].base64);
    }
  };

  const onSignup = async () => {
    if (!canSubmit) return;

    try {
      setLoading(true);

      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const uid = cred.user.uid;

      const fallbackName = email.trim().split("@")[0] || "User";
      await updateProfile(cred.user, { displayName: fallbackName });

      const familyRef = doc(collection(db, "families"));
      const familyId = familyRef.id;

      const inviteCode = makeInviteCode(6);
      await setDoc(familyRef, {
        name: familyName.trim(),
        inviteCode,
        photoBase64: familyPhotoBase64 || "",
        createdBy: uid,
        members: [uid],
        membersCount: 1,
        monthBudgetPkr: 0,
        monthSpentPkr: 0,
        createdAt: serverTimestamp(),
      });

      await setDoc(doc(db, "users", uid), {
        email: email.trim(),
        familyId,
        createdAt: serverTimestamp(),
      });

      await setDoc(doc(db, "families", familyId, "members", uid), {
        uid,
        role: "admin",
        name: fallbackName,
        email: email.trim(),
        joinedAt: serverTimestamp(),
      });

      await upsertSavedAccount({
        uid,
        email: email.trim(),
        displayName: cred.user.displayName || fallbackName,
        photoURL: cred.user.photoURL || "",
        provider: "email",
      });

      Alert.alert("Account created", `Invite code: ${inviteCode}`);

      if (route.params?.fromManageAccounts) {
        navigation.goBack();
      }
    } catch (err: any) {
      console.log("Signup error:", err);
      const msg = err?.code ? mapAuthError(err.code) : err?.message || "Unknown error";
      Alert.alert("Signup failed", msg);
    } finally {
      setLoading(false);
    }
  };

  const photoUri = familyPhotoBase64 ? `data:image/jpeg;base64,${familyPhotoBase64}` : null;

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 10) }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <FinanceTexture />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollGrow, { paddingBottom: Math.max(insets.bottom, 18) }]}
        >
          <View style={styles.centerWrap}>
            <View style={styles.topRow}>
              <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={({ pressed }) => [styles.backBtnCircle, { opacity: pressed ? 0.88 : 1 }]}>
                <Ionicons name="chevron-back" size={20} color="#fff" />
              </Pressable>

              <Text style={styles.topTitle}></Text>
              <View style={{ width: 44 }} />
            </View>

            <View style={styles.logoOuter}>
              <Image source={require("../../assets/logo.png")} style={styles.logoImg} resizeMode="contain" />
            </View>

            <Text style={styles.h1}>
              Create <Text style={styles.h1Accent}>Family</Text>
            </Text>
            <Text style={styles.sub}>Register your family and sync in real time.</Text>

            {/* Dark navy glass card */}
            <View style={styles.card}>
              <Text style={styles.label}>Family Photo</Text>
              <Pressable onPress={pickFamilyPhoto} style={({ pressed }) => [styles.photoPick, { opacity: pressed ? 0.92 : 1 }]}>
                {photoUri ? (
                  <Image source={{ uri: photoUri }} style={styles.photoCircle} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <LinearGradient
                      colors={["rgba(91,95,239,0.26)", "rgba(255,255,255,0.06)"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <Ionicons name="image-outline" size={22} color="#fff" />
                    <Text style={styles.photoText}>Choose photo</Text>
                  </View>
                )}
              </Pressable>

              <Text style={[styles.label, { marginTop: 14 }]}>Family Name</Text>
              <View style={[styles.inputWrap, familyNameError ? styles.inputWrapErr : null]}>
                <Ionicons name="people-outline" size={18} color={TEXT_MUTED} style={styles.leftIcon} />
                <TextInput
                  value={familyName}
                  onChangeText={setFamilyName}
                  placeholder="e.g. The Smiths"
                  placeholderTextColor={PLACEHOLDER}
                  style={styles.input}
                />
              </View>
              {!!familyNameError && <Text style={styles.helper}>{familyNameError}</Text>}

              <Text style={[styles.label, { marginTop: 14 }]}>Email Address</Text>
              <View style={[styles.inputWrap, emailError ? styles.inputWrapErr : null]}>
                <Ionicons name="mail-outline" size={18} color={TEXT_MUTED} style={styles.leftIcon} />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="name@example.com"
                  placeholderTextColor={PLACEHOLDER}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={styles.input}
                />
              </View>
              {!!emailError && <Text style={styles.helper}>{emailError}</Text>}

              <Text style={[styles.label, { marginTop: 14 }]}>Password</Text>
              <View style={[styles.inputWrap, passwordError ? styles.inputWrapErr : null]}>
                <Ionicons name="lock-closed-outline" size={18} color={TEXT_MUTED} style={styles.leftIcon} />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={PLACEHOLDER}
                  autoCapitalize="none"
                  secureTextEntry={!showPass}
                  style={styles.input}
                />
                <Pressable onPress={() => setShowPass((v) => !v)} hitSlop={10} style={styles.rightBtn}>
                  <Ionicons name={showPass ? "eye-off-outline" : "eye-outline"} size={20} color={TEXT_MUTED} />
                </Pressable>
              </View>
              {!!passwordError && <Text style={styles.helper}>{passwordError}</Text>}

              <Text style={[styles.label, { marginTop: 14 }]}>Confirm Password</Text>
              <View style={[styles.inputWrap, confirmError ? styles.inputWrapErr : null]}>
                <Ionicons name="shield-checkmark-outline" size={18} color={TEXT_MUTED} style={styles.leftIcon} />
                <TextInput
                  value={confirm}
                  onChangeText={setConfirm}
                  placeholder="••••••••"
                  placeholderTextColor={PLACEHOLDER}
                  autoCapitalize="none"
                  secureTextEntry={!showPass}
                  style={styles.input}
                />
              </View>
              {!!confirmError && <Text style={styles.helper}>{confirmError}</Text>}

              <Pressable disabled={!canSubmit} onPress={onSignup} style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }, { marginTop: 16 }]}>
                <View style={[styles.btnWrap, { opacity: canSubmit ? 1 : 0.55 }]}>
                  <LinearGradient colors={[theme.colors.primary, theme.colors.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btn}>
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Text style={styles.btnText}>Create Account</Text>
                        <Ionicons name="arrow-forward-circle" size={24} color="#fff" style={{ marginLeft: 10 }} />
                      </>
                    )}
                  </LinearGradient>
                </View>
              </Pressable>

              <Pressable
                onPress={() =>
                  navigation.replace("Login", {
                    email,
                    fromManageAccounts: route.params?.fromManageAccounts,
                  })
                }
                style={({ pressed }) => [styles.bottomTextRow, { opacity: pressed ? 0.9 : 1 }]}
              >
                <Text style={styles.bottomText}>
                  Already have an account? <Text style={styles.bottomLink}>Log in</Text>
                </Text>
              </Pressable>
            </View>

            <View style={{ height: 10 }} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NAVY_0 },
  scrollGrow: { flexGrow: 1, paddingHorizontal: 18, paddingTop: 10 },
  centerWrap: { flexGrow: 1, justifyContent: "center" },

  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },

  backBtnCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },

  topTitle: { fontFamily: theme.font.bold, fontSize: 16, color: TEXT, letterSpacing: 0.2 },

  logoOuter: { alignItems: "center", marginBottom: -46 },
  logoImg: { width: 210, height: 210 },

  h1: {
    marginTop: 6,
    fontFamily: theme.font.bold,
    fontSize: 34,
    lineHeight: 40,
    color: TEXT,
    textAlign: "center",
    letterSpacing: -0.4,
  },
  h1Accent: { color: theme.colors.primary },

  sub: {
    marginTop: 10,
    fontFamily: theme.font.regular,
    fontSize: 14,
    lineHeight: 20,
    color: TEXT_MUTED,
    textAlign: "center",
    paddingHorizontal: 10,
  },

  // GLASS CARD + 40% NAVY SHADOW
  card: {
    marginTop: 18,
    backgroundColor: "rgba(11,18,32,0.55)",
    borderRadius: theme.radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",

    shadowColor: NAVY_0,
    shadowOpacity: 0.40,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 10,
  },

  label: { marginTop: 14, marginBottom: 8, fontFamily: theme.font.medium, fontSize: 14, color: "rgba(255,255,255,0.90)" },

  photoPick: { alignItems: "center", justifyContent: "center", paddingVertical: 8 },
  photoCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 3,
    borderColor: "rgba(91,95,239,0.45)",
    backgroundColor: "rgba(0,0,0,0.20)",
  },
  photoPlaceholder: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  photoText: { marginTop: 6, fontFamily: theme.font.medium, color: "rgba(255,255,255,0.86)", fontSize: 12 },

  inputWrap: {
    height: 56,
    borderRadius: theme.radius.lg,
    backgroundColor: "rgba(0,0,0,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  inputWrapErr: { borderColor: UI.error },
  leftIcon: { marginRight: 10 },
  input: { flex: 1, fontFamily: theme.font.regular, fontSize: 16, color: TEXT },
  rightBtn: { paddingLeft: 10, paddingVertical: 8 },
  helper: { marginTop: 6, fontFamily: theme.font.regular, fontSize: 12, color: UI.error },

  btnWrap: { borderRadius: 999, overflow: "hidden" },
  btn: { height: 58, borderRadius: 999, alignItems: "center", justifyContent: "center", flexDirection: "row", paddingHorizontal: 18 },
  btnText: { fontFamily: theme.font.bold, fontSize: 16, color: "#fff" },

  bottomTextRow: { alignItems: "center", marginTop: 18 },
  bottomText: { fontFamily: theme.font.regular, color: TEXT_MUTED },
  bottomLink: { fontFamily: theme.font.bold, color: theme.colors.primary },

  // ---- texture pieces ----
  texReceipt: {
    position: "absolute",
    width: 176,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  texReceiptHeader: { height: 10, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.08)", marginBottom: 10, width: 120 },
  texReceiptLine: { height: 6, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.06)", marginBottom: 8, width: 150 },
  texReceiptFooter: { height: 8, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.06)", marginTop: 4, width: 90, alignSelf: "flex-end" },

  texChart: { position: "absolute", flexDirection: "row", gap: 8, alignItems: "flex-end", padding: 10, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", backgroundColor: "rgba(255,255,255,0.02)" },
  texBar: { width: 10, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.08)" },

  texDots: { position: "absolute", width: 140, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  texDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.10)" },

  texTrendWrap: { position: "absolute", width: 280, height: 120, transform: [{ rotate: "-12deg" }] },
  texTrendLine: { position: "absolute", left: 0, top: 0, height: 2, width: 230, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)" },
});
