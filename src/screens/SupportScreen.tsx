import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
  Linking,
  TextInput,
  Modal,
  StatusBar,
  LayoutAnimation,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Clipboard from "expo-clipboard";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  limit,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

import { auth, db } from "../lib/firebase";
import { theme } from "../theme";

type TicketStatus = "open" | "closed" | "pending";

type Ticket = {
  id: string;
  subject: string;
  status: TicketStatus;
  createdAt?: any;
  lastMessage?: string;
  message?: string;
};

type FAQ = { id: string; q: string; a: string };

const STORAGE = {
  tickets: (uid: string) => `support:tickets:${uid}`,
  draft: (uid: string) => `support:draft:${uid}`,
};

function fmt(ts: any): string {
  try {
    if (!ts) return "";
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString();
  } catch {
    return "";
  }
}

function safeLower(s: any) {
  return (typeof s === "string" ? s : "").toLowerCase();
}

async function openUrl(url: string) {
  const ok = await Linking.canOpenURL(url);
  if (!ok) return Alert.alert("Support", "No app found to open this link.");
  Linking.openURL(url);
}

const FAQS: FAQ[] = [
  { id: "f1", q: "How do I create a new family?", a: "Open Families tab, tap Create, add a name and photo, then share the invite code with members." },
  { id: "f2", q: "How do members join my family?", a: "Go to Join Family, enter the invite code, and confirm. Admin can remove members anytime." },
  { id: "f3", q: "Why is my monthly spent value wrong?", a: "Check transaction dates, category filters, and whether you changed month budget; re-open app to refresh totals." },
  { id: "f4", q: "Can I edit or delete a transaction?", a: "Transactions are create-only for safety. To correct, create an adjusting transaction and contact support." },
  { id: "f5", q: "Is my data private?", a: "Your user data and tickets are restricted to your UID by Firestore rules; other users can’t read your tickets." },
  { id: "f6", q: "What does Pending mean on a ticket?", a: "Pending means our team replied or needs more info. Use ticket details and email support with screenshots if possible." },
  { id: "f7", q: "Why does it say Syncing…?", a: "Syncing means your device wrote locally and is waiting for Firestore server confirmation." },
  { id: "f8", q: "How do I export my data?", a: "Use Export in settings. The app queues an export job and your file appears once processing finishes." },
  { id: "f9", q: "I can’t open Email/Call buttons", a: "Make sure a mail or phone app is installed and link handling is not blocked on your device." },
  { id: "f10", q: "How do I change my name?", a: "Go to Profile settings and update your name. New support tickets will include your latest saved name." },
  { id: "f11", q: "App is slow on my phone", a: "Close background apps, update the app, and avoid very large images. If it continues, share your device model in a ticket." },
  { id: "f12", q: "How do I report a bug properly?", a: "Include steps to reproduce, expected result, actual result, and a screenshot or screen recording." },
];

function StatusPill({ status }: { status: TicketStatus }) {
  const meta =
    status === "open"
      ? { bg: "rgba(16,185,129,0.14)", br: "rgba(16,185,129,0.22)", fg: "#10B981", txt: "OPEN" }
      : status === "pending"
      ? { bg: "rgba(245,158,11,0.14)", br: "rgba(245,158,11,0.22)", fg: "#F59E0B", txt: "PENDING" }
      : { bg: "rgba(100,116,139,0.14)", br: "rgba(100,116,139,0.22)", fg: "#64748B", txt: "CLOSED" };

  return (
    <View style={[styles.pill, { backgroundColor: meta.bg, borderColor: meta.br }]}>
      <Text style={[styles.pillText, { color: meta.fg }]} numberOfLines={1}>
        {meta.txt}
      </Text>
    </View>
  );
}

function FilterChip({ text, active, onPress }: { text: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && { opacity: 0.9 }]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{text}</Text>
    </Pressable>
  );
}

function ActionTile({
  icon,
  color,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, pressed && { opacity: 0.92 }]}>
      <View style={[styles.tileIcon, { backgroundColor: `${color}12`, borderColor: `${color}22` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.tileTitle} numberOfLines={1}>
        {title}
      </Text>
      <Text style={styles.tileSub} numberOfLines={1}>
        {subtitle}
      </Text>
    </Pressable>
  );
}

export default function SupportScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [userName, setUserName] = useState<string>("User");

  const [filter, setFilter] = useState<"all" | TicketStatus>("all");
  const [search, setSearch] = useState("");

  const [helpOpen, setHelpOpen] = useState(false);
  const [faqSearch, setFaqSearch] = useState("");
  const [faqOpen, setFaqOpen] = useState<Record<string, boolean>>({});

  const [selected, setSelected] = useState<Ticket | null>(null);

  const [draftSubject, setDraftSubject] = useState("");
  const [draftMessage, setDraftMessage] = useState("");

  const uid = auth.currentUser?.uid || null;

  const userRef = useMemo(() => (uid ? doc(db, "users", uid) : null), [uid]);
  const ticketsRef = useMemo(() => (uid ? collection(db, "users", uid, "supportTickets") : null), [uid]);

  const supportEmail = "support@familymate.app";
  const helpCenterUrl = "https://example.com";
  const supportPhone = "+10000000000";

  useEffect(() => {
    if (!uid) return;

    (async () => {
      const rawTickets = await AsyncStorage.getItem(STORAGE.tickets(uid));
      if (rawTickets) {
        try {
          const cached: Ticket[] = JSON.parse(rawTickets);
          if (Array.isArray(cached) && cached.length) {
            setTickets(cached);
            setLoading(false);
          }
        } catch {}
      }

      const rawDraft = await AsyncStorage.getItem(STORAGE.draft(uid));
      if (rawDraft) {
        try {
          const d = JSON.parse(rawDraft);
          setDraftSubject(typeof d?.subject === "string" ? d.subject : "");
          setDraftMessage(typeof d?.message === "string" ? d.message : "");
        } catch {}
      }
    })();
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    AsyncStorage.setItem(STORAGE.draft(uid), JSON.stringify({ subject: draftSubject, message: draftMessage })).catch(() => {});
  }, [uid, draftSubject, draftMessage]);

  useEffect(() => {
    if (!userRef) return;
    const unsub = onSnapshot(
      userRef,
      (snap) => {
        const d: any = snap.data() || {};
        setUserName(d?.name || d?.fullName || d?.displayName || "User");
      },
      () => {}
    );
    return () => unsub();
  }, [userRef]);

  useEffect(() => {
    if (!ticketsRef || !uid) return;

    const qy = query(ticketsRef, orderBy("createdAt", "desc"), limit(40));
    const unsub = onSnapshot(
      qy,
      { includeMetadataChanges: true },
      {
        next: async (snap) => {
          setSyncing(!!snap.metadata?.hasPendingWrites); // pending writes indicator [web:427]

          const rows: Ticket[] = snap.docs.map((d) => {
            const x: any = d.data() || {};
            return {
              id: d.id,
              subject: x?.subject || "Support request",
              status: (x?.status as TicketStatus) || "open",
              createdAt: x?.createdAt,
              lastMessage: x?.lastMessage || "",
              message: x?.message || "",
            };
          });

          setTickets(rows);
          setLoading(false);
          await AsyncStorage.setItem(STORAGE.tickets(uid), JSON.stringify(rows));
        },
        error: (err) => {
          setLoading(false);
          Alert.alert("Support", err?.message || "Failed to load tickets");
        },
      }
    );

    return () => unsub();
  }, [ticketsRef, uid]);

  const filteredTickets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (filter !== "all" && t.status !== filter) return false;
      if (!q) return true;
      return safeLower(t.subject).includes(q) || safeLower(t.lastMessage).includes(q);
    });
  }, [tickets, filter, search]);

  const filteredFaqs = useMemo(() => {
    const q = faqSearch.trim().toLowerCase();
    if (!q) return FAQS;
    return FAQS.filter((x) => safeLower(x.q).includes(q) || safeLower(x.a).includes(q));
  }, [faqSearch]);

  const createTicket = async () => {
    if (!ticketsRef) return;

    const subject = draftSubject.trim() || `Help needed (${new Date().toLocaleDateString()})`;
    const message = draftMessage.trim() || `Hi, I need help with FamilyMate. (Created by ${userName})`;

    try {
      setCreating(true);
      await addDoc(ticketsRef, {
        subject,
        status: "open",
        message,
        lastMessage: "Ticket created",
        createdAt: serverTimestamp(),
      });

      setDraftSubject("");
      setDraftMessage("");
      setFilter("open");
    } catch (e: any) {
      Alert.alert("Support", e?.message || "Could not create ticket");
    } finally {
      setCreating(false);
    }
  };

  const copyEmail = async () => {
    await Clipboard.setStringAsync(supportEmail);
    Alert.alert("Copied", "Support email copied.");
  };

  const toggleFaq = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); // standard preset [web:970]
    setFaqOpen((p) => ({ ...p, [id]: !p[id] }));
  };

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 10) }]}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Center header pill (match other screens) */}
      <View style={styles.headerBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.9 }]}>
          <Ionicons name="chevron-back" size={18} color={theme.colors.text} />
        </Pressable>

        <View pointerEvents="none" style={styles.centerTitle}>
          <View style={styles.centerTitlePill}>
            <Ionicons name="headset-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.centerTitleText}>Support</Text>
          </View>
        </View>

        <Pressable onPress={() => setHelpOpen(true)} hitSlop={12} style={({ pressed }) => [styles.rightBtn, pressed && { opacity: 0.9 }]}>
          <Ionicons name="help-circle-outline" size={20} color={theme.colors.primary} />
        </Pressable>

        <View style={styles.rightGhost}>
          {loading ? <ActivityIndicator color={theme.colors.primary} /> : null}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 18 + insets.bottom }}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <Ionicons name="headset-outline" size={18} color="#fff" />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Get help fast</Text>
              <Text style={styles.heroSub} numberOfLines={1}>
                Hi {userName} • {syncing ? "Syncing…" : "Realtime"}
              </Text>
            </View>

            <Pressable onPress={createTicket} disabled={creating} style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }, creating && { opacity: 0.6 }]}>
              {creating ? <ActivityIndicator color="#fff" /> : <Ionicons name="add" size={18} color="#fff" />}
              <Text style={styles.primaryBtnText}>New</Text>
            </Pressable>
          </View>

          {/* Compose */}
          <View style={styles.compose}>
            <Text style={styles.composeLabel}>Quick ticket</Text>

            <View style={styles.inputWrap}>
              <Ionicons name="pricetag-outline" size={16} color={theme.colors.muted} />
              <TextInput
                value={draftSubject}
                onChangeText={setDraftSubject}
                placeholder="Subject (optional)"
                placeholderTextColor={theme.colors.muted}
                style={styles.input}
              />
            </View>

            <View style={[styles.inputWrap, styles.textareaWrap]}>
              <Ionicons name="chatbubble-ellipses-outline" size={16} color={theme.colors.muted} style={{ marginTop: 2 }} />
              <TextInput
                value={draftMessage}
                onChangeText={setDraftMessage}
                placeholder="Describe your issue (optional)"
                placeholderTextColor={theme.colors.muted}
                style={[styles.input, { height: 72 }]}
                multiline
              />
            </View>
          </View>

          {/* Search + filters */}
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={16} color={theme.colors.muted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search tickets"
              placeholderTextColor={theme.colors.muted}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {search ? (
              <Pressable onPress={() => setSearch("")} hitSlop={10}>
                <Ionicons name="close-circle" size={18} color={theme.colors.muted} />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.filtersRow}>
            <FilterChip text="All" active={filter === "all"} onPress={() => setFilter("all")} />
            <FilterChip text="Open" active={filter === "open"} onPress={() => setFilter("open")} />
            <FilterChip text="Pending" active={filter === "pending"} onPress={() => setFilter("pending")} />
            <FilterChip text="Closed" active={filter === "closed"} onPress={() => setFilter("closed")} />
          </View>
        </View>

        {/* Contact actions grid */}
        <View style={styles.gridCard}>
          <ActionTile icon="mail-outline" color="#0EA5E9" title="Email" subtitle="Fast reply" onPress={() => openUrl(`mailto:${supportEmail}`)} />
          <ActionTile icon="call-outline" color="#10B981" title="Call" subtitle="Business hours" onPress={() => openUrl(`tel:${supportPhone}`)} />
          <ActionTile icon="globe-outline" color="#8B5CF6" title="Website" subtitle="Help center" onPress={() => openUrl(helpCenterUrl)} />
          <ActionTile icon="copy-outline" color={theme.colors.primary} title="Copy email" subtitle={supportEmail} onPress={copyEmail} />
        </View>

        {/* Tickets */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>YOUR TICKETS</Text>
          <Text style={styles.sectionHint}>{filteredTickets.length}</Text>
        </View>

        <View style={styles.card}>
          {filteredTickets.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={theme.colors.muted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.emptyTitle}>No tickets found</Text>
                <Text style={styles.emptyText}>Create a ticket and our team will respond.</Text>
              </View>
            </View>
          ) : (
            filteredTickets.map((t, idx) => (
              <View key={t.id}>
                <Pressable onPress={() => setSelected(t)} style={({ pressed }) => [styles.ticketRow, pressed && { opacity: 0.92 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ticketTitle} numberOfLines={1}>
                      {t.subject}
                    </Text>
                    <Text style={styles.ticketMeta} numberOfLines={1}>
                      {t.lastMessage ? t.lastMessage : "—"} {t.createdAt ? `• ${fmt(t.createdAt)}` : ""}
                    </Text>
                  </View>
                  <StatusPill status={t.status} />
                </Pressable>
                {idx !== filteredTickets.length - 1 ? <View style={styles.divider} /> : null}
              </View>
            ))
          )}
        </View>

        <View style={{ height: 10 }} />
      </ScrollView>

      {/* Ticket details modal */}
      <Modal visible={!!selected} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSelected(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                Ticket details
              </Text>
              <Pressable onPress={() => setSelected(null)} hitSlop={10}>
                <Ionicons name="close" size={20} color={theme.colors.muted} />
              </Pressable>
            </View>

            <Text style={styles.modalSubject} numberOfLines={2}>
              {selected?.subject || ""}
            </Text>

            <View style={styles.modalPillsRow}>
              {selected?.status ? <StatusPill status={selected.status} /> : null}
              {selected?.createdAt ? (
                <View style={styles.metaPill}>
                  <Ionicons name="time-outline" size={14} color={theme.colors.muted} />
                  <Text style={styles.metaPillText}>{fmt(selected.createdAt)}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.modalBox}>
              <Text style={styles.modalBoxLabel}>Message</Text>
              <Text style={styles.modalBoxText}>{selected?.message || selected?.lastMessage || "—"}</Text>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Help / FAQ bottom sheet */}
      <Modal visible={helpOpen} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setHelpOpen(false)}>
        <Pressable style={styles.modalBackdropSheet} onPress={() => setHelpOpen(false)}>
          <Pressable style={[styles.sheet, { paddingBottom: 14 + insets.bottom }]} onPress={() => {}}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHead}>
              <View style={styles.sheetTitleRow}>
                <View style={styles.helpCircle}>
                  <Ionicons name="help-buoy-outline" size={18} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetTitle}>Help center</Text>
                  <Text style={styles.sheetSub}>Search FAQs or contact support.</Text>
                </View>
              </View>

              <Pressable onPress={() => setHelpOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={20} color={theme.colors.muted} />
              </Pressable>
            </View>

            <View style={[styles.searchWrap, { marginTop: 12 }]}>
              <Ionicons name="search-outline" size={16} color={theme.colors.muted} />
              <TextInput
                value={faqSearch}
                onChangeText={setFaqSearch}
                placeholder="Search FAQs"
                placeholderTextColor={theme.colors.muted}
                style={styles.searchInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {faqSearch ? (
                <Pressable onPress={() => setFaqSearch("")} hitSlop={10}>
                  <Ionicons name="close-circle" size={18} color={theme.colors.muted} />
                </Pressable>
              ) : null}
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {filteredFaqs.map((f) => {
                const open = !!faqOpen[f.id];
                return (
                  <View key={f.id} style={styles.faqItem}>
                    <Pressable onPress={() => toggleFaq(f.id)} style={({ pressed }) => [styles.faqHead, pressed && { opacity: 0.92 }]}>
                      <Ionicons name={open ? "remove-circle-outline" : "add-circle-outline"} size={18} color={theme.colors.primary} />
                      <Text style={styles.faqQ} numberOfLines={2}>
                        {f.q}
                      </Text>
                    </Pressable>
                    {open ? <Text style={styles.faqA}>{f.a}</Text> : null}
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.sheetActions}>
              <Pressable onPress={copyEmail} style={({ pressed }) => [styles.sheetBtn, pressed && { opacity: 0.9 }]}>
                <Ionicons name="copy-outline" size={18} color={theme.colors.primary} />
                <Text style={styles.sheetBtnText}>Copy email</Text>
              </Pressable>

              <Pressable onPress={() => openUrl(`mailto:${supportEmail}`)} style={({ pressed }) => [styles.sheetBtn, pressed && { opacity: 0.9 }]}>
                <Ionicons name="mail-outline" size={18} color={theme.colors.primary} />
                <Text style={styles.sheetBtnText}>Email support</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 18, backgroundColor: theme.colors.background },

  /* Header */
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
  rightBtn: {
    position: "absolute",
    right: 48,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  rightGhost: { position: "absolute", right: 0, width: 42, height: 42, alignItems: "center", justifyContent: "center" },

  /* Hero */
  hero: {
    marginTop: 10,
    borderRadius: 26,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.97)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.06)",
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.05 : 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  heroIcon: { width: 44, height: 44, borderRadius: 18, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center" },
  heroTitle: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 15 },
  heroSub: { marginTop: 3, fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 12 },

  primaryBtn: { height: 40, paddingHorizontal: 12, borderRadius: 14, backgroundColor: theme.colors.primary, flexDirection: "row", alignItems: "center", gap: 8 },
  primaryBtnText: { fontFamily: theme.font.bold, color: "#fff", fontSize: 12 },

  compose: { marginTop: 12, borderRadius: 18, padding: 12, backgroundColor: "rgba(17,24,39,0.03)", borderWidth: 1, borderColor: "rgba(17,24,39,0.06)" },
  composeLabel: { fontFamily: theme.font.bold, color: theme.colors.muted, fontSize: 12, marginBottom: 10 },

  inputWrap: {
    height: 44,
    borderRadius: 16,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.08)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  textareaWrap: { height: 96, alignItems: "flex-start", paddingTop: 10 },
  input: { flex: 1, fontFamily: theme.font.medium, color: theme.colors.text },

  searchWrap: {
    marginTop: 10,
    height: 44,
    borderRadius: 16,
    paddingHorizontal: 12,
    backgroundColor: "rgba(17,24,39,0.04)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.08)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInput: { flex: 1, fontFamily: theme.font.medium, color: theme.colors.text },

  filtersRow: { marginTop: 12, flexDirection: "row", gap: 10, flexWrap: "wrap" },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: "rgba(17,24,39,0.03)", borderWidth: 1, borderColor: "rgba(17,24,39,0.08)" },
  chipActive: { backgroundColor: "rgba(91,95,239,0.12)", borderColor: "rgba(91,95,239,0.22)" },
  chipText: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 12 },
  chipTextActive: { color: theme.colors.primary },

  /* Grid card */
  gridCard: {
    marginTop: 12,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.97)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.06)",
    padding: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.05 : 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  tile: {
    width: "48%",
    borderRadius: 18,
    padding: 12,
    backgroundColor: "rgba(17,24,39,0.03)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.06)",
  },
  tileIcon: { width: 40, height: 40, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  tileTitle: { marginTop: 10, fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 13 },
  tileSub: { marginTop: 4, fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 11 },

  /* Tickets */
  sectionHead: { marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontFamily: theme.font.medium, fontSize: 12, color: theme.colors.muted, letterSpacing: 0.85 },
  sectionHint: { fontFamily: theme.font.bold, fontSize: 12, color: theme.colors.muted },

  card: {
    marginTop: 10,
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
  ticketRow: { paddingHorizontal: 14, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  ticketTitle: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 14 },
  ticketMeta: { marginTop: 4, fontFamily: theme.font.regular, color: theme.colors.muted, fontSize: 12 },
  divider: { height: 1, backgroundColor: "rgba(17,24,39,0.06)", marginLeft: 14 },

  empty: { padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  emptyIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: "rgba(17,24,39,0.04)", borderWidth: 1, borderColor: "rgba(17,24,39,0.08)", alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 13 },
  emptyText: { marginTop: 4, fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 12 },

  pill: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  pillText: { fontFamily: theme.font.bold, fontSize: 11 },

  /* Ticket modal */
  modalBackdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  modalCard: { width: "100%", maxWidth: 520, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.98)", borderWidth: 1, borderColor: "rgba(17,24,39,0.10)", padding: 14 },
  modalHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalTitle: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 16 },
  modalSubject: { marginTop: 10, fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 14 },
  modalPillsRow: { flexDirection: "row", gap: 10, marginTop: 10, flexWrap: "wrap" },
  metaPill: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: "rgba(17,24,39,0.10)", backgroundColor: "rgba(17,24,39,0.06)" },
  metaPillText: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 11 },
  modalBox: { marginTop: 12, borderRadius: 16, padding: 12, backgroundColor: "rgba(17,24,39,0.04)", borderWidth: 1, borderColor: "rgba(17,24,39,0.08)" },
  modalBoxLabel: { fontFamily: theme.font.bold, color: theme.colors.muted, fontSize: 12 },
  modalBoxText: { marginTop: 8, fontFamily: theme.font.medium, color: theme.colors.text, fontSize: 12, lineHeight: 16 },

  /* Help sheet */
  modalBackdropSheet: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", alignItems: "center", justifyContent: "flex-end", paddingHorizontal: 18, paddingBottom: 14 },
  sheet: { width: "100%", borderRadius: 22, backgroundColor: "rgba(255,255,255,0.98)", borderWidth: 1, borderColor: "rgba(17,24,39,0.10)", padding: 14 },
  sheetHandle: { alignSelf: "center", width: 46, height: 5, borderRadius: 999, backgroundColor: "rgba(148,163,184,0.65)", marginBottom: 10 },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitleRow: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, paddingRight: 10 },
  sheetTitle: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 16 },
  sheetSub: { marginTop: 2, fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 12 },

  helpCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center" },

  faqItem: { marginTop: 10, borderRadius: 16, padding: 12, backgroundColor: "rgba(17,24,39,0.03)", borderWidth: 1, borderColor: "rgba(17,24,39,0.08)" },
  faqHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  faqQ: { flex: 1, fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 12 },
  faqA: { marginTop: 10, fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 12, lineHeight: 16 },

  sheetActions: { marginTop: 12, flexDirection: "row", gap: 10 },
  sheetBtn: { flex: 1, height: 46, borderRadius: 16, backgroundColor: "rgba(17,24,39,0.03)", borderWidth: 1, borderColor: "rgba(17,24,39,0.08)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  sheetBtnText: { fontFamily: theme.font.bold, color: theme.colors.text },
});
