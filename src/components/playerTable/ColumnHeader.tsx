import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useId,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

export type HeaderAlign = 'left' | 'center' | 'right';
export type SortDirection = 'asc' | 'desc' | null;

interface ColumnHeaderProps {
  /** Short text rendered in the header cell. */
  label: ReactNode;
  /** Full wording (+ optional one-line description) shown on hover/tap. */
  tooltip?: string;
  align?: HeaderAlign;
  /** Visual weight: `group` for spanning group labels, `leaf` for columns. */
  variant?: 'group' | 'leaf';
  className?: string;
  /** When set, the header becomes a sort control (used by All Players). */
  sortable?: boolean;
  sortDirection?: SortDirection;
  onSort?: () => void;
}

const ALIGN_CLASS: Record<HeaderAlign, string> = {
  left: 'justify-start text-left',
  center: 'justify-center text-center',
  right: 'justify-end text-right',
};

/**
 * Table header label with a hover (desktop) + tap (mobile) + focus tooltip.
 *
 * The tooltip renders through a portal with fixed positioning so it is not
 * clipped by the table's horizontal-scroll container, and closes on scroll,
 * resize, outside click, or Escape. Optionally doubles as a sort control.
 */
export function ColumnHeader({
  label,
  tooltip,
  align = 'center',
  variant = 'leaf',
  className = '',
  sortable = false,
  sortDirection = null,
  onSort,
}: ColumnHeaderProps) {
  const triggerRef = useRef<HTMLElement | null>(null);
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const tipId = useId();

  const open = (hovered || pinned) && !!tooltip;

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setCoords({ top: r.bottom + 8, left: r.left + r.width / 2 });
  }, []);

  // Reposition while open; dismiss on scroll/resize/Escape so the tip never
  // detaches from a header that has moved under it.
  useEffect(() => {
    if (!open) return;
    place();
    const dismiss = () => {
      setPinned(false);
      setHovered(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, place]);

  // Outside-tap closes a pinned tooltip.
  useEffect(() => {
    if (!pinned) return;
    const onDown = (e: PointerEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setPinned(false);
      }
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [pinned]);

  const handleClick = () => {
    if (sortable && onSort) onSort();
    if (tooltip) setPinned((p) => !p);
  };

  const sortGlyph =
    sortDirection === 'asc' ? '▲' : sortDirection === 'desc' ? '▼' : sortable ? '↕' : '';

  const interactive = sortable || !!tooltip;
  const Tag: 'button' | 'span' = interactive ? 'button' : 'span';

  return (
    <>
      <Tag
        ref={triggerRef as never}
        type={interactive ? 'button' : undefined}
        onClick={interactive ? handleClick : undefined}
        onMouseEnter={() => tooltip && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => tooltip && setHovered(true)}
        onBlur={() => setHovered(false)}
        aria-describedby={open ? tipId : undefined}
        className={`btn-ghost lbl inline-flex w-full items-center gap-1 leading-tight text-ink-mid ${
          ALIGN_CLASS[align]
        } ${variant === 'group' ? '!text-[12px]' : '!text-[11px]'} ${
          interactive ? 'cursor-help hover:text-ink' : ''
        } ${sortDirection ? 'text-ink-hi' : ''} ${className}`}
      >
        <span className='truncate'>{label}</span>
        {sortGlyph && (
          <span className={`shrink-0 text-[8px] ${sortDirection ? 'text-cons' : 'text-ink-dim'}`}>
            {sortGlyph}
          </span>
        )}
      </Tag>
      {open &&
        coords &&
        createPortal(
          <div
            id={tipId}
            role='tooltip'
            style={{ top: coords.top, left: coords.left }}
            className='pointer-events-none fixed z-[10000] -translate-x-1/2 rounded-md border border-line-strong bg-surface-overlay px-2.5 py-1.5 text-center text-xs font-normal normal-case tracking-normal text-ink shadow-lg'
          >
            <span className='block max-w-[15rem] leading-snug'>{tooltip}</span>
          </div>,
          document.body
        )}
    </>
  );
}
