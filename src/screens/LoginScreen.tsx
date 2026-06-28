import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Image,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { signInWithEmailAndPassword } from "firebase/auth";

import { auth } from "../lib/firebase";
import { theme } from "../theme";
import type { AuthStackParamList } from "../navigation/types";
import { upsertSavedAccount } from "../lib/accountStore";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

const UI = { error: "#EF4444", success: "#10B981" };

// Dark navy base (matches your other screens)
const NAVY_0 = "#0B1220"; // deep navy
const NAVY_1 = "#0F1A33"; // slightly brighter navy
const NAVY_GLOW = "rgba(91,95,239,0.18)"; // your primary glow

export default function LoginScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState(route.params?.email ?? "");
  const [password, setPassword] = useState("");
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

  const canSubmit = useMemo(() => {
    return !loading && !emailError && !passwordError && !!email.trim() && !!password;
  }, [loading, emailError, passwordError, email, password]);

  const mapAuthError = (code?: string) => {
    switch (code) {
      case "auth/invalid-email":
        return "Please enter a valid email.";
      case "auth/user-not-found":
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return "Email or password is incorrect.";
      case "auth/too-many-requests":
        return "Too many attempts. Try again later.";
      default:
        return "Login failed. Please try again.";
    }
  };

  const onLogin = async () => {
    if (!canSubmit) return;

    try {
      setLoading(true);
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);

      const user = cred.user;
      const safeEmail = user.email || email.trim();
      const fallbackName = user.displayName || (safeEmail ? safeEmail.split("@")[0] : "User");

      await upsertSavedAccount({
        uid: user.uid,
        email: safeEmail,
        displayName: fallbackName,
        photoURL: user.photoURL || "",
        provider: user.providerData?.[0]?.providerId?.includes("google") ? "google" : "email",
      });

      if (route.params?.fromManageAccounts) navigation.goBack();
    } catch (err: any) {
      Alert.alert("Login failed", mapAuthError(err?.code));
    } finally {
      setLoading(false);
    }
  };

  const fromManage = route.params?.fromManageAccounts;

  const emailOk = !!email && !emailError;
  const passOk = !!password && !passwordError;

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 10) }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Dark navy background + subtle diagonal glow */}
      <LinearGradient
        pointerEvents="none"
        colors={[NAVY_0, NAVY_1, NAVY_0]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(91,95,239,0.22)", "rgba(91,95,239,0.00)"]}
        start={{ x: 0.15, y: 0.0 }}
        end={{ x: 0.85, y: 0.7 }}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollGrow, { paddingBottom: Math.max(insets.bottom, 18) }]}
        >
          <View style={styles.centerWrap}>
            <View style={styles.logoOuter}>
              <Image source={require("../../assets/logo.png")} style={styles.logoImg} resizeMode="contain" />
            </View>

            <Text style={styles.h1}>
              Welcome to <Text style={styles.h1Accent}>FamilyMate</Text>
            </Text>
            <Text style={styles.sub}>Sign in to track your family expenses together.</Text>

            {/* DARK NAVY GLASS CARD */}
            <View style={styles.card}>
              <Text style={styles.label}>Email Address</Text>
              <View style={[styles.inputWrap, emailError ? styles.inputWrapErr : null, emailOk ? styles.inputWrapOk : null]}>
                <Ionicons name="mail-outline" size={18} color="rgba(255,255,255,0.72)" style={styles.leftIcon} />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="name@example.com"
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                />
                {!!email && (
                  <Ionicons
                    name={emailError ? "close-circle" : "checkmark-circle"}
                    size={18}
                    color={emailError ? UI.error : UI.success}
                  />
                )}
              </View>
              {!!emailError && <Text style={styles.helper}>{emailError}</Text>}

              <Text style={[styles.label, { marginTop: 14 }]}>Password</Text>
              <View style={[styles.inputWrap, passwordError ? styles.inputWrapErr : null, passOk ? styles.inputWrapOk : null]}>
                <Ionicons name="lock-closed-outline" size={18} color="rgba(255,255,255,0.72)" style={styles.leftIcon} />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  secureTextEntry={!showPass}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                />
                <Pressable onPress={() => setShowPass((v) => !v)} hitSlop={10} style={styles.rightBtn}>
                  <Ionicons name={showPass ? "eye-off-outline" : "eye-outline"} size={20} color="rgba(255,255,255,0.72)" />
                </Pressable>
              </View>
              {!!passwordError && <Text style={styles.helper}>{passwordError}</Text>}

              <Pressable
                onPress={() => navigation.navigate("ForgotPassword", { email })}
                style={({ pressed }) => [styles.forgotRow, { opacity: pressed ? 0.85 : 1 }]}
              >
                <Text style={styles.link}>Forgot Password?</Text>
              </Pressable>

              <Pressable disabled={!canSubmit} onPress={onLogin} style={({ pressed }) => [{ opacity: pressed ? 0.94 : 1 }]}>
                <View style={[styles.btnWrap, { opacity: canSubmit ? 1 : 0.55 }]}>
                  <LinearGradient
                    colors={[theme.colors.primary, theme.colors.primaryDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.btn}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Text style={styles.btnText}>Log In</Text>
                        <Ionicons name="arrow-forward-circle" size={24} color="#fff" style={{ marginLeft: 10 }} />
                      </>
                    )}
                  </LinearGradient>
                </View>
              </Pressable>

              <View style={styles.dividerRow}>
                <View style={styles.line} />
                <Text style={styles.dividerText}>Or continue with</Text>
                <View style={styles.line} />
              </View>

              <View style={styles.socialRow}>
                <Pressable
                  onPress={() => Alert.alert("Info", "Google login can be added next.")}
                  style={({ pressed }) => [styles.socialBtn, { opacity: pressed ? 0.9 : 1 }]}
                >
                  <Ionicons name="logo-google" size={20} color={"rgba(255,255,255,0.92)"} />
                </Pressable>

                <Pressable
                  onPress={() => Alert.alert("Info", "Apple login can be added next.")}
                  style={({ pressed }) => [styles.socialBtn, { opacity: pressed ? 0.9 : 1 }]}
                >
                  <Ionicons name="logo-apple" size={22} color={"rgba(255,255,255,0.92)"} />
                </Pressable>
              </View>

              <Pressable
                onPress={() => navigation.navigate("Signup", { email, fromManageAccounts: fromManage })}
                style={({ pressed }) => [styles.bottomTextRow, { opacity: pressed ? 0.9 : 1 }]}
              >
                <Text style={styles.bottomText}>
                  Don’t have an account? <Text style={styles.bottomLink}>Create Account</Text>
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

  logoOuter: { alignItems: "center", marginBottom: -46 },
  logoImg: { width: 210, height: 210 },

  h1: {
    marginTop: 6,
    fontFamily: theme.font.bold,
    fontSize: 34,
    lineHeight: 40,
    color: "rgba(255,255,255,0.92)",
    textAlign: "center",
    letterSpacing: -0.4,
  },
  h1Accent: { color: theme.colors.primary },

  sub: {
    marginTop: 10,
    fontFamily: theme.font.regular,
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255,255,255,0.72)",
    textAlign: "center",
    paddingHorizontal: 10,
  },

  // DARK NAVY GLASS + 40% NAVY SHADOW FEEL
  card: {
    marginTop: 18,
    backgroundColor: "rgba(11,18,32,0.55)", // glass
    borderRadius: theme.radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",

    shadowColor: NAVY_0,
    shadowOpacity: 0.40, // <- your “40” shadow strength
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 10, // Android shadow
  },

  label: {
    marginTop: 14,
    marginBottom: 8,
    fontFamily: theme.font.medium,
    fontSize: 14,
    color: "rgba(255,255,255,0.90)",
  },

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
  inputWrapOk: { borderColor: "rgba(16,185,129,0.45)" },

  leftIcon: { marginRight: 10 },
  input: { flex: 1, fontFamily: theme.font.regular, fontSize: 16, color: "rgba(255,255,255,0.92)" },
  rightBtn: { paddingLeft: 10, paddingVertical: 8 },
  helper: { marginTop: 6, fontFamily: theme.font.regular, fontSize: 12, color: UI.error },

  forgotRow: { alignItems: "flex-end", marginTop: 10, marginBottom: 12 },
  link: { fontFamily: theme.font.medium, color: "rgba(255,255,255,0.90)" },

  btnWrap: { borderRadius: 999, overflow: "hidden", marginTop: 4 },
  btn: {
    height: 58,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    paddingHorizontal: 18,
  },
  btnText: { fontFamily: theme.font.bold, fontSize: 16, color: "#fff" },

  dividerRow: { flexDirection: "row", alignItems: "center", marginTop: 18 },
  line: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.10)" },
  dividerText: { marginHorizontal: 12, fontFamily: theme.font.regular, color: "rgba(255,255,255,0.72)" },

  socialRow: { flexDirection: "row", justifyContent: "center", marginTop: 14 },
  socialBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 7,
  },

  bottomTextRow: { alignItems: "center", marginTop: 18 },
  bottomText: { fontFamily: theme.font.regular, color: "rgba(255,255,255,0.72)" },
  bottomLink: { fontFamily: theme.font.bold, color: theme.colors.primary },
});
