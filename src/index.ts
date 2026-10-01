import path from 'node:path';

import type { Plugin, UserConfig } from 'vite';

import { rewriteCssPackageImports } from './css.ts';
import { findWorkspaceFile, packagesFromWorkspaceFile } from './workspace.ts';

export default function workspace(): Plugin {
    const styles: Record<string, string> = {};

    return {
        name: 'vite-plugin-multi-root-workspace',
        config(userConfig): UserConfig {
            const projectRoot = path.resolve(userConfig.root ?? process.cwd());
            const workspaceFile = findWorkspaceFile(projectRoot);

            if (!workspaceFile) {
                return {};
            }

            const aliases: Record<string, string> = {};

            for (const { name, srcPath, stylePath } of packagesFromWorkspaceFile(workspaceFile)) {
                aliases[name] = srcPath;

                if (stylePath) {
                    styles[name] = stylePath;
                }
            }

            return {
                resolve: {
                    alias: aliases,
                },
            };
        },
        transform: {
            order: 'pre',
            filter: {
                id: [/\.css(?:\?|$)/, /&lang\.css/],
            },
            handler(code) {
                const transformedCode = rewriteCssPackageImports(code, styles);

                return transformedCode === code ? null : { code: transformedCode, map: null };
            },
        },
    };
}
