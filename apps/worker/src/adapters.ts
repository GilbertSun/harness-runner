import { writeFile } from "node:fs/promises";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { join } from "node:path";
import type {
  AgentAdapter,
  ArtifactManifestEntry,
  PreparedInvocation,
  ProfileVersion,
  RunContext,
  RunEvent,
  TaskSpec,
  ValidationResult,
} from "@harness-runner/core";

type Emit = (event: Omit<RunEvent, "id" | "createdAt" | "updatedAt">) => Promise<void>;

const activeChildren = new Map<string, ChildProcessWithoutNullStreams>();

abstract class BaseAdapter implements AgentAdapter {
  abstract readonly key: string;

  async probe() {
    return {
      supportsStreaming: true,
      supportsCancellation: true,
      supportsProfiles: true,
      supportsNativeTools: true,
    };
  }

  async validate(_profile: ProfileVersion, _task: TaskSpec): Promise<ValidationResult> {
    return { ok: true, errors: [] };
  }

  abstract prepareRun(context: RunContext): Promise<PreparedInvocation>;
  abstract start(context: RunContext, prepared: PreparedInvocation, emit: Emit): Promise<{
    exitCode: number;
    artifactManifest: ArtifactManifestEntry[];
  }>;

  async cancel(runId: string): Promise<void> {
    const child = activeChildren.get(runId);
    if (child) {
      child.kill("SIGTERM");
      activeChildren.delete(runId);
    }
  }

  protected async writeTextArtifact(
    path: string,
    content: string,
    artifact: Omit<ArtifactManifestEntry, "path">,
  ): Promise<ArtifactManifestEntry> {
    await writeFile(path, content, "utf8");
    return {
      ...artifact,
      path,
    };
  }

  protected async writeReport(path: string, content: string): Promise<ArtifactManifestEntry> {
    return this.writeTextArtifact(path, content, {
      id: "report",
      name: "最终报告.md",
      kind: "report",
    });
  }

  protected async writeTranscript(path: string, content: string): Promise<ArtifactManifestEntry> {
    return this.writeTextArtifact(path, content, {
      id: "transcript",
      name: "原始执行记录.txt",
      kind: "transcript",
    });
  }
}

export class MockResearchAdapter extends BaseAdapter {
  readonly key = "mock";

  async prepareRun(context: RunContext): Promise<PreparedInvocation> {
    return {
      mode: "process",
      command: "mock",
      args: [context.task.title],
      env: {},
    };
  }

  async start(context: RunContext, _prepared: PreparedInvocation, emit: Emit) {
    const reportPath = join(context.artifactsPath, "mock-report.md");
    const content = [
      `# ${context.task.title}`,
      "",
      "建议：优先采用统一的运行入口，由平台负责分发给不同 Agent，并把最终输出沉淀为标准报告。",
      "",
      "主要风险：",
      "1. 不同 Agent 的输出风格和能力边界不一致，报告结构需要额外收敛。",
      "2. 长驻服务和 CLI 混用时，运行环境与版本管理容易漂移。",
      "3. 如果报告与过程事件没有统一归档，后续排查问题会很困难。",
      "",
      `Profile：${context.profile.name}`,
      `是否允许原生工具：${context.profile.toolPolicy.allowNativeTools ? "是" : "否"}`,
    ].join("\n");

    await emit({
      runId: context.run.id,
      type: "log",
      source: "agent",
      payload: { message: "模拟适配器已启动" },
    });
    await emit({
      runId: context.run.id,
      type: "tool.call",
      source: "agent",
      payload: {
        toolName: "web_search",
        toolSource: "agent-native",
      },
    });
    return {
      exitCode: 0,
      artifactManifest: [await this.writeReport(reportPath, content)],
    };
  }
}

export class CliAgentAdapter extends BaseAdapter {
  constructor(readonly key: string, private readonly defaultCommand: string) {
    super();
  }

  async prepareRun(context: RunContext): Promise<PreparedInvocation> {
    return {
      mode: "process",
      command: resolveCommand(this.key, this.defaultCommand),
      args: buildCliArgs(this.key, context),
      env: {
        HARNESS_AGENT_KEY: this.key,
      },
    };
  }

  async validate(profile: ProfileVersion, task: TaskSpec): Promise<ValidationResult> {
    const errors: string[] = [];
    if (!profile.toolPolicy.allowNativeTools) {
      errors.push("当前 CLI 适配器默认要求允许 Agent 使用原生工具。");
    }
    if (task.prompt.length === 0) {
      errors.push("任务提示词不能为空。");
    }
    return { ok: errors.length === 0, errors };
  }

  async start(context: RunContext, prepared: PreparedInvocation, emit: Emit) {
    const command = prepared.command ?? this.defaultCommand;
    const args = prepared.args ?? buildCliArgs(this.key, context);
    const env = {
      ...process.env,
      ...(prepared.env ?? {}),
      HARNESS_RUN_ID: context.run.id,
      HARNESS_WORKSPACE: context.workspacePath,
    };

    const child = spawn(command, args, {
      cwd: context.workspacePath,
      env,
      stdio: "pipe",
    });
    activeChildren.set(context.run.id, child);

    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];

    child.stdout.on("data", async (chunk) => {
      const message = chunk.toString();
      stdoutChunks.push(message);
      await emit({
        runId: context.run.id,
        type: "log",
        source: "agent",
        payload: { stream: "stdout", message },
      });
      parsePotentialToolEvent(message, context.run.id, emit).catch(() => undefined);
    });

    child.stderr.on("data", async (chunk) => {
      const message = chunk.toString();
      stderrChunks.push(message);
      await emit({
        runId: context.run.id,
        type: "log",
        source: "agent",
        payload: { stream: "stderr", message },
      });
    });

    if (shouldSendPromptOverStdin(this.key, args)) {
      child.stdin.write(context.compiledPrompt);
    }
    child.stdin.end();

    const exitCode = await new Promise<number>((resolve, reject) => {
      child.on("error", reject);
      child.on("close", (code) => resolve(code ?? 1));
    });

    activeChildren.delete(context.run.id);

    const transcriptPath = join(context.artifactsPath, `${this.key}-transcript.txt`);
    const reportPath = join(context.artifactsPath, `${this.key}-report.md`);
    const combinedOutput = `${stdoutChunks.join("")}\n${stderrChunks.join("")}`.trim();
    const transcriptArtifact = await this.writeTranscript(transcriptPath, combinedOutput || "未捕获到输出内容");
    const reportArtifact = await this.writeReport(
      reportPath,
      normalizeMarkdownReport(extractMarkdownReport(this.key, combinedOutput, context.task.title), context.task.title),
    );
    return { exitCode, artifactManifest: [reportArtifact, transcriptArtifact] };
  }
}

export class DeerFlowServiceAdapter extends BaseAdapter {
  readonly key = "deerflow";

  async validate(_profile: ProfileVersion, task: TaskSpec): Promise<ValidationResult> {
    const errors: string[] = [];
    if (!process.env.DEERFLOW_ENDPOINT?.trim()) {
      errors.push("当前机器未配置 DEERFLOW_ENDPOINT，DeerFlow 服务适配器不可用。");
    }
    if (task.prompt.length === 0) {
      errors.push("任务提示词不能为空。");
    }
    return { ok: errors.length === 0, errors };
  }

  async prepareRun(context: RunContext): Promise<PreparedInvocation> {
    return {
      mode: "http",
      url: process.env.DEERFLOW_ENDPOINT?.trim(),
      body: {
        prompt: context.compiledPrompt,
        profile: context.profile,
      },
    };
  }

  async start(context: RunContext, prepared: PreparedInvocation, emit: Emit) {
    const response = await fetch(prepared.url!, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(prepared.body),
    });
    const payload = (await response.json()) as Record<string, unknown>;
    await emit({
      runId: context.run.id,
      type: "log",
      source: "adapter",
      payload: {
        message: "已收到 DeerFlow 服务返回结果",
        responseStatus: response.status,
      },
    });
    const reportPath = join(context.artifactsPath, "deerflow-report.md");
    const transcriptPath = join(context.artifactsPath, "deerflow-raw.json");
    const reportArtifact = await this.writeReport(
      reportPath,
      normalizeMarkdownReport(extractDeerFlowReport(payload), context.task.title),
    );
    const transcriptArtifact = await this.writeTextArtifact(
      transcriptPath,
      JSON.stringify(payload, null, 2),
      {
        id: "transcript",
        name: "原始服务响应.json",
        kind: "transcript",
      },
    );
    return {
      exitCode: response.ok ? 0 : 1,
      artifactManifest: [reportArtifact, transcriptArtifact],
    };
  }
}

async function parsePotentialToolEvent(message: string, runId: string, emit: Emit): Promise<void> {
  const lines = message.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) {
      continue;
    }
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      if (parsed.type === "tool.call" && typeof parsed.toolName === "string") {
        await emit({
          runId,
          type: "tool.call",
          source: "agent",
          payload: {
            toolName: parsed.toolName,
            toolSource: parsed.toolSource === "profile-provided" ? "profile-provided" : "agent-native",
          },
        });
      }
    } catch {
      continue;
    }
  }
}

function buildCliArgs(adapterKey: string, context: RunContext): string[] {
  if (adapterKey === "codex") {
    return ["exec", "--json", context.compiledPrompt];
  }
  if (adapterKey === "claude-code") {
    return buildClaudeCliArgs(context);
  }
  return [];
}

function resolveCommand(adapterKey: string, fallback: string): string {
  if (adapterKey === "codex") {
    return process.env.CODEX_COMMAND ?? fallback;
  }
  if (adapterKey === "claude-code") {
    return process.env.CLAUDE_CODE_COMMAND ?? fallback;
  }
  return fallback;
}

function buildClaudeCliArgs(context: RunContext): string[] {
  const args = [
    "-p",
    context.compiledPrompt,
    "--output-format",
    "stream-json",
    "--verbose",
    "--bare",
    "--disable-slash-commands",
    "--no-session-persistence",
    "--permission-mode",
    "dontAsk",
    "--append-system-prompt",
    buildClaudeExecutionPrompt(context.task),
  ];

  if (isSmokeTask(context.task)) {
    args.push("--tools", "");
  }

  return args;
}

function buildClaudeExecutionPrompt(task: TaskSpec): string {
  const lines = [
    "优先直接回答，除非任务明确要求，否则不要读取文件、不要搜索、不要调用任何工具。",
    "不要复述任务，不要解释你的计划，不要输出 thinking 或中间过程。",
    "如果可以在不读取工作区内容的前提下完成任务，就直接给出最终 Markdown 正文。",
  ];

  if (isSmokeTask(task)) {
    lines.push("这是连通性冒烟检查。禁止读取文件、禁止调用工具、禁止展开额外分析。");
    lines.push("输出必须很短，并且最后一行必须是 SMOKE_OK。");
  }

  return lines.join(" ");
}

function isSmokeTask(task: TaskSpec): boolean {
  const haystack = `${task.title}\n${task.prompt}\n${task.successChecklist.join("\n")}`.toLowerCase();
  return haystack.includes("smoke_ok") || haystack.includes("冒烟");
}

function shouldSendPromptOverStdin(adapterKey: string, args: string[]): boolean {
  if (adapterKey === "codex" || adapterKey === "claude-code") {
    return false;
  }
  return args.length === 0;
}

export function createAdapterRegistry(): Map<string, AgentAdapter> {
  return new Map<string, AgentAdapter>([
    ["mock", new MockResearchAdapter()],
    ["codex", new CliAgentAdapter("codex", "codex")],
    ["claude-code", new CliAgentAdapter("claude-code", "claude")],
    ["deerflow", new DeerFlowServiceAdapter()],
  ]);
}

function extractMarkdownReport(adapterKey: string, transcript: string, taskTitle: string): string {
  const extracted =
    adapterKey === "codex"
      ? extractCodexReport(transcript)
      : adapterKey === "claude-code"
        ? extractClaudeReport(transcript)
        : transcript.trim();

  if (extracted) {
    return extracted;
  }

  return [
    `# ${taskTitle}`,
    "",
    "## 运行结果",
    "本次运行没有抽取到结构化报告，请查看原始执行记录。",
    "",
    "## 原始输出摘录",
    "```text",
    transcript.trim().slice(0, 4000) || "无输出",
    "```",
  ].join("\n");
}

function extractCodexReport(transcript: string): string {
  let report = "";
  for (const line of transcript.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) {
      continue;
    }
    try {
      const parsed = JSON.parse(trimmed) as {
        type?: string;
        item?: { type?: string; text?: string };
      };
      if (parsed.type === "item.completed" && parsed.item?.type === "agent_message" && parsed.item.text) {
        report = parsed.item.text.trim();
      }
    } catch {
      continue;
    }
  }
  return report;
}

function extractClaudeReport(transcript: string): string {
  for (const line of transcript.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) {
      continue;
    }
    try {
      const parsed = JSON.parse(trimmed) as {
        type?: string;
        result?: string;
        message?: { content?: Array<{ type?: string; text?: string }> };
      };
      if (parsed.type === "result" && typeof parsed.result === "string" && parsed.result.trim()) {
        return parsed.result.trim();
      }
      if (parsed.type === "assistant" && Array.isArray(parsed.message?.content)) {
        const text = parsed.message.content
          .filter((item) => item.type === "text" && typeof item.text === "string")
          .map((item) => item.text ?? "")
          .join("\n")
          .trim();
        if (text) {
          return text;
        }
      }
    } catch {
      continue;
    }
  }
  return "";
}

function extractDeerFlowReport(payload: Record<string, unknown>): string {
  if (typeof payload.report === "string" && payload.report.trim()) {
    return payload.report.trim();
  }
  if (typeof payload.markdown === "string" && payload.markdown.trim()) {
    return payload.markdown.trim();
  }
  return [
    "# DeerFlow 结果",
    "",
    "```json",
    JSON.stringify(payload, null, 2),
    "```",
  ].join("\n");
}

function normalizeMarkdownReport(content: string, taskTitle: string): string {
  const normalized = content.trim();
  if (!normalized) {
    return `# ${taskTitle}\n\n未生成可展示的报告。`;
  }

  if (/^\s*#/.test(normalized)) {
    return normalized;
  }

  return [
    `# ${taskTitle}`,
    "",
    "## 最终报告",
    normalized,
  ].join("\n");
}
