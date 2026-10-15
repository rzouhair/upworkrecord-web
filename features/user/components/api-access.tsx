'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/features/video/components/copy-button';

export function ApiAccess({ baseUrl, token }: { baseUrl: string; token: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <div>
        <label htmlFor="api-url">Server URL</label>
        <div className="flex gap-2">
          <input id="api-url" readOnly value={baseUrl} />
          <CopyButton text={baseUrl} />
        </div>
      </div>
      <div>
        <label htmlFor="api-token">API token</label>
        <div className="flex gap-2">
          <input id="api-token" readOnly type={shown ? 'text' : 'password'} value={token} className="font-mono" />
          <Button variant="tertiary" size="icon" onClick={() => setShown(s => !s)} aria-label={shown ? 'Hide token' : 'Show token'}>
            {shown ? <EyeOff /> : <Eye />}
          </Button>
          <CopyButton text={token} />
        </div>
        <p className="text-muted-foreground mt-1 text-xs">Set in .env.local as API_TOKEN. Rotate it there if it leaks.</p>
      </div>
    </div>
  );
}
