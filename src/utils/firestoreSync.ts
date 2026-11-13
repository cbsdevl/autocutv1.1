import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";
import { firebaseApp, firebaseAuth } from "./firebaseAuth";

// Initialize Cloud Firestore strictly with the provisioned databaseId
export const firestoreDb = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: Array<{
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }>;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: firebaseAuth.currentUser?.uid,
      email: firebaseAuth.currentUser?.email,
      emailVerified: firebaseAuth.currentUser?.emailVerified,
      isAnonymous: firebaseAuth.currentUser?.isAnonymous,
      tenantId: firebaseAuth.currentUser?.tenantId,
      providerInfo:
        firebaseAuth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error:", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

let connectionTested = false;

export async function testFirestoreConnection(): Promise<boolean> {
  if (connectionTested) return true;
  if (!firebaseAuth.currentUser) return false;
  connectionTested = true;
  try {
    await getDocFromServer(doc(firestoreDb, "test", "connection"));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.error("Please check your Firebase configuration. Firestore client is offline.");
      return false;
    }
    // Missing document / permission checks still prove active server reachability
    return true;
  }
}

function getSafeFirestoreId(rawId: string): string {
  const cleaned = rawId.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 128);
  if (!cleaned || cleaned === "." || cleaned === ".." || cleaned === "undefined" || cleaned === "null") {
    return `proj_${Date.now()}`;
  }
  return cleaned;
}

function toIsoDate(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (value && typeof value === "object" && "toDate" in value && typeof (value as any).toDate === "function") {
    return (value as any).toDate().toISOString();
  }
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

export async function syncUserProfileToFirestore(pgUser: {
  id: number;
  name: string;
  email: string;
  plan_slug?: string;
  avatar_url?: string | null;
}): Promise<void> {
  const fbUser = firebaseAuth.currentUser;
  if (!fbUser) return;

  await testFirestoreConnection();

  const uid = fbUser.uid;
  const profilePath = `users/${uid}`;
  const privatePath = `users/${uid}/private/account`;
  const isElectron = typeof window !== "undefined" && !!(window as any).electronAPI?.isElectron;

  try {
    const profileRef = doc(firestoreDb, "users", uid);
    const existingProfile = await getDoc(profileRef);
    const displayName = (pgUser.name || fbUser.displayName || "Creator").slice(0, 120);
    const photoUrl = (pgUser.avatar_url || fbUser.photoURL || "").slice(0, 1024);
    const planSlug = (pgUser.plan_slug || "free").slice(0, 40);

    if (!existingProfile.exists()) {
      const payload: Record<string, unknown> = {
        uid,
        displayName,
        planSlug,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (photoUrl) payload.photoUrl = photoUrl;
      await setDoc(profileRef, payload);
    } else {
      const updates: Record<string, unknown> = {
        displayName,
        planSlug,
        updatedAt: serverTimestamp(),
      };
      if (photoUrl) updates.photoUrl = photoUrl;
      await updateDoc(profileRef, updates);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, profilePath);
  }

  try {
    const privateRef = doc(firestoreDb, "users", uid, "private", "account");
    const existingPrivate = await getDoc(privateRef);
    const email = (pgUser.email || fbUser.email || "").slice(0, 254);

    if (!existingPrivate.exists()) {
      await setDoc(privateRef, {
        uid,
        email,
        role: "user",
        pgUserId: pgUser.id,
        lastPlatform: isElectron ? "desktop-exe" : "web",
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(privateRef, {
        email,
        pgUserId: pgUser.id,
        lastPlatform: isElectron ? "desktop-exe" : "web",
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, privatePath);
  }
}

export interface FirestoreProjectRecord {
  id: string;
  ownerUid: string;
  name: string;
  aspectRatio: string;
  resolution: string;
  frameRate: number;
  mediaCount: number;
  thumbnail?: string;
  snapshotJson: string;
  createdAt: string;
  updatedAt: string;
}

export async function saveProjectToFirestore(params: {
  projectId: string;
  name: string;
  aspectRatio?: string;
  resolution?: string;
  frameRate?: number;
  mediaCount: number;
  thumbnail?: string;
  snapshotJson: string;
}): Promise<boolean> {
  const fbUser = firebaseAuth.currentUser;
  if (!fbUser) return false;

  await testFirestoreConnection();

  const uid = fbUser.uid;
  const safeId = getSafeFirestoreId(params.projectId);
  const path = `users/${uid}/projects/${safeId}`;
  const docRef = doc(firestoreDb, "users", uid, "projects", safeId);

  // Enforce strict Firestore document byte ceilings (<750KB JSON, <220KB thumbnail)
  const boundedJson = params.snapshotJson.slice(0, 740000);
  const boundedThumb =
    params.thumbnail && params.thumbnail.length <= 220000 ? params.thumbnail : undefined;
  const boundedName = (params.name || "Untitled Project").trim().slice(0, 200) || "Untitled Project";

  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      const createPayload: Record<string, unknown> = {
        id: safeId,
        ownerUid: uid,
        name: boundedName,
        aspectRatio: (params.aspectRatio || "16:9").slice(0, 20),
        resolution: (params.resolution || "1080p").slice(0, 20),
        frameRate: Math.min(240, Math.max(1, Number(params.frameRate) || 30)),
        mediaCount: Math.min(5000, Math.max(0, Number(params.mediaCount) || 0)),
        snapshotJson: boundedJson,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (boundedThumb) createPayload.thumbnail = boundedThumb;
      await setDoc(docRef, createPayload);
    } else {
      const updatePayload: Record<string, unknown> = {
        name: boundedName,
        aspectRatio: (params.aspectRatio || "16:9").slice(0, 20),
        resolution: (params.resolution || "1080p").slice(0, 20),
        frameRate: Math.min(240, Math.max(1, Number(params.frameRate) || 30)),
        mediaCount: Math.min(5000, Math.max(0, Number(params.mediaCount) || 0)),
        snapshotJson: boundedJson,
        updatedAt: serverTimestamp(),
      };
      if (boundedThumb) updatePayload.thumbnail = boundedThumb;
      await updateDoc(docRef, updatePayload);
    }
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function listProjectsFromFirestore(): Promise<FirestoreProjectRecord[]> {
  const fbUser = firebaseAuth.currentUser;
  if (!fbUser) return [];

  await testFirestoreConnection();

  const uid = fbUser.uid;
  const path = `users/${uid}/projects`;

  try {
    const q = query(collection(firestoreDb, "users", uid, "projects"), where("ownerUid", "==", uid));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: String(data.id || d.id),
        ownerUid: String(data.ownerUid || uid),
        name: String(data.name || "Untitled Project"),
        aspectRatio: String(data.aspectRatio || "16:9"),
        resolution: String(data.resolution || "1080p"),
        frameRate: Number(data.frameRate || 30),
        mediaCount: Number(data.mediaCount || 0),
        thumbnail: typeof data.thumbnail === "string" ? data.thumbnail : undefined,
        snapshotJson: String(data.snapshotJson || "{}"),
        createdAt: toIsoDate(data.createdAt),
        updatedAt: toIsoDate(data.updatedAt),
      };
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function loadProjectFromFirestore(projectId: string): Promise<FirestoreProjectRecord | null> {
  const fbUser = firebaseAuth.currentUser;
  if (!fbUser) return null;

  await testFirestoreConnection();

  const uid = fbUser.uid;
  const safeId = getSafeFirestoreId(projectId);
  const path = `users/${uid}/projects/${safeId}`;

  try {
    const d = await getDoc(doc(firestoreDb, "users", uid, "projects", safeId));
    if (!d.exists()) return null;
    const data = d.data();
    return {
      id: String(data.id || d.id),
      ownerUid: String(data.ownerUid || uid),
      name: String(data.name || "Untitled Project"),
      aspectRatio: String(data.aspectRatio || "16:9"),
      resolution: String(data.resolution || "1080p"),
      frameRate: Number(data.frameRate || 30),
      mediaCount: Number(data.mediaCount || 0),
      thumbnail: typeof data.thumbnail === "string" ? data.thumbnail : undefined,
      snapshotJson: String(data.snapshotJson || "{}"),
      createdAt: toIsoDate(data.createdAt),
      updatedAt: toIsoDate(data.updatedAt),
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function deleteProjectFromFirestore(projectId: string): Promise<void> {
  const fbUser = firebaseAuth.currentUser;
  if (!fbUser) return;

  await testFirestoreConnection();

  const uid = fbUser.uid;
  const safeId = getSafeFirestoreId(projectId);
  const path = `users/${uid}/projects/${safeId}`;

  try {
    await deleteDoc(doc(firestoreDb, "users", uid, "projects", safeId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}
