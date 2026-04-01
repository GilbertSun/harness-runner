import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Repository } from "./contracts.js";
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
import { createId, nowIso } from "./utils.js";

type CollectionName =
  | "agentDefinitions"
  | "agentVersions"
  | "profileVersions"
  | "tasks"
  | "suites"
  | "suiteRuns"
  | "runs"
  | "runEvents"
  | "manualScores";

const DEFAULT_SNAPSHOT: RegistrySnapshot = {
  agentDefinitions: [],
  agentVersions: [],
  profileVersions: [],
  tasks: [],
  suites: [],
  suiteRuns: [],
  runs: [],
  runEvents: [],
  manualScores: [],
};

type CollectionMap = {
  agentDefinitions: AgentDefinition[];
  agentVersions: AgentVersion[];
  profileVersions: ProfileVersion[];
  tasks: TaskSpec[];
  suites: SuiteSpec[];
  suiteRuns: SuiteRun[];
  runs: RunRecord[];
  runEvents: RunEvent[];
  manualScores: ManualScore[];
};

export class FileRepository implements Repository {
  private readonly lockPath: string;

  constructor(private readonly snapshotPath: string) {
    this.lockPath = `${snapshotPath}.lock`;
  }

  async createAgentDefinition(input: Omit<AgentDefinition, "id" | "createdAt" | "updatedAt">): Promise<AgentDefinition> {
    return this.insert("agentDefinitions", input, "agent");
  }

  async listAgentDefinitions(): Promise<AgentDefinition[]> {
    return (await this.read()).agentDefinitions;
  }

  async getAgentDefinition(id: string): Promise<AgentDefinition | undefined> {
    return (await this.read()).agentDefinitions.find((item) => item.id === id);
  }

  async createAgentVersion(input: Omit<AgentVersion, "id" | "createdAt" | "updatedAt">): Promise<AgentVersion> {
    return this.insert("agentVersions", input, "agentver");
  }

  async listAgentVersions(): Promise<AgentVersion[]> {
    return (await this.read()).agentVersions;
  }

  async getAgentVersion(id: string): Promise<AgentVersion | undefined> {
    return (await this.read()).agentVersions.find((item) => item.id === id);
  }

  async createProfileVersion(input: Omit<ProfileVersion, "id" | "createdAt" | "updatedAt">): Promise<ProfileVersion> {
    return this.insert("profileVersions", input, "profile");
  }

  async listProfileVersions(): Promise<ProfileVersion[]> {
    return (await this.read()).profileVersions;
  }

  async getProfileVersion(id: string): Promise<ProfileVersion | undefined> {
    return (await this.read()).profileVersions.find((item) => item.id === id);
  }

  async createTask(input: Omit<TaskSpec, "id" | "createdAt" | "updatedAt">): Promise<TaskSpec> {
    return this.insert("tasks", input, "task");
  }

  async listTasks(): Promise<TaskSpec[]> {
    return (await this.read()).tasks;
  }

  async getTask(id: string): Promise<TaskSpec | undefined> {
    return (await this.read()).tasks.find((item) => item.id === id);
  }

  async createSuite(input: Omit<SuiteSpec, "id" | "createdAt" | "updatedAt">): Promise<SuiteSpec> {
    return this.insert("suites", input, "suite");
  }

  async listSuites(): Promise<SuiteSpec[]> {
    return (await this.read()).suites;
  }

  async getSuite(id: string): Promise<SuiteSpec | undefined> {
    return (await this.read()).suites.find((item) => item.id === id);
  }

  async createSuiteRun(input: Omit<SuiteRun, "id" | "createdAt" | "updatedAt">): Promise<SuiteRun> {
    return this.insert("suiteRuns", input, "suiterun");
  }

  async listSuiteRuns(): Promise<SuiteRun[]> {
    return (await this.read()).suiteRuns;
  }

  async getSuiteRun(id: string): Promise<SuiteRun | undefined> {
    return (await this.read()).suiteRuns.find((item) => item.id === id);
  }

  async updateSuiteRun(id: string, patch: Partial<SuiteRun>): Promise<SuiteRun> {
    return this.update("suiteRuns", id, patch);
  }

  async createRun(input: Omit<RunRecord, "id" | "createdAt" | "updatedAt">): Promise<RunRecord> {
    return this.insert("runs", input, "run");
  }

  async listRuns(): Promise<RunRecord[]> {
    return (await this.read()).runs;
  }

  async getRun(id: string): Promise<RunRecord | undefined> {
    return (await this.read()).runs.find((item) => item.id === id);
  }

  async updateRun(id: string, patch: Partial<RunRecord>): Promise<RunRecord> {
    return this.update("runs", id, patch);
  }

  async createRunEvent(input: Omit<RunEvent, "id" | "createdAt" | "updatedAt">): Promise<RunEvent> {
    return this.insert("runEvents", input, "evt");
  }

  async listRunEvents(runId: string): Promise<RunEvent[]> {
    return (await this.read()).runEvents
      .filter((item) => item.runId === runId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async createManualScore(input: Omit<ManualScore, "id" | "createdAt" | "updatedAt">): Promise<ManualScore> {
    return this.insert("manualScores", input, "score");
  }

  async listManualScores(runId?: string): Promise<ManualScore[]> {
    const items = (await this.read()).manualScores;
    return runId ? items.filter((item) => item.runId === runId) : items;
  }

  async getCompareRows(suiteRunId: string): Promise<CompareRow[]> {
    const state = await this.read();
    const scores = new Map(state.manualScores.map((score) => [score.runId, score]));
    const agentVersions = new Map(state.agentVersions.map((item) => [item.id, item]));
    const tasks = new Map(state.tasks.map((item) => [item.id, item]));
    return state.runs
      .filter((run) => run.suiteRunId === suiteRunId)
      .map((run) => {
        const events = state.runEvents.filter((event) => event.runId === run.id && event.type === "tool.call");
        const score = scores.get(run.id);
        const task = tasks.get(run.taskSpecId);
        const agentVersion = agentVersions.get(run.agentVersionId);
        return {
          taskId: run.taskSpecId,
          taskTitle: task?.title ?? "Unknown task",
          agentVersionId: run.agentVersionId,
          agentLabel: agentVersion?.label ?? "Unknown agent",
          runId: run.id,
          status: run.status,
          durationMs: run.durationMs,
          manualScore: score?.score,
          verdict: score?.verdict,
          nativeToolCalls: events.filter((event) => event.payload.toolSource === "agent-native").length,
          profileToolCalls: events.filter((event) => event.payload.toolSource === "profile-provided").length,
          artifactCount: run.summary?.finalArtifacts.length ?? 0,
        };
      });
  }

  async getSnapshot(): Promise<RegistrySnapshot> {
    return this.read();
  }

  private async insert<K extends CollectionName, T extends CollectionMap[K][number]>(
    collection: K,
    input: Omit<T, "id" | "createdAt" | "updatedAt">,
    prefix: string,
  ): Promise<T> {
    return this.withLockedSnapshot(async (snapshot) => {
      const nextItem = {
        ...input,
        id: createId(prefix),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      } as T;
      const current = snapshot[collection] as CollectionMap[K];
      snapshot[collection] = [...current, nextItem] as CollectionMap[K];
      return {
        snapshot,
        result: nextItem,
      };
    });
  }

  private async update<K extends CollectionName, T extends CollectionMap[K][number]>(
    collection: K,
    id: string,
    patch: Partial<T>,
  ): Promise<T> {
    return this.withLockedSnapshot(async (snapshot) => {
      const items = [...(snapshot[collection] as CollectionMap[K])] as T[];
      const index = items.findIndex((item) => item.id === id);
      if (index === -1) {
        throw new Error(`Entity not found: ${collection}:${id}`);
      }
      const nextItem = {
        ...items[index],
        ...patch,
        updatedAt: nowIso(),
      } as T;
      items[index] = nextItem;
      snapshot[collection] = items as CollectionMap[K];
      return {
        snapshot,
        result: nextItem,
      };
    });
  }

  private async read(): Promise<RegistrySnapshot> {
    return this.readUnlocked();
  }

  private async readUnlocked(): Promise<RegistrySnapshot> {
    try {
      const raw = await readFile(this.snapshotPath, "utf8");
      const snapshot = JSON.parse(raw) as RegistrySnapshot;
      return {
        ...DEFAULT_SNAPSHOT,
        ...snapshot,
      };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        await this.writeUnlocked(DEFAULT_SNAPSHOT);
        return DEFAULT_SNAPSHOT;
      }
      if (error instanceof SyntaxError) {
        const corruptPath = `${this.snapshotPath}.corrupt-${Date.now()}.json`;
        await mkdir(dirname(this.snapshotPath), { recursive: true });
        await rename(this.snapshotPath, corruptPath).catch(() => undefined);
        await this.writeUnlocked(DEFAULT_SNAPSHOT);
        return DEFAULT_SNAPSHOT;
      }
      throw error;
    }
  }

  private async write(snapshot: RegistrySnapshot): Promise<void> {
    await this.withLock(async () => {
      await this.writeUnlocked(snapshot);
    });
  }

  private async writeUnlocked(snapshot: RegistrySnapshot): Promise<void> {
    await mkdir(dirname(this.snapshotPath), { recursive: true });
    const tempPath = `${this.snapshotPath}.tmp`;
    await writeFile(tempPath, JSON.stringify(snapshot, null, 2), "utf8");
    await rename(tempPath, this.snapshotPath);
  }

  private async withLockedSnapshot<T>(
    operation: (snapshot: RegistrySnapshot) => Promise<{ snapshot: RegistrySnapshot; result: T }>,
  ): Promise<T> {
    return this.withLock(async () => {
      const snapshot = await this.readUnlocked();
      const { snapshot: nextSnapshot, result } = await operation(snapshot);
      await this.writeUnlocked(nextSnapshot);
      return result;
    });
  }

  private async withLock<T>(operation: () => Promise<T>): Promise<T> {
    await this.acquireLock();
    try {
      return await operation();
    } finally {
      await rm(this.lockPath, { recursive: true, force: true });
    }
  }

  private async acquireLock(): Promise<void> {
    const startedAt = Date.now();
    for (;;) {
      try {
        await mkdir(this.lockPath);
        return;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== "EEXIST") {
          throw error;
        }
        if (Date.now() - startedAt > 5000) {
          throw new Error(`Timed out acquiring repository lock for ${this.snapshotPath}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    }
  }
}
