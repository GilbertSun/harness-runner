import { FileRepository } from "@harness-runner/core";
import { SNAPSHOT_PATH, POLL_INTERVAL_MS } from "./config.js";
import { executeRun } from "./runtime.js";

const repository = new FileRepository(SNAPSHOT_PATH);

async function tick(): Promise<void> {
  const runs = await repository.listRuns();
  const nextRun = runs.find((run) => run.status === "queued");
  if (!nextRun) {
    return;
  }

  const suiteRun = nextRun.suiteRunId ? await repository.getSuiteRun(nextRun.suiteRunId) : undefined;
  if (suiteRun && suiteRun.status === "queued") {
    await repository.updateSuiteRun(suiteRun.id, { status: "running" });
  }

  await executeRun(repository, nextRun);

  if (suiteRun) {
    const siblingRuns = (await repository.listRuns()).filter((run) => run.suiteRunId === suiteRun.id);
    const hasQueuedOrRunning = siblingRuns.some((run) => run.status === "queued" || run.status === "running");
    const hasFailures = siblingRuns.some((run) => run.status === "failed");
    if (!hasQueuedOrRunning) {
      await repository.updateSuiteRun(suiteRun.id, {
        status: hasFailures ? "failed" : "completed",
      });
    }
  }
}

async function loop(): Promise<void> {
  for (;;) {
    try {
      await tick();
    } catch (error) {
      console.error("[worker]", error);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

loop().catch((error) => {
  console.error(error);
  process.exit(1);
});
