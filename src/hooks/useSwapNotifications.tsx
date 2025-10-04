import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from './use-toast';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: Date;
}

export function useSwapNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!user) return;

    // Fetch initial pending swap requests
    const fetchPendingSwaps = async () => {
      const { data: swaps, error } = await supabase
        .from('swap_requests')
        .select(`
          *,
          requester:profiles!swap_requests_requester_id_fkey(name),
          target:profiles!swap_requests_target_id_fkey(name)
        `)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching swaps:', error);
        return;
      }

      if (swaps && swaps.length > 0) {
        const newNotifications: Notification[] = swaps.map((swap) => ({
          id: swap.id,
          title: 'Nova Solicitação de Troca',
          message: `${swap.requester?.name || 'Segurança'} solicitou troca de turno`,
          type: 'info' as const,
          read: false,
          createdAt: new Date(swap.created_at),
        }));
        setNotifications(newNotifications);
      }
    };

    fetchPendingSwaps();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('swap-requests-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'swap_requests',
        },
        async (payload) => {
          console.log('New swap request:', payload);
          
          // Fetch the requester's name
          const { data: profile } = await supabase
            .from('profiles')
            .select('name')
            .eq('user_id', payload.new.requester_id)
            .single();

          const notification: Notification = {
            id: payload.new.id,
            title: 'Nova Solicitação de Troca',
            message: `${profile?.name || 'Segurança'} solicitou troca de turno`,
            type: 'info',
            read: false,
            createdAt: new Date(payload.new.created_at),
          };

          setNotifications((prev) => [notification, ...prev]);

          // Show toast notification
          toast({
            title: '🔔 Nova Solicitação de Troca',
            description: notification.message,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'swap_requests',
        },
        (payload) => {
          console.log('Swap request updated:', payload);
          
          // Remove notification if swap is no longer pending
          if (payload.new.status !== 'PENDING') {
            setNotifications((prev) => prev.filter((n) => n.id !== payload.new.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return {
    notifications,
    markAsRead,
    markAllAsRead,
  };
}
