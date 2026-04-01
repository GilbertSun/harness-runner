import { readFile } from "node:fs/promises";
import Link from "next/link";
import type { ArtifactManifestEntry, ManualScore, RegistrySnapshot, RunEvent, RunRecord } from "@harness-runner/core";
import { getJson } from "../../../components/api";
import { ManualScoreForm } from "../../../components/manual-score-form";
import { MarkdownPreview } from "../../../components/markdown-preview";

interface RunDetails extends RunRecord {
  events: RunEvent[];
  manualScores: ManualScore[];
}

function renderPayload(payload: Record<string, unknown>) {
  return JSON.stringify(payload, null, 2);
}

function statusLabel(status: string) {
  return (
    {
      queued: "排队中",
      running: "运行中",
      succeeded: "成功",
      failed: "失败",
      cancelled: "已取消",
      completed: "已完成",
      pass: "通过",
      partial: "部分通过",
      fail: "失败",
    }[status] ?? status
  );
}

function eventTypeLabel(type: string) {
  return (
    {
      "run.queued": "运行已入队",
      "run.started": "运行已开始",
      "run.completed": "运行已完成",
      "run.failed": "运行失败",
      "run.cancelled": "运行已取消",
      log: "日志",
      "tool.call": "工具调用",
      "artifact.created": "工件已生成",
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
    <div className="stack" style={{ gap: 18 }}>
      <section className="hero">
        <span className="eyebrow">单次运行</span>
        <h1>{task?.title ?? run.id}</h1>
        <p>
          该页优先展示最终报告，其次再看执行过程。当前运行由{" "}
          <span className="mono">{agentVersion?.label ?? run.agentVersionId}</span> 完成，绑定 Profile{" "}
          <span className="mono">{profile?.name ?? run.profileVersionId}</span>。
        </p>
        <div className="badge-row">
          <span className={`status ${run.status}`}>{statusLabel(run.status)}</span>
          <span className="eyebrow">耗时 {run.durationMs ? `${Math.round(run.durationMs / 1000)} 秒` : "等待中"}</span>
          <Link className="button secondary" href="/">
            返回首页
          </Link>
        </div>
      </section>

      <section className="panel">
        <h2 className="section-title">最终报告</h2>
        {primaryArtifact ? (
          <div className="stack" style={{ gap: 12 }}>
            <div className="subtle">优先展示本次运行生成的主报告或转录内容。</div>
            {artifactPreview ? renderArtifactPreview(primaryArtifact, artifactPreview) : <pre className="log">{primaryArtifact.path}</pre>}
          </div>
        ) : (
          <p className="subtle">当前还没有生成最终报告。</p>
        )}
      </section>

      <section className="grid two">
        <article className="panel">
          <h2 className="section-title">任务与配置</h2>
          <div className="stack">
            <div className="card">
              <strong>任务提示词</strong>
              <p className="subtle" style={{ marginBottom: 0 }}>
                {task?.prompt ?? "未找到任务内容"}
              </p>
            </div>
            <div className="card">
              <strong>Profile</strong>
              <div className="subtle" style={{ marginTop: 8 }}>
                Skills：{profile?.skills.map((item) => item.name).join("、") || "未配置"}
              </div>
              <div className="subtle" style={{ marginTop: 6 }}>
                MCP：{profile?.mcpServers.map((item) => item.name).join("、") || "未配置"}
              </div>
              <div className="subtle" style={{ marginTop: 6 }}>
                环境变量引用：{profile?.envRefs.join("、") || "未配置"}
              </div>
            </div>
          </div>
        </article>

        <article className="panel">
          <h2 className="section-title">运行产物</h2>
          {run.summary?.finalArtifacts.length ? (
            <div className="stack">
              {run.summary.finalArtifacts.map((artifact) => (
                <div className="card" key={artifact.id}>
                  <div>
                    <strong>{artifact.name}</strong>
                  </div>
                  <div className="mono subtle">{artifact.path}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="subtle">当前还没有工件。</p>
          )}
        </article>
      </section>

      <section className="grid two">
        <article className="panel">
          <h2 className="section-title">运行信息</h2>
          <div className="stack">
            <div className="card">
              <strong>运行 ID</strong>
              <div className="mono subtle" style={{ marginTop: 8 }}>
                {run.id}
              </div>
            </div>
            <div className="card">
              <strong>工作目录</strong>
              <div className="mono subtle" style={{ marginTop: 8 }}>
                {run.workspacePath}
              </div>
            </div>
            <div className="card">
              <strong>执行摘要</strong>
              <div className="subtle" style={{ marginTop: 8 }}>
                工具调用记录：{run.summary?.toolUsageBySource.length ?? 0} 项
              </div>
              <div className="subtle" style={{ marginTop: 6 }}>
                输出工件：{run.summary?.finalArtifacts.length ?? 0} 个
              </div>
              <div className="subtle" style={{ marginTop: 6 }}>
                退出码：{run.exitCode ?? "未结束"}
              </div>
            </div>
          </div>
        </article>

        <article className="panel">
          <h2 className="section-title">内部标注</h2>
          <ManualScoreForm runId={run.id} />
          <div className="stack" style={{ marginTop: 16 }}>
            {run.manualScores.map((score) => (
              <div key={score.id} className="card">
                <div className={`status ${score.verdict}`}>{statusLabel(score.verdict)}</div>
                <div style={{ marginTop: 10 }}>
                  <strong>{score.score}</strong>
                </div>
                <p className="subtle" style={{ marginBottom: 0 }}>
                  {score.notes}
                </p>
              </div>
            ))}
            {run.manualScores.length === 0 ? <p className="subtle">当前还没有内部标注。</p> : null}
          </div>
        </article>
      </section>

      <section className="panel">
        <h2 className="section-title">事件时间线</h2>
        <div className="timeline">
          {run.events.map((event) => (
            <article key={event.id} className="timeline-item">
              <header>
                <strong>{eventTypeLabel(event.type)}</strong>
                <span className="subtle">{new Date(event.createdAt).toLocaleString()}</span>
              </header>
              <div className="subtle" style={{ marginBottom: 8 }}>
                来源：<span className="mono">{event.source}</span>
              </div>
              <pre className="log">{renderPayload(event.payload)}</pre>
            </article>
          ))}
        </div>
      </section>
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
  return <pre className="log">{content}</pre>;
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
