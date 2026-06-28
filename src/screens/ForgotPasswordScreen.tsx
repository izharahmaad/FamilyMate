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
  ScrollView,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { sendPasswordResetEmail } from "firebase/auth";

import { auth } from "../lib/firebase";
import { theme } from "../theme";
import type { AuthStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "ForgotPassword">;

const UI = { error: "#EF4444" };

// Match Login/Signup
const NAVY_0 = "#0B1220";
const NAVY_1 = "#0F1A33";
const TEXT = "rgba(255,255,255,0.92)";
const TEXT_MUTED = "rgba(255,255,255,0.72)";
const PLACEHOLDER = "rgba(255,255,255,0.45)";

export default function ForgotPasswordScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const emailError = useMemo(() => {
    if (!email.length) return "";
    if (!email.trim().includes("@")) return "Enter a valid email address.";
    return "";
  }, [email]);

  const canSubmit = useMemo(() => !loading && !emailError && email.trim().length > 0, [loading, emailError, email]);

  const onReset = async () => {
    if (!canSubmit) return;

    try {
      setLoading(true);
      await sendPasswordResetEmail(auth, email.trim());
      Alert.alert("Email sent", "Check your inbox for the reset link.");
      navigation.goBack();
    } catch {
      Alert.alert("Failed", "Could not send reset email. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 10) }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Navy background + glow */}
      <LinearGradient
        pointerEvents="none"
        colors={[NAVY_0, NAVY_1, NAVY_0]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(91,95,239,0.22)", "rgba(91,95,239,0.08)", "rgba(0,0,0,0.00)"]}
        start={{ x: 0.12, y: 0 }}
        end={{ x: 0.88, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.scrollGrow, { paddingBottom: Math.max(insets.bottom, 16) }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.centerWrap}>
            <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={({ pressed }) => [styles.backCircle, { opacity: pressed ? 0.88 : 1 }]}>
              <Ionicons name="chevron-back" size={20} color="#fff" />
            </Pressable>

            <Ionicons name="shield-checkmark-outline" size={86} color={theme.colors.primary} />

            <Text style={styles.h1}>Forgot password?</Text>
            <Text style={styles.sub}>Enter your email and we’ll send a reset link.</Text>

            {/* Glass form card */}
            <View style={styles.formCard}>
              <Text style={styles.label}>Email Address</Text>
              <View style={[styles.inputWrap, emailError ? styles.inputWrapErr : null]}>
                <Ionicons name="mail-outline" size={18} color="rgba(255,255,255,0.72)" style={styles.leftIcon} />
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

              <Pressable
                disabled={!canSubmit}
                onPress={onReset}
                style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }, { marginTop: 16 }]}
              >
                <View style={[styles.btnWrap, { opacity: canSubmit ? 1 : 0.55 }]}>
                  <LinearGradient
                    colors={[theme.colors.primary, theme.colors.primaryDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.btn}
                  >
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Send Reset Link</Text>}
                  </LinearGradient>
                </View>
              </Pressable>

              <Text style={styles.note}>We’ll send a secure link to reset your password.</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NAVY_0 },
  scrollGrow: { flexGrow: 1, paddingHorizontal: 18, paddingTop: 10 },

  centerWrap: { flexGrow: 1, justifyContent: "center", alignItems: "center" },

  backCircle: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },

  h1: { marginTop: 14, fontFamily: theme.font.bold, fontSize: 28, color: TEXT, textAlign: "center" },
  sub: {
    marginTop: 8,
    fontFamily: theme.font.regular,
    fontSize: 14,
    lineHeight: 20,
    color: TEXT_MUTED,
    textAlign: "center",
    paddingHorizontal: 14,
  },

  // GLASS + 40% shadow (same feel)
  formCard: {
    width: "100%",
    marginTop: 18,
    padding: 16,
    borderRadius: 22,
    backgroundColor: "rgba(11,18,32,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",

    shadowColor: NAVY_0,
    shadowOpacity: 0.40,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 10,
  },

  label: { marginBottom: 8, fontFamily: theme.font.medium, fontSize: 14, color: "rgba(255,255,255,0.90)" },

  inputWrap: {
    height: 56,
    borderRadius: theme.radius.md,
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
  helper: { marginTop: 6, fontFamily: theme.font.regular, fontSize: 12, color: UI.error },

  btnWrap: { borderRadius: 999, overflow: "hidden" },
  btn: { height: 58, borderRadius: 999, alignItems: "center", justifyContent: "center", flexDirection: "row", paddingHorizontal: 18 },
  btnText: { fontFamily: theme.font.bold, fontSize: 16, color: "#fff" },

  note: { marginTop: 12, fontFamily: theme.font.medium, color: "rgba(255,255,255,0.68)", fontSize: 12, textAlign: "center" },
});
