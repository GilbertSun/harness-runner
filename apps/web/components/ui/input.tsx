import * as React from "react";
import { cn } from "../../lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-11 w-full rounded-2xl border border-[color:var(--color-border)] bg-white/85 px-4 py-2 text-sm text-[color:var(--color-foreground)] shadow-sm outline-none transition placeholder:text-[color:var(--color-muted-foreground)] focus:border-[color:var(--color-accent)] focus:ring-4 focus:ring-[color:var(--color-accent-soft)]",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

export { Input };
