import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../../../web/app/v2.css", import.meta.url), "utf8");
const colours = new Map();

for (const match of css.matchAll(/--v2-color-([a-z0-9-]+):\s*(#[0-9a-f]{6});/gi)) {
  colours.set(match[1], match[2].toUpperCase());
}

const pairs = [
  ["Primary text / surface", "neutral-950", "neutral-0", 4.5],
  ["Primary text / page", "neutral-950", "neutral-50", 4.5],
  ["Secondary text / surface", "neutral-600", "neutral-0", 4.5],
  ["Secondary text / page", "neutral-600", "neutral-50", 4.5],
  ["Metadata / surface", "neutral-500", "neutral-0", 4.5],
  ["Metadata / page", "neutral-500", "neutral-50", 4.5],
  ["Table heading / subtle surface", "neutral-700", "neutral-100", 4.5],
  ["Disabled text / subtle surface", "neutral-600", "neutral-100", 4.5],
  ["Accent text / surface", "accent", "neutral-0", 4.5],
  ["Accent text / accent soft", "accent", "accent-soft", 4.5],
  ["Primary button text / accent", "neutral-0", "accent", 4.5],
  ["Primary button text / accent hover", "neutral-0", "accent-hover", 4.5],
  ["Success text / surface", "success", "neutral-0", 4.5],
  ["Success text / success soft", "success", "success-soft", 4.5],
  ["Warning text / surface", "warning", "neutral-0", 4.5],
  ["Warning text / warning soft", "warning", "warning-soft", 4.5],
  ["Error text / surface", "error", "neutral-0", 4.5],
  ["Error text / error soft", "error", "error-soft", 4.5],
  ["Control border / surface", "neutral-400", "neutral-0", 3],
  ["Control or structural border / page", "neutral-400", "neutral-50", 3],
  ["Focus ring / surface", "accent", "neutral-0", 3],
  ["Focus ring / page", "accent", "neutral-50", 3],
];

function luminance(hex) {
  const channels = [1, 3, 5]
    .map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((channel) =>
      channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground, background) {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

let failed = false;
console.log("Pair\tForeground\tBackground\tRatio\tRequired\tResult");
for (const [label, foregroundName, backgroundName, threshold] of pairs) {
  const foreground = colours.get(foregroundName);
  const background = colours.get(backgroundName);
  if (!foreground || !background) {
    throw new Error(`Missing token for ${label}: ${foregroundName} / ${backgroundName}`);
  }
  const ratio = contrast(foreground, background);
  const passed = ratio >= threshold;
  failed ||= !passed;
  console.log(
    `${label}\t${foreground}\t${background}\t${ratio.toFixed(2)}:1\t${threshold.toFixed(1)}:1\t${passed ? "PASS" : "FAIL"}`,
  );
}

if (failed) process.exitCode = 1;
