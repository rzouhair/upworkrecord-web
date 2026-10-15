'use client';

import { useLayoutEffect, useRef, useState } from 'react';

// Upwork's proposal list shows the first two lines of the cover letter; the cut depends on width
// and font, not a fixed character count (~220–240 chars on desktop). Widths are the text column,
// tuned so a typical letter cuts in that range on desktop.
const WIDTHS = { Desktop: 780, Mobile: 340 } as const;
const TEXT = 'text-sm leading-5';

/** The client's proposals-list view of the cover letter: two lines, then "more". */
export function CoverLetterPreview({ text }: { text: string }) {
  const [device, setDevice] = useState<keyof typeof WIDTHS>('Desktop');
  const [visible, setVisible] = useState(0);
  const measure = useRef<HTMLParagraphElement>(null);
  const flat = text.replace(/\s+/g, ' ').trim();

  // Largest prefix that still fits in two lines at this width (binary search on a hidden twin).
  useLayoutEffect(() => {
    const el = measure.current;
    if (!el) return;
    el.textContent = 'x';
    const twoLines = el.offsetHeight * 2;
    let lo = 0;
    let hi = flat.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      el.textContent = `${flat.slice(0, mid)}… more`;
      if (el.offsetHeight <= twoLines) lo = mid;
      else hi = mid - 1;
    }
    setVisible(lo);
  }, [flat, device]);

  if (!flat) return null;
  const link = /https?:\/\/\S+\/v\/[\w-]+/.exec(flat)?.[0];
  const linkVisible = !!link && flat.indexOf(link) + link.length <= visible;
  const cut = visible < flat.length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">What the client sees in the proposals list</span>
        <div className="flex gap-2" role="group" aria-label="Preview width">
          {(Object.keys(WIDTHS) as (keyof typeof WIDTHS)[]).map(d => (
            <button
              key={d}
              type="button"
              className="uw-token uw-token--btn"
              aria-pressed={device === d}
              onClick={() => setDevice(d)}
            >
              {d}
            </button>
          ))}
        </div>
      </div>
      {/* Measured at the device width off-screen; shown wrapped to fit this column. */}
      <p ref={measure} aria-hidden className={`${TEXT} invisible fixed top-0 -left-[9999px]`} style={{ width: WIDTHS[device] }} />
      <div className="uw-card">
        <p className={TEXT}>
          {flat.slice(0, visible)}
          {cut ? (
            <>
              … <span className="text-brand font-medium">more</span>
            </>
          ) : null}
        </p>
      </div>
      {link ? (
        <p className={`text-xs font-medium ${linkVisible ? 'text-brand' : 'text-danger'}`}>
          {linkVisible
            ? '✓ The video link shows before "more".'
            : '✗ The video link is cut off here: shorten the opening or move the link up.'}
        </p>
      ) : null}
      <p className="text-muted-foreground text-xs">
        {cut
          ? `${visible} of ${flat.length} characters show before "more" at this width. Put the hook and the video link's promise in them.`
          : 'The whole cover letter fits in the preview.'}
      </p>
    </div>
  );
}
