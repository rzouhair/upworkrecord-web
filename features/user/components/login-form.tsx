'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { signIn } from '@/features/user/user-actions';

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(signIn, undefined);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" autoFocus required />
      </div>
      {state?.error ? (
        <p role="alert" className="text-danger text-sm">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" variant="primary" size="lg" className="w-full">
        Sign in
      </Button>
    </form>
  );
}
