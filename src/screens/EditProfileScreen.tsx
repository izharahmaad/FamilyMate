import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
  Alert,
  TextInput,
  Image,
  ScrollView,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { doc, onSnapshot, setDoc } from "firebase/firestore";

import { auth, db } from "../lib/firebase";
import { theme } from "../theme";

function IconCircle({ icon, color }: { icon: keyof typeof Ionicons.glyphMap; color: string }) {
  return (
    <View style={[styles.iconCircle, { backgroundColor: `${color}14`, borderColor: `${color}2A` }]}>
      <Ionicons name={icon} size={18} color={color} />
    </View>
  );
}

function formatBytesApproxFromBase64(b64: string) {
  const len = b64?.length || 0;
  const bytes = Math.floor((len * 3) / 4);
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

export default function EditProfileScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [photoBase64, setPhotoBase64] = useState<string>("");
  const [email, setEmail] = useState<string>("");

  const uid = auth.currentUser?.uid || null;
  const userRef = useMemo(() => (uid ? doc(db, "users", uid) : null), [uid]);

  const photoURL = photoBase64 ? `data:image/jpeg;base64,${photoBase64}` : null;

  useEffect(() => {
    if (!userRef) return;

    const unsub = onSnapshot(
      userRef,
      (snap) => {
        const d: any = snap.data() || {};
        setName(d?.name || d?.fullName || d?.displayName || "");
        setPhotoBase64((d?.photoBase64 as string) || "");
        setEmail(d?.email || auth.currentUser?.email || "");
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        Alert.alert("Profile", err?.message || "Failed to load profile");
      }
    );

    return () => unsub();
  }, [userRef]);

  const pickImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission", "Please allow photo library access.");
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true,
      });

      if (res.canceled) return;

      const asset = res.assets?.[0];
      const b64 = asset?.base64 || "";
      if (!b64) {
        Alert.alert("Image", "Could not read image as base64.");
        return;
      }

      setPhotoBase64(b64);
    } catch (e: any) {
      Alert.alert("Image", e?.message || "Failed to pick image");
    }
  };

  const removePhoto = () => {
    Alert.alert("Remove photo", "Remove your profile photo?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => setPhotoBase64("") },
    ]);
  };

  const save = async () => {
    if (!userRef) return;

    const n = name.trim();
    if (!n) {
      Alert.alert("Profile", "Name is required.");
      return;
    }

    try {
      setSaving(true);
      await setDoc(
        userRef,
        {
          name: n,
          photoBase64: photoBase64 || "",
        },
        { merge: true }
      );
      Alert.alert("Saved", "Profile updated.");
      navigation.goBack();
    } catch (e: any) {
      Alert.alert("Save failed", e?.message || "Could not update profile");
    } finally {
      setSaving(false);
    }
  };

  const canSave = !!name.trim() && !saving && !loading;

  const photoBytes = useMemo(() => Math.floor(((photoBase64?.length || 0) * 3) / 4), [photoBase64]);
  const photoSizeLabel = useMemo(() => formatBytesApproxFromBase64(photoBase64 || ""), [photoBase64]);

  const quality = useMemo(() => {
    if (!photoBase64) return { label: "No photo", color: theme.colors.muted, icon: "image-outline" as const };
    if (photoBytes < 250_000) return { label: "Good size", color: "#22C55E", icon: "checkmark-circle-outline" as const };
    if (photoBytes < 700_000) return { label: "Large", color: "#F59E0B", icon: "alert-circle-outline" as const };
    return { label: "Very large", color: "#EF4444", icon: "warning-outline" as const };
  }, [photoBase64, photoBytes]);

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 10) }]}>
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(11,18,32,0.10)", "rgba(11,18,32,0.03)", "rgba(11,18,32,0.08)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={18} color={theme.colors.text} />
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Edit Profile</Text>
            <Text style={styles.subTitle}>Name & photo update instantly</Text>
          </View>

          {(loading || saving) ? <ActivityIndicator color={theme.colors.primary} /> : null}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 18 + insets.bottom }}>
          <View style={styles.heroWrap}>
            <LinearGradient
              colors={["#0B1220", "#111B32", theme.colors.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              <View style={styles.heroRow}>
                <View style={styles.heroAvatarRing}>
                  {photoURL ? (
                    <Image source={{ uri: photoURL }} style={styles.heroAvatar} />
                  ) : (
                    <View style={styles.heroAvatarFallback}>
                      <Ionicons name="person-outline" size={22} color="rgba(255,255,255,0.95)" />
                    </View>
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.heroName} numberOfLines={1}>
                    {name.trim() ? name.trim() : "Your name"}
                  </Text>
                  <Text style={styles.heroEmail} numberOfLines={1}>
                    {email || "No email"}
                  </Text>

                  <View style={styles.heroChips}>
                    <View style={styles.chip}>
                      <Ionicons name="sync-outline" size={14} color="rgba(255,255,255,0.92)" />
                      <Text style={styles.chipText}>Live</Text>
                    </View>
                    <View style={styles.chip}>
                      <Ionicons name="shield-checkmark-outline" size={14} color="rgba(255,255,255,0.92)" />
                      <Text style={styles.chipText}>Secure</Text>
                    </View>
                  </View>
                </View>
              </View>
            </LinearGradient>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHead}>
              <IconCircle icon="image-outline" color={theme.colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.k}>Profile photo</Text>
                <Text style={styles.p}>Square photo works best. Keep it under ~700KB for speed.</Text>
              </View>
            </View>

            <View style={styles.photoActionsRow}>
              <Pressable onPress={pickImage} style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.92 }]}>
                <Ionicons name="images-outline" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>Choose photo</Text>
              </Pressable>

              <Pressable
                onPress={removePhoto}
                disabled={!photoBase64}
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  pressed && { opacity: 0.92 },
                  !photoBase64 && { opacity: 0.55 },
                ]}
              >
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
                <Text style={styles.secondaryBtnText}>Remove</Text>
              </Pressable>
            </View>

            <View style={styles.metaRow}>
              <View style={styles.metaPill}>
                <Ionicons name="stats-chart-outline" size={16} color={theme.colors.muted} />
                <Text style={styles.metaKey}>Size</Text>
                <Text style={styles.metaVal}>{photoBase64 ? photoSizeLabel : "—"}</Text>
              </View>

              <View style={[styles.metaPill, { borderColor: `${quality.color}26`, backgroundColor: `${quality.color}10` }]}>
                <Ionicons name={quality.icon} size={16} color={quality.color} />
                <Text style={styles.metaKey}>Status</Text>
                <Text style={[styles.metaVal, { color: quality.color }]}>{quality.label}</Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHead}>
              <IconCircle icon="person-circle-outline" color="#0EA5E9" />
              <View style={{ flex: 1 }}>
                <Text style={styles.k}>Your name</Text>
                <Text style={styles.p}>Shown on Settings and Home header.</Text>
              </View>
            </View>

            <View style={styles.inputShell}>
              <Ionicons name="create-outline" size={18} color={theme.colors.muted} />
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
                placeholderTextColor="rgba(100,116,139,0.85)"
                style={styles.input}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.emailRow}>
              <Ionicons name="mail-outline" size={16} color={theme.colors.muted} />
              <Text style={styles.emailText} numberOfLines={1}>
                {email || "No email"}
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHead}>
              <IconCircle icon="eye-outline" color="#6366F1" />
              <View style={{ flex: 1 }}>
                <Text style={styles.k}>Preview</Text>
                <Text style={styles.p}>How it will look inside Settings / Home.</Text>
              </View>
            </View>

            <View style={styles.previewRow}>
              <View style={styles.previewAvatarWrap}>
                {photoURL ? (
                  <Image source={{ uri: photoURL }} style={styles.previewAvatar} />
                ) : (
                  <View style={styles.previewAvatarFallback}>
                    <Ionicons name="person-outline" size={18} color="rgba(17,24,39,0.55)" />
                  </View>
                )}
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.previewName} numberOfLines={1}>
                  {name.trim() ? name.trim() : "Parent"}
                </Text>
                <Text style={styles.previewSub} numberOfLines={1}>
                  Parent • Family
                </Text>
              </View>

              <View style={styles.previewChip}>
                <Ionicons name="checkmark-circle-outline" size={16} color={theme.colors.primary} />
                <Text style={styles.previewChipText}>Ready</Text>
              </View>
            </View>
          </View>

          <Pressable
            onPress={save}
            disabled={!canSave}
            style={({ pressed }) => [
              styles.saveBtnShell,
              pressed && canSave ? { opacity: 0.92 } : null,
              !canSave ? { opacity: 0.55 } : null,
            ]}
          >
            <LinearGradient
              colors={[theme.colors.primary, theme.colors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.saveBtn}
            >
              <Ionicons name="save-outline" size={18} color="#fff" />
              <Text style={styles.saveText}>{saving ? "Saving…" : "Save changes"}</Text>
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 18, backgroundColor: theme.colors.background },

  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingBottom: 10 },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.70)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontFamily: theme.font.bold, fontSize: 18, color: theme.colors.text },
  subTitle: { marginTop: 2, fontFamily: theme.font.medium, fontSize: 12, color: theme.colors.muted },

  heroWrap: { marginTop: 6, borderRadius: 26, overflow: "hidden" },
  heroCard: {
    borderRadius: 26,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.12 : 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 14 },
    elevation: 4,
  },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  heroAvatarRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.55)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
    overflow: "hidden",
  },
  heroAvatar: { width: 64, height: 64, borderRadius: 32 },
  heroAvatarFallback: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  heroName: { fontFamily: theme.font.bold, fontSize: 18, color: "#fff" },
  heroEmail: { marginTop: 4, fontFamily: theme.font.medium, fontSize: 12, color: "rgba(255,255,255,0.86)" },

  heroChips: { marginTop: 10, flexDirection: "row", gap: 10, flexWrap: "wrap" },
  chip: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chipText: { fontFamily: theme.font.bold, fontSize: 12, color: "rgba(255,255,255,0.95)" },

  card: {
    marginTop: 12,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.97)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.06)",
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.05 : 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
    padding: 14,
  },

  iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  k: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 14 },
  p: { marginTop: 3, fontFamily: theme.font.regular, color: theme.colors.muted, fontSize: 12, lineHeight: 16 },

  photoActionsRow: { marginTop: 12, flexDirection: "row", gap: 10 },
  primaryBtn: {
    flex: 1,
    height: 46,
    borderRadius: 999,
    backgroundColor: theme.colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  primaryBtnText: { fontFamily: theme.font.bold, color: "#fff", fontSize: 13 },

  secondaryBtn: {
    flex: 1,
    height: 46,
    borderRadius: 999,
    backgroundColor: "rgba(239,68,68,0.10)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.18)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  secondaryBtnText: { fontFamily: theme.font.bold, color: "#EF4444", fontSize: 13 },

  metaRow: { marginTop: 12, flexDirection: "row", gap: 10 },
  metaPill: {
    flex: 1,
    height: 44,
    borderRadius: 999,
    paddingHorizontal: 12,
    backgroundColor: "rgba(11,18,32,0.03)",
    borderWidth: 1,
    borderColor: "rgba(11,18,32,0.06)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  metaKey: { fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 12 },
  metaVal: { marginLeft: "auto", fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 12 },

  inputShell: {
    marginTop: 12,
    height: 54,
    borderRadius: 999,
    paddingHorizontal: 14,
    backgroundColor: "rgba(11,18,32,0.03)",
    borderWidth: 1,
    borderColor: "rgba(11,18,32,0.08)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: { flex: 1, height: 54, fontFamily: theme.font.bold, color: theme.colors.text },

  emailRow: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  emailText: { flex: 1, fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 12 },

  previewRow: {
    marginTop: 12,
    borderRadius: 18,
    padding: 12,
    backgroundColor: "rgba(11,18,32,0.03)",
    borderWidth: 1,
    borderColor: "rgba(11,18,32,0.06)",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  previewAvatarWrap: { width: 44, height: 44, borderRadius: 22, overflow: "hidden" },
  previewAvatar: { width: 44, height: 44, borderRadius: 22 },
  previewAvatarFallback: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(17,24,39,0.06)", alignItems: "center", justifyContent: "center" },
  previewName: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 14 },
  previewSub: { marginTop: 3, fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 12 },

  previewChip: {
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
  previewChipText: { fontFamily: theme.font.bold, color: theme.colors.primary, fontSize: 12 },

  saveBtnShell: { marginTop: 12, borderRadius: 999, overflow: "hidden" },
  saveBtn: {
    height: 56,
    borderRadius: 999,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  saveText: { fontFamily: theme.font.bold, color: "#fff", fontSize: 14 },
});
