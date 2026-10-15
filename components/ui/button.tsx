'use client';

import * as React from 'react';
import { useFormStatus } from 'react-dom';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';

import { CircularLoader } from '@/components/ui/loader';
import { cn } from '@/lib/utils';

/**
 * Air 3 button (`.uw-btn`, styles/air3-components.css): 40px, 2px border, 8px corner, 14px/500,
 * colour-only hover, .96 press.
 * - primary: brand-green fill (one per view)
 * - secondary: green 2px outline + green label
 * - tertiary: gray outline + green label (quiet actions: cancel, copy, open)
 * - ghost: no border, hover wash (toolbar / inline actions)
 * - danger: red fill · link: green underline text
 */
const buttonVariants = cva('uw-btn shrink-0 [&_svg]:pointer-events-none', {
  variants: {
    variant: {
      primary: 'uw-btn--primary',
      secondary: 'uw-btn--secondary',
      tertiary: 'uw-btn--tertiary',
      ghost: 'border-transparent! bg-transparent text-foreground hover:bg-hover',
      danger: 'uw-btn--negative',
      link: 'uw-btn--link',
    },
    size: {
      default: '',
      sm: 'uw-btn--sm',
      lg: 'uw-btn--lg',
      icon: 'w-(--height-base) px-0!',
      'icon-sm': 'uw-btn--sm w-(--height-sm) px-0!',
    },
  },
  defaultVariants: { variant: 'tertiary', size: 'default' },
});

function Button({
  className,
  variant,
  size,
  asChild = false,
  type,
  disabled,
  children,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : 'button';
  const { pending } = useFormStatus();
  const showSpinner = !asChild && type === 'submit' && pending;

  return (
    <Comp
      data-slot="button"
      type={asChild ? undefined : (type ?? 'button')}
      disabled={asChild ? undefined : disabled || showSpinner}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {showSpinner && <CircularLoader className="size-3.5 border-current" />}
          {children}
        </>
      )}
    </Comp>
  );
}

export { Button, buttonVariants };
