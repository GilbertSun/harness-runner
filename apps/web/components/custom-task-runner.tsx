"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AgentVersion, ProfileVersion } from "@harness-runner/core";
import { getApiBase } from "./api";

interface CustomTaskRunnerProps {
  agentVersions: AgentVersion[];
  profileVersions: ProfileVersion[];
}

export function CustomTaskRunner({ agentVersions, profileVersions }: CustomTaskRunnerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("自定义运行");
  const [prompt, setPrompt] = useState("");
  const [checklist, setChecklist] = useState("");
  const [rubric, setRubric] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [profileVersionId, setProfileVersionId] = useState(profileVersions[0]?.id ?? "");
  const [selectedAgents, setSelectedAgents] = useState<string[]>(
    agentVersions[0] ? [agentVersions[0].id] : [],
  );

  const sortedAgents = useMemo(
    () => [...agentVersions].sort((left, right) => left.label.localeCompare(right.label, "zh-CN")),
    [agentVersions],
  );

  const sortedProfiles = useMemo(
    () => [...profileVersions].sort((left, right) => left.name.localeCompare(right.name, "zh-CN")),
    [profileVersions],
  );

  function toggleAgent(id: string) {
    setSelectedAgents((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  return (
    <div className="panel">
      <div className="toolbar" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h2 className="section-title" style={{ marginBottom: 8 }}>
            发起运行
          </h2>
          <p className="subtle" style={{ margin: 0 }}>
            直接输入提示词，选择 Profile 和 Agent。系统会为这次请求生成一组运行，并汇总展示每个 Agent 的最终报告。
          </p>
        </div>
      </div>

      <form
        className="form"
        style={{ marginTop: 18 }}
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(async () => {
            setError(null);

            if (!prompt.trim()) {
              setError("提示词不能为空。");
              return;
            }

            if (selectedAgents.length === 0) {
              setError("至少选择一个 Agent。");
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
                  description: "由首页发起的一次多 Agent 运行。",
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
        <div className="grid two">
          <label>
            <div className="subtle">任务标题</div>
            <input value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label>
            <div className="subtle">Profile</div>
            <select value={profileVersionId} onChange={(event) => setProfileVersionId(event.target.value)}>
              {sortedProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label>
          <div className="subtle">提示词</div>
          <textarea
            rows={7}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="输入你希望 Agent 完成的任务提示词"
          />
        </label>

        <div className="grid two">
          <label>
            <div className="subtle">补充要求，可选</div>
            <textarea
              rows={5}
              value={checklist}
              onChange={(event) => setChecklist(event.target.value)}
              placeholder="每行一条，例如：\n需要总结 3 个方案\n需要给出推荐结论"
            />
          </label>
          <label>
            <div className="subtle">内部评审标准，可选</div>
            <textarea
              rows={5}
              value={rubric}
              onChange={(event) => setRubric(event.target.value)}
              placeholder="每行一条，例如：\n论证是否准确\n输出是否清晰"
            />
          </label>
        </div>

        <div>
          <div className="subtle" style={{ marginBottom: 10 }}>
            选择 Agent
          </div>
          <div className="stack">
            {sortedAgents.map((agentVersion) => (
              <label
                key={agentVersion.id}
                className="card"
                style={{ display: "flex", alignItems: "center", gap: 12, padding: 14 }}
              >
                <input
                  type="checkbox"
                  checked={selectedAgents.includes(agentVersion.id)}
                  onChange={() => toggleAgent(agentVersion.id)}
                />
                <div>
                  <strong>{agentVersion.label}</strong>
                  <div className="subtle">adapter 版本：{agentVersion.adapterVersion}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {error ? <div className="status failed">{error}</div> : null}

        <div className="toolbar">
          <button className="button" disabled={pending} type="submit">
            {pending ? "正在创建并启动..." : "开始运行并生成报告"}
          </button>
        </div>
      </form>
    </div>
  );
}

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}
