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

type LangCode = "en" | "ur" | "ar";

const LANGS: Array<{
  code: LangCode;
  title: string;
  subtitle: string;
  sample: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { code: "en", title: "English", subtitle: "Default", sample: "Hello", color: "#0284C7", icon: "language-outline" },
  { code: "ur", title: "Urdu", subtitle: "اردو", sample: "سلام", color: "#16A34A", icon: "chatbubble-ellipses-outline" },
  { code: "ar", title: "Arabic", subtitle: "العربية", sample: "مرحبا", color: "#CA8A04", icon: "moon-outline" },
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

function LanguageRow({
  item,
  selected,
  onPress,
}: {
  item: (typeof LANGS)[number];
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.92 }]}>
      <View style={[styles.iconCircle, { backgroundColor: `${item.color}12`, borderColor: `${item.color}22` }]}>
        <Ionicons name={item.icon} size={18} color={item.color} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {item.subtitle} • {item.sample}
        </Text>
      </View>

      {selected ? (
        <View style={[styles.checkCircle, { backgroundColor: `${item.color}14`, borderColor: `${item.color}26` }]}>
          <Ionicons name="checkmark" size={16} color={item.color} />
        </View>
      ) : (
        <View style={styles.chevCircle}>
          <Ionicons name="chevron-forward" size={16} color={theme.colors.muted} />
        </View>
      )}
    </Pressable>
  );
}

export default function LanguageSettingsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();

  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lang, setLang] = useState<LangCode>("en");

  const userRef = useMemo(() => (uid ? doc(db, "users", uid) : null), [uid]);

  const saveTimer = useRef<any>(null);
  const pendingRef = useRef<LangCode>("en");
  const ignoreSnapshotRef = useRef(false);

  const meta = useMemo(() => LANGS.find((x) => x.code === lang) || LANGS[0], [lang]);

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
        const v = d?.settings?.language as LangCode | undefined;

        setSaving(snap.metadata.hasPendingWrites);

        if (ignoreSnapshotRef.current && snap.metadata.hasPendingWrites) {
          setLoading(false);
          return;
        }

        if (v && LANGS.some((x) => x.code === v)) {
          pendingRef.current = v;
          setLang(v);
        }
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        Alert.alert("Language", err?.message || "Failed to load language");
      }
    );

    return () => unsub();
  }, [userRef]);

  const scheduleSave = (next: LangCode) => {
    if (!userRef) return;

    pendingRef.current = next;
    ignoreSnapshotRef.current = true;
    setSaving(true);

    if (saveTimer.current) clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(async () => {
      try {
        await setDoc(userRef, { settings: { language: pendingRef.current } }, { merge: true });
      } catch (e: any) {
        Alert.alert("Save failed", e?.message || "Could not update language");
        ignoreSnapshotRef.current = false;
      } finally {
        setTimeout(() => {
          ignoreSnapshotRef.current = false;
        }, 500);
      }
    }, 250);
  };

  const choose = (c: LangCode) => {
    setLang(c);
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
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.9 }]}>
          <Ionicons name="chevron-back" size={18} color={theme.colors.text} />
        </Pressable>

        <View pointerEvents="none" style={styles.centerTitle}>
          <View style={styles.centerTitlePill}>
            <Ionicons name="globe-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.centerTitleText}>Language</Text>
          </View>
        </View>

        <View style={styles.rightGhost}>
          {loading ? <ActivityIndicator color={theme.colors.primary} /> : null}
        </View>
      </View>

      <View style={styles.hero}>
        <View style={styles.heroLeft}>
          <View style={[styles.heroIcon, { backgroundColor: `${meta.color}12`, borderColor: `${meta.color}22` }]}>
            <Ionicons name="globe-outline" size={18} color={meta.color} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.heroK}>Selected</Text>
            <Text style={styles.heroV} numberOfLines={1}>
              {meta.title} • {meta.subtitle}
            </Text>
          </View>
        </View>

        <View style={{ alignItems: "flex-end", gap: 8 }}>
          <Chip icon="chatbubble-outline" text={meta.sample} color={meta.color} />
          <Chip
            icon={saving ? "sync-outline" : "checkmark-circle-outline"}
            text={saving ? "Saving…" : "Saved"}
            color={saving ? "#64748B" : "#16A34A"}
          />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 18 + insets.bottom }}>
        <View style={styles.card}>
          {LANGS.map((x, idx) => (
            <View key={x.code}>
              <LanguageRow item={x} selected={x.code === lang} onPress={() => choose(x.code)} />
              {idx !== LANGS.length - 1 ? <View style={styles.divider} /> : null}
            </View>
          ))}
        </View>

        <View style={{ height: 10 }} />
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
  heroIcon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", borderWidth: 1 },
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
});
