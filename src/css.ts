const CSS_IMPORT_REGEX = /(@(?:import|reference)\s+)(['"])([^'"]+)\2/g;

export function rewriteCssPackageImports(code: string, packageStyles: Record<string, string>): string {
    return code.replace(CSS_IMPORT_REGEX, (match, directive: string, quote: string, specifier: string) => {
        const stylePath = packageStyles[specifier];

        return stylePath ? `${directive}${quote}${stylePath}${quote}` : match;
    });
}
