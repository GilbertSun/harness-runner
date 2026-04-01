export type EntityId = string;

export type AgentKind = "cli" | "service";
export type RunStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";
export type RunSource = "agent" | "adapter" | "worker" | "mcp" | "skill" | "system";
export type ToolSource = "profile-provided" | "agent-native" | "unknown";

export interface TimestampedEntity {
  id: EntityId;
  createdAt: string;
  updatedAt: string;
}

export interface AgentDefinition extends TimestampedEntity {
  name: string;
  adapterKey: string;
  kind: AgentKind;
  description: string;
  installStrategy: string;
  capabilities: string[];
}

export interface AgentVersion extends TimestampedEntity {
  agentDefinitionId: EntityId;
  label: string;
  binaryVersion: string;
  adapterVersion: string;
  wrapperPrompt: string;
  defaultConfig: Record<string, string>;
}

export interface SkillReference {
  id: string;
  name: string;
  description: string;
}

export interface McpServerDefinition {
  id: string;
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
}

export interface ProfileVersion extends TimestampedEntity {
  name: string;
  description: string;
  skills: SkillReference[];
  mcpServers: McpServerDefinition[];
  envRefs: string[];
  toolPolicy: {
    allowNativeTools: boolean;
    allowedDomains: string[];
  };
  timeouts: {
    maxDurationMs: number;
    idleTimeoutMs: number;
  };
  networkPolicy: {
    mode: "restricted" | "standard";
  };
}

export interface TaskAttachment {
  id: string;
  name: string;
  contentType: string;
  inlineContent?: string;
  filePath?: string;
}

export interface TaskSpec extends TimestampedEntity {
  title: string;
  category: "research";
  prompt: string;
  attachments: TaskAttachment[];
  successChecklist: string[];
  manualRubric: string[];
}

export interface SuiteSpec extends TimestampedEntity {
  name: string;
  description: string;
  taskIds: EntityId[];
  agentVersionIds: EntityId[];
  profileVersionId: EntityId;
  concurrency: number;
}

export interface SuiteRun extends TimestampedEntity {
  suiteSpecId: EntityId;
  profileVersionId: EntityId;
  status: "queued" | "running" | "completed" | "failed";
  runIds: EntityId[];
}

export interface RunRecord extends TimestampedEntity {
  suiteRunId?: EntityId;
  taskSpecId: EntityId;
  agentDefinitionId: EntityId;
  agentVersionId: EntityId;
  profileVersionId: EntityId;
  status: RunStatus;
  workspacePath: string;
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
  exitCode?: number;
  summary?: RunSummary;
  errorMessage?: string;
}

export interface ToolUsageSummary {
  toolName: string;
  count: number;
  source: ToolSource;
}

export interface ArtifactManifestEntry {
  id: string;
  name: string;
  kind: "report" | "log" | "transcript" | "attachment" | "other";
  path: string;
}

export interface RunSummary {
  status: RunStatus;
  durationMs: number;
  tokenUsage?: number;
  costUsd?: number;
  toolUsageBySource: ToolUsageSummary[];
  finalArtifacts: ArtifactManifestEntry[];
}

export interface ManualScore extends TimestampedEntity {
  runId: EntityId;
  score: number;
  verdict: "pass" | "partial" | "fail";
  notes: string;
}

export interface RunEvent extends TimestampedEntity {
  runId: EntityId;
  type:
    | "run.queued"
    | "run.started"
    | "run.completed"
    | "run.failed"
    | "run.cancelled"
    | "log"
    | "tool.call"
    | "artifact.created"
    | "metric"
    | "heartbeat";
  source: RunSource;
  payload: Record<string, unknown>;
}

export interface CompareRow {
  taskId: EntityId;
  taskTitle: string;
  agentVersionId: EntityId;
  agentLabel: string;
  runId: EntityId;
  status: RunStatus;
  durationMs?: number;
  manualScore?: number;
  verdict?: string;
  nativeToolCalls: number;
  profileToolCalls: number;
  artifactCount: number;
}

export interface RegistrySnapshot {
  agentDefinitions: AgentDefinition[];
  agentVersions: AgentVersion[];
  profileVersions: ProfileVersion[];
  tasks: TaskSpec[];
  suites: SuiteSpec[];
  suiteRuns: SuiteRun[];
  runs: RunRecord[];
  runEvents: RunEvent[];
  manualScores: ManualScore[];
}
