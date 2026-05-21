import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { Player } from '../types';
import { PlayerDetailContent } from './PlayerDetailContent';

export const PlayerDetailModal: React.FC<{
  player: Player;
  bundleSeason: string | null;
  leagueSeason: string | null;
  researchWeek?: number | null;
  ownershipMap?: Record<string, { owned: number; started?: number }>;
  onClose: () => void;
}> = ({
  player,
  bundleSeason,
  leagueSeason,
  researchWeek,
  ownershipMap,
  onClose,
}) => (
  <div
    className='fixed inset-0 z-9999 flex items-center justify-center bg-black/60 p-4'
    onClick={onClose}
    role='presentation'
  >
    <div
      className='relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-white/10 bg-[#0d1e2e] p-5 shadow-2xl'
      onClick={(e) => e.stopPropagation()}
      role='dialog'
      aria-modal='true'
      aria-labelledby='player-detail-modal-title'
    >
      <button
        type='button'
        className='btn-ghost absolute top-3 right-3 text-gray-400 hover:text-white'
        onClick={onClose}
        aria-label='Close player details'
      >
        <XMarkIcon className='h-5 w-5' />
      </button>

      <div id='player-detail-modal-title' className='sr-only'>
        Player details
      </div>

      <PlayerDetailContent
        player={player}
        bundleSeason={bundleSeason}
        leagueSeason={leagueSeason}
        researchWeek={researchWeek}
        ownershipMap={ownershipMap}
        showHeader
      />
    </div>
  </div>
);
