import type { PackIndex } from '@chess-open/core';
import { useTranslation } from 'react-i18next';

import { getPack, withPersonal } from '@/packs/registry';
import { useProgress } from '@/store/progress';

/** A shipped pack with the user's personal lines attached. */
export function usePack(id: string | undefined): PackIndex | null {
  const { t } = useTranslation();
  const custom = useProgress((s) => (id ? s.custom[id] : undefined));
  const base = id ? getPack(id) : null;
  return base ? withPersonal(base, custom, t('theory.myRepertoire')) : null;
}
