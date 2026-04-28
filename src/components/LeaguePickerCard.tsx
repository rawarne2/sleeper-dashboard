import React, { useState } from 'react';
import { TrophyIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { API_CONFIG } from '../apiConfig';

const { EXAMPLE_LEAGUES, EXAMPLE_LEAGUE_ID } = API_CONFIG;
const LEAGUE_ID_PATTERN = /^\d{10,24}$/;

interface LeaguePickerCardProps {
  titleId: string;
  description: React.ReactNode;
  onSelect: (leagueId: string) => void;
  onClose?: () => void;
}

export const LeaguePickerCard: React.FC<LeaguePickerCardProps> = ({
  titleId,
  description,
  onSelect,
  onClose,
}) => {
  const [customId, setCustomId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customId.trim();
    if (!LEAGUE_ID_PATTERN.test(trimmed)) {
      setError('Enter a numeric Sleeper league ID (10–24 digits).');
      return;
    }
    setError(null);
    onSelect(trimmed);
  };

  return (
    <div
      className='relative w-full max-w-md rounded-xl border border-gray-500/40 bg-[#0f1729] p-6 shadow-2xl ring-1 ring-white/10'
      onClick={(e) => e.stopPropagation()}
    >
      {onClose ? (
        <button
          type='button'
          className='btn-ghost absolute top-3 right-3 text-gray-400 hover:text-white'
          onClick={onClose}
          aria-label='Close without changing league'
        >
          <XMarkIcon className='w-5 h-5' />
        </button>
      ) : null}

      <div className={`mb-4 flex items-center justify-center gap-2 ${onClose ? 'pr-8' : ''}`}>
        <TrophyIcon className='h-8 w-8 shrink-0 text-primary-main' />
        <h1 id={titleId} className='text-lg font-semibold sm:text-xl'>
          Sleeper Dynasty Dashboard
        </h1>
      </div>

      <div className='mb-4 text-sm text-gray-400'>{description}</div>

      <section className='mb-5'>
        <p className='mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400'>
          Example Dynasty Superflex Seasons
        </p>
        <div className='flex flex-wrap gap-2'>
          {EXAMPLE_LEAGUES.map((l) => (
            <button
              key={l.id}
              type='button'
              onClick={() => onSelect(l.id)}
              className='flex-1 min-w-[5rem] rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-gray-100 transition-colors hover:border-primary-main hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-primary-main'
            >
              {l.label}
            </button>
          ))}
        </div>
      </section>

      <form onSubmit={handleCustomSubmit} className='flex flex-col gap-2'>
        <label htmlFor='custom-league-id-input' className='text-xs font-semibold uppercase tracking-wider text-gray-400'>
          Or enter your own league ID
        </label>
        <div className='flex gap-2'>
          <input
            id='custom-league-id-input'
            type='text'
            inputMode='numeric'
            autoComplete='off'
            placeholder={EXAMPLE_LEAGUE_ID}
            value={customId}
            onChange={(ev) => {
              setCustomId(ev.target.value);
              setError(null);
            }}
            className='flex-1 min-w-0 rounded-lg border border-gray-500 bg-gray-800 px-3 py-2.5 font-mono text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-main'
          />
          <button
            type='submit'
            className='rounded-lg bg-primary-main px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-primary-main focus:ring-offset-2 focus:ring-offset-[#0f1729]'
          >
            Load
          </button>
        </div>
        {error ? <p className='text-sm text-red-400'>{error}</p> : null}
      </form>
    </div>
  );
};
