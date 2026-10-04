import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const tmp = mkdtempSync(path.join(os.tmpdir(), "verify-build-"));
const src = path.join(tmp, "src");
const env = { ...process.env, MSYS_NO_PATHCONV: "1", MSYS2_ARG_CONV_EXCL: "*" };

function cleanup() {
  rmSync(tmp, { recursive: true, force: true });
}

function run(command, extraEnv = {}, cwd = src) {
  console.log(`\n> ${command}`);
  const result = spawnSync(command, { cwd, shell: true, stdio: "inherit", env: { ...env, ...extraEnv } });
  if (result.status !== 0) {
    console.error(`\nBAŞARISIZ: ${command}\nGitHub'daki Docker derlemesi de aynı yerde kırılır; push etmeyin.`);
    cleanup();
    process.exit(result.status ?? 1);
  }
}

const dirty = spawnSync("git status --porcelain", { cwd: root, shell: true, encoding: "utf8" }).stdout.trim();
if (dirty) console.warn("Uyarı: commit edilmemiş değişiklikler var; yalnızca commit edilmiş (HEAD) sürüm doğrulanır.\n");

run(`git clone --quiet "${root}" "${src}"`, {}, tmp);
for (const file of [".env"]) if (existsSync(path.join(root, file))) copyFileSync(path.join(root, file), path.join(src, file));
const baseImage = readFileSync(path.join(src, "Dockerfile"), "utf8").match(/^FROM\s+(\S+)/m)?.[1];
if (baseImage && spawnSync("docker version", { shell: true, stdio: "ignore" }).status === 0) {
  const deps = path.join(tmp, "deps");
  mkdirSync(deps);
  for (const file of ["package.json", "package-lock.json"]) copyFileSync(path.join(src, file), path.join(deps, file));
  run(`docker run --rm -v "${deps}:/app" -w /app ${baseImage} npm ci --ignore-scripts`, {}, tmp);
} else {
  console.warn("Uyarı: Docker yok; Dockerfile'daki Node/npm sürümüyle bağımlılık kurulumu doğrulanamadı.");
}
run("npm ci");
if (existsSync(path.join(src, "prisma", "schema.prisma"))) run("npx prisma generate");

if (existsSync(path.join(src, "scripts", "build-themes.mjs"))) {
  run("npm run build");
  run("npm run build", { NEXT_PUBLIC_BASE_PATH: "/ecommerce", NEXT_PUBLIC_PATH_MODE: "1" });
} else {
  run("npx next build --webpack");
}

cleanup();
console.log("\nDoğrulama tamam: Docker derlemesi geçmeli.");
