import * as React from 'react';

import { cn } from '@/lib/utils';

/** Air 3 textarea: base styles come from globals.css (40px control family, 8px, ink focus ring). */
function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return <textarea data-slot="textarea" className={cn('field-sizing-content min-h-24 resize-y', className)} {...props} />;
}

export { Textarea };
