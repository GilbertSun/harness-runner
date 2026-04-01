import { readFile } from "node:fs/promises";
import Link from "next/link";
import type { ArtifactManifestEntry, CompareRow, RegistrySnapshot, RunRecord, SuiteRun } from "@harness-runner/core";
import { getJson } from "../../../components/api";
import { MarkdownPreview } from "../../../components/markdown-preview";

function statusLabel(status?: string) {
  return (
    {
      queued: "排队中",
      running: "运行中",
      succeeded: "成功",
      failed: "失败",
      cancelled: "已取消",
      completed: "已完成",
    }[status ?? ""] ?? status ?? "未知"
  );
}

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
    <div className="stack" style={{ gap: 18 }}>
      <section className="hero">
        <span className="eyebrow">报告组</span>
        <h1>{task?.title ?? suiteRunId}</h1>
        <p>
          这是同一任务发给多个 Agent 后收回的一组报告。这里优先看最终交付内容，底部再补充运行状态和过程入口。
        </p>
        <div className="badge-row">
          <span className={`status ${suiteRun?.status ?? "queued"}`}>{statusLabel(suiteRun?.status)}</span>
          <span className="eyebrow">Agent 数 {rows.length}</span>
          <Link className="button secondary" href="/">
            返回首页
          </Link>
        </div>
      </section>

      <section className="panel">
        <h2 className="section-title">发起内容</h2>
        <div className="grid two">
          <div className="card">
            <strong>提示词</strong>
            <p className="subtle" style={{ marginBottom: 0 }}>
              {task?.prompt ?? "未找到任务内容"}
            </p>
          </div>
          <div className="card">
            <strong>使用配置</strong>
            <div className="subtle" style={{ marginTop: 8 }}>
              Profile：{profile?.name ?? suiteRun?.profileVersionId ?? "未知"}
            </div>
            <div className="subtle" style={{ marginTop: 6 }}>
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
      </section>

      <section className="stack" style={{ gap: 16 }}>
        <h2 className="section-title" style={{ marginBottom: 0 }}>
          最终报告
        </h2>
        {reportCards.map(({ row, artifact, preview }) => (
          <article key={row.runId} className="panel">
            <div className="toolbar" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div className="eyebrow">{row.agentLabel}</div>
                <div className="subtle" style={{ marginTop: 10 }}>
                  状态：<span className={`status ${row.status}`}>{statusLabel(row.status)}</span>
                </div>
                <div className="subtle" style={{ marginTop: 6 }}>
                  耗时：{row.durationMs ? `${Math.round(row.durationMs / 1000)} 秒` : "等待中"}
                </div>
              </div>
              <div className="toolbar">
                <Link className="button secondary" href={`/runs/${row.runId}`}>
                  查看过程
                </Link>
              </div>
            </div>

            {artifact ? (
              <div className="stack" style={{ gap: 12, marginTop: 16 }}>
                <div className="subtle">
                  主报告文件：<span className="mono">{artifact.name}</span>
                </div>
                {preview ? renderArtifactPreview(artifact, preview) : <pre className="log">{artifact.path}</pre>}
              </div>
            ) : (
              <p className="subtle" style={{ marginTop: 16 }}>
                当前还没有生成主报告。
              </p>
            )}
          </article>
        ))}
      </section>

      <section className="panel">
        <h2 className="section-title">运行概览</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Agent</th>
                <th>状态</th>
                <th>耗时</th>
                <th>Profile 工具</th>
                <th>原生工具</th>
                <th>工件数</th>
                <th>运行详情</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.runId}>
                  <td>{row.agentLabel}</td>
                  <td>
                    <span className={`status ${row.status}`}>{statusLabel(row.status)}</span>
                  </td>
                  <td>{row.durationMs ? `${Math.round(row.durationMs / 1000)} 秒` : "等待中"}</td>
                  <td>{row.profileToolCalls}</td>
                  <td>{row.nativeToolCalls}</td>
                  <td>{row.artifactCount}</td>
                  <td>
                    <Link href={`/runs/${row.runId}`}>打开</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
    return content.length > 6000 ? `${content.slice(0, 6000)}\n\n...[内容已截断]` : content;
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
