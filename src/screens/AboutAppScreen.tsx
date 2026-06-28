import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  StatusBar,
  Linking,
  Alert,
  Platform,
  ScrollView,
  LayoutAnimation,
  Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import NetInfo from "@react-native-community/netinfo";

import { theme } from "../theme";

const APP_NAME = "FamilyMate";
const VERSION = "1.0.0";
const BUILD = "100";
const SUPPORT_EMAIL = "support@familymate.app";

// Put real URLs when you have them
const PRIVACY_URL = "https://example.com/privacy";
const TERMS_URL = "https://example.com/terms";
const RATE_URL = "https://example.com/rate";

function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function SectionHeader({ icon, title, subtitle }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={18} color={theme.colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {!!subtitle ? <Text style={styles.sectionSub}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

function ActionRow({
  icon,
  title,
  subtitle,
  onPress,
  tone = "default",
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress: () => void;
  tone?: "default" | "info" | "danger";
}) {
  const color = tone === "danger" ? theme.colors.error : tone === "info" ? theme.colors.primary : theme.colors.text;

  const bg =
    tone === "danger"
      ? "rgba(239,68,68,0.10)"
      : tone === "info"
      ? "rgba(91,95,239,0.10)"
      : "rgba(17,24,39,0.03)";

  const br =
    tone === "danger"
      ? "rgba(239,68,68,0.18)"
      : tone === "info"
      ? "rgba(91,95,239,0.18)"
      : "rgba(17,24,39,0.08)";

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.92 }]}>
      <View style={[styles.actionIcon, { backgroundColor: bg, borderColor: br }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.actionTitle} numberOfLines={1}>
          {title}
        </Text>
        {!!subtitle ? (
          <Text style={styles.actionSub} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
    </Pressable>
  );
}

function InfoPill({ dotColor, text, icon }: { dotColor: string; text: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.infoPill}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Ionicons name={icon} size={14} color="rgba(255,255,255,0.92)" />
      <Text style={styles.infoPillText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

export default function AboutAppScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();

  // REALTIME FEATURE #1: updates every second
  const [now, setNow] = useState<Date>(() => new Date());

  // REALTIME FEATURE #2: online/offline indicator
  const [isOnline, setIsOnline] = useState<boolean | null>(null);

  const [aboutOpen, setAboutOpen] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const online = !!(state.isConnected && state.isInternetReachable !== false);
      setIsOnline(online);
    });
    return () => unsub();
  }, []);

  const openUrl = async (url: string) => {
    try {
      const ok = await Linking.canOpenURL(url); // [web:1007]
      if (!ok) return Alert.alert("Link", "Cannot open this link.");
      await Linking.openURL(url); // [web:1007]
    } catch {
      Alert.alert("Link", "Could not open link.");
    }
  };

  const shareApp = async () => {
    try {
      await Share.share({ message: `Try ${APP_NAME}: ${RATE_URL}` });
    } catch {}
  };

  const copyAppInfo = async () => {
    const txt =
      `${APP_NAME}\n` +
      `Version: ${VERSION} (${BUILD})\n` +
      `Platform: ${Platform.OS}\n` +
      `Support: ${SUPPORT_EMAIL}\n` +
      `Last updated: ${now.toLocaleString()}\n`;
    await Clipboard.setStringAsync(txt); // [web:826]
    Alert.alert("Copied", "App info copied.");
  };

  const toggleAbout = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAboutOpen((p) => !p);
  };

  const liveStatusText = useMemo(() => {
    if (isOnline === null) return "Checking…";
    return isOnline ? "Online" : "Offline";
  }, [isOnline]);

  const liveStatusColor = useMemo(() => {
    if (isOnline === null) return "rgba(148,163,184,0.95)";
    return isOnline ? "rgba(52,211,153,0.95)" : "rgba(248,113,113,0.95)";
  }, [isOnline]);

  const aboutParagraph =
    "FamilyMate is built for families who want a simple, shared view of spending. It lets you create a family space, invite members, record transactions, and review monthly totals so everyone stays aligned—without turning finance into something complicated.";

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 10) }]}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Header (matches your other screens) */}
      <View style={styles.headerBar}>
        <Pressable onPress={() => navigation?.goBack?.()} hitSlop={12} style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.9 }]}>
          <Ionicons name="chevron-back" size={18} color={theme.colors.text} />
        </Pressable>

        <View pointerEvents="none" style={styles.centerTitle}>
          <View style={styles.centerTitlePill}>
            <Ionicons name="information-circle-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.centerTitleText}>About {APP_NAME}</Text>
          </View>
        </View>

        <Pressable onPress={shareApp} hitSlop={12} style={({ pressed }) => [styles.rightBtn, pressed && { opacity: 0.9 }]}>
          <Ionicons name="share-social-outline" size={20} color={theme.colors.primary} />
        </Pressable>
      </View>

      {/* Hero */}
      <View style={{ paddingHorizontal: 18, marginTop: 10 }}>
        <LinearGradient
          colors={["#2559c2", "#0a0a2e", "#112B5C"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroTop}>
            <View style={styles.logoBox}>
              <Ionicons name="people-outline" size={22} color="#fff" />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.heroName}>{APP_NAME}</Text>
              <Text style={styles.heroMeta} numberOfLines={1}>
                Version {VERSION} • Build {BUILD}
              </Text>
            </View>

            <View style={styles.heroRight}>
              <InfoPill dotColor={liveStatusColor} icon="pulse-outline" text={liveStatusText} />
              <InfoPill dotColor="rgba(148,163,184,0.95)" icon="time-outline" text={now.toLocaleTimeString()} />
            </View>
          </View>

          <Pressable onPress={copyAppInfo} style={({ pressed }) => [styles.heroBtn, pressed && { opacity: 0.92 }]}>
            <Ionicons name="copy-outline" size={18} color="#fff" />
            <Text style={styles.heroBtnText}>Copy app info</Text>
          </Pressable>
        </LinearGradient>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 12) + 18 }}>
        {/* Section 1 */}
        <Card style={{ marginTop: 12 }}>
          <Pressable onPress={toggleAbout} style={({ pressed }) => [styles.cardHeadRow, pressed && { opacity: 0.92 }]}>
            <Text style={styles.cardTitle}>1) Overview</Text>
            <Ionicons name={aboutOpen ? "chevron-up" : "chevron-down"} size={18} color={theme.colors.muted} />
          </Pressable>
          {aboutOpen ? <Text style={styles.paragraph}>{aboutParagraph}</Text> : <Text style={styles.paragraphMuted}>Tap to expand.</Text>}
        </Card>

        {/* Section 2 */}
        <Card>
          <SectionHeader icon="construct-outline" title="2) How it works" subtitle="Simple flow, consistent history" />
          <Text style={styles.paragraph}>
            Create a family space, invite members, and start adding transactions with clear categories. Monthly views help you
            understand totals quickly, and exports let you take your data outside the app whenever needed.
          </Text>
        </Card>

        {/* Section 3 */}
        <Card>
          <SectionHeader icon="shield-checkmark-outline" title="3) Privacy & safety" subtitle="Designed to protect your data" />
          <Text style={styles.paragraph}>
            FamilyMate aims to keep access controlled and changes intentional—so the record feels trustworthy. Use Privacy Policy to
            see what’s collected and why, and contact support if something doesn’t look right.
          </Text>
          <ActionRow icon="lock-closed-outline" title="Privacy policy" subtitle="How we handle your data" onPress={() => openUrl(PRIVACY_URL)} />
        </Card>

        {/* Section 4 */}
        <Card>
          <SectionHeader icon="cloud-outline" title="4) Sync & reliability" subtitle="What “Syncing…” actually means" />
          <Text style={styles.paragraph}>
            When you see syncing, it means your device saved changes locally and is confirming them with the server. If you go offline,
            you can still use the app, and it will sync again when your connection returns.
          </Text>
        </Card>

        {/* Section 5 */}
        <Card>
          <SectionHeader icon="chatbubbles-outline" title="5) Support & feedback" subtitle="Help us improve the experience" />
          <ActionRow icon="mail-outline" title="Email support" subtitle={SUPPORT_EMAIL} onPress={() => openUrl(`mailto:${SUPPORT_EMAIL}`)} />
          <ActionRow icon="star-outline" title="Rate the app" subtitle="Tell others what you like" onPress={() => openUrl(RATE_URL)} tone="info" />
          <ActionRow icon="document-text-outline" title="Terms of use" subtitle="Rules and conditions" onPress={() => openUrl(TERMS_URL)} />
        </Card>

        <Text style={styles.footerNote}>© {new Date().getFullYear()} {APP_NAME}. All rights reserved.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },

  /* Header */
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
  centerTitle: { position: "absolute", left: 18, right: 18, alignItems: "center", justifyContent: "center" },
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
  rightBtn: {
    position: "absolute",
    right: 18,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },

  /* Hero */
  hero: {
    borderRadius: 26,
    padding: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.10 : 0.20,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 3,
  },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  logoBox: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroName: { fontFamily: theme.font.bold, fontSize: 20, color: "#fff" },
  heroMeta: { marginTop: 4, fontFamily: theme.font.medium, fontSize: 12, color: "rgba(255,255,255,0.80)" },
  heroRight: { alignItems: "flex-end", gap: 8 },

  infoPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  infoPillText: { fontFamily: theme.font.bold, fontSize: 11, color: "rgba(255,255,255,0.92)" },

  heroBtn: {
    marginTop: 12,
    height: 44,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  heroBtnText: { fontFamily: theme.font.bold, fontSize: 13, color: "#fff" },

  /* Cards */
  card: {
    marginHorizontal: 18,
    marginTop: 12,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.06)",
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.05 : 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  cardHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 15, marginBottom: 10 },

  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "rgba(91,95,239,0.10)",
    borderWidth: 1,
    borderColor: "rgba(91,95,239,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 14 },
  sectionSub: { marginTop: 3, fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 12 },

  paragraph: { fontFamily: theme.font.regular, color: theme.colors.muted, lineHeight: 19 },
  paragraphMuted: { fontFamily: theme.font.medium, color: theme.colors.muted, lineHeight: 19 },

  actionRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  actionIcon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  actionTitle: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 14 },
  actionSub: { marginTop: 3, fontFamily: theme.font.regular, color: theme.colors.muted, fontSize: 12 },

  footerNote: { marginTop: 14, textAlign: "center", fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 11, marginBottom: 10 },
});
