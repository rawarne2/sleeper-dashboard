import { Player } from '../../types';

/** Position pill (QB/RB/WR/…), styled via the `.player-chip-*` token colors. */
export function PositionBadge({
  position,
  className = '',
}: {
  position?: Player['position'];
  className?: string;
}) {
  const pos = position || 'DEF';
  return (
    <span className={`player-chip player-chip-${pos} ${className}`}>{position || 'N/A'}</span>
  );
}
