import { readFile } from "node:fs/promises";
import Link from "next/link";
import type { ArtifactManifestEntry, CompareRow, RegistrySnapshot, RunRecord, SuiteRun } from "@harness-runner/core";
import { ArrowLeft, Clock3, FileSearch, Layers3 } from "lucide-react";
import { getJson } from "../../../components/api";
import { MarkdownPreview } from "../../../components/markdown-preview";
import { StatusPill } from "../../../components/status-pill";
import { buttonVariants } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { cn } from "../../../lib/utils";

export default async function ComparePage({ params }: { params: Promise<{ suiteRunId: string }> }) {
  const { suiteRunId } = await params;
  const [rows, suiteRuns, snapshot] = await Promise.all([
    getJson<CompareRow[]>(`/compare?suiteRunId=${suiteRunId}`),
    getJson<SuiteRun[]>("/suite-runs"),
    getJson<RegistrySnapshot>("/snapshot"),
  ]);

  const suiteRun = suiteRuns.find((item) => item.id === suiteRunId);
  const firstRow = rows[0];
  const task = snapshot.tasks.find((item) => item.id === firstRow?.taskId);
  const profile = suiteRun ? snapshot.profileVersions.find((item) => item.id === suiteRun.profileVersionId) : undefined;
  const reportCards = await Promise.all(
    rows.map(async (row) => {
      const run = snapshot.runs.find((item) => item.id === row.runId);
      const artifact = pickPrimaryArtifact(run);
      return {
        row,
        artifact,
        preview: artifact ? await readArtifactPreview(artifact.path) : null,
      };
    }),
  );

  return (
    <div className="space-y-6">
      <section className="glass-panel p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-4">
            <div className="kicker">报告对比视图</div>
            <div className="space-y-3">
              <h1 className="hero-title max-w-4xl text-3xl md:text-5xl">{task?.title ?? suiteRunId}</h1>
              <p className="max-w-3xl text-sm leading-7 text-[color:var(--color-muted-foreground)] md:text-base">
                这是同一条任务发给多个 Runner 后回收的一组结果。页面先展示最终报告，再补充运行状态和过程入口。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={suiteRun?.status} />
              <Badge variant="secondary">Runner 数 {rows.length}</Badge>
              <Badge variant="outline">{profile?.name ?? suiteRun?.profileVersionId ?? "未知 Profile"}</Badge>
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
              <CardTitle>任务摘要</CardTitle>
              <CardDescription>这组运行共享的提示词和 Profile。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-[24px] border border-[color:var(--color-border)] bg-white/74 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[color:var(--color-muted-foreground)]">
                  <FileSearch className="size-4 text-[color:var(--color-accent)]" />
                  提示词
                </div>
                <p className="text-sm leading-7">{task?.prompt ?? "未找到任务内容"}</p>
              </div>
              <div className="rounded-[24px] border border-[color:var(--color-border)] bg-white/74 p-4 text-sm leading-7 text-[color:var(--color-muted-foreground)]">
                <div className="mb-2 flex items-center gap-2 font-medium text-[color:var(--color-foreground)]">
                  <Layers3 className="size-4 text-[color:var(--color-accent)]" />
                  Profile
                </div>
                <div>名称：{profile?.name ?? "未知"}</div>
                <div>Skills：{profile?.skills.map((item) => item.name).join("、") || "未配置"}</div>
                <div>MCP：{profile?.mcpServers.map((item) => item.name).join("、") || "未配置"}</div>
                <div>环境变量引用：{profile?.envRefs.join("、") || "未配置"}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>运行概览</CardTitle>
              <CardDescription>快速比较状态、时长和工件数。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {rows.map((row) => (
                <div key={row.runId} className="rounded-[24px] border border-[color:var(--color-border)] bg-white/74 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold">{row.agentLabel}</div>
                    <StatusPill status={row.status} />
                  </div>
                  <div className="space-y-1 text-sm text-[color:var(--color-muted-foreground)]">
                    <div className="flex items-center gap-2">
                      <Clock3 className="size-4" />
                      {row.durationMs ? `${Math.round(row.durationMs / 1000)} 秒` : "等待中"}
                    </div>
                    <div>原生工具：{row.nativeToolCalls}</div>
                    <div>Profile 工具：{row.profileToolCalls}</div>
                    <div>工件数：{row.artifactCount}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>

        <div className="space-y-6">
          {reportCards.map(({ row, artifact, preview }) => (
            <Card key={row.runId}>
              <CardHeader className="flex-row items-start justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{row.agentLabel}</Badge>
                    <StatusPill status={row.status} />
                  </div>
                  <div className="text-sm text-[color:var(--color-muted-foreground)]">
                    {row.durationMs ? `${Math.round(row.durationMs / 1000)} 秒` : "等待中"} / 工件 {row.artifactCount}
                  </div>
                </div>
                <Link className={cn(buttonVariants({ variant: "secondary" }), "shrink-0")} href={`/runs/${row.runId}`}>
                  查看过程
                </Link>
              </CardHeader>
              <CardContent className="space-y-4">
                {artifact ? (
                  <>
                    <div className="text-sm text-[color:var(--color-muted-foreground)]">
                      主报告文件：<span className="font-mono">{artifact.name}</span>
                    </div>
                    {preview ? renderArtifactPreview(artifact, preview) : <pre className="event-log">{artifact.path}</pre>}
                  </>
                ) : (
                  <div className="rounded-[24px] border border-dashed border-[color:var(--color-border)] bg-white/62 px-4 py-10 text-center text-sm text-[color:var(--color-muted-foreground)]">
                    当前还没有生成主报告。
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
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
    return content.length > 6000 ? `${content.slice(0, 6000)}\n\n...[内容已截断]` : content;
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

function pickPrimaryArtifact(run?: RunRecord) {
  if (!run?.summary?.finalArtifacts.length) {
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
