"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertAfterLastImport = insertAfterLastImport;
exports.insertIntoProviders = insertIntoProviders;
/** Insert `newImport` on the line after the last import statement (handles multi-line imports and blank lines between groups). */
function insertAfterLastImport(content, newImport) {
    const lines = content.split('\n');
    let lastImportLine = -1;
    let inImport = false;
    for (let i = 0; i < lines.length; i++) {
        if (/^import\s/.test(lines[i]))
            inImport = true;
        if (inImport) {
            lastImportLine = i;
            if (lines[i].includes(';'))
                inImport = false;
        }
    }
    if (lastImportLine < 0)
        return newImport + '\n' + content;
    lines.splice(lastImportLine + 1, 0, newImport);
    return lines.join('\n');
}
/** Insert `newProvider` as the first item in the `providers: [...]` array, preserving indentation style. */
function insertIntoProviders(content, newProvider) {
    return content.replace(/^(\s*)providers\s*:\s*\[/m, (match, indent) => {
        return `${indent}providers: [\n${indent}  ${newProvider},`;
    });
}
