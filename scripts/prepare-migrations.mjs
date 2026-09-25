import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { prepareMigrations } from './migration-plan.mjs';

// Offline preparation only. Never connects to a database or changes the originals.
const [applicationsPath, usersPath, outputPath, ...extra] = process.argv.slice(2);
if (!applicationsPath || !usersPath || !outputPath || extra.length) {
  throw new Error('Usage: node scripts/prepare-migrations.mjs applications-schema.json users-schema.json NEW_OUTPUT_DIRECTORY');
}
const root = resolve(import.meta.dirname, '..');
const readSchema = path => {
  const response = JSON.parse(readFileSync(path, 'utf8'));
  if (!Array.isArray(response) || response.some(item => !Array.isArray(item.results))) {
    throw new Error('Expected Wrangler d1 execute --json output. See docs/MIGRATIONS.md.');
  }
  return response.flatMap(item => item.results);
};
const files = readdirSync(join(root, 'migrations')).filter(name => name.endsWith('.sql')).sort()
  .map(name => ({ name, sql: readFileSync(join(root, 'migrations', name), 'utf8') }));
const plan = prepareMigrations(files, {
  application_captures: readSchema(applicationsPath), users: readSchema(usersPath)
});
const output = resolve(outputPath);
// Refuse existing output, including migrations/, so historical files cannot change.
mkdirSync(output);
for (const file of plan) writeFileSync(join(output, file.name), file.sql, { flag: 'wx' });
console.log(`Prepared ${plan.length} migrations in ${output}. No database was modified.`);
