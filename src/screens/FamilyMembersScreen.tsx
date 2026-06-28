// src/screens/FamilyMembersScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
  Alert,
  FlatList,
  Share,
  TextInput,
  Modal,
  StatusBar,
  ToastAndroid,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";

import { getAuth, signOut } from "firebase/auth";
import {
  doc,
  onSnapshot,
  collection,
  query,
  orderBy,
  updateDoc,
  serverTimestamp,
  deleteDoc,
} from "firebase/firestore";

import { db } from "../lib/firebase";
import { theme } from "../theme";

type MemberRole = "admin" | "member";

type MemberRow = {
  id: string;
  uid: string;
  role: MemberRole;
  name?: string;
  email?: string;
  joinedAt?: any;
};

const ORANGE = "#F59E0B";
const GREEN = "#10B981";

function initialLetter(m: MemberRow) {
  return (m.name?.trim()?.[0] || m.email?.trim()?.[0] || "U").toUpperCase();
}

function roleLabel(r: MemberRole) {
  return r === "admin" ? "PARENT" : "MEMBER";
}

function roleColors(r: MemberRole) {
  if (r === "admin") {
    return {
      ring: "rgba(91,95,239,0.20)",
      bg: "rgba(91,95,239,0.10)",
      text: theme.colors.primary,
      icon: "shield-checkmark-outline" as const,
    };
  }
  return {
    ring: "rgba(107,114,128,0.18)",
    bg: "rgba(107,114,128,0.08)",
    text: theme.colors.muted,
    icon: "person-outline" as const,
  };
}

function sanitizeName(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function IconTopButton({
  icon,
  onPress,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  color: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => [styles.iconTopBtn, pressed && { opacity: 0.7 }]}
    >
      <Ionicons name={icon} size={22} color={color} />
    </Pressable>
  );
}

function Chip({
  label,
  active,
  onPress,
  icon,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        active ? styles.filterChipActive : null,
        pressed && { opacity: 0.88 },
      ]}
    >
      <Ionicons
        name={icon}
        size={14}
        color={active ? theme.colors.primary : theme.colors.muted}
      />
      <Text style={[styles.filterChipText, active && { color: theme.colors.primary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function FamilyMembersScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const auth = getAuth();

  const [loading, setLoading] = useState(true);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string>("");
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [search, setSearch] = useState("");

  const [filter, setFilter] = useState<"all" | "admin" | "member">("all");

  const [removedOpen, setRemovedOpen] = useState(false);
  const [removedMsg, setRemovedMsg] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MemberRow | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  const [manageOpen, setManageOpen] = useState(false);
  const [manageTarget, setManageTarget] = useState<MemberRow | null>(null);
  const [managing, setManaging] = useState(false);

  const myUid = auth.currentUser?.uid ?? "";

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const unsub = onSnapshot(
      doc(db, "users", uid),
      (snap) => {
        const data = snap.data() as any;
        setFamilyId(data?.familyId ?? null);
      },
      (err) => Alert.alert("Error", err.message)
    );

    return unsub;
  }, []);

  useEffect(() => {
    if (!familyId || !myUid) return;

    const unsub = onSnapshot(
      doc(db, "families", familyId, "members", myUid),
      async (snap) => {
        if (!snap.exists()) {
          const msg = "You were removed from the family. Logging out…";
          setRemovedMsg(msg);
          setRemovedOpen(true);

          if (Platform.OS === "android") {
            ToastAndroid.show(msg, ToastAndroid.SHORT);
          }

          setTimeout(async () => {
            try {
              await signOut(auth);
            } catch {}
            setRemovedOpen(false);
          }, 2200);
        }
      },
      () => {}
    );

    return unsub;
  }, [familyId, myUid]);

  useEffect(() => {
    if (!familyId) return;

    const unsub = onSnapshot(
      doc(db, "families", familyId),
      (snap) => {
        const data = snap.data() as any;
        setInviteCode((data?.inviteCode ?? "").toString());
      },
      (err) => Alert.alert("Error", err.message)
    );

    return unsub;
  }, [familyId]);

  useEffect(() => {
    if (!familyId) return;

    setLoading(true);
    const q = query(collection(db, "families", familyId, "members"), orderBy("joinedAt", "asc"));

    const unsub = onSnapshot(
      q,
      (qs) => {
        const rows: MemberRow[] = qs.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            uid: (data.uid ?? d.id) as string,
            role: ((data.role ?? "member") as string) === "admin" ? "admin" : "member",
            name: data.name ?? "",
            email: data.email ?? "",
            joinedAt: data.joinedAt,
          };
        });
        setMembers(rows);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        Alert.alert("Error", err.message);
      }
    );

    return unsub;
  }, [familyId]);

  const { adminRows, memberRows, me } = useMemo(() => {
    const meRow = members.find((m) => m.uid === myUid) ?? null;
    return {
      me: meRow,
      adminRows: members.filter((m) => m.role === "admin"),
      memberRows: members.filter((m) => m.role !== "admin"),
    };
  }, [members, myUid]);

  const canManage = me?.role === "admin";

  const filteredAdmins = useMemo(() => {
    const s = search.trim().toLowerCase();
    let base = adminRows;
    if (filter === "member") base = [];
    if (!s) return base;
    return base.filter((m) => (m.name || m.email || m.uid).toLowerCase().includes(s));
  }, [adminRows, search, filter]);

  const filteredMembers = useMemo(() => {
    const s = search.trim().toLowerCase();
    let base = memberRows;
    if (filter === "admin") base = [];
    if (!s) return base;
    return base.filter((m) => (m.name || m.email || m.uid).toLowerCase().includes(s));
  }, [memberRows, search, filter]);

  const copyInvite = async () => {
    if (!inviteCode) return Alert.alert("Invite code", "Invite code not found yet.");
    await Clipboard.setStringAsync(inviteCode);
    if (Platform.OS === "android") ToastAndroid.show("Invite code copied", ToastAndroid.SHORT);
    else Alert.alert("Copied", "Invite code copied.");
  };

  const shareInvite = async () => {
    if (!inviteCode) return Alert.alert("Invite code", "Invite code not found yet.");
    try {
      await Share.share({ message: `Join my family on FamilyMate.\nInvite code: ${inviteCode}` });
    } catch {}
  };

  const copyText = async (t: string) => {
    await Clipboard.setStringAsync(t);
    Alert.alert("Copied", "Copied to clipboard.");
  };

  const openEdit = (m: MemberRow) => {
    if (!canManage) return Alert.alert("Not allowed", "Only parents can change names.");
    setEditTarget(m);
    setEditName(m.name || "");
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!familyId || !editTarget) return;

    const name = sanitizeName(editName);
    if (!name) return Alert.alert("Name", "Please enter a name.");

    try {
      setSaving(true);
      await updateDoc(doc(db, "families", familyId, "members", editTarget.uid), {
        name,
        nameUpdatedAt: serverTimestamp(),
      });
      setEditOpen(false);
      setEditTarget(null);
      setEditName("");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not update name (check rules).");
    } finally {
      setSaving(false);
    }
  };

  const openManage = (m: MemberRow) => {
    if (!canManage) return;
    if (m.uid === myUid) {
      Alert.alert("Admin account", "You can't manage yourself here.");
      return;
    }
    setManageTarget(m);
    setManageOpen(true);
  };

  const toggleRole = (m: MemberRow) => {
    if (!familyId) return;
    if (!canManage) return Alert.alert("Not allowed", "Only parents can change roles.");
    if (m.uid === myUid) return Alert.alert("Not allowed", "You cannot change your own role.");

    const next: MemberRole = m.role === "admin" ? "member" : "admin";

    Alert.alert(
      next === "admin" ? "Promote to parent" : "Demote to member",
      `Set role to "${next}" for ${m.name || m.email || "this user"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              setManaging(true);
              await updateDoc(doc(db, "families", familyId, "members", m.uid), {
                role: next,
                roleUpdatedAt: serverTimestamp(),
              });
              setManageOpen(false);
              setManageTarget(null);
            } catch (e: any) {
              Alert.alert("Error", e?.message || "Role update failed (check rules).");
            } finally {
              setManaging(false);
            }
          },
        },
      ]
    );
  };

  const removeMember = (m: MemberRow) => {
    if (!familyId) return;
    if (!canManage) return Alert.alert("Not allowed", "Only parents can remove members.");
    if (m.uid === myUid) return Alert.alert("Not allowed", "You cannot remove yourself.");

    Alert.alert("Remove member", `Remove ${m.name || m.email || "this member"} from family?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            setManaging(true);
            await deleteDoc(doc(db, "families", familyId, "members", m.uid));
            setManageOpen(false);
            setManageTarget(null);
          } catch (e: any) {
            Alert.alert("Error", e?.message || "Could not remove member (check rules).");
          } finally {
            setManaging(false);
          }
        },
      },
    ]);
  };

  const refreshMembers = () => {
    Alert.alert("Live list", "Members list is live and updates automatically.");
  };

  if (!auth.currentUser) {
    return (
      <View style={[styles.root, { paddingTop: Math.max(insets.top, 10), justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: theme.colors.muted }}>Please login again.</Text>
      </View>
    );
  }

  if (!familyId) {
    return (
      <View style={[styles.root, { paddingTop: Math.max(insets.top, 10) }]}>
        <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
        <View style={styles.emptyState}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.emptyTitle}>No family connected</Text>
          <Text style={styles.emptySub}>Create a family or join using an invite code.</Text>
        </View>
      </View>
    );
  }

  const listData: Array<MemberRow | { id: "__divider__" }> = [
    ...filteredAdmins,
    ...(filteredMembers.length > 0 ? [{ id: "__divider__" as const }] : []),
    ...filteredMembers,
  ];

  const ListHeader = (
    <>
      <View style={styles.headerBar}>
        <Pressable
          onPress={() => navigation?.goBack?.()}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.9 }]}
        >
          <Ionicons name="chevron-back" size={18} color={theme.colors.text} />
        </Pressable>

        <View pointerEvents="none" style={styles.centerTitle}>
          <View style={styles.centerTitlePill}>
            <Ionicons name="people-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.centerTitleText}>Family members</Text>
          </View>
        </View>

        <View style={styles.rightIcons}>
          <IconTopButton icon="refresh-outline" onPress={refreshMembers} color={theme.colors.muted} />
          <IconTopButton
            icon="information-circle-outline"
            onPress={() => Alert.alert("Tip", "Admins can edit names, promote/demote, and remove members.")}
            color={theme.colors.muted}
          />
        </View>
      </View>

      <LinearGradient
        colors={["#2559c2", "#0a0a2e", "#112B5C"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.inviteCard}
      >
        <View style={styles.inviteHeaderRow}>
          <Pressable onPress={copyInvite} style={{ flex: 1 }}>
            <Text style={styles.inviteLabel}>INVITE CODE</Text>
            <Text style={styles.inviteCode}>{inviteCode || "—"}</Text>
            <Text style={styles.inviteSub}>Tap code to copy • Share with family</Text>
          </Pressable>

          <View style={styles.inviteIcon}>
            <Ionicons name="ticket-outline" size={22} color="#fff" />
          </View>
        </View>

        <View style={styles.inviteActions}>
          <Pressable onPress={copyInvite} style={({ pressed }) => [styles.inviteBtn, { opacity: pressed ? 0.9 : 1 }]}>
            <Ionicons name="copy-outline" size={16} color="#fff" />
            <Text style={styles.inviteBtnText}>Copy</Text>
          </Pressable>

          <Pressable onPress={shareInvite} style={({ pressed }) => [styles.inviteBtn, { opacity: pressed ? 0.9 : 1 }]}>
            <Ionicons name="share-social-outline" size={16} color="#fff" />
            <Text style={styles.inviteBtnText}>Share</Text>
          </Pressable>
        </View>
      </LinearGradient>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={theme.colors.muted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search members…"
          placeholderTextColor={theme.colors.muted}
          style={styles.searchInput}
          autoCapitalize="none"
        />
        {!!search && (
          <Pressable onPress={() => setSearch("")} hitSlop={10} style={styles.clearBtn}>
            <Ionicons name="close" size={16} color={theme.colors.muted} />
          </Pressable>
        )}
      </View>

      <View style={styles.filterRow}>
        <Chip label="All" icon="grid-outline" active={filter === "all"} onPress={() => setFilter("all")} />
        <Chip label={`Parents (${adminRows.length})`} icon="shield-checkmark-outline" active={filter === "admin"} onPress={() => setFilter("admin")} />
        <Chip label={`Members (${memberRows.length})`} icon="people-outline" active={filter === "member"} onPress={() => setFilter("member")} />
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statChip}>
          <Ionicons name="shield-checkmark-outline" size={14} color={theme.colors.primary} />
          <Text style={styles.statText}>{adminRows.length} Parents</Text>
        </View>
        <View style={styles.statChip}>
          <Ionicons name="people-outline" size={14} color={ORANGE} />
          <Text style={styles.statText}>{memberRows.length} Members</Text>
        </View>
        <View style={styles.statChip}>
          <Ionicons name="person-circle-outline" size={14} color={GREEN} />
          <Text style={styles.statText}>{members.length} Total</Text>
        </View>
      </View>

      <Text style={styles.section}>Parents / Admin</Text>
    </>
  );

  const renderMember = ({ item }: { item: MemberRow }) => {
    const isMe = item.uid === myUid;
    const rc = roleColors(item.role);

    return (
      <View style={styles.cardRow}>
        <View style={[styles.avatar, { backgroundColor: "rgba(255,255,255,0.97)", borderColor: rc.ring }]}>
          <Text style={[styles.avatarText, { color: rc.text }]}>{initialLetter(item)}</Text>
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {item.name || "No name"} {isMe ? "(You)" : ""}
            </Text>

            <View style={[styles.badge, { backgroundColor: rc.bg, borderColor: rc.ring }]}>
              <Ionicons name={rc.icon} size={12} color={rc.text} />
              <Text style={[styles.badgeText, { color: rc.text }]}>{roleLabel(item.role)}</Text>
            </View>
          </View>

          <Text style={styles.email} numberOfLines={1}>
            {item.email || item.uid}
          </Text>

          <View style={styles.rowActions}>
            <Pressable onPress={() => copyText(item.email || item.uid)} style={styles.smallActionBtn}>
              <Ionicons name="copy-outline" size={14} color={theme.colors.text} />
              <Text style={styles.smallActionText}>Copy</Text>
            </Pressable>

            {canManage ? (
              <Pressable onPress={() => openEdit(item)} style={styles.smallActionBtn}>
                <Ionicons name="create-outline" size={14} color={theme.colors.primary} />
                <Text style={[styles.smallActionText, { color: theme.colors.primary }]}>Edit name</Text>
              </Pressable>
            ) : null}

            {canManage && !isMe ? (
              <Pressable onPress={() => openManage(item)} style={styles.smallActionBtn}>
                <Ionicons name="settings-outline" size={14} color={theme.colors.muted} />
                <Text style={styles.smallActionText}>Manage</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 10) }]}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <Modal visible={removedOpen} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.removedOverlay}>
          <View style={styles.removedCard}>
            <View style={styles.removedRow}>
              <View style={styles.removedIcon}>
                <Ionicons name="alert-circle-outline" size={18} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.removedTitle}>Removed</Text>
                <Text style={styles.removedText}>{removedMsg}</Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={editOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          if (!saving) setEditOpen(false);
        }}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => (!saving ? setEditOpen(false) : null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalTop}>
              <View style={styles.modalIcon}>
                <Ionicons name="create-outline" size={18} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Edit member name</Text>
                <Text style={styles.modalSub} numberOfLines={1}>
                  {editTarget?.email || editTarget?.uid || ""}
                </Text>
              </View>
            </View>

            <View style={styles.modalInputWrap}>
              <Ionicons name="person-outline" size={18} color={theme.colors.muted} />
              <TextInput
                value={editName}
                onChangeText={setEditName}
                placeholder="Enter name"
                placeholderTextColor={theme.colors.muted}
                style={styles.modalInput}
                editable={!saving}
              />
            </View>

            <View style={styles.modalBtns}>
              <Pressable
                onPress={() => setEditOpen(false)}
                disabled={saving}
                style={({ pressed }) => [styles.modalBtnGhost, { opacity: pressed ? 0.75 : 1 }]}
              >
                <Text style={styles.modalBtnGhostText}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={saveEdit}
                disabled={saving}
                style={({ pressed }) => [styles.modalBtnPrimary, { opacity: pressed ? 0.85 : 1 }]}
              >
                <Ionicons name={saving ? "hourglass-outline" : "checkmark-outline"} size={18} color="#fff" />
                <Text style={styles.modalBtnPrimaryText}>{saving ? "Saving…" : "Save"}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={manageOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          if (!managing) setManageOpen(false);
        }}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => (!managing ? setManageOpen(false) : null)}>
          <Pressable style={styles.manageCard} onPress={() => {}}>
            <View style={styles.manageTop}>
              <Text style={styles.manageTitle}>Manage member</Text>
              <Pressable onPress={() => setManageOpen(false)} hitSlop={10} disabled={managing} style={{ padding: 8 }}>
                <Ionicons name="close" size={18} color={theme.colors.muted} />
              </Pressable>
            </View>

            <Text style={styles.manageSub} numberOfLines={1}>
              {manageTarget?.name || manageTarget?.email || manageTarget?.uid || ""}
            </Text>

            <Pressable
              disabled={managing}
              onPress={() => (manageTarget ? openEdit(manageTarget) : null)}
              style={({ pressed }) => [styles.manageBtn, pressed && { opacity: 0.9 }]}
            >
              <Ionicons name="create-outline" size={18} color={theme.colors.text} />
              <Text style={styles.manageBtnText}>Edit name</Text>
            </Pressable>

            <Pressable
              disabled={managing}
              onPress={() => (manageTarget ? toggleRole(manageTarget) : null)}
              style={({ pressed }) => [styles.manageBtn, pressed && { opacity: 0.9 }, { borderColor: "rgba(91,95,239,0.22)" }]}
            >
              <Ionicons name="arrow-up-circle-outline" size={18} color={theme.colors.primary} />
              <Text style={[styles.manageBtnText, { color: theme.colors.primary }]}>
                {manageTarget?.role === "admin" ? "Demote to member" : "Promote to parent"}
              </Text>
            </Pressable>

            <Pressable
              disabled={managing}
              onPress={() => (manageTarget ? removeMember(manageTarget) : null)}
              style={({ pressed }) => [styles.manageBtnDanger, pressed && { opacity: 0.9 }]}
            >
              <Ionicons name="trash-outline" size={18} color="#fff" />
              <Text style={styles.manageBtnDangerText}>{managing ? "Please wait…" : "Remove from family"}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading members…</Text>
        </View>
      ) : (
        <FlatList
          data={listData as any}
          keyExtractor={(i: any) => i.id}
          renderItem={({ item }: any) => {
            if (item.id === "__divider__") {
              return (
                <View style={styles.sectionRow}>
                  <Text style={styles.section}>Family members</Text>
                  <Text style={styles.pill}>{filteredMembers.length} Active</Text>
                </View>
              );
            }
            return renderMember({ item });
          }}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={{ paddingBottom: 30 }}
          showsVerticalScrollIndicator={false}
        />
      )}
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
  rightIcons: { position: "absolute", right: 0, flexDirection: "row", alignItems: "center", gap: 6 },
  iconTopBtn: { padding: 6 },

  inviteCard: { marginTop: 14, borderRadius: theme.radius.xl, padding: 16 },
  inviteHeaderRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  inviteIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(14, 18, 51, 0.83)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  inviteLabel: { fontFamily: theme.font.medium, color: "rgba(255,255,255,0.85)", letterSpacing: 1 },
  inviteCode: { marginTop: 8, fontFamily: theme.font.bold, fontSize: 34, color: "#fff", letterSpacing: 2 },
  inviteSub: { marginTop: 6, fontFamily: theme.font.regular, color: "rgba(255,255,255,0.9)" },

  inviteActions: { marginTop: 12, flexDirection: "row", gap: 10 },
  inviteBtn: {
    flex: 1,
    height: 46,
    borderRadius: theme.radius.lg,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  inviteBtnText: { fontFamily: theme.font.bold, color: "#fff" },

  searchWrap: {
    marginTop: 12,
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.06)",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInput: { flex: 1, fontFamily: theme.font.medium, color: theme.colors.text },
  clearBtn: { padding: 6, borderRadius: 10 },

  filterRow: { marginTop: 10, flexDirection: "row", gap: 10, flexWrap: "wrap" },
  filterChip: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(17,24,39,0.03)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.08)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  filterChipActive: { backgroundColor: "rgba(91,95,239,0.10)", borderColor: "rgba(91,95,239,0.18)" },
  filterChipText: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 12 },

  statsRow: { marginTop: 10, flexDirection: "row", gap: 10 },
  statChip: {
    flex: 1,
    height: 40,
    borderRadius: 999,
    backgroundColor: "rgba(17,24,39,0.03)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.08)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  statText: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 12 },

  section: { marginTop: 16, marginBottom: 10, fontFamily: theme.font.medium, fontSize: 13, color: theme.colors.muted, letterSpacing: 0.3 },
  sectionRow: { marginTop: 16, marginBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(59,130,246,0.10)",
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.18)",
    fontFamily: theme.font.medium,
    color: theme.colors.info,
    fontSize: 12,
  },

  cardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: 12,
    marginBottom: 10,
  },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", marginRight: 12, borderWidth: 1 },
  avatarText: { fontFamily: theme.font.bold, fontSize: 16 },

  nameRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  name: { flex: 1, fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 15 },
  email: { marginTop: 3, fontFamily: theme.font.regular, color: theme.colors.muted, fontSize: 13 },

  badge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  badgeText: { fontFamily: theme.font.bold, fontSize: 11, letterSpacing: 0.4 },

  rowActions: { marginTop: 10, flexDirection: "row", gap: 10, flexWrap: "wrap" },
  smallActionBtn: {
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.06)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  smallActionText: { fontFamily: theme.font.bold, fontSize: 12, color: theme.colors.text },

  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 10, color: theme.colors.muted, fontFamily: theme.font.medium },

  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  emptyTitle: { marginTop: 10, fontFamily: theme.font.bold, fontSize: 18, color: theme.colors.text },
  emptySub: { marginTop: 6, fontFamily: theme.font.regular, color: theme.colors.muted, textAlign: "center" },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },

  modalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.97)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.10)",
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.08 : 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },

  manageCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.97)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.10)",
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.08 : 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  manageTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  manageTitle: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 16 },
  manageSub: { marginTop: 6, fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 12 },

  manageBtn: {
    height: 46,
    borderRadius: 16,
    backgroundColor: "rgba(17,24,39,0.03)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.08)",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
  },
  manageBtnText: { fontFamily: theme.font.bold, color: theme.colors.text },

  manageBtnDanger: {
    marginTop: 12,
    height: 46,
    borderRadius: 16,
    backgroundColor: theme.colors.error,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  manageBtnDangerText: { fontFamily: theme.font.bold, color: "#fff" },

  modalTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  modalIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(91,95,239,0.10)", alignItems: "center", justifyContent: "center" },
  modalTitle: { fontFamily: theme.font.bold, color: theme.colors.text, fontSize: 16 },
  modalSub: { marginTop: 2, fontFamily: theme.font.medium, color: theme.colors.muted, fontSize: 12 },

  modalInputWrap: {
    marginTop: 12,
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(17,24,39,0.03)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.08)",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  modalInput: { flex: 1, fontFamily: theme.font.bold, color: theme.colors.text },

  modalBtns: { marginTop: 12, flexDirection: "row", gap: 10 },
  modalBtnGhost: {
    flex: 1,
    height: 46,
    borderRadius: 16,
    backgroundColor: "rgba(17,24,39,0.03)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnGhostText: { fontFamily: theme.font.bold, color: theme.colors.text },

  modalBtnPrimary: {
    flex: 1,
    height: 46,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  modalBtnPrimaryText: { fontFamily: theme.font.bold, color: "#fff" },

  removedOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.15)", justifyContent: "flex-end", paddingHorizontal: 16, paddingBottom: 26 },
  removedCard: { borderRadius: 18, backgroundColor: "rgba(15,23,42,0.95)", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", padding: 14 },
  removedRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  removedIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: "rgba(239,68,68,0.90)", alignItems: "center", justifyContent: "center" },
  removedTitle: { fontFamily: theme.font.bold, color: "#fff", fontSize: 14 },
  removedText: { marginTop: 2, fontFamily: theme.font.medium, color: "rgba(255,255,255,0.88)", fontSize: 12 },
});
