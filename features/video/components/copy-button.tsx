'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

/** Copies `text` (and optional `html`, for pasting a clickable GIF into email). */
export function CopyButton({
  text,
  html,
  label = 'Copy',
  variant = 'tertiary',
}: {
  text: string;
  html?: string;
  label?: string;
  variant?: 'primary' | 'secondary' | 'tertiary';
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      if (html && 'ClipboardItem' in window) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([text], { type: 'text/plain' }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Clipboard is blocked in this browser');
    }
  }

  return (
    <Button variant={variant} onClick={copy} aria-live="polite">
      {copied ? <Check /> : <Copy />}
      {copied ? 'Copied' : label}
    </Button>
  );
}
