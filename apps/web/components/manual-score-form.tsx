"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getApiBase } from "./api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

export function ManualScoreForm({ runId }: { runId: string }) {
  const router = useRouter();
  const [score, setScore] = useState("80");
  const [verdict, setVerdict] = useState("pass");
  const [notes, setNotes] = useState("结构清晰，结论完整，证据质量可接受。");
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const response = await fetch(`${getApiBase()}/runs/${runId}/manual-score`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({
              score: Number(score),
              verdict,
              notes,
            }),
          });
          if (response.ok) {
            router.refresh();
          }
        });
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-2">
          <div className="text-sm font-medium text-[color:var(--color-muted-foreground)]">分数</div>
          <Input id="manual-score" name="manual-score" value={score} onChange={(event) => setScore(event.target.value)} />
        </label>
        <label className="block space-y-2">
          <div className="text-sm font-medium text-[color:var(--color-muted-foreground)]">结论</div>
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/85 px-4 py-2">
            <select
              id="manual-verdict"
              className="h-7 w-full bg-transparent text-sm outline-none"
              name="manual-verdict"
              value={verdict}
              onChange={(event) => setVerdict(event.target.value)}
            >
              <option value="pass">通过</option>
              <option value="partial">部分通过</option>
              <option value="fail">失败</option>
            </select>
          </div>
        </label>
      </div>
      <label className="block space-y-2">
        <div className="text-sm font-medium text-[color:var(--color-muted-foreground)]">备注</div>
        <Textarea id="manual-notes" name="manual-notes" rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      <Button disabled={pending} type="submit" variant="secondary">
        {pending ? "正在保存..." : "保存人工评分"}
      </Button>
    </form>
  );
}
