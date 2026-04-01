"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { getApiBase } from "./api";

export function LaunchSuiteButton({ suiteId }: { suiteId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      className="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const response = await fetch(`${getApiBase()}/suite-runs`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({ suiteSpecId: suiteId }),
          });
          if (response.ok) {
            const payload = (await response.json()) as { id: string };
            router.push(`/compare/${payload.id}`);
            router.refresh();
          }
        })
      }
    >
      {pending ? "正在加入运行队列..." : "运行套件"}
    </button>
  );
}
