import type { ReactNode } from "react";
import { readFile } from "node:fs/promises";
import Link from "next/link";
import type { ArtifactManifestEntry, ManualScore, RegistrySnapshot, RunEvent, RunRecord } from "@harness-runner/core";
import { ArrowLeft, Boxes, FileStack, FolderKanban, TimerReset } from "lucide-react";
import { getJson } from "../../../components/api";
import { ManualScoreForm } from "../../../components/manual-score-form";
import { MarkdownPreview } from "../../../components/markdown-preview";
import { StatusPill } from "../../../components/status-pill";
import { buttonVariants } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { cn } from "../../../lib/utils";

interface RunDetails extends RunRecord {
  events: RunEvent[];
  manualScores: ManualScore[];
}

function renderPayload(payload: Record<string, unknown>) {
  return JSON.stringify(payload, null, 2);
}

function eventTypeLabel(type: string) {
  return (
    {
      "run.queued": "运行已入队",
      "run.started": "运行开始",
      "run.completed": "运行完成",
      "run.failed": "运行失败",
      "run.cancelled": "运行取消",
      log: "日志输出",
      "tool.call": "工具调用",
      "artifact.created": "生成工件",
      metric: "指标",
      heartbeat: "心跳",
    }[type] ?? type
  );
}

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [run, snapshot] = await Promise.all([
    getJson<RunDetails>(`/runs/${id}`),
    getJson<RegistrySnapshot>("/snapshot"),
  ]);

  const primaryArtifact = pickPrimaryArtifact(run);
  const artifactPreview = primaryArtifact ? await readArtifactPreview(primaryArtifact.path) : null;
  const task = snapshot.tasks.find((item) => item.id === run.taskSpecId);
  const profile = snapshot.profileVersions.find((item) => item.id === run.profileVersionId);
  const agentVersion = snapshot.agentVersions.find((item) => item.id === run.agentVersionId);

  return (
    <div className="space-y-6">
      <section className="glass-panel p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-4">
            <div className="kicker">单次运行回放</div>
            <div className="space-y-3">
              <h1 className="hero-title max-w-4xl text-3xl md:text-5xl">{task?.title ?? run.id}</h1>
              <p className="max-w-3xl text-sm leading-7 text-[color:var(--color-muted-foreground)] md:text-base">
                先看最终报告，再根据需要下钻到事件流、工件和内部评分。这个页面是单个 Runner 的完整回放视图。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={run.status} />
              <Badge variant="secondary">{agentVersion?.label ?? run.agentVersionId}</Badge>
              <Badge variant="outline">{profile?.name ?? run.profileVersionId}</Badge>
            </div>
          </div>

          <Link className={cn(buttonVariants({ variant: "secondary" }), "shrink-0")} href="/">
            <ArrowLeft className="size-4" />
            返回首页
          </Link>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <Card>
            <CardHeader>
              <CardTitle>运行摘要</CardTitle>
              <CardDescription>这次运行的执行器、耗时和工作区信息。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-[color:var(--color-muted-foreground)]">
              <SummaryRow icon={<TimerReset className="size-4" />} label="耗时" value={run.durationMs ? `${Math.round(run.durationMs / 1000)} 秒` : "等待中"} />
              <SummaryRow icon={<Boxes className="size-4" />} label="工件数" value={String(run.summary?.finalArtifacts.length ?? 0)} />
              <SummaryRow icon={<FileStack className="size-4" />} label="退出码" value={String(run.exitCode ?? "未结束")} />
              <SummaryRow icon={<FolderKanban className="size-4" />} label="工作区" value={run.workspacePath} mono />
              <SummaryRow label="运行 ID" value={run.id} mono />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>任务与 Profile</CardTitle>
              <CardDescription>本次运行继承的上下文和配置。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-[24px] border border-[color:var(--color-border)] bg-white/74 p-4">
                <div className="mb-2 text-sm font-medium text-[color:var(--color-muted-foreground)]">任务提示词</div>
                <p className="text-sm leading-7">{task?.prompt ?? "未找到任务内容"}</p>
              </div>
              <div className="rounded-[24px] border border-[color:var(--color-border)] bg-white/74 p-4 text-sm leading-7 text-[color:var(--color-muted-foreground)]">
                <div>Skills：{profile?.skills.map((item) => item.name).join("、") || "未配置"}</div>
                <div>MCP：{profile?.mcpServers.map((item) => item.name).join("、") || "未配置"}</div>
                <div>环境变量引用：{profile?.envRefs.join("、") || "未配置"}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>人工评分</CardTitle>
              <CardDescription>补充内部评审结果。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ManualScoreForm runId={run.id} />
              {run.manualScores.map((score) => (
                <div key={score.id} className="rounded-[24px] border border-[color:var(--color-border)] bg-white/74 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <StatusPill status={score.verdict} />
                    <div className="font-display text-2xl tracking-[-0.04em]">{score.score}</div>
                  </div>
                  <p className="text-sm leading-7 text-[color:var(--color-muted-foreground)]">{score.notes}</p>
                </div>
              ))}
              {run.manualScores.length === 0 ? <p className="subtle">当前还没有内部标注。</p> : null}
            </CardContent>
          </Card>
        </aside>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>最终报告</CardTitle>
              <CardDescription>优先展示主报告，其次回退到转录或其他工件。</CardDescription>
            </CardHeader>
            <CardContent>
              {primaryArtifact ? (
                artifactPreview ? (
                  renderArtifactPreview(primaryArtifact, artifactPreview)
                ) : (
                  <pre className="event-log">{primaryArtifact.path}</pre>
                )
              ) : (
                <div className="rounded-[24px] border border-dashed border-[color:var(--color-border)] bg-white/62 px-4 py-10 text-center text-sm text-[color:var(--color-muted-foreground)]">
                  当前还没有生成最终报告。
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>运行产物</CardTitle>
              <CardDescription>当前运行写入的所有最终工件。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {run.summary?.finalArtifacts.length ? (
                run.summary.finalArtifacts.map((artifact) => (
                  <div key={artifact.id} className="rounded-[24px] border border-[color:var(--color-border)] bg-white/74 p-4">
                    <div className="font-medium">{artifact.name}</div>
                    <div className="mt-2 break-all font-mono text-xs leading-6 text-[color:var(--color-muted-foreground)]">
                      {artifact.path}
                    </div>
                  </div>
                ))
              ) : (
                <p className="subtle md:col-span-2">当前还没有工件。</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>事件时间线</CardTitle>
              <CardDescription>保留原始执行过程，便于排查和验证。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {run.events.map((event) => (
                <article
                  key={event.id}
                  className="rounded-[26px] border border-[color:var(--color-border)] bg-white/76 p-4"
                >
                  <header className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="font-semibold tracking-[-0.02em]">{eventTypeLabel(event.type)}</div>
                    <div className="text-sm text-[color:var(--color-muted-foreground)]">
                      {new Date(event.createdAt).toLocaleString()}
                    </div>
                  </header>
                  <div className="mb-3 text-sm text-[color:var(--color-muted-foreground)]">
                    来源：<span className="font-mono">{event.source}</span>
                  </div>
                  <pre className="event-log">{renderPayload(event.payload)}</pre>
                </article>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({
  icon,
  label,
  value,
  mono = false,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-[22px] border border-[color:var(--color-border)] bg-white/72 p-4">
      <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-[color:var(--color-muted-foreground)]">
        {icon}
        {label}
      </div>
      <div className={cn("break-all text-sm leading-7 text-[color:var(--color-foreground)]", mono && "font-mono text-xs")}>
        {value}
      </div>
    </div>
  );
}

async function readArtifactPreview(path: string): Promise<string | null> {
  try {
    const content = await readFile(path, "utf8");
    if (path.endsWith(".md")) {
      return content;
    }
    return content.length > 8000 ? `${content.slice(0, 8000)}\n\n...[内容已截断]` : content;
  } catch {
    return null;
  }
}

function renderArtifactPreview(artifact: ArtifactManifestEntry, content: string) {
  if (isMarkdownArtifact(artifact)) {
    return <MarkdownPreview content={content} />;
  }
  return <pre className="event-log">{content}</pre>;
}

function pickPrimaryArtifact(run: RunRecord) {
  if (!run.summary?.finalArtifacts.length) {
    return undefined;
  }
  return (
    run.summary.finalArtifacts.find((artifact) => artifact.kind === "report") ??
    run.summary.finalArtifacts.find((artifact) => artifact.kind === "transcript") ??
    run.summary.finalArtifacts[0]
  );
}

function isMarkdownArtifact(artifact: ArtifactManifestEntry) {
  return artifact.kind === "report" || artifact.path.endsWith(".md");
}
