import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase App instance safely (singleton)
export const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const firebaseAuth = getAuth(firebaseApp);

export const googleProvider = new GoogleAuthProvider();
// Request official Google OAuth scopes
googleProvider.addScope("https://www.googleapis.com/auth/userinfo.email");
googleProvider.addScope("https://www.googleapis.com/auth/userinfo.profile");
googleProvider.setCustomParameters({
  prompt: "select_account",
});

export interface RealGoogleAuthResult {
  user: User;
  idToken: string;
  accessToken?: string;
  email: string;
  name: string;
  photoUrl: string | null;
  googleId: string;
}

/**
 * Triggers real Google Sign-In using official Firebase Auth & Google OAuth Provider.
 * Opens Google's secure account chooser popup and returns authenticated user credentials.
 */
export async function signInWithGoogleReal(): Promise<RealGoogleAuthResult> {
  try {
    const result = await signInWithPopup(firebaseAuth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const idToken = await result.user.getIdToken();

    if (!result.user.email) {
      throw new Error("No verified email address returned from Google account.");
    }

    return {
      user: result.user,
      idToken,
      accessToken: credential?.accessToken,
      email: result.user.email,
      name: result.user.displayName || result.user.email.split("@")[0],
      photoUrl: result.user.photoURL,
      googleId: result.user.uid,
    };
  } catch (error: any) {
    console.error("[Real Google Auth] Sign-in error:", error);
    throw error;
  }
}

export async function signOutRealGoogle(): Promise<void> {
  try {
    await signOut(firebaseAuth);
  } catch (e) {
    // Ignore signOut errors
  }
}
