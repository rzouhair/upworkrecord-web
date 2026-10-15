'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { updateVideoDetails } from '@/features/video/video-actions';

export function TitleEditor({ id, title }: { id: string; title: string }) {
  const [value, setValue] = useState(title);

  async function save() {
    const next = value.trim();
    if (next === title) return;
    const res = await updateVideoDetails(id, { title: next });
    if (!res.ok) {
      toast.error(res.error);
      setValue(title);
    }
  }

  return (
    <input
      aria-label="Video title"
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={e => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setValue(title);
          e.currentTarget.blur();
        }
      }}
      maxLength={120}
      // Reads as an Air 3 h4 until hovered/focused, then shows the control border.
      className="hover:border-input! -mx-3 h-auto! border-transparent! bg-transparent! py-1! text-[length:var(--font-size-h4)]! leading-[var(--line-height-h4)]! font-[550]! tracking-[var(--letter-spacing-h4)]"
    />
  );
}
