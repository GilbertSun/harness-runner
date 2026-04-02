import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-all outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-[color:var(--color-accent)] px-5 py-2.5 text-white shadow-[0_18px_40px_-20px_color-mix(in_oklch,var(--color-accent)_70%,transparent)] hover:translate-y-[-1px] hover:bg-[color:var(--color-accent-strong)]",
        secondary:
          "bg-white/85 px-5 py-2.5 text-[color:var(--color-foreground)] ring-1 ring-[color:var(--color-border)] hover:bg-white",
        ghost:
          "px-3 py-2 text-[color:var(--color-muted-foreground)] hover:bg-white/70 hover:text-[color:var(--color-foreground)]",
        outline:
          "bg-transparent px-4 py-2.5 text-[color:var(--color-foreground)] ring-1 ring-[color:var(--color-border)] hover:bg-white/70",
      },
      size: {
        default: "h-11",
        sm: "h-9 px-3 text-xs",
        lg: "h-12 px-6 text-base",
        icon: "size-10 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return <button className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
