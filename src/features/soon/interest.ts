import { useCallback, useEffect, useState } from 'react';
import { useAccount } from '@/features/auth/account';
import { supabase } from '@/lib/supabase';
import type { SoonId } from './services';

/**
 * "Tell me when it opens", per service, stored on the member's account.
 * Signed out there is nothing to store: the page asks to sign in.
 * `enabled` false (an id the server does not accept yet): nothing is read
 * or written.
 */
export function useServiceInterest(id: SoonId, enabled = true) {
  const uid = useAccount()?.userId;
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase || !uid || !enabled) return;
    let alive = true;
    supabase
      .from('service_interest')
      .select('service')
      .eq('user_id', uid)
      .eq('service', id)
      .maybeSingle()
      .then(({ data }) => alive && setOn(Boolean(data)));
    return () => {
      alive = false;
    };
  }, [uid, id, enabled]);

  const toggle = useCallback(async () => {
    if (!supabase || !uid || busy || !enabled) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('set_service_interest', { p_service: id, p_on: !on });
      if (error) throw new Error(error.message);
      setOn(Boolean(data));
    } finally {
      setBusy(false);
    }
  }, [uid, id, on, busy, enabled]);

  return { signedIn: Boolean(uid), on, busy, toggle };
}
