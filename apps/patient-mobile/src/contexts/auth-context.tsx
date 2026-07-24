import type {
  B2CRegistrationInput,
  Patient,
  PatientAuthMetadata,
  PatientBasicDetailsInput,
  PatientOnboardingInput,
  UserRole,
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

import { useInactivityTimeout } from '@/hooks/use-inactivity-timeout';
import { assertPatientRole, getUserRole } from '@/lib/auth-role';
import {
  completePatientOnboarding,
  fetchPatientProfile,
  savePatientBasicDetails,
} from '@/lib/patients';
import { toE164Phone } from '@/lib/phone';
import { supabase } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  role: UserRole | null;
  patient: Patient | null;
  /** True until session + patient profile have both been resolved. */
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithPhoneOtp: (phone: string) => Promise<void>;
  verifyPhoneOtp: (phone: string, token: string) => Promise<void>;
  signUp: (input: B2CRegistrationInput) => Promise<{ needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  resendConfirmation: (email: string) => Promise<void>;
  refreshPatient: () => Promise<void>;
  saveBasicDetails: (input: PatientBasicDetailsInput) => Promise<void>;
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

  const enforcePatientSession = useCallback(
    async (nextSession: Session | null) => {
      if (!nextSession?.user) {
        setSession(null);
        setPatient(null);
        return null;
      }

      try {
        assertPatientRole(nextSession.user);
      } catch (err) {
        await supabase.auth.signOut();
        setSession(null);
        setPatient(null);
        throw err;
      }

      setSession(nextSession);
      await loadPatient(nextSession.user.id);
      return nextSession;
    },
    [loadPatient]
  );

  useEffect(() => {
    let mounted = true;

    async function resolveSession(nextSession: Session | null, options?: { gate?: boolean }) {
      if (!mounted) return;
      if (options?.gate !== false) {
        setIsLoading(true);
      }

      try {
        if (!nextSession?.user) {
          setSession(null);
          setPatient(null);
        } else {
          const role = getUserRole(nextSession.user);
          if (role && role !== 'patient') {
            await supabase.auth.signOut();
            setSession(null);
            setPatient(null);
          } else {
            setSession(nextSession);
            await loadPatient(nextSession.user.id);
          }
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    void supabase.auth.getSession().then(({ data }) => {
      void resolveSession(data.session);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
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

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setPatient(null);
    setSession(null);
  }, []);

  useInactivityTimeout(Boolean(session), () => {
    void signOut();
  });

  const signIn = useCallback(
    async (email: string, password: string) => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await enforcePatientSession(data.session);
      } catch (err) {
        setIsLoading(false);
        throw err;
      }
      setIsLoading(false);
    },
    [enforcePatientSession]
  );

  const signInWithPhoneOtp = useCallback(async (phone: string) => {
    const e164 = toE164Phone(phone);
    if (!e164) throw new Error('Enter a valid mobile number.');

    const { error } = await supabase.auth.signInWithOtp({
      phone: e164,
      options: {
        shouldCreateUser: true,
        data: {
          role: 'patient',
          account_source: 'b2c',
          mobile: e164,
        },
      },
    });
    if (error) throw error;
  }, []);

  const verifyPhoneOtp = useCallback(
    async (phone: string, token: string) => {
      const e164 = toE164Phone(phone);
      if (!e164) throw new Error('Enter a valid mobile number.');

      setIsLoading(true);
      try {
        const { data, error } = await supabase.auth.verifyOtp({
          phone: e164,
          token: token.trim(),
          type: 'sms',
        });
        if (error) throw error;
        await enforcePatientSession(data.session);
      } catch (err) {
        setIsLoading(false);
        throw err;
      }
      setIsLoading(false);
    },
    [enforcePatientSession]
  );

  const signUp = useCallback(async (input: B2CRegistrationInput) => {
    const metadata: PatientAuthMetadata = {
      role: 'patient',
      full_name: input.fullName.trim(),
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

  const saveBasicDetails = useCallback(
    async (input: PatientBasicDetailsInput) => {
      if (!session?.user) throw new Error('Not signed in');
      const updated = await savePatientBasicDetails(session.user.id, input);
      setPatient(updated);
    },
    [session?.user]
  );

  const completeOnboarding = useCallback(
    async (input: PatientOnboardingInput) => {
      if (!session?.user) throw new Error('Not signed in');
      const updated = await completePatientOnboarding(session.user.id, input);
      setPatient(updated);
    },
    [session?.user]
  );

  const role = getUserRole(session?.user);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      role,
      patient,
      isLoading,
      signIn,
      signInWithPhoneOtp,
      verifyPhoneOtp,
      signUp,
      signOut,
      resendConfirmation,
      refreshPatient,
      saveBasicDetails,
      completeOnboarding,
    }),
    [
      session,
      role,
      patient,
      isLoading,
      signIn,
      signInWithPhoneOtp,
      verifyPhoneOtp,
      signUp,
      signOut,
      resendConfirmation,
      refreshPatient,
      saveBasicDetails,
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
