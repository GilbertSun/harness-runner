"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getApiBase } from "./api";

export function ManualScoreForm({ runId }: { runId: string }) {
  const router = useRouter();
  const [score, setScore] = useState("80");
  const [verdict, setVerdict] = useState("pass");
  const [notes, setNotes] = useState("结构清晰，结论完整，证据质量可接受。");
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="form"
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
      <div className="grid two">
        <label>
          <div className="subtle">分数</div>
          <input value={score} onChange={(event) => setScore(event.target.value)} />
        </label>
        <label>
          <div className="subtle">结论</div>
          <select value={verdict} onChange={(event) => setVerdict(event.target.value)}>
            <option value="pass">通过</option>
            <option value="partial">部分通过</option>
            <option value="fail">失败</option>
          </select>
        </label>
      </div>
      <label>
        <div className="subtle">备注</div>
        <textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      <button className="button secondary" disabled={pending} type="submit">
        {pending ? "正在保存..." : "保存人工评分"}
      </button>
    </form>
  );
}
