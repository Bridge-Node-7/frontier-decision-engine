import { createHash } from 'node:crypto';
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootPath = fileURLToPath(new URL('../site/', import.meta.url));
const manifestName = 'manifest.sha256';
const schemaSource = fileURLToPath(new URL('../schemas/', import.meta.url));
const schemaTarget = fileURLToPath(new URL('../site/schemas/', import.meta.url));

await rm(schemaTarget, { recursive: true, force: true });
await mkdir(schemaTarget, { recursive: true });
await cp(schemaSource, schemaTarget, { recursive: true });

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (entry.name !== manifestName) files.push(path);
  }
  return files;
}

const files = (await walk(rootPath)).sort();
const lines = [];
for (const file of files) {
  const digest = createHash('sha256').update(await readFile(file)).digest('hex');
  lines.push(`${digest}  ${relative(rootPath, file).replaceAll('\\', '/')}`);
}
await writeFile(join(rootPath, manifestName), `${lines.join('\n')}\n`);
console.log(`wrote ${lines.length} entries to site/${manifestName}`);
