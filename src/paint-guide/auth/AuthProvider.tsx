import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import {
  parseStaffProfile,
  type StaffAuthState,
  type StaffProfile,
} from "./staff-profile";

const AUTHORIZATION_TIMEOUT_MS = 10_000;

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
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [authState, setAuthState] = useState<StaffAuthState>(
    isSupabaseConfigured ? "loading" : "unauthenticated",
  );
  const sessionRef = useRef<Session | null>(null);
  const authStateRef = useRef<StaffAuthState>(
    isSupabaseConfigured ? "loading" : "unauthenticated",
  );
  const requestGenerationRef = useRef(0);
  const authorizationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const clearAuthorizationTimeout = useCallback(() => {
    if (authorizationTimeoutRef.current !== null) {
      clearTimeout(authorizationTimeoutRef.current);
      authorizationTimeoutRef.current = null;
    }
  }, []);

  const updateAuthState = useCallback((nextState: StaffAuthState) => {
    authStateRef.current = nextState;
    setAuthState(nextState);
  }, []);

  const invalidateAuthorization = useCallback(
    (nextState: Extract<StaffAuthState, "unauthenticated" | "unauthorized">) => {
      requestGenerationRef.current += 1;
      clearAuthorizationTimeout();
      setProfile(null);
      updateAuthState(nextState);
    },
    [clearAuthorizationTimeout, updateAuthState],
  );

  const authorizeSession = useCallback(
    (nextSession: Session) => {
      if (!supabase) {
        invalidateAuthorization("unauthorized");
        return;
      }

      const userId = nextSession.user.id;
      const requestGeneration = requestGenerationRef.current + 1;

      requestGenerationRef.current = requestGeneration;
      clearAuthorizationTimeout();
      setProfile(null);
      updateAuthState("loading");

      const isCurrentRequest = () =>
        requestGenerationRef.current === requestGeneration &&
        sessionRef.current?.user.id === userId;

      const denyAuthorization = () => {
        if (!isCurrentRequest()) return;

        requestGenerationRef.current += 1;
        clearAuthorizationTimeout();
        setProfile(null);
        updateAuthState("unauthorized");
      };

      authorizationTimeoutRef.current = setTimeout(
        denyAuthorization,
        AUTHORIZATION_TIMEOUT_MS,
      );

      void supabase
        .from("profiles")
        .select("user_id, display_name, role, active, created_at, updated_at")
        .eq("user_id", userId)
        .maybeSingle()
        .then(({ data, error }) => {
          if (!isCurrentRequest()) return;

          clearAuthorizationTimeout();

          const nextProfile = error ? null : parseStaffProfile(data);

          if (!nextProfile || nextProfile.user_id !== userId) {
            setProfile(null);
            updateAuthState("unauthorized");
            return;
          }

          setProfile(nextProfile);

          if (!nextProfile.active) {
            updateAuthState("inactive");
            return;
          }

          updateAuthState(
            nextProfile.role === "owner"
              ? "authorized_owner"
              : "authorized_supervisor",
          );
        })
        .catch(denyAuthorization);
    },
    [clearAuthorizationTimeout, invalidateAuthorization, updateAuthState],
  );

  useEffect(() => {
    if (!supabase) {
      updateAuthState("unauthenticated");
      return;
    }

    let active = true;
    let receivedInitialAuthEvent = false;

    const initialSessionTimeout = setTimeout(() => {
      if (!active || receivedInitialAuthEvent) return;

      sessionRef.current = null;
      setSession(null);
      invalidateAuthorization("unauthorized");
    }, AUTHORIZATION_TIMEOUT_MS);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;

      if (!receivedInitialAuthEvent) {
        receivedInitialAuthEvent = true;
        clearTimeout(initialSessionTimeout);
      }

      if (event === "SIGNED_OUT" || !nextSession) {
        sessionRef.current = null;
        setSession(null);
        invalidateAuthorization("unauthenticated");
        return;
      }

      const sameUser = sessionRef.current?.user.id === nextSession.user.id;
      sessionRef.current = nextSession;
      setSession(nextSession);

      if (event === "TOKEN_REFRESHED" && sameUser) {
        return;
      }

      if (
        sameUser &&
        (authStateRef.current === "loading" ||
          authStateRef.current === "authorized_owner" ||
          authStateRef.current === "authorized_supervisor")
      ) {
        return;
      }

      authorizeSession(nextSession);
    });

    return () => {
      active = false;
      clearTimeout(initialSessionTimeout);
      requestGenerationRef.current += 1;
      clearAuthorizationTimeout();
      subscription.unsubscribe();
    };
  }, [authorizeSession, clearAuthorizationTimeout, invalidateAuthorization, updateAuthState]);

  const signOut = useCallback(async () => {
    if (!supabase) return;

    sessionRef.current = null;
    setSession(null);
    invalidateAuthorization("unauthenticated");

    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, [invalidateAuthorization]);

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
