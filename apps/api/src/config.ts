import { resolve } from "node:path";

const WORKSPACE_ROOT = process.env.HARNESS_ROOT ?? resolve(process.cwd(), "../..");

export const DATA_DIR = resolve(WORKSPACE_ROOT, ".data");
export const SNAPSHOT_PATH = resolve(DATA_DIR, "registry.json");
export const WORKSPACES_DIR = resolve(DATA_DIR, "workspaces");
export const ARTIFACTS_DIR = resolve(DATA_DIR, "artifacts");
export const PORT = Number(process.env.PORT ?? 4000);
