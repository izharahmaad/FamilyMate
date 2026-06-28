// src/lib/accountStore.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { collection, doc, getDocs, orderBy, query, serverTimestamp, setDoc, deleteDoc, Timestamp } from "firebase/firestore";
import { auth, db } from "./firebase"; // adjust path if yours is ../lib/firebase

export type SavedAccount = {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  provider: "email" | "google";
  lastUsedAt: number; // local epoch ms for sorting UI
};

const KEY = "SAVED_ACCOUNTS_V1";

function normalizeEmail(v?: string) {
  return (v || "").trim().toLowerCase();
}

async function readLocal(): Promise<SavedAccount[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedAccount[]) : [];
  } catch {
    return [];
  }
}

async function writeLocal(list: SavedAccount[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

function upsertLocal(list: SavedAccount[], a: SavedAccount) {
  const email = normalizeEmail(a.email);
  const next = { ...a, email };
  const idx = list.findIndex((x) => x.uid === next.uid || normalizeEmail(x.email) === email);
  if (idx >= 0) {
    const merged = { ...list[idx], ...next };
    const out = [...list];
    out[idx] = merged;
    return out;
  }
  return [next, ...list];
}

function sortByLastUsed(list: SavedAccount[]) {
  return [...list].sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0));
}

async function syncUpsertToFirestore(a: SavedAccount) {
  const owner = auth.currentUser;
  if (!owner?.uid) return; // if not signed in, skip cloud sync

  const ref = doc(db, "users", owner.uid, "manageAccounts", a.uid);

  await setDoc(
    ref,
    {
      uid: a.uid,
      email: a.email,
      displayName: a.displayName || "",
      photoURL: a.photoURL || "",
      provider: a.provider,
      lastUsedAt: serverTimestamp(), // ✅ timestamp for your rules [web:1469]
    },
    { merge: true }
  );
}

async function syncRemoveFromFirestore(accountUid: string) {
  const owner = auth.currentUser;
  if (!owner?.uid) return;
  const ref = doc(db, "users", owner.uid, "manageAccounts", accountUid);
  await deleteDoc(ref);
}

export async function upsertSavedAccount(input: {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  provider?: "email" | "google";
  lastUsedAt?: number; // optional; if not given we'll set Date.now()
}) {
  const a: SavedAccount = {
    uid: input.uid,
    email: normalizeEmail(input.email),
    displayName: input.displayName || "",
    photoURL: input.photoURL || "",
    provider: input.provider || "email",
    lastUsedAt: input.lastUsedAt ?? Date.now(),
  };

  // local
  const local = await readLocal();
  const next = sortByLastUsed(upsertLocal(local, a));
  await writeLocal(next);

  // cloud (best-effort)
  await syncUpsertToFirestore(a);

  return next;
}

export async function getSavedAccounts(): Promise<SavedAccount[]> {
  // 1) local
  const local = sortByLastUsed(await readLocal());

  // 2) cloud merge (best-effort)
  const owner = auth.currentUser;
  if (!owner?.uid) return local;

  try {
    const qy = query(collection(db, "users", owner.uid, "manageAccounts"), orderBy("lastUsedAt", "desc"));
    const snap = await getDocs(qy);

    let merged = local;
    snap.forEach((d) => {
      const x: any = d.data();

      const ts: Timestamp | null = x?.lastUsedAt && typeof x.lastUsedAt.toDate === "function" ? x.lastUsedAt : null;
      const lastUsedAtMs = ts ? ts.toDate().getTime() : Date.now();

      const fromCloud: SavedAccount = {
        uid: String(x?.uid || d.id),
        email: normalizeEmail(String(x?.email || "")),
        displayName: String(x?.displayName || ""),
        photoURL: String(x?.photoURL || ""),
        provider: x?.provider === "google" ? "google" : "email",
        lastUsedAt: lastUsedAtMs,
      };

      merged = upsertLocal(merged, fromCloud);
    });

    merged = sortByLastUsed(merged);
    await writeLocal(merged); // keep local in sync
    return merged;
  } catch {
    return local;
  }
}

export async function removeSavedAccount(accountUid: string) {
  const local = await readLocal();
  const next = local.filter((x) => x.uid !== accountUid);
  await writeLocal(next);

  // cloud (best-effort)
  await syncRemoveFromFirestore(accountUid);

  return next;
}
