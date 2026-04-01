import type {
  AgentDefinition,
  AgentVersion,
  CompareRow,
  ManualScore,
  ProfileVersion,
  RegistrySnapshot,
  RunEvent,
  RunRecord,
  SuiteRun,
  SuiteSpec,
  TaskSpec,
} from "./domain.js";

export interface Repository {
  createAgentDefinition(input: Omit<AgentDefinition, "id" | "createdAt" | "updatedAt">): Promise<AgentDefinition>;
  listAgentDefinitions(): Promise<AgentDefinition[]>;
  getAgentDefinition(id: string): Promise<AgentDefinition | undefined>;

  createAgentVersion(input: Omit<AgentVersion, "id" | "createdAt" | "updatedAt">): Promise<AgentVersion>;
  listAgentVersions(): Promise<AgentVersion[]>;
  getAgentVersion(id: string): Promise<AgentVersion | undefined>;

  createProfileVersion(input: Omit<ProfileVersion, "id" | "createdAt" | "updatedAt">): Promise<ProfileVersion>;
  listProfileVersions(): Promise<ProfileVersion[]>;
  getProfileVersion(id: string): Promise<ProfileVersion | undefined>;

  createTask(input: Omit<TaskSpec, "id" | "createdAt" | "updatedAt">): Promise<TaskSpec>;
  listTasks(): Promise<TaskSpec[]>;
  getTask(id: string): Promise<TaskSpec | undefined>;

  createSuite(input: Omit<SuiteSpec, "id" | "createdAt" | "updatedAt">): Promise<SuiteSpec>;
  listSuites(): Promise<SuiteSpec[]>;
  getSuite(id: string): Promise<SuiteSpec | undefined>;

  createSuiteRun(input: Omit<SuiteRun, "id" | "createdAt" | "updatedAt">): Promise<SuiteRun>;
  listSuiteRuns(): Promise<SuiteRun[]>;
  updateSuiteRun(id: string, patch: Partial<SuiteRun>): Promise<SuiteRun>;
  getSuiteRun(id: string): Promise<SuiteRun | undefined>;

  createRun(input: Omit<RunRecord, "id" | "createdAt" | "updatedAt">): Promise<RunRecord>;
  listRuns(): Promise<RunRecord[]>;
  getRun(id: string): Promise<RunRecord | undefined>;
  updateRun(id: string, patch: Partial<RunRecord>): Promise<RunRecord>;

  createRunEvent(input: Omit<RunEvent, "id" | "createdAt" | "updatedAt">): Promise<RunEvent>;
  listRunEvents(runId: string): Promise<RunEvent[]>;

  createManualScore(input: Omit<ManualScore, "id" | "createdAt" | "updatedAt">): Promise<ManualScore>;
  listManualScores(runId?: string): Promise<ManualScore[]>;

  getCompareRows(suiteRunId: string): Promise<CompareRow[]>;
  getSnapshot(): Promise<RegistrySnapshot>;
}

