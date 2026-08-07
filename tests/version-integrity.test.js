import assert from "node:assert/strict";
import { mkdtemp, cp, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const validator = path.join(root, "scripts", "validate_version_integrity.py");

async function fixture() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "fde-version-"));
  for (const item of [
    "package.json",
    "package-lock.json",
    "CITATION.cff",
    "project-facts.json",
    "examples",
    "docs",
  ]) {
    await cp(path.join(root, item), path.join(dir, item), { recursive: true });
  }
  return dir;
}

function run(dir) {
  return spawnSync("python3", [validator, "--root", dir], { encoding: "utf8" });
}

test("version authorities agree", async () => {
  const dir = await fixture();
  const result = run(dir);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test("stale citation fails", async () => {
  const dir = await fixture();
  const p = path.join(dir, "CITATION.cff");
  await writeFile(p, (await readFile(p, "utf8")).replace("version: 0.2.12", "version: 0.2.11"));
  const result = run(dir);
  assert.notEqual(result.status, 0);
});

test("stale generated facts fail", async () => {
  const dir = await fixture();
  const p = path.join(dir, "project-facts.json");
  const obj = JSON.parse(await readFile(p, "utf8"));
  obj.applicationVersion = "0.2.11";
  await writeFile(p, JSON.stringify(obj, null, 2) + "\n");
  const result = run(dir);
  assert.notEqual(result.status, 0);
});

test("stale package lock fails", async () => {
  const dir = await fixture();
  const p = path.join(dir, "package-lock.json");
  const obj = JSON.parse(await readFile(p, "utf8"));
  obj.version = "0.2.11";
  await writeFile(p, JSON.stringify(obj, null, 2) + "\n");
  const result = run(dir);
  assert.notEqual(result.status, 0);
});


test("missing current release notes fail", async () => {
  const dir = await fixture();
  await rm(path.join(dir, "docs", "releases", "v0.2.12.md"));
  const result = run(dir);
  assert.notEqual(result.status, 0);
});
