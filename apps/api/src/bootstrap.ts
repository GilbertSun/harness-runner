import { spawnSync } from "node:child_process";
import type { AgentDefinition, Repository } from "@harness-runner/core";

export async function ensureSeedData(repository: Repository): Promise<void> {
  const [agents, versions, profiles, tasks, suites] = await Promise.all([
    repository.listAgentDefinitions(),
    repository.listAgentVersions(),
    repository.listProfileVersions(),
    repository.listTasks(),
    repository.listSuites(),
  ]);

  if (agents.length === 0) {
    const definitions = [];
    for (const definition of getSeedAgentDefinitions()) {
      definitions.push(await repository.createAgentDefinition(definition));
    }

    for (const definition of definitions) {
      await repository.createAgentVersion({
        agentDefinitionId: definition.id,
        label: definition.adapterKey === "mock" ? "模拟研究 Agent@1.0.0" : `${definition.name}@1.0.0`,
        binaryVersion: "1.0.0",
        adapterVersion: "1.0.0",
        wrapperPrompt: "请严格围绕给定任务产出最终 Markdown 报告，保持结构清晰、结论明确，并说明你使用了哪些工具或能力。",
        defaultConfig: {
          model: definition.adapterKey === "mock" ? "mock-researcher" : "default",
        },
      });
    }
  }

  if (versions.length === 0 && agents.length > 0) {
    for (const definition of agents.filter((item) => isAdapterAvailable(item.adapterKey))) {
      await repository.createAgentVersion({
        agentDefinitionId: definition.id,
        label: definition.adapterKey === "mock" ? "模拟研究 Agent@1.0.0" : `${definition.name}@1.0.0`,
        binaryVersion: "1.0.0",
        adapterVersion: "1.0.0",
        wrapperPrompt: "请严格围绕给定任务产出最终 Markdown 报告，保持结构清晰、结论明确，并说明你使用了哪些工具或能力。",
        defaultConfig: {
          model: definition.adapterKey === "mock" ? "mock-researcher" : "default",
        },
      });
    }
  }

  if (profiles.length === 0) {
    await repository.createProfileVersion({
      name: "研究基线配置",
      description: "用于研究与报告类任务的基线 Profile，包含技能、MCP 元数据和运行策略。",
      skills: [
        {
          id: "summarize",
          name: "总结归纳",
          description: "将收集到的资料整理成结构清晰、带引用的简明答案。",
        },
      ],
      mcpServers: [
        {
          id: "web-search",
          name: "网页搜索 MCP",
          command: "web-search",
          args: ["serve"],
          env: {},
        },
      ],
      envRefs: ["OPENAI_API_KEY", "ANTHROPIC_API_KEY"],
      toolPolicy: {
        allowNativeTools: true,
        allowedDomains: ["*", "news.ycombinator.com"],
      },
      timeouts: {
        maxDurationMs: 900000,
        idleTimeoutMs: 120000,
      },
      networkPolicy: {
        mode: "standard",
      },
    });
  }

  if (tasks.length === 0) {
    await repository.createTask({
      title: "分析多 Agent Runner 的落地方案",
      category: "research",
      prompt:
        "请说明多 Agent Runner 应该如何组织发起端、运行端和报告展现层，并给出推荐方案与 3 个主要风险。",
      attachments: [],
      successChecklist: [
        "需要覆盖发起端、运行端和报告展现层",
        "需要给出明确推荐方案",
        "需要列出至少 3 个风险",
      ],
      manualRubric: [
        "架构权衡分析是否准确",
        "推荐方案是否具备可执行性",
        "表达是否清晰、结构是否完整",
      ],
    });
  }

  const nextTasks = tasks.length === 0 ? await repository.listTasks() : tasks;
  const smokeTask = nextTasks.find((item) => item.title === "本机 CLI 接入冒烟检查");
  if (!smokeTask) {
    await repository.createTask({
      title: "本机 CLI 接入冒烟检查",
      category: "research",
      prompt: "请只输出一份很短的中文 Markdown 报告，并在结尾单独写一行：SMOKE_OK。",
      attachments: [],
      successChecklist: [
        "必须返回中文 Markdown",
        "内容应当非常简短",
        "最后一行必须是 SMOKE_OK",
      ],
      manualRubric: [
        "是否正确跑通本机 CLI",
        "输出是否满足格式要求",
      ],
    });
  }

  if (suites.length === 0) {
    const [task] = await repository.listTasks();
    const [profile] = await repository.listProfileVersions();
    const currentAgentDefinitions = await repository.listAgentDefinitions();
    const mockAgentId = definitionsOrFallbackId(currentAgentDefinitions, "mock");
    const [agentVersion] = (await repository.listAgentVersions()).filter((item) => item.agentDefinitionId === mockAgentId);
    if (task && profile && agentVersion) {
      await repository.createSuite({
        name: "报告类冒烟运行",
        description: "用于验证多 Agent 运行和报告落盘链路是否正常的单任务运行组。",
        taskIds: [task.id],
        agentVersionIds: [agentVersion.id],
        profileVersionId: profile.id,
        concurrency: 1,
      });
    }
  }

  const currentSuites = suites.length === 0 ? await repository.listSuites() : suites;
  const currentTasks = smokeTask ? nextTasks : await repository.listTasks();
  const currentProfiles = profiles.length === 0 ? await repository.listProfileVersions() : profiles;
  const currentVersions = versions.length === 0 ? await repository.listAgentVersions() : versions;
  const currentAgents = agents.length === 0 ? await repository.listAgentDefinitions() : agents;

  const smokeTaskId = currentTasks.find((item) => item.title === "本机 CLI 接入冒烟检查")?.id;
  const smokeProfileId = currentProfiles[0]?.id;
  const smokeAgentVersionIds = currentVersions
    .filter((item) => {
      const definition = currentAgents.find((agent) => agent.id === item.agentDefinitionId);
      return definition ? definition.adapterKey === "codex" || definition.adapterKey === "claude-code" : false;
    })
    .map((item) => item.id);

  if (
    smokeTaskId &&
    smokeProfileId &&
    smokeAgentVersionIds.length > 0 &&
    !currentSuites.some((item) => item.name === "本机 CLI 冒烟运行")
  ) {
    await repository.createSuite({
      name: "本机 CLI 冒烟运行",
      description: "用于快速验证 Codex 和 Claude Code 在当前机器上的本地接入是否正常。",
      taskIds: [smokeTaskId],
      agentVersionIds: smokeAgentVersionIds,
      profileVersionId: smokeProfileId,
      concurrency: 1,
    });
  }
}

function definitionsOrFallbackId(
  agents: Awaited<ReturnType<Repository["listAgentDefinitions"]>>,
  adapterKey: string,
): string | undefined {
  return agents.find((item) => item.adapterKey === adapterKey)?.id;
}

function getSeedAgentDefinitions(): Array<Omit<AgentDefinition, "id" | "createdAt" | "updatedAt">> {
  const definitions: Array<Omit<AgentDefinition, "id" | "createdAt" | "updatedAt">> = [
    {
      name: "模拟研究 Agent",
      adapterKey: "mock",
      kind: "cli",
      description: "用于冒烟验证和界面联调的确定性模拟适配器。",
      installStrategy: "bundled",
      capabilities: ["streaming", "profile-awareness"],
    },
  ];

  if (isAdapterAvailable("codex")) {
    definitions.push({
      name: "OpenAI Codex CLI",
      adapterKey: "codex",
      kind: "cli",
      description: "通过 Codex 非交互适配器运行的短生命周期 CLI Agent。",
      installStrategy: "platform-managed binary",
      capabilities: ["streaming", "native-tools", "profile-awareness"],
    });
  }

  if (isAdapterAvailable("claude-code")) {
    definitions.push({
      name: "Claude Code",
      adapterKey: "claude-code",
      kind: "cli",
      description: "以无头模式运行的 Claude Code 执行适配器。",
      installStrategy: "platform-managed binary",
      capabilities: ["streaming", "native-tools", "profile-awareness"],
    });
  }

  if (isAdapterAvailable("deerflow")) {
    definitions.push({
      name: "DeerFlow",
      adapterKey: "deerflow",
      kind: "service",
      description: "本地或远端部署的 DeerFlow HTTP 服务适配器。",
      installStrategy: "platform-managed service",
      capabilities: ["streaming", "service-mode", "profile-awareness"],
    });
  }

  return definitions;
}

function isAdapterAvailable(adapterKey: string): boolean {
  if (adapterKey === "mock") {
    return true;
  }

  if (adapterKey === "codex") {
    return isCommandAvailable(process.env.CODEX_COMMAND ?? "codex");
  }

  if (adapterKey === "claude-code") {
    return isCommandAvailable(process.env.CLAUDE_CODE_COMMAND ?? "claude");
  }

  if (adapterKey === "deerflow") {
    return Boolean(process.env.DEERFLOW_ENDPOINT?.trim());
  }

  return false;
}

function isCommandAvailable(command: string): boolean {
  const result = spawnSync(command, ["--version"], {
    stdio: "ignore",
  });
  return !result.error;
}
