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
  Share,
  StatusBar,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";

import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import {
  collection,
  onSnapshot,
  orderBy,
  query,
  limit,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

import { auth, db } from "../lib/firebase";
import { theme } from "../theme";

type JobStatus = "queued" | "running" | "done" | "error";

type Job = {
  id: string;
  type?: string;
  status: JobStatus;
  createdAt?: any;
  fileName?: string;
  rows?: number;
  error?: string;
  downloadUrl?: string;
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

function statusMeta(s: JobStatus) {
  if (s === "done") return { text: "DONE", color: "#10B981", icon: "checkmark-circle-outline" as const };
  if (s === "running") return { text: "RUNNING", color: "#0EA5E9", icon: "sync-outline" as const };
  if (s === "error") return { text: "ERROR", color: "#EF4444", icon: "alert-circle-outline" as const };
  return { text: "QUEUED", color: "#F59E0B", icon: "time-outline" as const };
}

function Pill({ text, color, icon }: { text: string; color: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={[styles.pill, { backgroundColor: `${color}14`, borderColor: `${color}2A` }]}>
      <Ionicons name={icon} size={14} color={color} />
      <Text style={[styles.pillText, { color }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

function FilterChip({ text, active, onPress }: { text: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.filterChip, active && styles.filterChipActive, pressed && { opacity: 0.9 }]}>
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{text}</Text>
    </Pressable>
  );
}

function safeFileName(name: string) {
  const n = (name || "").trim();
  const cleaned = (n || "familymate-export.xlsx").replace(/[^a-zA-Z0-9._-]/g, "-");
  return cleaned.toLowerCase().endsWith(".xlsx") ? cleaned : `${cleaned}.xlsx`;
}

function HeroChip({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.heroChip}>
      <Ionicons name={icon} size={14} color="rgba(255,255,255,0.92)" />
      <Text style={styles.heroChipText}>{label}</Text>
    </View>
  );
}

export default function DataExportScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filter, setFilter] = useState<"all" | JobStatus>("all");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const [tipsOpen, setTipsOpen] = useState(false);

  const uid = auth.currentUser?.uid || null;
  const jobsRef = useMemo(() => (uid ? collection(db, "users", uid, "exportJobs") : null), [uid]);

  useEffect(() => {
    if (!jobsRef) return;

    const qy = query(jobsRef, orderBy("createdAt", "desc"), limit(30));
    const unsub = onSnapshot(
      qy,
      (snap) => {
        const rows: Job[] = snap.docs.map((d) => {
          const x: any = d.data() || {};
          return {
            id: d.id,
            type: x?.type,
            status: (x?.status as JobStatus) || "queued",
            createdAt: x?.createdAt,
            fileName: x?.fileName,
            rows: typeof x?.rows === "number" ? x.rows : undefined,
            error: x?.error,
            downloadUrl: x?.downloadUrl,
          };
        });
        setJobs(rows);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        Alert.alert("Export", err?.message || "Failed to load export history.");
      }
    );

    return () => unsub();
  }, [jobsRef]);

  const counts = useMemo(() => {
    const c = { queued: 0, running: 0, done: 0, error: 0 };
    for (const j of jobs) (c as any)[j.status] = (c as any)[j.status] + 1;
    return c;
  }, [jobs]);

  const latest = jobs[0];
  const latestMeta = latest ? statusMeta(latest.status) : null;

  const filteredJobs = useMemo(() => {
    if (filter === "all") return jobs;
    return jobs.filter((j) => j.status === filter);
  }, [jobs, filter]);

  const createExportJob = async () => {
    if (!jobsRef) return Alert.alert("Export", "Please login again.");

    try {
      setCreating(true);
      await addDoc(jobsRef, {
        type: "csv",
        status: "queued",
        createdAt: serverTimestamp(),
        fileName: `familymate-export-${new Date().toISOString().slice(0, 10)}.xlsx`,
      });
      Alert.alert("Export", "Queued.");
    } catch (e: any) {
      Alert.alert("Export", e?.message || "Could not start export.");
    } finally {
      setCreating(false);
    }
  };

  const copyLink = async (j: Job) => {
    if (!j.downloadUrl) return Alert.alert("Export", "No download link yet.");
    await Clipboard.setStringAsync(j.downloadUrl);
    Alert.alert("Copied", "Link copied.");
  };

  const shareLink = async (j: Job) => {
    if (!j.downloadUrl) return Alert.alert("Export", "No download link yet.");
    try {
      await Share.share({ message: j.downloadUrl });
    } catch {}
  };

  const downloadXlsxToPhone = async (j: Job) => {
    if (!j.downloadUrl) return Alert.alert("Download", "No download link yet.");

    const dir = FileSystem.documentDirectory;
    if (!dir) return Alert.alert("Download", "Storage not available on this device.");

    const name = safeFileName(j.fileName || `familymate-export-${j.id}.xlsx`);
    const targetUri = dir + name;

    try {
      setDownloadingId(j.id);

      const res = await FileSystem.downloadAsync(j.downloadUrl, targetUri);

      const canShare = await Sharing.isAvailableAsync(); // recommended check [web:939]
      if (canShare) {
        await Sharing.shareAsync(res.uri, {
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          dialogTitle: "Save Excel file",
          UTI: "org.openxmlformats.spreadsheetml.sheet",
        });
      } else {
        await Share.share({ message: res.uri });
      }
    } catch (e: any) {
      Alert.alert("Download", e?.message || "Download failed.");
    } finally {
      setDownloadingId(null);
    }
  };

  const exportingNow = counts.running > 0 || counts.queued > 0;

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 10) }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Center title header */}
      <View style={styles.headerBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.9 }]}>
          <Ionicons name="chevron-back" size={18} color={theme.colors.text} />
        </Pressable>

        <View pointerEvents="none" style={styles.centerTitle}>
          <View style={styles.centerTitlePill}>
            <Ionicons name="document-text-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.centerTitleText}>Data Export</Text>
          </View>
        </View>

        <Pressable onPress={() => setTipsOpen(true)} hitSlop={12} style={({ pressed }) => [styles.rightBtn, pressed && { opacity: 0.9 }]}>
          <Ionicons name="help-circle-outline" size={20} color={theme.colors.primary} />
        </Pressable>

        <View style={styles.rightGhost}>
          {loading ? <ActivityIndicator color={theme.colors.primary} /> : <Ionicons name="cloud-outline" size={20} color={theme.colors.muted} />}
        </View>
      </View>

      {/* NAVY / DARK HERO */}
      <LinearGradient
        colors={["#2559c2", "#0a0a2e", "#112B5C"]} // dark navy
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        {/* subtle top glow */}
        <LinearGradient
          colors={["rgba(59,130,246,0.35)", "rgba(0,0,0,0)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={styles.heroOverlay}
        />

        <View style={{ flex: 1 }}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <Ionicons name="document-attach-outline" size={18} color="#fff" />
            </View>
            <Text style={styles.heroTopText}>Latest export</Text>
          </View>

          <Text style={styles.heroFile} numberOfLines={1}>
            {latest?.fileName ? latest.fileName : "No exports yet"}
          </Text>

          <Text style={styles.heroTime} numberOfLines={1}>
            {latest?.createdAt ? fmt(latest.createdAt) : "Create a new export anytime"}
          </Text>

          <View style={styles.heroChips}>
            <HeroChip icon="checkmark-done-outline" label={`${counts.done} Done`} />
            <HeroChip icon="sync-outline" label={`${counts.running} Running`} />
            <HeroChip icon="time-outline" label={`${counts.queued} Queued`} />
            <HeroChip icon="alert-circle-outline" label={`${counts.error} Error`} />
          </View>
        </View>

        <View style={{ alignItems: "flex-end", gap: 10 }}>
          {latestMeta ? <Pill text={latestMeta.text} color={latestMeta.color} icon={latestMeta.icon} /> : null}

          <Pressable
            onPress={createExportJob}
            disabled={creating}
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }, creating && { opacity: 0.6 }]}
          >
            {creating ? <ActivityIndicator color="#fff" /> : <Ionicons name="add" size={18} color="#fff" />}
            <Text style={styles.primaryBtnText}>New export</Text>
          </Pressable>

          {latest?.status === "done" && !!latest.downloadUrl ? (
            <Pressable
              onPress={() => downloadXlsxToPhone(latest)}
              disabled={downloadingId === latest.id}
              style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.9 }, downloadingId === latest.id && { opacity: 0.6 }]}
            >
              {downloadingId === latest.id ? <ActivityIndicator color="#fff" /> : <Ionicons name="download-outline" size={18} color="#fff" />}
              <Text style={styles.secondaryBtnText}>Download</Text>
            </Pressable>
          ) : null}
        </View>
      </LinearGradient>

      {exportingNow && (
        <View style={styles.liveBanner}>
          <Ionicons name="pulse-outline" size={16} color={theme.colors.primary} />
          <Text style={styles.liveBannerText}>{counts.running > 0 ? "Export is running…" : "Export is queued…"}</Text>
          <Pressable onPress={() => setFilter(counts.running > 0 ? "running" : "queued")} style={({ pressed }) => [styles.liveBtn, pressed && { opacity: 0.9 }]}>
            <Text style={styles.liveBtnText}>View</Text>
          </Pressable>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 18 + insets.bottom }}>
        <View style={styles.filtersRow}>
          <FilterChip text="All" active={filter === "all"} onPress={() => setFilter("all")} />
          <FilterChip text="Done" active={filter === "done"} onPress={() => setFilter("done")} />
          <FilterChip text="Running" active={filter === "running"} onPress={() => setFilter("running")} />
          <FilterChip text="Queued" active={filter === "queued"} onPress={() => setFilter("queued")} />
          <FilterChip text="Error" active={filter === "error"} onPress={() => setFilter("error")} />
        </View>

        <View style={styles.card}>
          {filteredJobs.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="folder-open-outline" size={18} color={theme.colors.muted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.emptyTitle}>No exports found</Text>
                <Text style={styles.emptyText}>Tap “New export” to generate an Excel file.</Text>
              </View>
            </View>
          ) : (
            filteredJobs.map((j, idx) => {
              const m = statusMeta(j.status);
              const isDownloading = downloadingId === j.id;

              return (
                <View key={j.id}>
                  <Pressable onLongPress={() => copyLink(j)} style={({ pressed }) => [styles.jobRow, pressed && { opacity: 0.93 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.jobTitle} numberOfLines={1}>
                        {j.fileName || "Export.xlsx"}
                      </Text>
                      <Text style={styles.jobMeta} numberOfLines={2}>
                        {j.createdAt ? fmt(j.createdAt) : ""}
                        {typeof j.rows === "number" ? ` • Rows: ${j.rows}` : ""}
                        {j.error ? ` • ${j.error}` : ""}
                      </Text>

                      <View style={styles.rowActions}>
                        {j.status === "done" && !!j.downloadUrl ? (
                          <>
                            <Pressable
                              onPress={() => downloadXlsxToPhone(j)}
                              disabled={isDownloading}
                              style={({ pressed }) => [styles.rowBtn, pressed && { opacity: 0.9 }, isDownloading && { opacity: 0.6 }]}
                            >
                              {isDownloading ? (
                                <ActivityIndicator color={theme.colors.primary} />
                              ) : (
                                <Ionicons name="download-outline" size={14} color={theme.colors.primary} />
                              )}
                              <Text style={styles.rowBtnText}>Download</Text>
                            </Pressable>

                            <Pressable onPress={() => shareLink(j)} style={({ pressed }) => [styles.rowBtn, pressed && { opacity: 0.9 }]}>
                              <Ionicons name="share-social-outline" size={14} color={theme.colors.primary} />
                              <Text style={styles.rowBtnText}>Share link</Text>
                            </Pressable>
                          </>
                        ) : null}

                        {!!j.downloadUrl ? (
                          <Pressable onPress={() => copyLink(j)} style={({ pressed }) => [styles.rowBtnGhost, pressed && { opacity: 0.9 }]}>
                            <Ionicons name="copy-outline" size={14} color={theme.colors.text} />
                            <Text style={styles.rowBtnGhostText}>Copy link</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>

                    <Pill text={m.text} color={m.color} icon={m.icon} />
                  </Pressable>

                  {idx !== filteredJobs.length - 1 ? <View style={styles.divider} /> : null}
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 10 }} />
      </ScrollView>

      {/* Tips window */}
      <Modal visible={tipsOpen} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setTipsOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setTipsOpen(false)}>
          <Pressable style={[styles.sheet, { paddingBottom: 14 + insets.bottom }]} onPress={() => {}}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHead}>
              <View style={styles.sheetIcon}>
                <Ionicons name="bulb-outline" size={18} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>Export tips</Text>
                <Text style={styles.sheetSub}>Quick help for best results.</Text>
              </View>
              <Pressable onPress={() => setTipsOpen(false)} hitSlop={10} style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.85 }]}>
                <Ionicons name="close" size={18} color={theme.colors.text} />
              </Pressable>
            </View>

            <View style={styles.tipBox}>
              <Text style={styles.tipH}>Queued vs Running</Text>
              <Text style={styles.tipP}>
                Queued means your export is waiting. Running means the server is generating your file—wait until DONE to download.
              </Text>
            </View>

            <View style={styles.tipBox}>
              <Text style={styles.tipH}>Download</Text>
              <Text style={styles.tipP}>
                We download the Excel file into app storage, then open the system share sheet to save it to Files/Drive. (Sharing support depends on device.) [web:939]
              </Text>
            </View>

            <View style={styles.tipBox}>
              <Text style={styles.tipH}>Share link carefully</Text>
              <Text style={styles.tipP}>
                Anyone with the link may access the file. Share only with trusted people.
              </Text>
            </View>

            <Pressable onPress={() => setTipsOpen(false)} style={({ pressed }) => [styles.sheetBtn, pressed && { opacity: 0.9 }]}>
              <Text style={styles.sheetBtnText}>Got it</Text>
            </Pressable>
          </Pressable>
        </Pressable>
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

  hero: {
    marginTop: 10,
    borderRadius: 26,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.12 : 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 3,
    overflow: "hidden",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.9,
  },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  heroIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTopText: { fontFamily: theme.font.bold, color: "rgba(255,255,255,0.92)", fontSize: 12 },
  heroFile: { marginTop: 10, fontFamily: theme.font.bold, color: "#fff", fontSize: 15 },
  heroTime: { marginTop: 6, fontFamily: theme.font.medium, color: "rgba(255,255,255,0.82)", fontSize: 12 },

  heroChips: { marginTop: 12, flexDirection: "row", gap: 10, flexWrap: "wrap" },
  heroChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  heroChipText: { fontFamily: theme.font.bold, color: "rgba(255,255,255,0.92)", fontSize: 12 },

  primaryBtn: {
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  primaryBtnText: { fontFamily: theme.font.bold, color: "#fff", fontSize: 12 },

  secondaryBtn: {
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(16,185,129,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  secondaryBtnText: { fontFamily: theme.font.bold, color: "#fff", fontSize: 12 },

  pill: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, borderWidth: 1, maxWidth: 160 },
  pillText: { fontFamily: theme.font.bold, fontSize: 11 },

  liveBanner: {
    marginTop: 10,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(91,95,239,0.08)",
    borderWidth: 1,
    borderColor: "rgba(91,95,239,0.14)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  liveBannerText: { flex: 1, fontFamily: theme.font.medium, color: theme.colors.text, fontSize: 12 },
  liveBtn: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(91,95,239,0.12)",
    borderWidth: 1,
    borderColor: "rgba(91,95,239,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  liveBtnText: { fontFamily: theme.font.bold, color: theme.colors.primary, fontSize: 12 },

  filtersRow: { marginTop: 14, flexDirection: "row", gap: 10, flexWrap: "wrap" },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(17,24,39,0.03)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.08)",
  },
  filterChipActive: { backgroundColor: "rgba(91,95,239,0.12)", borderColor: "rgba(91,95,239,0.22)" },
  filterChipText: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 12 },
  filterChipTextActive: { color: theme.colors.primary },

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

  jobRow: { paddingHorizontal: 14, paddingVertical: 14, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  jobTitle: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 14 },
  jobMeta: { marginTop: 4, fontFamily: theme.font.regular, color: theme.colors.muted, fontSize: 12, lineHeight: 16 },

  rowActions: { marginTop: 10, flexDirection: "row", gap: 10, flexWrap: "wrap" },
  rowBtn: {
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(91,95,239,0.10)",
    borderWidth: 1,
    borderColor: "rgba(91,95,239,0.16)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rowBtnText: { fontFamily: theme.font.bold, color: theme.colors.primary, fontSize: 12 },

  rowBtnGhost: {
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(17,24,39,0.03)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.08)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rowBtnGhostText: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 12 },

  divider: { height: 1, backgroundColor: "rgba(17,24,39,0.06)", marginLeft: 14 },

  empty: { padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  emptyIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "rgba(17,24,39,0.04)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 13 },
  emptyText: { marginTop: 4, fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 12 },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", alignItems: "center", justifyContent: "flex-end", paddingHorizontal: 18, paddingBottom: 14 },
  sheet: { width: "100%", borderRadius: 22, backgroundColor: "rgba(255,255,255,0.98)", borderWidth: 1, borderColor: "rgba(17,24,39,0.10)", padding: 14 },
  sheetHandle: { alignSelf: "center", width: 46, height: 5, borderRadius: 999, backgroundColor: "rgba(148,163,184,0.65)", marginBottom: 10 },
  sheetHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  sheetIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(91,95,239,0.10)",
    borderWidth: 1,
    borderColor: "rgba(91,95,239,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
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
  sheetTitle: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 14 },
  sheetSub: { marginTop: 2, fontFamily: theme.font.regular, fontSize: 12, color: theme.colors.muted },

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
