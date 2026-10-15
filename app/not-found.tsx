import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-5 text-center">
      <h1>Not found</h1>
      <p className="text-muted-foreground text-sm">That page doesn&apos;t exist.</p>
      <Button asChild variant="primary">
        <Link href="/">Go home</Link>
      </Button>
    </div>
  );
}
