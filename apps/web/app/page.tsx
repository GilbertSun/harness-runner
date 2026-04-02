import Link from "next/link";
import type { RegistrySnapshot } from "@harness-runner/core";
import { ArrowRight, Bot, Clock3, Layers3, Sparkles } from "lucide-react";
import { getJson } from "../components/api";
import { CustomTaskRunner } from "../components/custom-task-runner";
import { StatusPill } from "../components/status-pill";
import { Badge } from "../components/ui/badge";
import { buttonVariants } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { cn } from "../lib/utils";

export default async function HomePage() {
  const snapshot = await getJson<RegistrySnapshot>("/snapshot");
  const latestSuiteRun = snapshot.suiteRuns.at(-1);
  const latestRuns = snapshot.runs.slice().reverse().slice(0, 6);
  const profile = snapshot.profileVersions[0];

  return (
    <div className="space-y-6 md:space-y-8">
      <section className="glass-panel mesh-panel overflow-hidden">
        <div className="relative px-5 py-8 md:px-10 md:py-12">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
          <div className="mx-auto max-w-5xl space-y-8">
            <div className="space-y-5 text-center">
              <div className="flex justify-center">
                <div className="kicker">
                  <Sparkles className="size-3.5" />
                  Report-first Runner Workspace
                </div>
              </div>
              <h1 className="hero-title mx-auto max-w-4xl">
                一个输入框发起任务，多个 Runner 同时执行，回来直接看最终报告。
              </h1>
              <p className="mx-auto max-w-3xl text-base leading-8 text-[color:var(--color-muted-foreground)] md:text-lg">
                交互方式参考 ChatGPT 和 Gemini 的首页体验，把发起任务这件事做得更直接；而运行流程、事件流和报告结果，
                则收敛到更专注的结果页里。
              </p>
            </div>

            <div className="mx-auto max-w-4xl">
              <CustomTaskRunner
                agentVersions={snapshot.agentVersions}
                latestSuiteRunId={latestSuiteRun?.id}
                profileVersions={snapshot.profileVersions}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <MetricCard label="可用 Runner" value={String(snapshot.agentVersions.length)} />
              <MetricCard label="Profile 数量" value={String(snapshot.profileVersions.length)} />
              <MetricCard label="累计运行" value={String(snapshot.runs.length)} />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(320px,1fr)]">
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>最近运行</CardTitle>
              <CardDescription>最近发起的任务会在这里快速回看。点击任一条可以进入回放或报告组页面。</CardDescription>
            </div>
            {latestSuiteRun ? (
              <Link className={cn(buttonVariants({ variant: "secondary" }), "shrink-0")} href={`/compare/${latestSuiteRun.id}`}>
                查看最近报告组
              </Link>
            ) : null}
          </CardHeader>
          <CardContent className="grid gap-3">
            {latestRuns.map((run) => {
              const task = snapshot.tasks.find((item) => item.id === run.taskSpecId);
              const version = snapshot.agentVersions.find((item) => item.id === run.agentVersionId);
              return (
                <Link
                  className="group rounded-[24px] border border-[color:var(--color-border)] bg-white/72 p-4 transition hover:border-[color:var(--color-accent)] hover:bg-white"
                  href={`/runs/${run.id}`}
                  key={run.id}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <StatusPill status={run.status} />
                        <span className="text-xs uppercase tracking-[0.14em] text-[color:var(--color-muted-foreground)]">
                          {version?.label ?? run.agentVersionId}
                        </span>
                      </div>
                      <div className="text-base font-semibold tracking-[-0.02em]">{task?.title ?? run.taskSpecId}</div>
                      <div className="subtle flex items-center gap-2">
                        <Clock3 className="size-4" />
                        {run.durationMs ? `${Math.round(run.durationMs / 1000)} 秒` : "等待中"}
                        <span className="text-slate-300">/</span>
                        <span className="font-mono text-xs">{run.id}</span>
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-2 text-sm font-medium text-[color:var(--color-muted-foreground)] transition group-hover:text-[color:var(--color-accent-strong)]">
                      打开回放
                      <ArrowRight className="size-4" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>可用 Runners</CardTitle>
              <CardDescription>当前这台机器能直接发起的执行器。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {snapshot.agentDefinitions.map((agent) => (
                <div
                  className="rounded-[24px] border border-[color:var(--color-border)] bg-white/70 p-4"
                  key={agent.id}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex size-9 items-center justify-center rounded-full bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent-strong)]">
                      <Bot className="size-4" />
                    </div>
                    <div className="font-semibold tracking-[-0.02em]">{agent.name}</div>
                  </div>
                  <div className="subtle">{agent.description || "暂无说明"}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="secondary">{agent.kind === "service" ? "服务" : "CLI"}</Badge>
                    <Badge variant="outline">{agent.adapterKey}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>当前 Profile</CardTitle>
              <CardDescription>发起页面默认使用的基线配置。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-lg font-semibold tracking-[-0.02em]">{profile?.name ?? "未配置"}</div>
                <p className="subtle mt-2">{profile?.description ?? "当前还没有可用 Profile。"}</p>
              </div>
              <div className="rounded-[24px] border border-[color:var(--color-border)] bg-white/70 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                  <Layers3 className="size-4 text-[color:var(--color-accent)]" />
                  Skills & MCP
                </div>
                <div className="space-y-2 text-sm text-[color:var(--color-muted-foreground)]">
                  <div>Skills：{profile?.skills.map((skill) => skill.name).join("、") || "未配置"}</div>
                  <div>MCP：{profile?.mcpServers.map((server) => server.name).join("、") || "未配置"}</div>
                  <div>原生工具：{profile?.toolPolicy.allowNativeTools ? "允许" : "禁用"}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-white/70 bg-white/62 px-5 py-4 shadow-[0_18px_50px_-36px_rgba(31,38,88,0.35)] backdrop-blur-xl">
      <div className="text-sm text-[color:var(--color-muted-foreground)]">{label}</div>
      <div className="mt-2 font-display text-4xl font-semibold tracking-[-0.05em]">{value}</div>
    </div>
  );
}
