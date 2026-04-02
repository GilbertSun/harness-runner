import { Badge } from "./ui/badge";
import { cn } from "../lib/utils";

const LABELS: Record<string, string> = {
  queued: "排队中",
  running: "运行中",
  succeeded: "成功",
  failed: "失败",
  cancelled: "已取消",
  completed: "已完成",
  pass: "通过",
  partial: "部分通过",
  fail: "失败",
};

const STATUS_STYLES: Record<string, string> = {
  queued: "border-amber-200 bg-amber-50 text-amber-700",
  running: "border-sky-200 bg-sky-50 text-sky-700",
  succeeded: "border-emerald-200 bg-emerald-50 text-emerald-700",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  failed: "border-rose-200 bg-rose-50 text-rose-700",
  cancelled: "border-slate-200 bg-slate-100 text-slate-600",
  pass: "border-emerald-200 bg-emerald-50 text-emerald-700",
  partial: "border-amber-200 bg-amber-50 text-amber-700",
  fail: "border-rose-200 bg-rose-50 text-rose-700",
};

export function StatusPill({ status, className }: { status?: string; className?: string }) {
  const key = status ?? "queued";

  return (
    <Badge
      variant="secondary"
      className={cn(
        "border px-3 py-1 text-xs font-semibold",
        STATUS_STYLES[key] ?? "border-slate-200 bg-slate-100 text-slate-600",
        className,
      )}
    >
      {LABELS[key] ?? key}
    </Badge>
  );
}
