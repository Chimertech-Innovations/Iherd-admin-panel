import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { 
  type User as FirebaseUser, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut,
  updateProfile
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  createdAt: string;
}

export type AuthUser = {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  phoneNumber?: string | null;
};

interface AuthContextType {
  user: AuthUser | null;
  profile: UserProfile | null;
  loading: boolean;
  setProfile: (profile: UserProfile | null) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, phone: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const adminEmail = (import.meta.env.VITE_ADMIN_EMAIL as string | undefined)?.trim() || "";

  useEffect(() => {
    // 1. Supabase Auth Integration
    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          const suUser = session.user;
          const authUserObj: AuthUser = {
            uid: suUser.id,
            email: suUser.email || "",
            displayName: suUser.user_metadata?.name || suUser.email?.split("@")[0] || "Admin",
            phoneNumber: suUser.user_metadata?.phone || suUser.phone || "",
          };
          setUser(authUserObj);
          setProfile({
            uid: suUser.id,
            name: authUserObj.displayName || "Admin User",
            email: suUser.email || "",
            phone: authUserObj.phoneNumber || "",
            role: "Super Admin",
            createdAt: suUser.created_at || new Date().toISOString(),
          });
        }
        setLoading(false);
      });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          const suUser = session.user;
          const authUserObj: AuthUser = {
            uid: suUser.id,
            email: suUser.email || "",
            displayName: suUser.user_metadata?.name || suUser.email?.split("@")[0] || "Admin",
            phoneNumber: suUser.user_metadata?.phone || suUser.phone || "",
          };
          setUser(authUserObj);
          setProfile({
            uid: suUser.id,
            name: authUserObj.displayName || "Admin User",
            email: suUser.email || "",
            phone: authUserObj.phoneNumber || "",
            role: "Super Admin",
            createdAt: suUser.created_at || new Date().toISOString(),
          });
        } else {
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      });

      return () => {
        subscription.unsubscribe();
      };
    }

    // 2. Firebase Auth Integration (No hardcoded passwords)
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // If admin email restriction is configured
        if (adminEmail && currentUser.email && currentUser.email.toLowerCase() !== adminEmail.toLowerCase()) {
          await firebaseSignOut(auth);
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        const authUserObj: AuthUser = {
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName,
          phoneNumber: currentUser.phoneNumber,
        };
        setUser(authUserObj);

        try {
          const userDocRef = doc(db, "users", currentUser.uid);
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            const fallbackProfile: UserProfile = {
              uid: currentUser.uid,
              name: currentUser.displayName || "Admin User",
              email: currentUser.email || "",
              phone: currentUser.phoneNumber || "",
              role: "Super Admin",
              createdAt: new Date().toISOString(),
            };
            setProfile(fallbackProfile);

            await setDoc(userDocRef, {
              uid: currentUser.uid,
              name: fallbackProfile.name,
              email: fallbackProfile.email,
              phoneNumber: fallbackProfile.phone,
              roles: ["Super Admin"],
              createdAt: new Date(),
              updatedAt: new Date(),
            }, { merge: true });
          }
        } catch {
          // Firestore read error -> fallback profile
          setProfile({
            uid: currentUser.uid,
            name: currentUser.displayName || "Admin User",
            email: currentUser.email || "",
            phone: currentUser.phoneNumber || "",
            role: "Super Admin",
            createdAt: new Date().toISOString(),
          });
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [adminEmail]);

  const signIn = async (email: string, password: string) => {
    if (adminEmail && email.toLowerCase() !== adminEmail.toLowerCase()) {
      throw new Error(`Unauthorized. Only ${adminEmail} is permitted.`);
    }

    // 1. If Supabase is active, authenticate via Supabase Auth
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw new Error(error.message || "Failed to sign in via Supabase.");
      }

      if (data.user) {
        const suUser = data.user;
        setUser({
          uid: suUser.id,
          email: suUser.email || "",
          displayName: suUser.user_metadata?.name || "Admin",
          phoneNumber: suUser.user_metadata?.phone || "",
        });
        setProfile({
          uid: suUser.id,
          name: suUser.user_metadata?.name || "Admin User",
          email: suUser.email || "",
          phone: suUser.user_metadata?.phone || "",
          role: "Super Admin",
          createdAt: suUser.created_at || new Date().toISOString(),
        });
        return;
      }
    }

    // 2. Authenticate via Firebase Auth
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
        throw new Error("Invalid password. Please check your credentials.");
      } else if (err.code === "auth/user-not-found") {
        throw new Error("Admin account not found. Please click 'Create one' to register.");
      }
      throw new Error(err.message || "Authentication failed.");
    }
  };

  const signUp = async (email: string, password: string, name: string, phone: string) => {
    if (adminEmail && email.toLowerCase() !== adminEmail.toLowerCase()) {
      throw new Error(`Unauthorized. Only ${adminEmail} is permitted.`);
    }

    // 1. Supabase Sign Up
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            phone,
            role: "Super Admin",
          },
        },
      });

      if (error) {
        throw new Error(error.message || "Supabase registration failed.");
      }

      if (data.user) {
        setUser({
          uid: data.user.id,
          email: data.user.email || "",
          displayName: name,
          phoneNumber: phone,
        });
        setProfile({
          uid: data.user.id,
          name,
          email,
          phone,
          role: "Super Admin",
          createdAt: new Date().toISOString(),
        });
        return;
      }
    }

    // 2. Firebase Sign Up
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(userCredential.user, { displayName: name });
  };

  const logout = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    await firebaseSignOut(auth).catch(() => {});
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, setProfile, signIn, signUp, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
