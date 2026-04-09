import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/authStore';

export function useAuth() {
  const { user, profile, isLoading, setUser, setProfile, setLoading, signOut } = useAuthStore();

  useEffect(() => {
    let mounted = true;

    const syncProfile = async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (!mounted) return;

        if (error) {
          setProfile(null);
          return;
        }

        setProfile((data as any) ?? null);
      } catch {
        if (mounted) {
          setProfile(null);
        }
      }
    };

    const bootstrap = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        setUser(session?.user ?? null);
        setLoading(false);

        if (session?.user) {
          void syncProfile(session.user.id);
        } else {
          setProfile(null);
        }
      } catch {
        if (!mounted) return;
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        void syncProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    void bootstrap();

    const failSafe = window.setTimeout(() => {
      if (mounted) {
        setLoading(false);
      }
    }, 4000);

    return () => {
      mounted = false;
      window.clearTimeout(failSafe);
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    signOut();
  };

  return { user, profile, isLoading, signOut: handleSignOut };
}
