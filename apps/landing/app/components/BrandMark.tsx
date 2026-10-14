import type { CSSProperties } from 'react';

const MASK = 'url(/brand-mark.png) center / contain no-repeat';

/**
 * The MuscleOS mark with no tile behind it. The transparent mark is a mask filled with
 * the ink colour, so it reads on the translucent header in both themes.
 */
export function BrandMark({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 bg-ink ${className}`}
      style={{ mask: MASK, WebkitMask: MASK, ...style }}
    />
  );
}
