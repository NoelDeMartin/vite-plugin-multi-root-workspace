import fs from "node:fs";
import path from "node:path";
import { parse as parseJsonc, type ParseError } from "jsonc-parser";

import { getPackagesFromProject, type WorkspacePackage } from "./packages.ts";

export function findWorkspaceFile(folder: string, ancestors: number = 3): string | undefined {
  const workspaceFiles = fs
    .readdirSync(folder)
    .filter((name) => name.endsWith(".code-workspace"))
    .sort();

  if (workspaceFiles.length > 0) {
    return path.join(folder, workspaceFiles[0]!);
  }

  if (ancestors === 0) {
    return undefined;
  }

  return findWorkspaceFile(path.dirname(folder), ancestors - 1);
}

export function packagesFromWorkspaceFile(workspaceFile: string): WorkspacePackage[] {
  const workspaceDirectory = path.dirname(workspaceFile);
  const workspaceFileContents = fs.readFileSync(workspaceFile, "utf-8");
  const parseErrors: ParseError[] = [];
  const workspaceConfig = parseJsonc(workspaceFileContents, parseErrors, {
    allowTrailingComma: true,
  }) as {
    folders?: { path: string }[];
  };

  if (parseErrors.length > 0) {
    throw new Error(
      `Invalid workspace file (${path.basename(workspaceFile)}): ${parseErrors[0]!.error}`,
    );
  }

  return (workspaceConfig.folders ?? []).flatMap((folder) =>
    getPackagesFromProject(path.resolve(workspaceDirectory, folder.path)),
  );
}
