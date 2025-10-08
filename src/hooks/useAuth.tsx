import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import { Profile } from '@/lib/types';

export type UserRole = 'admin' | 'guard' | 'super_admin';

interface AuthUser {
  user: User | null;
  session: Session | null;
  role: UserRole | null;
  profile: Profile | null;
  loading: boolean;
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthUser>({
    user: null,
    session: null,
    role: null,
    profile: null,
    loading: true,
  });
  const navigate = useNavigate();

  useEffect(() => {
    // Set up auth state listener (avoid async work inside callback)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        // Set base state and fetch role/profile asynchronously to avoid deadlocks
        setAuthState(prev => ({
          ...prev,
          user: session.user!,
          session,
          loading: true,
        }));

        setTimeout(async () => {
          try {
            const [role, profile] = await Promise.all([
              getUserRole(session.user!.id),
              getUserProfile(session.user!.id),
            ]);
            setAuthState({
              user: session.user!,
              session,
              role,
              profile,
              loading: false,
            });
          } catch (e) {
            console.error('[Auth] Failed to fetch role/profile after auth change', e);
            setAuthState({
              user: session.user!,
              session,
              role: null,
              profile: null,
              loading: false,
            });
          }
        }, 0);
      } else {
        setAuthState({
          user: null,
          session: null,
          role: null,
          profile: null,
          loading: false,
        });
      }
    });

    // Check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const role = await getUserRole(session.user.id);
        const profile = await getUserProfile(session.user.id);
        setAuthState({
          user: session.user,
          session,
          role,
          profile,
          loading: false,
        });
      } else {
        setAuthState({
          user: null,
          session: null,
          role: null,
          profile: null,
          loading: false,
        });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const getUserRole = async (userId: string): Promise<UserRole | null> => {
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    if (roles && roles.length > 0) {
      // Prioridade: super_admin > admin > guard
      if (roles.some(r => r.role === 'super_admin')) return 'super_admin';
      if (roles.some(r => r.role === 'admin')) return 'admin';
      return 'guard';
    }
    return null;
  };

  const getUserProfile = async (userId: string): Promise<Profile | null> => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    return profile || null;
  };

  const signOut = async () => {
    try {
      // Clear local state immediately
      setAuthState({
        user: null,
        session: null,
        role: null,
        profile: null,
        loading: false,
      });

      // Sign out from Supabase with global scope
      await supabase.auth.signOut({ scope: 'global' });

      // Clean up localStorage
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key) continue;
          if (key.startsWith('sb-') && key.endsWith('-auth-token')) keysToRemove.push(key);
          if (key.startsWith('supabase.auth.')) keysToRemove.push(key);
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      } catch {}
      
      // Increased delay to ensure Supabase fully processed the signOut
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Use navigate for client-side routing (avoid server 404)
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('[Auth] Erro ao fazer logout:', error);

      // Fallback cleanup
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key) continue;
          if (key.startsWith('sb-') && key.endsWith('-auth-token')) keysToRemove.push(key);
          if (key.startsWith('supabase.auth.')) keysToRemove.push(key);
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      } catch {}
      
      navigate('/login', { replace: true });
    }
  };

  return {
    ...authState,
    signOut,
  };
};
