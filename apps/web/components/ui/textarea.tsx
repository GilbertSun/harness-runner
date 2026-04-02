import * as React from "react";
import { cn } from "../../lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[120px] w-full rounded-[24px] border border-[color:var(--color-border)] bg-white/85 px-4 py-3 text-sm text-[color:var(--color-foreground)] shadow-sm outline-none transition placeholder:text-[color:var(--color-muted-foreground)] focus:border-[color:var(--color-accent)] focus:ring-4 focus:ring-[color:var(--color-accent-soft)]",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export { Textarea };
