'use client';

import { useEffect, useEffectEvent, useState } from 'react';

/**
 * Hidden `<input type="file">` wired with a native `change` listener instead of React's
 * `onChange`. In e2e runs React occasionally didn't dispatch onChange for a file picked while a
 * server-action refresh was in flight (the native event did fire on the mounted input).
 * A native listener can't miss it. Returns `[attach, open]`: pass `attach` as the input's ref, call `open()` to show the picker.
 */
export function useFileInput(onFile: (file: File) => void) {
  const [input, setInput] = useState<HTMLInputElement | null>(null);
  const pick = useEffectEvent(onFile);

  useEffect(() => {
    if (!input) return;
    const listener = () => {
      const file = input.files?.[0];
      input.value = ''; // picking the same file again should fire again
      if (file) pick(file);
    };
    input.addEventListener('change', listener);
    return () => input.removeEventListener('change', listener);
  }, [input]);

  return [setInput, () => input?.click()] as const;
}
