import { CheckCircle2, PlugZap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { UpworkActions } from '@/features/upwork/components/upwork-actions';
import { status } from '@/features/upwork/upwork-mcp';
import { verifyAuth } from '@/lib/auth';

export async function UpworkSection({ notice, error }: { notice?: string; error?: string }) {
  await verifyAuth();
  const s = await status();

  return (
    <div className="flex flex-col gap-4">
      {notice === 'connected' ? (
        <div className="uw-alert uw-alert--success">
          <CheckCircle2 /> Upwork connected.
        </div>
      ) : null}
      {error ? <div className="uw-alert uw-alert--danger">{error}</div> : null}

      {s.connected ? (
        <div className="uw-card flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="uw-badge uw-badge--success">Connected</span>
            {s.connectedAt ? (
              <span className="text-muted-foreground text-sm">since {new Date(s.connectedAt).toLocaleDateString()}</span>
            ) : null}
          </div>
          <p className="text-sm">
            {s.tools.length} tools available:{' '}
            <span className="text-muted-foreground">{s.tools.map(t => t.name).join(', ') || 'none listed yet'}</span>
          </p>
          <UpworkActions />
        </div>
      ) : (
        <div className="uw-card flex flex-col gap-3">
          <p className="text-sm">
            Connect your Upwork account through Upwork&apos;s official MCP server to pull job posts, client stats, your
            profile, reviews and past proposals into proposals.
          </p>
          {s.oauthBase ? (
            <Button variant="primary" asChild className="self-start">
              <a href="/api/upwork/connect">
                <PlugZap /> Connect Upwork
              </a>
            </Button>
          ) : (
            <p className="uw-alert uw-alert--warning">
              Upwork needs a public https address for this app. Run <code>pnpm tunnel</code> in <code>web/</code>, then reload
              this page.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function UpworkSectionSkeleton() {
  return <Skeleton className="h-28 w-full rounded-lg" />;
}
