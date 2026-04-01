import type { ArtifactManifestEntry, ProfileVersion, RunEvent, RunRecord, TaskSpec } from "./domain.js";

export interface CapabilityManifest {
  supportsStreaming: boolean;
  supportsCancellation: boolean;
  supportsProfiles: boolean;
  supportsNativeTools: boolean;
  notes?: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export interface RunContext {
  run: RunRecord;
  task: TaskSpec;
  profile: ProfileVersion;
  compiledPrompt: string;
  workspacePath: string;
  artifactsPath: string;
}

export interface PreparedInvocation {
  mode: "process" | "http";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  body?: Record<string, unknown>;
}

export interface AgentAdapter {
  readonly key: string;
  probe(): Promise<CapabilityManifest>;
  validate(profile: ProfileVersion, task: TaskSpec): Promise<ValidationResult>;
  prepareRun(context: RunContext): Promise<PreparedInvocation>;
  start(context: RunContext, prepared: PreparedInvocation, emit: (event: Omit<RunEvent, "id" | "createdAt" | "updatedAt">) => Promise<void>): Promise<{
    exitCode: number;
    artifactManifest: ArtifactManifestEntry[];
  }>;
  cancel?(runId: string): Promise<void>;
}
