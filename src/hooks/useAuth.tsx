import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';

export type UserRole = 'admin' | 'guard';

interface AuthUser {
  user: User | null;
  session: Session | null;
  role: UserRole | null;
  loading: boolean;
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthUser>({
    user: null,
    session: null,
    role: null,
    loading: true,
  });
  const navigate = useNavigate();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          const role = await getUserRole(session.user.id);
          setAuthState({
            user: session.user,
            session,
            role,
            loading: false,
          });
        } else {
          setAuthState({
            user: null,
            session: null,
            role: null,
            loading: false,
          });
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const role = await getUserRole(session.user.id);
        setAuthState({
          user: session.user,
          session,
          role,
          loading: false,
        });
      } else {
        setAuthState({
          user: null,
          session: null,
          role: null,
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
      return roles.some(r => r.role === 'admin') ? 'admin' : 'guard';
    }
    return null;
  };

  const signOut = async () => {
    try {
      // Clear local state first
      setAuthState({
        user: null,
        session: null,
        role: null,
        loading: false,
      });
      
      // Attempt to sign out from Supabase
      await supabase.auth.signOut();
    } catch (error) {
      // Ignore errors - we're logging out anyway
      console.error('[Auth] Erro ao fazer logout:', error);
    } finally {
      // Always redirect to login
      navigate('/login', { replace: true });
    }
  };

  return {
    ...authState,
    signOut,
  };
};
