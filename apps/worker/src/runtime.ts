import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ArtifactManifestEntry, Repository, RunContext, RunRecord } from "@harness-runner/core";
import { nowIso } from "@harness-runner/core";
import { ARTIFACTS_DIR, WORKSPACES_DIR } from "./config.js";
import { createAdapterRegistry } from "./adapters.js";

const execFileAsync = promisify(execFile);
const adapters = createAdapterRegistry();

export async function executeRun(repository: Repository, run: RunRecord): Promise<void> {
  const [task, profile, agentDefinition, agentVersion] = await Promise.all([
    repository.getTask(run.taskSpecId),
    repository.getProfileVersion(run.profileVersionId),
    repository.getAgentDefinition(run.agentDefinitionId),
    repository.getAgentVersion(run.agentVersionId),
  ]);

  if (!task || !profile || !agentDefinition || !agentVersion) {
    throw new Error(`Run ${run.id} is missing task, profile, or agent metadata`);
  }

  const adapter = adapters.get(agentDefinition.adapterKey);
  if (!adapter) {
    throw new Error(`No adapter registered for ${agentDefinition.adapterKey}`);
  }

  const workspacePath = join(WORKSPACES_DIR, run.id);
  const artifactsPath = join(ARTIFACTS_DIR, run.id);
  const compiledPrompt = buildCompiledPrompt(task, profile, agentVersion.wrapperPrompt);

  await prepareWorkspace(workspacePath, artifactsPath, task, profile, agentVersion.wrapperPrompt, compiledPrompt);

  await repository.updateRun(run.id, {
    status: "running",
    startedAt: nowIso(),
    workspacePath,
  });
  await repository.createRunEvent({
    runId: run.id,
    type: "run.started",
    source: "worker",
    payload: { workspacePath, adapterKey: agentDefinition.adapterKey },
  });

  const context: RunContext = {
    run: { ...run, workspacePath, status: "running", startedAt: nowIso() },
    task,
    profile,
    compiledPrompt,
    workspacePath,
    artifactsPath,
  };

  const validation = await adapter.validate(profile, task);
  if (!validation.ok) {
    throw new Error(validation.errors.join("; "));
  }

  const prepared = await adapter.prepareRun(context);
  const startedAt = Date.now();
  const emit = async (event: Parameters<Repository["createRunEvent"]>[0]): Promise<void> => {
    await repository.createRunEvent(event);
  };

  try {
    const result = await adapter.start(context, prepared, emit);
    const durationMs = Date.now() - startedAt;
    const artifacts = await finalizeArtifacts(repository, run.id, result.artifactManifest);
    await repository.updateRun(run.id, {
      status: result.exitCode === 0 ? "succeeded" : "failed",
      endedAt: nowIso(),
      durationMs,
      exitCode: result.exitCode,
      summary: {
        status: result.exitCode === 0 ? "succeeded" : "failed",
        durationMs,
        toolUsageBySource: summarizeToolUsage(await repository.listRunEvents(run.id)),
        finalArtifacts: artifacts,
      },
      errorMessage: result.exitCode === 0 ? undefined : `Process exited with code ${result.exitCode}`,
    });
    await repository.createRunEvent({
      runId: run.id,
      type: result.exitCode === 0 ? "run.completed" : "run.failed",
      source: "worker",
      payload: { exitCode: result.exitCode, durationMs },
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    await repository.updateRun(run.id, {
      status: "failed",
      endedAt: nowIso(),
      durationMs,
      errorMessage: (error as Error).message,
      summary: {
        status: "failed",
        durationMs,
        toolUsageBySource: summarizeToolUsage(await repository.listRunEvents(run.id)),
        finalArtifacts: [],
      },
    });
    await repository.createRunEvent({
      runId: run.id,
      type: "run.failed",
      source: "worker",
      payload: { errorMessage: (error as Error).message },
    });
  }
}

async function prepareWorkspace(
  workspacePath: string,
  artifactsPath: string,
  task: RunContext["task"],
  profile: RunContext["profile"],
  wrapperPrompt: string,
  compiledPrompt: string,
): Promise<void> {
  await mkdir(workspacePath, { recursive: true });
  await mkdir(artifactsPath, { recursive: true });
  await writeFile(join(workspacePath, "task.md"), task.prompt, "utf8");
  await writeFile(join(workspacePath, "profile.json"), JSON.stringify(profile, null, 2), "utf8");
  await writeFile(join(workspacePath, "wrapper-prompt.txt"), wrapperPrompt, "utf8");
  await writeFile(join(workspacePath, "run-prompt.md"), compiledPrompt, "utf8");

  for (const attachment of task.attachments) {
    if (attachment.inlineContent) {
      await writeFile(join(workspacePath, attachment.name), attachment.inlineContent, "utf8");
    }
  }

  try {
    await execFileAsync("git", ["init"], { cwd: workspacePath });
  } catch {
    // The workspace still works without Git; some agents may simply see a plain directory.
  }
}

async function finalizeArtifacts(
  repository: Repository,
  runId: string,
  artifacts: ArtifactManifestEntry[],
): Promise<ArtifactManifestEntry[]> {
  for (const artifact of artifacts) {
    await repository.createRunEvent({
      runId,
      type: "artifact.created",
      source: "worker",
      payload: {
        artifactId: artifact.id,
        name: artifact.name,
        path: artifact.path,
      },
    });
  }
  return artifacts;
}

function summarizeToolUsage(events: Awaited<ReturnType<Repository["listRunEvents"]>>) {
  const counts = new Map<string, { toolName: string; count: number; source: "agent-native" | "profile-provided" | "unknown" }>();
  for (const event of events) {
    if (event.type !== "tool.call") {
      continue;
    }
    const toolName = typeof event.payload.toolName === "string" ? event.payload.toolName : "unknown";
    const source =
      event.payload.toolSource === "agent-native" || event.payload.toolSource === "profile-provided"
        ? event.payload.toolSource
        : "unknown";
    const key = `${toolName}:${source}`;
    const current = counts.get(key);
    counts.set(key, {
      toolName,
      source,
      count: current ? current.count + 1 : 1,
    });
  }
  return [...counts.values()];
}

function buildCompiledPrompt(
  task: RunContext["task"],
  profile: RunContext["profile"],
  wrapperPrompt: string,
): string {
  const checklist =
    task.successChecklist.length > 0
      ? task.successChecklist.map((item) => `- ${item}`).join("\n")
      : "- 无额外补充要求";

  const skills =
    profile.skills.length > 0 ? profile.skills.map((item) => item.name).join("、") : "未配置";
  const mcpServers =
    profile.mcpServers.length > 0 ? profile.mcpServers.map((item) => item.name).join("、") : "未配置";

  return [
    wrapperPrompt.trim(),
    "",
    "你必须直接产出最终报告，不要输出 JSON、日志、思考过程或协议事件。",
    "最终答案必须是中文 Markdown，并且适合直接展示在 Web 页面中。",
    "请尽量使用以下结构：",
    "# 结论",
    "## 关键发现",
    "## 详细说明",
    "## 使用的工具与能力",
    "",
    `任务标题：${task.title}`,
    "",
    "任务说明：",
    task.prompt.trim(),
    "",
    "补充要求：",
    checklist,
    "",
    "本次运行绑定的 Profile 信息：",
    `- Skills：${skills}`,
    `- MCP：${mcpServers}`,
    `- 允许原生工具：${profile.toolPolicy.allowNativeTools ? "是" : "否"}`,
    "",
    "请只返回最终 Markdown 报告正文。",
  ].join("\n");
}
