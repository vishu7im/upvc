import { readdirSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, extname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const freezeCommit = "1a9c18a5b7e8ca3295bd8f97880b1179352a8d08";
const acceptedBackendDigest = "5fceec2d3f191b06d89f021de42175a010d730dc489dd1b18c96d0316b823338";
const acceptedOwnerV1Files = new Map([
  [
    "web/app/(app)/admin/catalog/catalog-editor.tsx",
    "8cc51d2a154cced340946bd7e87aca34551f87caf70940239fc4073d7d32d8fd",
  ],
]);
const componentRoot = join(repositoryRoot, "web/components/v2");
const v2RouteRoot = join(repositoryRoot, "web/app/(v2)/v2");
const v2Stylesheet = join(repositoryRoot, "web/app/v2.css");
const frozenV1Paths = [
  "web/app/(app)",
  "web/components/ui.tsx",
  "web/app/globals.css",
  ...[...acceptedOwnerV1Files.keys()].map((path) => `:(exclude)${path}`),
];
const frozenBackendPaths = ["src", "prisma"];
const failures = [];

function runGit(args) {
  return spawnSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
}

function assertFrozen(label, paths) {
  const diff = runGit(["diff", "--quiet", freezeCommit, "--", ...paths]);
  if (diff.status !== 0) {
    const detail = runGit(["diff", "--stat", freezeCommit, "--", ...paths]);
    failures.push(`${label} changed from the freeze commit:\n${detail.stdout.trim()}`);
  }

  const untracked = runGit([
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
    "--",
    ...paths,
  ]);
  if (untracked.status !== 0) {
    failures.push(`${label} status could not be checked: ${untracked.stderr.trim()}`);
  } else if (untracked.stdout.trim()) {
    failures.push(`${label} contains untracked changes:\n${untracked.stdout.trim()}`);
  }
}

function filesBelow(directory) {
  try {
    return readdirSync(directory).flatMap((entry) => {
      const path = join(directory, entry);
      return statSync(path).isDirectory() ? filesBelow(path) : [path];
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

function digestPaths(paths) {
  const hash = createHash("sha256");
  const files = paths
    .flatMap((path) => filesBelow(join(repositoryRoot, path)))
    .sort();
  for (const file of files) {
    hash.update(relative(repositoryRoot, file));
    hash.update("\0");
    hash.update(readFileSync(file));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function block(source, declaration) {
  const match = source.match(new RegExp(`export const ${declaration}[^=]*=\\s*\\[([\\s\\S]*?)\\n\\];`));
  return match?.[1] ?? "";
}

function quotedValues(source, property) {
  return [...source.matchAll(new RegExp(`${property}:\\s*["']([^"']+)["']`, "g"))].map(
    (match) => match[1],
  );
}

function stringLiterals(source) {
  return [...source.matchAll(/(["'`])([^\n]*?)\1/g)].map((match) => match[2]);
}

assertFrozen("V1", frozenV1Paths);
for (const [path, expectedDigest] of acceptedOwnerV1Files) {
  const actualDigest = createHash("sha256")
    .update(readFileSync(join(repositoryRoot, path)))
    .digest("hex");
  if (actualDigest !== expectedDigest) {
    failures.push(
      `Owner-approved V1 companion changed from the 2026-08-10 snapshot: ${path}\nexpected ${expectedDigest}\nactual   ${actualDigest}`,
    );
  }
}
const backendDigest = digestPaths(frozenBackendPaths);
if (backendDigest !== acceptedBackendDigest) {
  failures.push(
    `Backend changed from the owner-approved 2026-08-10 snapshot:\nexpected ${acceptedBackendDigest}\nactual   ${backendDigest}`,
  );
}

const registry = readFileSync(join(repositoryRoot, "src/rbac/registry.ts"), "utf8");
const forbiddenModuleSlugs = new Set(quotedValues(block(registry, "MODULES"), "slug"));
const forbiddenRoleNames = new Set(quotedValues(block(registry, "ROLES"), "name"));
const forbiddenOptionKeys = new Set();

for (const file of filesBelow(join(repositoryRoot, "src/catalog/options"))) {
  if (extname(file) !== ".ts") continue;
  const source = readFileSync(file, "utf8");
  for (const value of quotedValues(source, "optionKey")) forbiddenOptionKeys.add(value);
  for (const value of quotedValues(source, "key")) {
    if (value.includes(".")) forbiddenOptionKeys.add(value);
  }
}

const sourceFiles = filesBelow(componentRoot).filter((file) => [".ts", ".tsx"].includes(extname(file)));
for (const file of sourceFiles) {
  const source = readFileSync(file, "utf8");
  const displayPath = relative(repositoryRoot, file);

  const forbiddenImports = [
    /(?:from|import\s*\()\s*["'][^"']*components\/ui(?:\.tsx)?["']/, 
    /(?:from|import\s*\()\s*["'][^"']*components\/icons(?:\.tsx)?["']/, 
    /(?:from|import\s*\()\s*["'][^"']*components\/toast(?:\.tsx)?["']/, 
    /(?:from|import\s*\()\s*["'][^"']*app\/\(app\)[^"']*["']/, 
    /(?:from|import\s*\()\s*["'][^"']*(?:^|\/)src(?:\/|["'])/,
  ];
  for (const pattern of forbiddenImports) {
    if (pattern.test(source)) failures.push(`${displayPath} crosses a forbidden import boundary.`);
  }

  const imports = [...source.matchAll(/(?:from\s*|import\s*\()\s*["']([^"']+)["']/g)].map(
    (match) => match[1],
  );
  for (const specifier of imports) {
    if (specifier.startsWith(".")) {
      if (!resolve(dirname(file), specifier).startsWith(componentRoot)) {
        failures.push(`${displayPath} imports outside components/v2 through ${JSON.stringify(specifier)}.`);
      }
    } else if (specifier.startsWith("@/") && !/^@\/lib\/(?:v2\/|api$|types$|permissions$|format$|server-api$)/.test(specifier)) {
      failures.push(`${displayPath} imports a non-seam alias ${JSON.stringify(specifier)}.`);
    }
  }

  if (/\bclassName\s*\?:/.test(source) || /\bstyle\s*\?:/.test(source)) {
    failures.push(`${displayPath} exposes a className/style escape hatch.`);
  }
  if (/\bstyle\s*=|\.style\./.test(source)) failures.push(`${displayPath} uses inline styling.`);
  if (/(?:#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|\bbox-shadow\b|\bdrop-shadow\b)/i.test(source)) {
    failures.push(`${displayPath} bypasses the V2 colour/elevation tokens.`);
  }

  if (file.endsWith("state.tsx") === false && /data-v2-state(?:-label)?/.test(source)) {
    failures.push(`${displayPath} duplicates the state grammar; use state.tsx.`);
  }

  for (const literal of stringLiterals(source)) {
    if (forbiddenModuleSlugs.has(literal)) {
      failures.push(`${displayPath} hardcodes module slug ${JSON.stringify(literal)}.`);
    }
    if (forbiddenRoleNames.has(literal)) {
      failures.push(`${displayPath} hardcodes role name ${JSON.stringify(literal)}.`);
    }
    if (forbiddenOptionKeys.has(literal)) {
      failures.push(`${displayPath} hardcodes option key ${JSON.stringify(literal)}.`);
    }
  }
}

const configureSourceFiles = [
  ...filesBelow(join(v2RouteRoot, "configure")),
  join(repositoryRoot, "web/lib/v2/configure.ts"),
].filter((file) => [".ts", ".tsx"].includes(extname(file)));

for (const file of configureSourceFiles) {
  const source = readFileSync(file, "utf8");
  const displayPath = relative(repositoryRoot, file);
  for (const literal of stringLiterals(source)) {
    if (forbiddenOptionKeys.has(literal)) {
      failures.push(`${displayPath} hardcodes product option key ${JSON.stringify(literal)}.`);
    }
  }
}

const css = readFileSync(v2Stylesheet, "utf8");
for (const match of css.matchAll(/--([a-z0-9-_]+)\s*:/gi)) {
  if (!match[1].startsWith("v2-")) failures.push(`web/app/v2.css declares non-V2 token --${match[1]}.`);
}
for (const match of css.matchAll(/var\(--([a-z0-9-_]+)/gi)) {
  if (!match[1].startsWith("v2-")) failures.push(`web/app/v2.css consumes non-V2 token --${match[1]}.`);
}

const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
let lastBrace = -1;
for (let index = 0; index < cssWithoutComments.length; index += 1) {
  const character = cssWithoutComments[index];
  if (character !== "{" && character !== "}") continue;
  if (character === "{") {
    const prelude = cssWithoutComments.slice(lastBrace + 1, index).trim();
    if (prelude && !prelude.startsWith("@") && !prelude.includes("[data-v2]")) {
      failures.push(`web/app/v2.css has an unscoped selector: ${prelude.replace(/\s+/g, " ")}.`);
    }
  }
  lastBrace = index;
}

if (/prefers-color-scheme|@page|\[data-v2\][^{]*\bsvg\b/i.test(cssWithoutComments)) {
  failures.push("web/app/v2.css violates the light-only or document/SVG isolation contract.");
}

const expectedV2Pages = [
  "page.tsx",
  "account/page.tsx",
  "configure/page.tsx",
  "products/page.tsx",
  "products/[id]/page.tsx",
  "orders/page.tsx",
  "orders/[id]/page.tsx",
  "orders/[id]/items/page.tsx",
  "orders/[id]/customer-price/page.tsx",
  "orders/[id]/documents/page.tsx",
  "manage/catalog-pricing/page.tsx",
  "manage/discounts/page.tsx",
  "manage/settings/company/page.tsx",
  "manage/settings/financial/page.tsx",
  "manage/team/page.tsx",
  "manage/team/[id]/page.tsx",
  "manage/roles/page.tsx",
  "manage/roles/[id]/page.tsx",
];

for (const page of expectedV2Pages) {
  const file = join(v2RouteRoot, page);
  let source;
  try {
    source = readFileSync(file, "utf8");
  } catch {
    failures.push(`Missing mapped V2 route page: ${page}.`);
    continue;
  }
  const guarded = page === "account/page.tsx"
    ? /getCurrentUser\(\)/.test(source) && /redirect\("\/login"\)/.test(source)
    : /requirePagePermission\(/.test(source);
  if (!guarded) failures.push(`Mapped V2 route is not server-guarded: ${page}.`);
}

const v2Layout = readFileSync(join(repositoryRoot, "web/app/(v2)/layout.tsx"), "utf8");
if (!/getCurrentUser\(\)/.test(v2Layout) || !/mustChangePassword/.test(v2Layout) || !/PermissionsProvider/.test(v2Layout)) {
  failures.push("The V2 layout does not preserve the login/change-password/render guard contract.");
}

const v2Shell = readFileSync(join(repositoryRoot, "web/app/(v2)/v2-shell.tsx"), "utf8");
if (!/buildV2Navigation\(user\.nav\)/.test(v2Shell) || !/<Sidebar/.test(v2Shell) || !/<Header/.test(v2Shell)) {
  failures.push("The V2 shell is not composed from user.nav plus the approved Sidebar/Header.");
}

const proxy = readFileSync(join(repositoryRoot, "web/proxy.ts"), "utf8");
if (!/pathname === "\/"/.test(proxy) || !/pathname\.startsWith\("\/v1\/"\)/.test(proxy)) {
  failures.push("The chooser/V1 alias proxy contract is missing.");
}

for (const aliasFile of ["web/app/v1/layout.tsx", "web/app/v1/page.tsx"]) {
  if (!readFileSync(join(repositoryRoot, aliasFile), "utf8").includes("@/app/(app)/")) {
    failures.push(`${aliasFile} does not reuse the frozen V1 route implementation.`);
  }
}

const shellContract = spawnSync(
  process.execPath,
  ["--import", "tsx", "web/scripts/check-v2-shell.ts"],
  { cwd: repositoryRoot, encoding: "utf8" },
);
if (shellContract.status !== 0) {
  failures.push(`V2 shell contract tests failed:\n${shellContract.stderr || shellContract.stdout}`);
}

const dashboardContract = spawnSync(
  process.execPath,
  ["--import", "tsx", "scripts/check-v2-dashboard.ts"],
  { cwd: join(repositoryRoot, "web"), encoding: "utf8" },
);
if (dashboardContract.status !== 0) {
  failures.push(`V2 dashboard contract tests failed:\n${dashboardContract.stderr || dashboardContract.stdout}`);
}

const ordersContract = spawnSync(
  process.execPath,
  ["--import", "tsx", "scripts/check-v2-orders.ts"],
  { cwd: join(repositoryRoot, "web"), encoding: "utf8" },
);
if (ordersContract.status !== 0) {
  failures.push(`V2 Orders contract tests failed:\n${ordersContract.stderr || ordersContract.stdout}`);
}

const configureContract = spawnSync(
  process.execPath,
  ["--import", "tsx", "scripts/check-v2-configure.ts"],
  { cwd: join(repositoryRoot, "web"), encoding: "utf8" },
);
if (configureContract.status !== 0) {
  failures.push(`V2 Quote/configure contract tests failed:\n${configureContract.stderr || configureContract.stdout}`);
}

const productsContract = spawnSync(
  process.execPath,
  ["--import", "tsx", "scripts/check-v2-products.ts"],
  { cwd: join(repositoryRoot, "web"), encoding: "utf8" },
);
if (productsContract.status !== 0) {
  failures.push(`V2 Products contract tests failed:\n${productsContract.stderr || productsContract.stdout}`);
}

if (failures.length) {
  console.error(`V2 boundary checks failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`V2 boundary checks passed (${sourceFiles.length} component source files checked).`);
console.log(
  `V1 matches freeze commit ${freezeCommit} except for the content-pinned owner companion; backend matches the owner-approved 2026-08-10 snapshot.`,
);
console.log(
  shellContract.stdout.trim()
    || "V2 shell contract checks passed (data-driven navigation, route preservation, safe preference targets).",
);
console.log(
  dashboardContract.stdout.trim()
    || "V2 dashboard contract checks passed (permission priority, scope variants, UTC buckets, all-page aggregation, server total fallback).",
);
console.log(
  ordersContract.stdout.trim()
    || "V2 Orders contract checks passed (server filters, unified basket lines, all seven grouped documents, commercial parsing).",
);
console.log(
  configureContract.stdout.trim()
    || "V2 Quote/configure contract checks passed (task-first entry, one reducer, guarded resolve loop, Standard persistence, Custom parity, in-workspace basket).",
);
console.log(
  productsContract.stdout.trim()
    || "V2 Products contract checks passed (paged product browsing, per-tile SVG degradation, reference separation, task-mode entry, context preservation).",
);
