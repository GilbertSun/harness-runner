import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium tracking-[0.01em]",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent-strong)]",
        secondary:
          "border-[color:var(--color-border)] bg-white/80 text-[color:var(--color-muted-foreground)]",
        outline:
          "border-[color:var(--color-border)] bg-transparent text-[color:var(--color-foreground)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
