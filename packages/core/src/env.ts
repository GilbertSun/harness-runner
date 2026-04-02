import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function loadWorkspaceEnv(workspaceRoot: string): void {
  const lockedKeys = new Set(Object.keys(process.env));

  loadEnvFile(join(workspaceRoot, ".env"), lockedKeys);
  loadEnvFile(join(workspaceRoot, ".env.local"), lockedKeys);
}

function loadEnvFile(path: string, lockedKeys: Set<string>): void {
  if (!existsSync(path)) {
    return;
  }

  const content = readFileSync(path, "utf8");
  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(key) || lockedKeys.has(key)) {
      continue;
    }

    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value.replace(/\\n/gu, "\n");
  }
}
