import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { supabase } from "../api/supabaseClient";

type Role = "admin" | "custodian" | "supervisor";

type Profile = {
  id: string;
  full_name: string | null;
  role: Role;
};

type AuthContextType = {
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    if (error) {
      console.error("Error loading profile:", error.message);
      setProfile(null);
    } else {
      setProfile({
        id: data.id,
        full_name: data.full_name,
        role: data.role,
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    loadProfile();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, _session) => {
      loadProfile();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;

    if (data.user) {
      await supabase
        .from("profiles")
        .upsert({ id: data.user.id, full_name: data.user.email });
    }
    await loadProfile();
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
