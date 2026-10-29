import fs from 'node:fs';
import path from 'node:path';

import { normalizePath } from 'vite';

export interface WorkspacePackage {
    name: string;
    path: string;
    srcPath: string;
    stylePath?: string;
}

interface PackageJson {
    name?: string;
    style?: string;
    exports?: unknown;
}

function getExportsStyleEntry(exports: unknown): string | undefined {
    if (!exports || typeof exports !== 'object') {
        return;
    }

    const rootExport = '.' in exports ? exports['.'] : exports;

    if (!rootExport || typeof rootExport !== 'object' || !('style' in rootExport)) {
        return;
    }

    return typeof rootExport.style === 'string' ? rootExport.style : undefined;
}

function getStylePath(packageDir: string, packageJson: PackageJson): string | undefined {
    const styleEntry = getExportsStyleEntry(packageJson.exports) ?? packageJson.style;

    if (!styleEntry) {
        return;
    }

    const stylePath = path.join(packageDir, styleEntry);

    return fs.existsSync(stylePath) ? normalizePath(stylePath) : undefined;
}

function parsePackageJson(packageJsonPath: string): PackageJson {
    try {
        return JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')) as PackageJson;
    } catch (error) {
        throw new Error(
            `Invalid package.json (${packageJsonPath}): ${error instanceof Error ? error.message : String(error)}`,
            { cause: error },
        );
    }
}

function getPackage(packageDir: string): WorkspacePackage[] {
    const packageJsonPath = path.join(packageDir, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
        return [];
    }

    const packageJson = parsePackageJson(packageJsonPath);

    if (!packageJson.name) {
        return [];
    }

    const srcPath = path.join(packageDir, 'src');

    if (!fs.existsSync(srcPath)) {
        return [];
    }

    return [
        {
            name: packageJson.name,
            path: packageDir,
            srcPath,
            stylePath: getStylePath(packageDir, packageJson),
        },
    ];
}

export function getPackagesFromProject(projectRoot: string): WorkspacePackage[] {
    const packagesDir = path.join(projectRoot, 'packages');

    if (!fs.existsSync(packagesDir)) {
        return getPackage(projectRoot);
    }

    return fs.readdirSync(packagesDir).flatMap((folder) => getPackage(path.resolve(packagesDir, folder)));
}
