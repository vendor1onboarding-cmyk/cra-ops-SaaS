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
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  retryLoadProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Retry logic with exponential backoff
const retryWithBackoff = async (
  fn: () => Promise<any>,
  maxRetries: number = 3,
  delay: number = 1000
) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      console.warn(`Retry ${i + 1}/${maxRetries} after ${delay}ms`, error);
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  const loadProfile = async () => {
    // Prevent multiple simultaneous loads
    if (isLoadingProfile) {
      console.warn("Profile load already in progress, skipping");
      return;
    }

    setIsLoadingProfile(true);
    setError(null);

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        throw new Error(`Session error: ${sessionError.message}`);
      }

      if (!session?.user) {
        console.log("No active session");
        setProfile(null);
        setLoading(false);
        setIsLoadingProfile(false);
        return;
      }

      console.log("Loading profile for user:", session.user.id);

      // Retry profile fetch with exponential backoff for production resilience
      const profileData = await retryWithBackoff(
        async () => {
          const { data, error } = await supabase
            .from("profiles")
            .select("id, full_name, role")
            .eq("id", session.user.id)
            .single();

          if (error) {
            console.error("Profile query error:", error);
            throw new Error(`Failed to load profile: ${error.message}`);
          }
          return data;
        },
        3,
        500
      );

      if (!profileData?.role) {
        throw new Error("Profile missing role information");
      }

      const loadedProfile = {
        id: profileData.id,
        full_name: profileData.full_name,
        role: profileData.role as Role,
      };
      
      console.log("Profile loaded successfully:", loadedProfile.role);
      setProfile(loadedProfile);
      setError(null);
    } catch (err: any) {
      const errorMsg = err.message || "Failed to load profile";
      console.error("Error in loadProfile:", errorMsg);
      setError(errorMsg);
      setProfile(null);
      // Don't set loading to false on error - let the user retry
    } finally {
      setLoading(false);
      setIsLoadingProfile(false);
    }
  };

  useEffect(() => {
    console.log("AuthProvider initializing");
    setLoading(true);
    loadProfile();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth state changed:", event);
      if (event === "SIGNED_OUT") {
        setProfile(null);
        setLoading(false);
        setError(null);
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        loadProfile();
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;

      if (data.user) {
        // Ensure profile exists with upsert
        const { error: upsertError } = await supabase
          .from("profiles")
          .upsert(
            { id: data.user.id, full_name: data.user.email, role: "custodian" },
            { onConflict: "id" }
          );
        
        if (upsertError) {
          console.error("Error upserting profile:", upsertError);
        }
      }
      
      await loadProfile();
    } catch (err: any) {
      const errorMsg = err.message || "Sign in failed";
      setError(errorMsg);
      setProfile(null);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setProfile(null);
      setError(null);
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  const retryLoadProfile = async () => {
    setError(null);
    await loadProfile();
  };

  return (
    <AuthContext.Provider value={{ profile, loading, error, signIn, signOut, retryLoadProfile }}>
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
