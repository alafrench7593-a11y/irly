import { toast } from '@/components/ui/Toast';
import { useStore } from '@/state/store';

/**
 * Search, Discover and Communities follow the current destination. From a
 * Bali guide they must show Bali, so the app switches there, and says so
 * (a Dubai resident must not find their home feed silently changed).
 */
export function switchToBali(): void {
  const s = useStore.getState();
  if (s.cityId === 'bali') return;
  s.setCity('bali');
  toast('Now showing Bali. Switch back anytime from the destination menu', 'globe', 'brand');
}
