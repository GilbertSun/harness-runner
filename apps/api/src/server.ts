import { mkdir } from "node:fs/promises";
import Fastify from "fastify";
import { FileRepository } from "@harness-runner/core";
import { ARTIFACTS_DIR, PORT, SNAPSHOT_PATH, WORKSPACES_DIR } from "./config.js";
import { ensureSeedData } from "./bootstrap.js";
import {
  parseAgentDefinition,
  parseAgentVersion,
  parseManualScore,
  parseProfileVersion,
  parseSuite,
  parseSuiteRunRequest,
  parseTask,
} from "./validation.js";

const repository = new FileRepository(SNAPSHOT_PATH);
const server = Fastify({ logger: true });

server.addHook("onRequest", async (_, reply) => {
  reply.header("Access-Control-Allow-Origin", "*");
  reply.header("Access-Control-Allow-Headers", "Content-Type");
});

server.options("*", async (_, reply) => {
  reply.status(204).send();
});

server.get("/health", async () => ({ ok: true }));

server.get("/snapshot", async () => repository.getSnapshot());

server.get("/agent-definitions", async () => repository.listAgentDefinitions());
server.post("/agent-definitions", async (request, reply) => {
  try {
    const entity = await repository.createAgentDefinition(parseAgentDefinition(request.body));
    reply.status(201).send(entity);
  } catch (error) {
    reply.status(400).send({ error: (error as Error).message });
  }
});

server.get("/agent-versions", async () => repository.listAgentVersions());
server.post("/agent-versions", async (request, reply) => {
  try {
    const entity = await repository.createAgentVersion(parseAgentVersion(request.body));
    reply.status(201).send(entity);
  } catch (error) {
    reply.status(400).send({ error: (error as Error).message });
  }
});

server.get("/profile-versions", async () => repository.listProfileVersions());
server.post("/profile-versions", async (request, reply) => {
  try {
    const entity = await repository.createProfileVersion(parseProfileVersion(request.body));
    reply.status(201).send(entity);
  } catch (error) {
    reply.status(400).send({ error: (error as Error).message });
  }
});

server.get("/tasks", async () => repository.listTasks());
server.post("/tasks", async (request, reply) => {
  try {
    const entity = await repository.createTask(parseTask(request.body));
    reply.status(201).send(entity);
  } catch (error) {
    reply.status(400).send({ error: (error as Error).message });
  }
});

server.get("/suites", async () => repository.listSuites());
server.post("/suites", async (request, reply) => {
  try {
    const entity = await repository.createSuite(parseSuite(request.body));
    reply.status(201).send(entity);
  } catch (error) {
    reply.status(400).send({ error: (error as Error).message });
  }
});

server.get("/suite-runs", async () => repository.listSuiteRuns());
server.post("/suite-runs", async (request, reply) => {
  try {
    const { suiteSpecId } = parseSuiteRunRequest(request.body);
    const suite = await repository.getSuite(suiteSpecId);
    if (!suite) {
      reply.status(404).send({ error: "未找到对应的套件" });
      return;
    }

    const suiteRun = await repository.createSuiteRun({
      suiteSpecId: suite.id,
      profileVersionId: suite.profileVersionId,
      status: "queued",
      runIds: [],
    });

    const agentVersions = await repository.listAgentVersions();
    const agentVersionMap = new Map(agentVersions.map((item) => [item.id, item]));
    const runIds: string[] = [];

    for (const taskId of suite.taskIds) {
      for (const agentVersionId of suite.agentVersionIds) {
        const version = agentVersionMap.get(agentVersionId);
        if (!version) {
          continue;
        }

        const run = await repository.createRun({
          suiteRunId: suiteRun.id,
          taskSpecId: taskId,
          agentDefinitionId: version.agentDefinitionId,
          agentVersionId,
          profileVersionId: suite.profileVersionId,
          status: "queued",
          workspacePath: `${WORKSPACES_DIR}/pending`,
        });
        runIds.push(run.id);
        await repository.createRunEvent({
          runId: run.id,
          type: "run.queued",
          source: "system",
          payload: {
            suiteRunId: suiteRun.id,
          },
        });
      }
    }

    const updatedSuiteRun = await repository.updateSuiteRun(suiteRun.id, { runIds });
    reply.status(201).send(updatedSuiteRun);
  } catch (error) {
    reply.status(400).send({ error: (error as Error).message });
  }
});

server.get("/runs", async () => repository.listRuns());
server.get("/runs/:id", async (request, reply) => {
  const run = await repository.getRun((request.params as { id: string }).id);
  if (!run) {
    reply.status(404).send({ error: "未找到对应的运行记录" });
    return;
  }
  const [events, scores] = await Promise.all([
    repository.listRunEvents(run.id),
    repository.listManualScores(run.id),
  ]);
  reply.send({ ...run, events, manualScores: scores });
});

server.get("/runs/:id/events", async (request, reply) => {
  const runId = (request.params as { id: string }).id;
  const run = await repository.getRun(runId);
  if (!run) {
    reply.status(404).send({ error: "未找到对应的运行记录" });
    return;
  }
  reply.send(await repository.listRunEvents(runId));
});

server.post("/runs/:id/cancel", async (request, reply) => {
  try {
    const runId = (request.params as { id: string }).id;
    const run = await repository.getRun(runId);
    if (!run) {
      reply.status(404).send({ error: "未找到对应的运行记录" });
      return;
    }
    if (run.status === "succeeded" || run.status === "failed" || run.status === "cancelled") {
      reply.status(409).send({ error: "当前运行已经结束，不能再次取消" });
      return;
    }
    const updated = await repository.updateRun(runId, {
      status: "cancelled",
      endedAt: new Date().toISOString(),
      errorMessage: "用户已取消该运行",
    });
    await repository.createRunEvent({
      runId,
      type: "run.cancelled",
      source: "system",
      payload: { reason: "用户主动取消了本次运行" },
    });
    reply.send(updated);
  } catch (error) {
    reply.status(400).send({ error: (error as Error).message });
  }
});

server.post("/runs/:id/manual-score", async (request, reply) => {
  try {
    const runId = (request.params as { id: string }).id;
    const payload = parseManualScore({
      ...(request.body as object),
      runId,
    });
    const score = await repository.createManualScore(payload);
    reply.status(201).send(score);
  } catch (error) {
    reply.status(400).send({ error: (error as Error).message });
  }
});

server.get("/compare", async (request, reply) => {
  const suiteRunId = (request.query as { suiteRunId?: string }).suiteRunId;
  if (!suiteRunId) {
    reply.status(400).send({ error: "缺少 suiteRunId 参数" });
    return;
  }
  reply.send(await repository.getCompareRows(suiteRunId));
});

async function start(): Promise<void> {
  await Promise.all([
    mkdir(WORKSPACES_DIR, { recursive: true }),
    mkdir(ARTIFACTS_DIR, { recursive: true }),
  ]);
  await ensureSeedData(repository);
  await server.listen({ port: PORT, host: "0.0.0.0" });
}

start().catch((error) => {
  server.log.error(error);
  process.exit(1);
});
