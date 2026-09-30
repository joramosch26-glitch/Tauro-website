import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import {
  parseStaffProfile,
  type StaffAuthState,
  type StaffProfile,
} from "./staff-profile";

type AuthContextValue = {
  configured: boolean;
  authState: StaffAuthState;
  profile: StaffProfile | null;
  session: Session | null;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: React.ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(isSupabaseConfigured);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [authState, setAuthState] = useState<StaffAuthState>(
    isSupabaseConfigured ? "loading" : "unauthenticated",
  );

  useEffect(() => {
    if (!supabase) {
      setSessionLoading(false);
      return;
    }

    let active = true;

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      setProfile(null);
      setSession(error ? null : data.session);
      setSessionLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setProfile(null);
      setAuthState(nextSession ? "loading" : "unauthenticated");
      setSession(nextSession);
      setSessionLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;

    setProfile(null);

    if (!isSupabaseConfigured || !supabase) {
      setAuthState("unauthenticated");
      return;
    }

    if (sessionLoading) {
      setAuthState("loading");
      return;
    }

    if (!session) {
      setAuthState("unauthenticated");
      return;
    }

    const userId = session.user.id;
    setAuthState("loading");

    void supabase
      .from("profiles")
      .select("user_id, display_name, role, active, created_at, updated_at")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;

        const nextProfile = error ? null : parseStaffProfile(data);

        if (!nextProfile || nextProfile.user_id !== userId) {
          setAuthState("unauthorized");
          return;
        }

        setProfile(nextProfile);

        if (!nextProfile.active) {
          setAuthState("inactive");
          return;
        }

        setAuthState(
          nextProfile.role === "owner"
            ? "authorized_owner"
            : "authorized_supervisor",
        );
      })
      .catch(() => {
        if (!active) return;
        setProfile(null);
        setAuthState("unauthorized");
      });

    return () => {
      active = false;
    };
  }, [session?.access_token, session?.user.id, sessionLoading]);

  const signOut = useCallback(async () => {
    if (!supabase) return;

    setProfile(null);
    setSession(null);
    setAuthState("unauthenticated");

    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const value = useMemo(
    () => ({
      configured: isSupabaseConfigured,
      authState,
      profile,
      session,
      signOut,
    }),
    [authState, profile, session, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
