import type {
  B2CRegistrationInput,
  Patient,
  PatientAuthMetadata,
  PatientOnboardingInput,
} from '@teleconsult/shared-types';
import type { Session, User } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { completePatientOnboarding, fetchPatientProfile } from '@/lib/patients';
import { supabase } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  patient: Patient | null;
  /** True until session + patient profile have both been resolved. */
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: B2CRegistrationInput) => Promise<{ needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  resendConfirmation: (email: string) => Promise<void>;
  refreshPatient: () => Promise<void>;
  completeOnboarding: (input: PatientOnboardingInput) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadPatient = useCallback(async (userId: string) => {
    try {
      const profile = await fetchPatientProfile(userId);
      setPatient(profile);
      return profile;
    } catch {
      setPatient(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function resolveSession(nextSession: Session | null, options?: { gate?: boolean }) {
      if (!mounted) return;
      if (options?.gate !== false) {
        setIsLoading(true);
      }

      setSession(nextSession);

      if (nextSession?.user) {
        await loadPatient(nextSession.user.id);
      } else {
        setPatient(null);
      }

      if (mounted) setIsLoading(false);
    }

    void supabase.auth.getSession().then(({ data }) => {
      void resolveSession(data.session);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      // Token refresh must not re-open the routing gate — that briefly makes
      // patient look "missing" and sends completed users back to onboarding.
      if (event === 'TOKEN_REFRESHED') {
        setSession(nextSession);
        return;
      }

      void resolveSession(nextSession, { gate: true });
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [loadPatient]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      setIsLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setIsLoading(false);
        throw error;
      }

      setSession(data.session);
      if (data.session?.user) {
        await loadPatient(data.session.user.id);
      } else {
        setPatient(null);
      }
      setIsLoading(false);
    },
    [loadPatient]
  );

  const signUp = useCallback(async (input: B2CRegistrationInput) => {
    const metadata: PatientAuthMetadata = {
      role: 'patient',
      full_name: input.fullName.trim(),
      date_of_birth: input.dateOfBirth,
      gender: input.gender,
      mobile: input.mobile.trim(),
      account_source: 'b2c',
    };

    const { data, error } = await supabase.auth.signUp({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      options: { data: metadata },
    });

    if (error) throw error;

    const needsEmailConfirmation = !data.session;
    return { needsEmailConfirmation };
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setPatient(null);
  }, []);

  const resendConfirmation = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase(),
    });
    if (error) throw error;
  }, []);

  const refreshPatient = useCallback(async () => {
    if (!session?.user) {
      setPatient(null);
      return;
    }
    await loadPatient(session.user.id);
  }, [loadPatient, session?.user]);

  const completeOnboarding = useCallback(
    async (input: PatientOnboardingInput) => {
      if (!session?.user) throw new Error('Not signed in');
      const updated = await completePatientOnboarding(session.user.id, input);
      setPatient(updated);
    },
    [session?.user]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      patient,
      isLoading,
      signIn,
      signUp,
      signOut,
      resendConfirmation,
      refreshPatient,
      completeOnboarding,
    }),
    [
      session,
      patient,
      isLoading,
      signIn,
      signUp,
      signOut,
      resendConfirmation,
      refreshPatient,
      completeOnboarding,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
