import type {
  AgentDefinition,
  AgentVersion,
  ManualScore,
  ProfileVersion,
  SuiteSpec,
  TaskSpec,
} from "@harness-runner/core";

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function parseAgentDefinition(input: unknown): Omit<AgentDefinition, "id" | "createdAt" | "updatedAt"> {
  invariant(isRecord(input), "agent definition body must be an object");
  invariant(typeof input.name === "string", "agent definition name is required");
  invariant(typeof input.adapterKey === "string", "agent definition adapterKey is required");
  invariant(input.kind === "cli" || input.kind === "service", "agent definition kind must be cli or service");
  return {
    name: input.name,
    adapterKey: input.adapterKey,
    kind: input.kind,
    description: asString(input.description),
    installStrategy: asString(input.installStrategy),
    capabilities: asStringArray(input.capabilities),
  };
}

export function parseAgentVersion(input: unknown): Omit<AgentVersion, "id" | "createdAt" | "updatedAt"> {
  invariant(isRecord(input), "agent version body must be an object");
  invariant(typeof input.agentDefinitionId === "string", "agentDefinitionId is required");
  invariant(typeof input.label === "string", "label is required");
  invariant(typeof input.binaryVersion === "string", "binaryVersion is required");
  invariant(typeof input.adapterVersion === "string", "adapterVersion is required");
  invariant(typeof input.wrapperPrompt === "string", "wrapperPrompt is required");
  return {
    agentDefinitionId: input.agentDefinitionId,
    label: input.label,
    binaryVersion: input.binaryVersion,
    adapterVersion: input.adapterVersion,
    wrapperPrompt: input.wrapperPrompt,
    defaultConfig: isRecord(input.defaultConfig) ? asStringMap(input.defaultConfig) : {},
  };
}

export function parseProfileVersion(input: unknown): Omit<ProfileVersion, "id" | "createdAt" | "updatedAt"> {
  invariant(isRecord(input), "profile version body must be an object");
  invariant(typeof input.name === "string", "profile name is required");
  return {
    name: input.name,
    description: asString(input.description),
    skills: Array.isArray(input.skills) ? input.skills.map((skill, index) => parseSkill(skill, index)) : [],
    mcpServers: Array.isArray(input.mcpServers) ? input.mcpServers.map((server, index) => parseMcp(server, index)) : [],
    envRefs: asStringArray(input.envRefs),
    toolPolicy: {
      allowNativeTools: Boolean(isRecord(input.toolPolicy) && input.toolPolicy.allowNativeTools),
      allowedDomains: isRecord(input.toolPolicy) ? asStringArray(input.toolPolicy.allowedDomains) : [],
    },
    timeouts: {
      maxDurationMs: asNumber(isRecord(input.timeouts) ? input.timeouts.maxDurationMs : undefined, 900000),
      idleTimeoutMs: asNumber(isRecord(input.timeouts) ? input.timeouts.idleTimeoutMs : undefined, 120000),
    },
    networkPolicy: {
      mode: isRecord(input.networkPolicy) && input.networkPolicy.mode === "standard" ? "standard" : "restricted",
    },
  };
}

export function parseTask(input: unknown): Omit<TaskSpec, "id" | "createdAt" | "updatedAt"> {
  invariant(isRecord(input), "task body must be an object");
  invariant(typeof input.title === "string", "task title is required");
  invariant(typeof input.prompt === "string", "task prompt is required");
  return {
    title: input.title,
    category: "research",
    prompt: input.prompt,
    attachments: Array.isArray(input.attachments)
      ? input.attachments.map((attachment, index) => {
          invariant(isRecord(attachment), `attachment ${index} must be an object`);
          invariant(typeof attachment.id === "string", `attachment ${index} id is required`);
          invariant(typeof attachment.name === "string", `attachment ${index} name is required`);
          invariant(typeof attachment.contentType === "string", `attachment ${index} contentType is required`);
          return {
            id: attachment.id,
            name: attachment.name,
            contentType: attachment.contentType,
            inlineContent: typeof attachment.inlineContent === "string" ? attachment.inlineContent : undefined,
            filePath: typeof attachment.filePath === "string" ? attachment.filePath : undefined,
          };
        })
      : [],
    successChecklist: asStringArray(input.successChecklist),
    manualRubric: asStringArray(input.manualRubric),
  };
}

export function parseSuite(input: unknown): Omit<SuiteSpec, "id" | "createdAt" | "updatedAt"> {
  invariant(isRecord(input), "suite body must be an object");
  invariant(typeof input.name === "string", "suite name is required");
  invariant(typeof input.profileVersionId === "string", "profileVersionId is required");
  return {
    name: input.name,
    description: asString(input.description),
    taskIds: asStringArray(input.taskIds),
    agentVersionIds: asStringArray(input.agentVersionIds),
    profileVersionId: input.profileVersionId,
    concurrency: asNumber(input.concurrency, 1),
  };
}

export function parseSuiteRunRequest(input: unknown): { suiteSpecId: string } {
  invariant(isRecord(input), "suite run body must be an object");
  invariant(typeof input.suiteSpecId === "string", "suiteSpecId is required");
  return { suiteSpecId: input.suiteSpecId };
}

export function parseManualScore(input: unknown): Omit<ManualScore, "id" | "createdAt" | "updatedAt"> {
  invariant(isRecord(input), "manual score body must be an object");
  invariant(typeof input.runId === "string", "runId is required");
  invariant(typeof input.score === "number", "score is required");
  invariant(input.verdict === "pass" || input.verdict === "partial" || input.verdict === "fail", "invalid verdict");
  invariant(typeof input.notes === "string", "notes is required");
  return {
    runId: input.runId,
    score: input.score,
    verdict: input.verdict,
    notes: input.notes,
  };
}

function parseSkill(input: unknown, index: number) {
  invariant(isRecord(input), `skill ${index} must be an object`);
  invariant(typeof input.id === "string", `skill ${index} id is required`);
  invariant(typeof input.name === "string", `skill ${index} name is required`);
  return {
    id: input.id,
    name: input.name,
    description: asString(input.description),
  };
}

function parseMcp(input: unknown, index: number) {
  invariant(isRecord(input), `mcp server ${index} must be an object`);
  invariant(typeof input.id === "string", `mcp server ${index} id is required`);
  invariant(typeof input.name === "string", `mcp server ${index} name is required`);
  invariant(typeof input.command === "string", `mcp server ${index} command is required`);
  return {
    id: input.id,
    name: input.name,
    command: input.command,
    args: asStringArray(input.args),
    env: isRecord(input.env) ? asStringMap(input.env) : {},
  };
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null;
}

function asString(input: unknown): string {
  return typeof input === "string" ? input : "";
}

function asStringArray(input: unknown): string[] {
  return Array.isArray(input) ? input.filter((item): item is string => typeof item === "string") : [];
}

function asStringMap(input: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(input).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

function asNumber(input: unknown, fallback: number): number {
  return typeof input === "number" && Number.isFinite(input) ? input : fallback;
}

