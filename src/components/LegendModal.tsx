import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { STAT_DESCRIPTIONS } from '../utils/statDescriptions';

const POSITIONS = [
  { pos: 'QB', bg: 'bg-red-500', label: 'Quarterback' },
  { pos: 'RB', bg: 'bg-green-500', label: 'Running Back' },
  { pos: 'WR', bg: 'bg-blue-500', label: 'Wide Receiver' },
  { pos: 'TE', bg: 'bg-amber-500', label: 'Tight End' },
  { pos: 'K', bg: 'bg-purple-500', label: 'Kicker' },
  { pos: 'DEF', bg: 'bg-cyan-500', label: 'Defense' },
];

const OWNERSHIP_TIERS = [
  { color: 'text-green-300', range: '≥ 90%', label: 'Very High' },
  { color: 'text-blue-300', range: '65–89%', label: 'High' },
  { color: 'text-yellow-300', range: '30–64%', label: 'Mid' },
  { color: 'text-red-300', range: '8–29%', label: 'Low' },
  { color: 'text-gray-400', range: '< 8%', label: 'Fringe' },
];

export const LegendModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div
    className='fixed inset-0 z-9999 flex items-center justify-center p-4 bg-black/60'
    onClick={onClose}
  >
    <div
      className='relative bg-[#0d1e2e] border border-white/10 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5'
      onClick={(e) => e.stopPropagation()}
    >
      <button
        className='btn-ghost absolute top-3 right-3 text-gray-400 hover:text-white'
        onClick={onClose}
        aria-label='Close legend'
      >
        <XMarkIcon className='w-5 h-5' />
      </button>

      <h2 className='text-base sm:text-lg font-bold text-white mb-4'>Dashboard Legend</h2>

      <section className='mb-5'>
        <h3 className='text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2'>
          Team Stats
        </h3>
        <div className='grid grid-cols-1 gap-1.5'>
          {Object.entries(STAT_DESCRIPTIONS).map(([key, desc]) => (
            <div key={key} className='flex gap-2 text-xs sm:text-sm'>
              <span className='shrink-0 font-bold text-gray-100 w-10 text-right'>{key}</span>
              <span className='text-gray-300'>{desc}</span>
            </div>
          ))}
        </div>
      </section>

      <section className='mb-5'>
        <h3 className='text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2'>
          Position Colors
        </h3>
        <div className='flex flex-wrap gap-2'>
          {POSITIONS.map(({ pos, bg, label }) => (
            <div key={pos} className='flex items-center gap-1.5 text-xs sm:text-sm'>
              <span
                className={`${bg} text-white rounded-full px-2 py-0.5 font-medium text-xs min-w-[42px] text-center`}
              >
                {pos}
              </span>
              <span className='text-gray-300'>{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className='text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2'>
          Ownership % Colors
        </h3>
        <div className='flex flex-col gap-1'>
          {OWNERSHIP_TIERS.map(({ color, range, label }) => (
            <div key={range} className='flex items-center gap-2 text-xs sm:text-sm'>
              <span className={`${color} font-semibold tabular-nums w-14 shrink-0`}>
                {range}
              </span>
              <span className='text-gray-300'>{label}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  </div>
);
