"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LoaderCircle, Play, Settings2, Sparkles } from "lucide-react";
import type { AgentVersion, ProfileVersion } from "@harness-runner/core";
import { getApiBase } from "./api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Separator } from "./ui/separator";
import { Textarea } from "./ui/textarea";
import { cn } from "../lib/utils";

interface CustomTaskRunnerProps {
  agentVersions: AgentVersion[];
  profileVersions: ProfileVersion[];
  latestSuiteRunId?: string;
}

export function CustomTaskRunner({
  agentVersions,
  profileVersions,
  latestSuiteRunId,
}: CustomTaskRunnerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("自定义运行");
  const [prompt, setPrompt] = useState("");
  const [checklist, setChecklist] = useState("");
  const [rubric, setRubric] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileVersionId, setProfileVersionId] = useState(profileVersions[0]?.id ?? "");
  const [selectedAgents, setSelectedAgents] = useState<string[]>(agentVersions[0] ? [agentVersions[0].id] : []);

  const sortedAgents = [...agentVersions].sort((left, right) => left.label.localeCompare(right.label, "zh-CN"));
  const sortedProfiles = [...profileVersions].sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));

  function toggleAgent(id: string) {
    setSelectedAgents((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  return (
    <form
      className="glass-panel overflow-hidden"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          setError(null);

          if (!prompt.trim()) {
            setError("先输入任务，再发起运行。");
            return;
          }

          if (selectedAgents.length === 0) {
            setError("至少选择一个 Runner。");
            return;
          }

          try {
            const taskResponse = await fetch(`${getApiBase()}/tasks`, {
              method: "POST",
              headers: {
                "content-type": "application/json",
              },
              body: JSON.stringify({
                title: title.trim() || "自定义运行",
                prompt: prompt.trim(),
                attachments: [],
                successChecklist: splitLines(checklist),
                manualRubric: splitLines(rubric),
              }),
            });

            if (!taskResponse.ok) {
              throw new Error("创建任务失败");
            }

            const task = (await taskResponse.json()) as { id: string; title: string };
            const suiteResponse = await fetch(`${getApiBase()}/suites`, {
              method: "POST",
              headers: {
                "content-type": "application/json",
              },
              body: JSON.stringify({
                name: `${task.title} - 报告组`,
                description: "由首页发起的一次多 Runner 运行。",
                taskIds: [task.id],
                agentVersionIds: selectedAgents,
                profileVersionId,
                concurrency: 1,
              }),
            });

            if (!suiteResponse.ok) {
              throw new Error("创建套件失败");
            }

            const suite = (await suiteResponse.json()) as { id: string };
            const suiteRunResponse = await fetch(`${getApiBase()}/suite-runs`, {
              method: "POST",
              headers: {
                "content-type": "application/json",
              },
              body: JSON.stringify({
                suiteSpecId: suite.id,
              }),
            });

            if (!suiteRunResponse.ok) {
              throw new Error("启动运行失败");
            }

            const suiteRun = (await suiteRunResponse.json()) as { id: string };
            router.push(`/compare/${suiteRun.id}`);
            router.refresh();
          } catch (requestError) {
            setError((requestError as Error).message);
          }
        });
      }}
    >
      <div className="flex items-center justify-between gap-3 border-b border-[color:var(--color-border)] px-5 py-4">
        <div className="flex items-center gap-2 text-sm text-[color:var(--color-muted-foreground)]">
          <Sparkles className="size-4 text-[color:var(--color-accent)]" />
          <span>输入一条任务，同时发给多个 Runner</span>
        </div>
        {latestSuiteRunId ? (
          <button
            className="text-sm text-[color:var(--color-muted-foreground)] transition hover:text-[color:var(--color-foreground)]"
            onClick={() => router.push(`/compare/${latestSuiteRunId}`)}
            type="button"
          >
            回到最近一次结果
          </button>
        ) : null}
      </div>

      <div className="space-y-5 p-5 md:p-6">
        <div className="space-y-3">
          <label className="block text-sm font-medium text-[color:var(--color-muted-foreground)]" htmlFor="prompt">
            任务描述
          </label>
          <Textarea
            className="composer-field min-h-[160px] text-base leading-8 placeholder:text-[color:var(--color-muted-foreground)] md:text-lg"
            id="prompt"
            name="prompt"
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="输入你希望多个 runner 一起完成的任务，例如：对比 Codex 和 Claude Code 对同一研究任务的交付质量，并给出最终推荐。"
            rows={6}
            value={prompt}
          />
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="space-y-3">
            <div className="text-sm font-medium text-[color:var(--color-muted-foreground)]">选择 Runner</div>
            <div className="flex flex-wrap gap-2">
              {sortedAgents.map((agentVersion) => {
                const selected = selectedAgents.includes(agentVersion.id);
                return (
                  <button
                    className={cn(
                      "runner-chip",
                      selected
                        ? "border-transparent bg-[color:var(--color-accent)] text-white shadow-[0_18px_40px_-24px_color-mix(in_oklch,var(--color-accent)_80%,transparent)]"
                        : "border-[color:var(--color-border)] bg-white/86 text-[color:var(--color-foreground)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent-strong)]",
                    )}
                    key={agentVersion.id}
                    onClick={() => toggleAgent(agentVersion.id)}
                    type="button"
                  >
                    <span>{agentVersion.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <label
                className="flex items-center gap-3 rounded-full border border-[color:var(--color-border)] bg-white/85 px-4 py-2 text-sm text-[color:var(--color-foreground)]"
                htmlFor="profileVersionId"
              >
                <span className="text-[color:var(--color-muted-foreground)]">Profile</span>
                <select
                  id="profileVersionId"
                  className="bg-transparent outline-none"
                  name="profileVersionId"
                  onChange={(event) => setProfileVersionId(event.target.value)}
                  value={profileVersionId}
                >
                  {sortedProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </label>

              <Button onClick={() => setAdvancedOpen((current) => !current)} type="button" variant="ghost">
                <Settings2 className="size-4" />
                高级设置
                <ChevronDown className={cn("size-4 transition", advancedOpen ? "rotate-180" : "")} />
              </Button>
            </div>

            <Button className="min-w-[168px]" disabled={pending} size="lg" type="submit">
              {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Play className="size-4" />}
              {pending ? "正在发起..." : "开始运行"}
            </Button>
          </div>

          {advancedOpen ? (
            <div className="grid gap-4 rounded-[28px] border border-[color:var(--color-border)] bg-white/58 p-4 md:grid-cols-2">
              <div className="space-y-4 md:col-span-2">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-[color:var(--color-muted-foreground)]">任务标题</span>
                  <Input id="title" name="title" onChange={(event) => setTitle(event.target.value)} value={title} />
                </label>
              </div>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-[color:var(--color-muted-foreground)]">补充要求</span>
                <Textarea
                  id="checklist"
                  name="checklist"
                  onChange={(event) => setChecklist(event.target.value)}
                  placeholder="每行一条，例如：\n需要总结 3 个方案\n需要给出推荐结论"
                  rows={5}
                  value={checklist}
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-[color:var(--color-muted-foreground)]">内部评审标准</span>
                <Textarea
                  id="rubric"
                  name="rubric"
                  onChange={(event) => setRubric(event.target.value)}
                  placeholder="每行一条，例如：\n论证是否准确\n输出是否清晰"
                  rows={5}
                  value={rubric}
                />
              </label>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
          ) : null}
        </div>
      </div>
    </form>
  );
}

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}
