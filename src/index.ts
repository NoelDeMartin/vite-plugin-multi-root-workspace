import fs from "node:fs";
import path from "node:path";
import type { Plugin, UserConfig } from "vite";
import { parse as parseJsonc, type ParseError } from "jsonc-parser";

function findWorkspaceFile(folder: string, ancestors: number = 3): string | undefined {
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

function getPackagesFromProject(projectRoot: string): { name: string; srcPath: string }[] {
  const packagesDir = path.join(projectRoot, "packages");

  if (!fs.existsSync(packagesDir)) {
    return [];
  }

  return fs.readdirSync(packagesDir).flatMap((folder) => {
    const packageJsonPath = path.join(packagesDir, folder, "package.json");

    if (!fs.existsSync(packageJsonPath)) {
      return [];
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8")) as { name?: string };

    if (!packageJson.name) {
      return [];
    }

    const srcPath = path.join(packagesDir, folder, "src");

    if (!fs.existsSync(srcPath)) {
      return [];
    }

    return [{ name: packageJson.name, srcPath: path.resolve(srcPath) }];
  });
}

function aliasesFromWorkspaceFile(workspaceFile: string): Record<string, string> {
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
  const aliases: Record<string, string> = {};

  for (const folder of workspaceConfig.folders ?? []) {
    const projectRoot = path.resolve(workspaceDirectory, folder.path);

    for (const { name, srcPath } of getPackagesFromProject(projectRoot)) {
      aliases[name] = srcPath;
    }
  }

  return aliases;
}

export default function workspace(): Plugin {
  return {
    name: "vite-plugin-multi-root-workspace",
    config(userConfig): UserConfig {
      const projectRoot = path.resolve(userConfig.root ?? process.cwd());
      const workspaceFile = findWorkspaceFile(projectRoot);

      if (!workspaceFile) {
        return {};
      }

      return {
        resolve: {
          alias: aliasesFromWorkspaceFile(workspaceFile),
        },
      };
    },
  };
}
