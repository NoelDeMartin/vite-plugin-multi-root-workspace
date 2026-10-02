import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { normalizePath } from 'vite';
import type { ConfigEnv, Plugin, UserConfig } from 'vite';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import { rewriteCssPackageImports } from './css.ts';
import workspace from './index.ts';
import { findWorkspaceFile, packagesFromWorkspaceFile } from './workspace.ts';

describe('vite-plugin-multi-root-workspace', () => {
    let root: string;

    function write(file: string, contents: string | object): void {
        const filePath = path.join(root, file);

        mkdirSync(path.dirname(filePath), { recursive: true });
        writeFileSync(filePath, typeof contents === 'string' ? contents : JSON.stringify(contents));
    }

    function resolveConfig(plugin: Plugin, config: UserConfig): UserConfig {
        const hook = plugin.config as (config: UserConfig, env: ConfigEnv) => UserConfig;

        return hook(config, { command: 'serve', mode: 'development' });
    }

    beforeEach(() => {
        root = mkdtempSync(path.join(tmpdir(), 'vite-plugin-multi-root-workspace-'));

        write(
            'my.code-workspace',
            `{
                // Folders
                "folders": [{ "path": "app" }, { "path": "library" }],
            }`,
        );
        write('app/package.json', { name: 'app' });
        write('library/packages/core/package.json', { name: '@library/core', style: 'style.css' });
        write('library/packages/core/style.css', '');
        write('library/packages/core/src/index.ts', '');
        write('library/packages/utils/package.json', {
            name: '@library/utils',
            exports: { '.': { style: './dist/style.css' } },
        });
        write('library/packages/utils/dist/style.css', '');
        write('library/packages/utils/src/index.ts', '');
        write('library/packages/no-src/package.json', { name: '@library/no-src' });
        write('library/packages/no-name/package.json', {});
        write('library/packages/no-name/src/index.ts', '');
    });

    afterEach(() => rmSync(root, { recursive: true, force: true }));

    it('finds workspace files in ancestor folders', () => {
        const packageFolder = path.join(root, 'library/packages/core');

        expect(findWorkspaceFile(packageFolder)).toBe(path.join(root, 'my.code-workspace'));
        expect(findWorkspaceFile(path.join(packageFolder, 'src'))).toBeUndefined();
        expect(findWorkspaceFile(path.join(packageFolder, 'src'), 4)).toBe(path.join(root, 'my.code-workspace'));
    });

    it('reads packages with sources from workspace folders', () => {
        const packages = packagesFromWorkspaceFile(path.join(root, 'my.code-workspace'));

        expect(packages).toEqual([
            {
                name: '@library/core',
                srcPath: path.join(root, 'library/packages/core/src'),
                stylePath: normalizePath(path.join(root, 'library/packages/core/style.css')),
            },
            {
                name: '@library/utils',
                srcPath: path.join(root, 'library/packages/utils/src'),
                stylePath: normalizePath(path.join(root, 'library/packages/utils/dist/style.css')),
            },
        ]);
    });

    it('rejects invalid workspace files', () => {
        write('my.code-workspace', '{ "folders": [ }');

        expect(() => packagesFromWorkspaceFile(path.join(root, 'my.code-workspace'))).toThrow(
            'Invalid workspace file (my.code-workspace)',
        );
    });

    it('aliases packages to their sources', () => {
        const config = resolveConfig(workspace(), { root: path.join(root, 'app') });

        expect(config.resolve?.alias).toEqual({
            '@library/core': path.join(root, 'library/packages/core/src'),
            '@library/utils': path.join(root, 'library/packages/utils/src'),
        });
    });

    it('does nothing outside of a workspace', () => {
        rmSync(path.join(root, 'my.code-workspace'));

        expect(resolveConfig(workspace(), { root: path.join(root, 'app') })).toEqual({});
    });

    it('rewrites css imports of package styles', () => {
        const css = ['@import "@library/core";', "@reference '@library/core';", '@import "tailwindcss";'].join('\n');

        expect(rewriteCssPackageImports(css, { '@library/core': '/library/core/style.css' })).toBe(
            [
                '@import "/library/core/style.css";',
                "@reference '/library/core/style.css';",
                '@import "tailwindcss";',
            ].join('\n'),
        );
    });
});
