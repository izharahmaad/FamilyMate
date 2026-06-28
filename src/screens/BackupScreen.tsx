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
  Modal,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { doc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
import * as Clipboard from "expo-clipboard";

import { auth, db } from "../lib/firebase";
import { theme } from "../theme";

type BackupStatus = "idle" | "running" | "success" | "error";
type BackupSchedule = "off" | "daily" | "weekly";
type QuietHours = { enabled: boolean; from: number; to: number };

type BackupState = {
  enabled: boolean;
  status: BackupStatus;
  schedule: BackupSchedule;

  lastBackupAt?: any;
  lastRestoreAt?: any;
  lastError?: string;

  progress?: number;
  lastDevice?: string;
  updatedAt?: any;

  quietHours?: QuietHours;

  request?: {
    op: "backup" | "restore";
    requestedAt: any;
    nonce?: string;
  };
};

const DEFAULTS: BackupState = {
  enabled: true,
  status: "idle",
  schedule: "daily",
  quietHours: { enabled: false, from: 1, to: 6 },
};

function fmt(ts: any): string {
  try {
    if (!ts) return "Never";
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString();
  } catch {
    return "Never";
  }
}

function clamp01to100(n: any) {
  const x = typeof n === "number" ? n : 0;
  return Math.max(0, Math.min(100, Math.round(x)));
}

function statusMeta(s: BackupStatus) {
  if (s === "running") return { text: "Running", icon: "sync-outline" as const, color: "#0EA5E9" };
  if (s === "success") return { text: "Protected", icon: "shield-checkmark-outline" as const, color: "#10B981" };
  if (s === "error") return { text: "Attention", icon: "alert-circle-outline" as const, color: "#EF4444" };
  return { text: "Ready", icon: "pause-circle-outline" as const, color: "#64748B" };
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function hourLabel(h: number) {
  return `${pad2(h)}:00`;
}

function isWithinQuietHours(q: QuietHours | undefined, now = new Date()) {
  if (!q?.enabled) return false;
  const h = now.getHours();
  const from = Math.max(0, Math.min(23, q.from));
  const to = Math.max(0, Math.min(23, q.to));
  if (from === to) return true;
  return from < to ? h >= from && h < to : h >= from || h < to;
}

function Chip({
  icon,
  text,
  tone,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  tone: "neutral" | "primary" | "danger";
  onPress?: () => void;
}) {
  const bg =
    tone === "primary" ? "rgba(91,95,239,0.12)" : tone === "danger" ? "rgba(239,68,68,0.10)" : "rgba(17,24,39,0.04)";
  const bd =
    tone === "primary" ? "rgba(91,95,239,0.22)" : tone === "danger" ? "rgba(239,68,68,0.18)" : "rgba(17,24,39,0.08)";
  const tx = tone === "primary" ? theme.colors.primary : tone === "danger" ? theme.colors.error : theme.colors.text;

  const body = (
    <View style={[styles.chip, { backgroundColor: bg, borderColor: bd }]}>
      <Ionicons name={icon} size={14} color={tx} />
      <Text style={[styles.chipText, { color: tx }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.9 }]}>
      {body}
    </Pressable>
  );
}

function LogoCircle() {
  return (
    <View style={styles.logoOuter}>
      <View style={styles.logoInner}>
        <Ionicons name="shield-checkmark-outline" size={24} color="#fff" />
      </View>
    </View>
  );
}

export default function BackupScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [backup, setBackup] = useState<BackupState>(DEFAULTS);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMode, setConfirmMode] = useState<"backup" | "restore">("backup");

  const uid = auth.currentUser?.uid || null;
  const userRef = useMemo(() => (uid ? doc(db, "users", uid) : null), [uid]);

  useEffect(() => {
    if (!userRef) return;

    const unsub = onSnapshot(
      userRef,
      { includeMetadataChanges: true },
      (snap) => {
        setSyncing(!!snap.metadata?.hasPendingWrites); // pending writes indicator [web:427]

        const d: any = snap.data() || {};
        const b = d?.backup || {};

        const qh = b?.quietHours || {};
        const quietHours: QuietHours = {
          enabled: typeof qh.enabled === "boolean" ? qh.enabled : DEFAULTS.quietHours!.enabled,
          from: typeof qh.from === "number" ? qh.from : DEFAULTS.quietHours!.from,
          to: typeof qh.to === "number" ? qh.to : DEFAULTS.quietHours!.to,
        };

        setBackup({
          enabled: typeof b.enabled === "boolean" ? b.enabled : DEFAULTS.enabled,
          status: (b.status as BackupStatus) || DEFAULTS.status,
          schedule: (b.schedule as BackupSchedule) || DEFAULTS.schedule,
          lastBackupAt: b.lastBackupAt,
          lastRestoreAt: b.lastRestoreAt,
          lastError: b.lastError,
          progress: typeof b.progress === "number" ? b.progress : 0,
          lastDevice: b.lastDevice,
          updatedAt: b.updatedAt,
          request: b.request,
          quietHours,
        });

        setLoading(false);
      },
      (err) => {
        setLoading(false);
        Alert.alert("Backup", err?.message || "Failed to load backup status");
      }
    );

    return () => unsub();
  }, [userRef]);

  const meta = useMemo(() => statusMeta(backup.status), [backup.status]);
  const progress = clamp01to100(backup.progress);
  const quietNow = useMemo(() => isWithinQuietHours(backup.quietHours), [backup.quietHours]);

  const patch = async (payload: Record<string, any>) => {
    if (!userRef) return;
    try {
      setSaving(true);
      await updateDoc(userRef, payload);
    } catch (e: any) {
      Alert.alert("Backup", e?.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async () => {
    await patch({ "backup.enabled": !backup.enabled, "backup.updatedAt": serverTimestamp() });
  };

  const cycleSchedule = async () => {
    const cur = backup.schedule || "daily";
    const next: BackupSchedule = cur === "daily" ? "weekly" : cur === "weekly" ? "off" : "daily";
    await patch({ "backup.schedule": next, "backup.updatedAt": serverTimestamp() });
  };

  const toggleQuiet = async () => {
    const next = { ...(backup.quietHours || DEFAULTS.quietHours!) };
    next.enabled = !next.enabled;
    await patch({ "backup.quietHours": next, "backup.updatedAt": serverTimestamp() });
  };

  const shiftQuietFrom = async (dir: -1 | 1) => {
    const q = backup.quietHours || DEFAULTS.quietHours!;
    const next = { ...q, from: (q.from + dir + 24) % 24 };
    await patch({ "backup.quietHours": next, "backup.updatedAt": serverTimestamp() });
  };

  const shiftQuietTo = async (dir: -1 | 1) => {
    const q = backup.quietHours || DEFAULTS.quietHours!;
    const next = { ...q, to: (q.to + dir + 24) % 24 };
    await patch({ "backup.quietHours": next, "backup.updatedAt": serverTimestamp() });
  };

  const openConfirm = (mode: "backup" | "restore") => {
    if (!backup.enabled) return Alert.alert("Backup", "Turn on backup first.");
    if (backup.status === "running") return;
    if (mode === "backup" && quietNow) {
      return Alert.alert("Quiet hours", "Backup is blocked during quiet hours. Change quiet hours to run now.");
    }
    setConfirmMode(mode);
    setConfirmOpen(true);
  };

  const requestOp = async () => {
    setConfirmOpen(false);
    if (!backup.enabled) return;
    if (!uid) return;

    const nonce = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    await patch({
      "backup.request": { op: confirmMode, requestedAt: serverTimestamp(), nonce },
      "backup.status": "running",
      "backup.progress": 0,
      "backup.lastError": "",
      "backup.updatedAt": serverTimestamp(),
    });
  };

  const exportDiagnostics = async () => {
    const q = backup.quietHours || DEFAULTS.quietHours!;
    const report =
      [
        "Backup diagnostics",
        `User: ${uid ?? "-"}`,
        `Enabled: ${backup.enabled}`,
        `Status: ${backup.status}`,
        `Schedule: ${backup.schedule}`,
        `Progress: ${backup.status === "running" ? `${progress}%` : "-"}`,
        `Last backup: ${fmt(backup.lastBackupAt)}`,
        `Last restore: ${fmt(backup.lastRestoreAt)}`,
        `Quiet hours: ${q.enabled ? `${hourLabel(q.from)} → ${hourLabel(q.to)}` : "Off"}`,
        `Syncing: ${syncing ? "Yes" : "No"}`,
        `Device: ${backup.lastDevice ?? "-"}`,
        `Updated: ${fmt(backup.updatedAt)}`,
        `Error: ${backup.lastError ? backup.lastError.replace(/\s+/g, " ").slice(0, 220) : "-"}`,
      ].join("\n") + "\n";

    await Clipboard.setStringAsync(report);
    Alert.alert("Copied", "Diagnostics copied. Paste it in support chat.");
  };

  const topLine =
    backup.status === "running"
      ? `Running • ${progress}%`
      : backup.status === "success"
      ? "Protected"
      : backup.status === "error"
      ? "Needs attention"
      : "Ready";

  const disableActions = saving || loading || backup.status === "running" || !backup.enabled;

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 10) }]}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* CENTER HEADER (matches your other screens) */}
      <View style={styles.headerBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.9 }]}>
          <Ionicons name="chevron-back" size={18} color={theme.colors.text} />
        </Pressable>

        <View pointerEvents="none" style={styles.centerTitle}>
          <View style={styles.centerTitlePill}>
            <Ionicons name="cloud-done-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.centerTitleText}>Backup</Text>
          </View>
        </View>

        <Pressable onPress={() => setTipsOpen(true)} hitSlop={12} style={({ pressed }) => [styles.rightBtn, pressed && { opacity: 0.9 }]}>
          <Ionicons name="help-circle-outline" size={20} color={theme.colors.primary} />
        </Pressable>

        <Pressable onPress={() => setDetailsOpen(true)} hitSlop={12} style={({ pressed }) => [styles.rightBtn2, pressed && { opacity: 0.9 }]}>
          <Ionicons name="ellipsis-horizontal" size={20} color={theme.colors.muted} />
        </Pressable>

        <View style={styles.rightGhost}>
          {loading || saving ? <ActivityIndicator color={theme.colors.primary} /> : null}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 18 + insets.bottom }}>
        <View style={styles.hero}>
          <View style={styles.heroRow}>
            <LogoCircle />

            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>{backup.enabled ? meta.text : "Disabled"}</Text>
              <Text style={styles.heroSub}>{topLine}</Text>
              {backup.lastDevice ? <Text style={styles.heroMini} numberOfLines={1}>Device: {backup.lastDevice}</Text> : null}
              {backup.quietHours?.enabled ? (
                <Text style={styles.heroMini} numberOfLines={1}>
                  Quiet hours: {hourLabel(backup.quietHours.from)} → {hourLabel(backup.quietHours.to)} {quietNow ? "• Active" : ""}
                </Text>
              ) : null}
            </View>

            <Pressable
              onPress={toggleEnabled}
              disabled={saving}
              style={({ pressed }) => [
                styles.toggle,
                { backgroundColor: backup.enabled ? "rgba(16,185,129,0.14)" : "rgba(148,163,184,0.14)" },
                pressed && { opacity: 0.9 },
              ]}
            >
              <Ionicons name={backup.enabled ? "toggle" : "toggle-outline"} size={34} color={backup.enabled ? "#10B981" : "#64748B"} />
            </Pressable>
          </View>

          <View style={styles.heroChips}>
            <Chip icon={meta.icon} text={`Status: ${meta.text}`} tone="neutral" />
            <Chip icon="calendar-outline" text={`Schedule: ${backup.schedule.toUpperCase()}`} tone="primary" onPress={cycleSchedule} />
            <Chip icon="time-outline" text={`Backup: ${fmt(backup.lastBackupAt)}`} tone="neutral" />
            <Chip icon="refresh-outline" text={`Restore: ${fmt(backup.lastRestoreAt)}`} tone="neutral" />
            {backup.lastError ? <Chip icon="alert-circle-outline" text="Error details" tone="danger" onPress={() => setDetailsOpen(true)} /> : null}
          </View>

          <View style={styles.progressWrap}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${backup.status === "running" ? progress : backup.status === "success" ? 100 : 0}%` }]} />
            </View>
            <Text style={styles.progressText}>{backup.status === "running" ? `${progress}%` : backup.status === "success" ? "100%" : ""}</Text>
          </View>

          {backup.lastError ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
              <Text style={styles.errorText} numberOfLines={2}>
                {backup.lastError}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.actionsCard}>
          <Pressable
            onPress={toggleQuiet}
            disabled={saving || loading}
            style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.92 }, (saving || loading) && { opacity: 0.55 }]}
          >
            <View style={[styles.actionIcon, { backgroundColor: "rgba(100,116,139,0.12)", borderColor: "rgba(100,116,139,0.20)" }]}>
              <Ionicons name="moon-outline" size={18} color="#64748B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Quiet hours</Text>
              <Text style={styles.rowSub}>
                {backup.quietHours?.enabled
                  ? `On • ${hourLabel(backup.quietHours.from)} → ${hourLabel(backup.quietHours.to)}`
                  : "Off • Backups can run anytime"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
          </Pressable>

          {backup.quietHours?.enabled ? (
            <View style={styles.quietPanel}>
              <View style={styles.quietCol}>
                <Text style={styles.quietLabel}>From</Text>
                <View style={styles.quietCtrl}>
                  <Pressable onPress={() => shiftQuietFrom(-1)} style={({ pressed }) => [styles.quietBtn, pressed && { opacity: 0.85 }]}>
                    <Ionicons name="remove" size={18} color={theme.colors.text} />
                  </Pressable>
                  <Text style={styles.quietVal}>{hourLabel(backup.quietHours.from)}</Text>
                  <Pressable onPress={() => shiftQuietFrom(1)} style={({ pressed }) => [styles.quietBtn, pressed && { opacity: 0.85 }]}>
                    <Ionicons name="add" size={18} color={theme.colors.text} />
                  </Pressable>
                </View>
              </View>

              <View style={styles.quietCol}>
                <Text style={styles.quietLabel}>To</Text>
                <View style={styles.quietCtrl}>
                  <Pressable onPress={() => shiftQuietTo(-1)} style={({ pressed }) => [styles.quietBtn, pressed && { opacity: 0.85 }]}>
                    <Ionicons name="remove" size={18} color={theme.colors.text} />
                  </Pressable>
                  <Text style={styles.quietVal}>{hourLabel(backup.quietHours.to)}</Text>
                  <Pressable onPress={() => shiftQuietTo(1)} style={({ pressed }) => [styles.quietBtn, pressed && { opacity: 0.85 }]}>
                    <Ionicons name="add" size={18} color={theme.colors.text} />
                  </Pressable>
                </View>
              </View>
            </View>
          ) : null}

          <View style={styles.divider} />

          <Pressable
            onPress={() => openConfirm("backup")}
            disabled={disableActions}
            style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.92 }, disableActions && { opacity: 0.55 }]}
          >
            <View style={[styles.actionIcon, { backgroundColor: "rgba(14,165,233,0.14)", borderColor: "rgba(14,165,233,0.22)" }]}>
              <Ionicons name="cloud-upload-outline" size={18} color="#0EA5E9" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Backup now</Text>
              <Text style={styles.rowSub}>{quietNow ? "Blocked by quiet hours" : "Save latest data to cloud"}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
          </Pressable>

          <View style={styles.divider} />

          <Pressable
            onPress={() => openConfirm("restore")}
            disabled={disableActions}
            style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.92 }, disableActions && { opacity: 0.55 }]}
          >
            <View style={[styles.actionIcon, { backgroundColor: "rgba(139,92,246,0.14)", borderColor: "rgba(139,92,246,0.22)" }]}>
              <Ionicons name="cloud-download-outline" size={18} color="#8B5CF6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Restore</Text>
              <Text style={styles.rowSub}>Recover from latest backup</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
          </Pressable>

          <View style={styles.divider} />

          <Pressable
            onPress={exportDiagnostics}
            disabled={saving || loading}
            style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.92 }, (saving || loading) && { opacity: 0.55 }]}
          >
            <View style={[styles.actionIcon, { backgroundColor: "rgba(34,197,94,0.12)", borderColor: "rgba(34,197,94,0.20)" }]}>
              <Ionicons name="document-text-outline" size={18} color="#16A34A" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Export diagnostics</Text>
              <Text style={styles.rowSub}>Copy details to share with support</Text>
            </View>
            <Ionicons name="copy-outline" size={18} color={theme.colors.muted} />
          </Pressable>
        </View>
      </ScrollView>

      {/* Tips small window */}
      <Modal visible={tipsOpen} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setTipsOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setTipsOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHeadTips}>
              <View style={styles.sheetIcon}>
                <Ionicons name="bulb-outline" size={18} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>Tips & safety</Text>
                <Text style={styles.sheetSub}>Small notes that prevent mistakes.</Text>
              </View>
              <Pressable onPress={() => setTipsOpen(false)} hitSlop={10} style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.85 }]}>
                <Ionicons name="close" size={20} color={theme.colors.muted} />
              </Pressable>
            </View>

            <View style={styles.tipBox}>
              <Text style={styles.tipH}>Restore overwrites local data</Text>
              <Text style={styles.tipP}>
                Use Restore only when you are sure. If you recently added transactions on this phone, do a Backup first to avoid losing new changes.
              </Text>
            </View>

            <View style={styles.tipBox}>
              <Text style={styles.tipH}>Schedule meaning</Text>
              <Text style={styles.tipP}>
                Daily/Weekly is your preference. Your backend/worker should read it and run backups automatically; this screen only stores your plan.
              </Text>
            </View>

            <View style={styles.tipBox}>
              <Text style={styles.tipH}>What “Syncing…” means</Text>
              <Text style={styles.tipP}>
                Firestore listeners can show local changes immediately (latency compensation). While pending writes exist, metadata can report it. [web:427]
              </Text>
            </View>

            <Pressable onPress={() => setTipsOpen(false)} style={({ pressed }) => [styles.sheetBtn, pressed && { opacity: 0.9 }]}>
              <Text style={styles.sheetBtnText}>Got it</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Details window */}
      <Modal visible={detailsOpen} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setDetailsOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setDetailsOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHeadPlain}>
              <Text style={styles.sheetTitlePlain}>Backup details</Text>
              <Pressable onPress={() => setDetailsOpen(false)} hitSlop={10} style={({ pressed }) => [pressed && { opacity: 0.8 }]}>
                <Ionicons name="close" size={20} color={theme.colors.muted} />
              </Pressable>
            </View>

            <View style={styles.sheetRow}>
              <Ionicons name={meta.icon} size={16} color={meta.color} />
              <Text style={styles.sheetKey}>Status</Text>
              <Text style={styles.sheetVal}>{meta.text}</Text>
            </View>

            <View style={styles.sheetRow}>
              <Ionicons name="stats-chart-outline" size={16} color={theme.colors.muted} />
              <Text style={styles.sheetKey}>Progress</Text>
              <Text style={styles.sheetVal}>{backup.status === "running" ? `${progress}%` : "-"}</Text>
            </View>

            <View style={styles.sheetRow}>
              <Ionicons name="calendar-outline" size={16} color={theme.colors.muted} />
              <Text style={styles.sheetKey}>Schedule</Text>
              <Text style={styles.sheetVal}>{backup.schedule.toUpperCase()}</Text>
            </View>

            <View style={styles.sheetRow}>
              <Ionicons name="time-outline" size={16} color={theme.colors.muted} />
              <Text style={styles.sheetKey}>Last backup</Text>
              <Text style={styles.sheetVal}>{fmt(backup.lastBackupAt)}</Text>
            </View>

            <View style={styles.sheetRow}>
              <Ionicons name="refresh-outline" size={16} color={theme.colors.muted} />
              <Text style={styles.sheetKey}>Last restore</Text>
              <Text style={styles.sheetVal}>{fmt(backup.lastRestoreAt)}</Text>
            </View>

            {backup.updatedAt ? (
              <View style={styles.sheetRow}>
                <Ionicons name="sparkles-outline" size={16} color={theme.colors.muted} />
                <Text style={styles.sheetKey}>Updated</Text>
                <Text style={styles.sheetVal}>{fmt(backup.updatedAt)}</Text>
              </View>
            ) : null}

            {backup.lastDevice ? (
              <View style={styles.sheetRow}>
                <Ionicons name="phone-portrait-outline" size={16} color={theme.colors.muted} />
                <Text style={styles.sheetKey}>Device</Text>
                <Text style={styles.sheetVal} numberOfLines={1}>
                  {backup.lastDevice}
                </Text>
              </View>
            ) : null}

            {backup.lastError ? (
              <View style={styles.sheetError}>
                <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
                <Text style={styles.sheetErrorText} numberOfLines={3}>
                  {backup.lastError}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Confirm */}
      <Modal visible={confirmOpen} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setConfirmOpen(false)}>
        <Pressable style={styles.modalBackdropCenter} onPress={() => setConfirmOpen(false)}>
          <Pressable style={styles.confirmCard} onPress={() => {}}>
            <View style={styles.confirmTop}>
              <View style={styles.confirmIcon}>
                <Ionicons name={confirmMode === "backup" ? "cloud-upload-outline" : "cloud-download-outline"} size={18} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.confirmTitle}>{confirmMode === "backup" ? "Start backup now?" : "Start restore now?"}</Text>
                <Text style={styles.confirmSub}>This runs in background.</Text>
              </View>
            </View>

            <View style={styles.confirmBtns}>
              <Pressable onPress={() => setConfirmOpen(false)} style={({ pressed }) => [styles.btnGhost, pressed && { opacity: 0.85 }]}>
                <Text style={styles.btnGhostText}>Cancel</Text>
              </Pressable>

              <Pressable onPress={requestOp} style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.9 }]}>
                <Text style={styles.btnPrimaryText}>Confirm</Text>
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

  /* Center header */
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
    right: 96,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  rightBtn2: {
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
    borderRadius: 28,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.97)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.06)",
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.06 : 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  heroTitle: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 16 },
  heroSub: { marginTop: 4, fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 12 },
  heroMini: { marginTop: 6, fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 12 },

  logoOuter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(91,95,239,0.10)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(91,95,239,0.22)",
  },
  logoInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  toggle: {
    width: 64,
    height: 48,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.06)",
  },

  heroChips: { marginTop: 12, flexDirection: "row", gap: 10, flexWrap: "wrap" },
  chip: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  chipText: { fontFamily: theme.font.bold, fontSize: 12 },

  progressWrap: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  progressTrack: { flex: 1, height: 10, borderRadius: 999, backgroundColor: "rgba(17,24,39,0.06)", overflow: "hidden" },
  progressFill: { height: 10, borderRadius: 999, backgroundColor: theme.colors.primary },
  progressText: { width: 44, textAlign: "right", fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 12 },

  errorBox: {
    marginTop: 12,
    borderRadius: 16,
    padding: 10,
    backgroundColor: "rgba(239,68,68,0.10)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.18)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  errorText: { flex: 1, fontFamily: theme.font.medium, color: theme.colors.error, fontSize: 12 },

  actionsCard: {
    marginTop: 12,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.97)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.06)",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.06 : 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  actionIcon: { width: 44, height: 44, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  rowTitle: { fontFamily: theme.font.bold, fontSize: 14, color: theme.colors.text },
  rowSub: { marginTop: 3, fontFamily: theme.font.regular, fontSize: 12, color: theme.colors.muted },
  divider: { height: 1, backgroundColor: "rgba(17,24,39,0.06)", marginLeft: 70 },

  quietPanel: { paddingHorizontal: 14, paddingBottom: 14, flexDirection: "row", gap: 12 },
  quietCol: { flex: 1 },
  quietLabel: { fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 12, marginBottom: 8 },
  quietCtrl: {
    height: 46,
    borderRadius: 16,
    backgroundColor: "rgba(17,24,39,0.04)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.08)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
  },
  quietBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.85)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.08)",
  },
  quietVal: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 13 },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", alignItems: "center", justifyContent: "flex-end", paddingHorizontal: 18, paddingBottom: 14 },
  modalBackdropCenter: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },

  sheet: { width: "100%", borderRadius: 22, backgroundColor: "rgba(255,255,255,0.98)", borderWidth: 1, borderColor: "rgba(17,24,39,0.10)", padding: 14 },
  sheetHeadTips: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  sheetHeadPlain: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
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
  sheetTitle: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 16 },
  sheetSub: { marginTop: 2, fontFamily: theme.font.regular, fontSize: 12, color: theme.colors.muted },
  sheetTitlePlain: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 16 },

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

  sheetRow: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  sheetKey: { width: 92, fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 12 },
  sheetVal: { flex: 1, fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 12 },

  sheetError: {
    marginTop: 12,
    borderRadius: 16,
    padding: 10,
    backgroundColor: "rgba(239,68,68,0.10)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.18)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sheetErrorText: { flex: 1, fontFamily: theme.font.medium, color: theme.colors.error, fontSize: 12 },

  confirmCard: { width: "100%", maxWidth: 520, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.98)", borderWidth: 1, borderColor: "rgba(17,24,39,0.10)", padding: 14 },
  confirmTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  confirmIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(91,95,239,0.10)", alignItems: "center", justifyContent: "center" },
  confirmTitle: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 16 },
  confirmSub: { marginTop: 2, fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 12 },

  confirmBtns: { marginTop: 12, flexDirection: "row", gap: 10 },
  btnGhost: { flex: 1, height: 46, borderRadius: 16, backgroundColor: "rgba(17,24,39,0.03)", borderWidth: 1, borderColor: "rgba(17,24,39,0.08)", alignItems: "center", justifyContent: "center" },
  btnGhostText: { fontFamily: theme.font.bold, color: theme.colors.text },
  btnPrimary: { flex: 1, height: 46, borderRadius: 16, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center" },
  btnPrimaryText: { fontFamily: theme.font.bold, color: "#fff" },
});
