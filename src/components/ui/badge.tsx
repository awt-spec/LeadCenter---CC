import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-sysde-red-light text-sysde-red',
        secondary: 'border-sysde-border bg-sysde-bg text-sysde-gray',
        success: 'border-transparent bg-green-50 text-success',
        warning: 'border-transparent bg-amber-50 text-warning',
        danger: 'border-transparent bg-red-50 text-danger',
        outline: 'border-sysde-border text-sysde-gray',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
