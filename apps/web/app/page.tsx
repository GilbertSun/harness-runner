import Link from "next/link";
import type { RegistrySnapshot } from "@harness-runner/core";
import { getJson } from "../components/api";
import { CustomTaskRunner } from "../components/custom-task-runner";

function statusClass(status: string) {
  return `status ${status}`;
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
    }[status] ?? status
  );
}

function kindLabel(kind: string) {
  return kind === "service" ? "服务" : "命令行";
}

export default async function HomePage() {
  const snapshot = await getJson<RegistrySnapshot>("/snapshot");
  const latestSuiteRun = snapshot.suiteRuns.at(-1);

  return (
    <div className="stack" style={{ gap: 18 }}>
      <section className="hero">
        <span className="eyebrow">多 Agent 运行台</span>
        <h1>一次发起，多路运行，最后集中看报告。</h1>
        <p>
          这里更关心交付结果而不是评测分数。你可以为同一条提示词选择多个 Agent，同时绑定固定的 Profile，
          持久化保存 skills、MCP、环境变量引用和运行策略。每个 Agent 会生成自己的最终报告，运行过程也会被记录下来。
        </p>
        <div className="grid three">
          <div className="metric">
            <span className="subtle">Agent 版本数</span>
            <strong>{snapshot.agentVersions.length}</strong>
          </div>
          <div className="metric">
            <span className="subtle">Profile 数</span>
            <strong>{snapshot.profileVersions.length}</strong>
          </div>
          <div className="metric">
            <span className="subtle">运行次数</span>
            <strong>{snapshot.runs.length}</strong>
          </div>
        </div>
        <div className="toolbar">
          {latestSuiteRun ? (
            <Link className="button secondary" href={`/compare/${latestSuiteRun.id}`}>
              查看最近一组报告
            </Link>
          ) : null}
        </div>
      </section>

      <CustomTaskRunner
        agentVersions={snapshot.agentVersions}
        profileVersions={snapshot.profileVersions}
      />

      <section className="grid two">
        <article className="panel">
          <h2 className="section-title">Agent 注册表</h2>
          <div className="stack">
            {snapshot.agentDefinitions.map((agent) => (
              <div key={agent.id} className="card">
                <div className="eyebrow">{kindLabel(agent.kind)}</div>
                <h3 style={{ marginBottom: 8 }}>{agent.name}</h3>
                <p className="subtle" style={{ marginTop: 0 }}>
                  {agent.description || "暂无说明"}
                </p>
                <div className="mono subtle">适配器：{agent.adapterKey}</div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <h2 className="section-title">Profile 配置</h2>
          <div className="stack">
            {snapshot.profileVersions.map((profile) => (
              <div key={profile.id} className="card">
                <strong>{profile.name}</strong>
                <p className="subtle" style={{ margin: "8px 0 0" }}>
                  {profile.description || "暂无说明"}
                </p>
                <div className="subtle" style={{ marginTop: 10 }}>
                  Skills：{profile.skills.map((skill) => skill.name).join("、") || "未配置"}
                </div>
                <div className="subtle" style={{ marginTop: 6 }}>
                  MCP：{profile.mcpServers.map((server) => server.name).join("、") || "未配置"}
                </div>
                <div className="subtle" style={{ marginTop: 6 }}>
                  原生工具：{profile.toolPolicy.allowNativeTools ? "允许" : "禁用"}
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="toolbar" style={{ justifyContent: "space-between", marginBottom: 12 }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            最近报告
          </h2>
          {latestSuiteRun ? (
            <Link href={`/compare/${latestSuiteRun.id}`} className="button secondary">
              查看最近报告组
            </Link>
          ) : null}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>运行 ID</th>
                <th>状态</th>
                <th>任务</th>
                <th>Agent 版本</th>
                <th>耗时</th>
                <th>报告</th>
                <th>打开</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.runs
                .slice()
                .reverse()
                .map((run) => {
                  const task = snapshot.tasks.find((item) => item.id === run.taskSpecId);
                  const version = snapshot.agentVersions.find((item) => item.id === run.agentVersionId);
                  return (
                    <tr key={run.id}>
                      <td className="mono">{run.id}</td>
                      <td>
                        <span className={statusClass(run.status)}>{statusLabel(run.status)}</span>
                      </td>
                      <td>{task?.title ?? run.taskSpecId}</td>
                      <td>{version?.label ?? run.agentVersionId}</td>
                      <td>{run.durationMs ? `${Math.round(run.durationMs / 1000)} 秒` : "等待中"}</td>
                      <td>{run.summary?.finalArtifacts.length ? "已生成" : "未生成"}</td>
                      <td>
                        <Link href={`/runs/${run.id}`}>回放</Link>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
