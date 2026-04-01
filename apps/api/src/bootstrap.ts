import type { Repository } from "@harness-runner/core";

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
    definitions.push(
      await repository.createAgentDefinition({
        name: "模拟研究 Agent",
        adapterKey: "mock",
        kind: "cli",
        description: "用于冒烟验证和界面联调的确定性模拟适配器。",
        installStrategy: "bundled",
        capabilities: ["streaming", "profile-awareness"],
      }),
    );
    definitions.push(
      await repository.createAgentDefinition({
        name: "OpenAI Codex CLI",
        adapterKey: "codex",
        kind: "cli",
        description: "通过 Codex 非交互适配器运行的短生命周期 CLI Agent。",
        installStrategy: "platform-managed binary",
        capabilities: ["streaming", "native-tools", "profile-awareness"],
      }),
    );
    definitions.push(
      await repository.createAgentDefinition({
        name: "Claude Code",
        adapterKey: "claude-code",
        kind: "cli",
        description: "以无头模式运行的 Claude Code 执行适配器。",
        installStrategy: "platform-managed binary",
        capabilities: ["streaming", "native-tools", "profile-awareness"],
      }),
    );
    definitions.push(
      await repository.createAgentDefinition({
        name: "DeerFlow",
        adapterKey: "deerflow",
        kind: "service",
        description: "本地或远端部署的 DeerFlow HTTP 服务适配器。",
        installStrategy: "platform-managed service",
        capabilities: ["streaming", "service-mode", "profile-awareness"],
      }),
    );

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
    for (const definition of agents) {
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
}

function definitionsOrFallbackId(
  agents: Awaited<ReturnType<Repository["listAgentDefinitions"]>>,
  adapterKey: string,
): string | undefined {
  return agents.find((item) => item.adapterKey === adapterKey)?.id;
}
