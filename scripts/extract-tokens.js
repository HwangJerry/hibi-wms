#!/usr/bin/env node
/**
 * extract-tokens.js
 *
 * Semi-automated design-token extraction from Claude Design HTML exports.
 *
 * What it does:
 *  - Scans design/mockups/*.html for <style> blocks.
 *  - Pulls CSS custom properties (--name: value;) out of a `:root` block (light)
 *    and a `.dark` / `[data-theme="dark"]` block (dark).
 *  - Diffs them against the canonical packages/ui/tokens/tokens.json.
 *  - Flags: NEW tokens, CHANGED values for existing names, and NEAR-DUPLICATE
 *    colors (small RGB distance from an existing token under a different name) —
 *    the most common source of design-system drift across separately generated mockups.
 *  - Writes a proposal file. It NEVER auto-writes tokens.json — a human merges it.
 *
 * Usage:
 *   node scripts/extract-tokens.js <mockupsDir> <canonicalTokensPath> <outProposalPath>
 *   node scripts/extract-tokens.js design/mockups packages/ui/tokens/tokens.json packages/ui/tokens/tokens.proposed.json
 *
 * No dependencies beyond Node's fs/path — regex-based, intentionally simple.
 */

const fs = require("fs");
const path = require("path");

const [, , mockupsDirArg, canonicalPathArg, outPathArg] = process.argv;

const mockupsDir = mockupsDirArg || "design/mockups";
const canonicalPath = canonicalPathArg || "packages/ui/tokens/tokens.json";
const outPath = outPathArg || "packages/ui/tokens/tokens.proposed.json";

const VAR_RE = /--([a-zA-Z0-9-]+)\s*:\s*([^;]+);/g;
const STYLE_BLOCK_RE = /<style[^>]*>([\s\S]*?)<\/style>/gi;
const DARK_SELECTOR_RE = /(\.dark|\[data-theme=["']dark["']\])\s*\{([^}]*)\}/gi;
const ROOT_SELECTOR_RE = /:root\s*\{([^}]*)\}/gi;

function extractVars(blockCss) {
  const vars = {};
  let m;
  VAR_RE.lastIndex = 0;
  while ((m = VAR_RE.exec(blockCss))) {
    vars[m[1].trim()] = m[2].trim();
  }
  return vars;
}

function parseHtmlFile(filePath) {
  const html = fs.readFileSync(filePath, "utf8");
  const light = {};
  const dark = {};

  let styleMatch;
  STYLE_BLOCK_RE.lastIndex = 0;
  while ((styleMatch = STYLE_BLOCK_RE.exec(html))) {
    const css = styleMatch[1];

    let rootMatch;
    ROOT_SELECTOR_RE.lastIndex = 0;
    while ((rootMatch = ROOT_SELECTOR_RE.exec(css))) {
      Object.assign(light, extractVars(rootMatch[1]));
    }

    let darkMatch;
    DARK_SELECTOR_RE.lastIndex = 0;
    while ((darkMatch = DARK_SELECTOR_RE.exec(css))) {
      Object.assign(dark, extractVars(darkMatch[2]));
    }
  }
  return { light, dark };
}

function hexToRgb(hex) {
  const h = hex.replace("#", "").trim();
  if (![3, 6].includes(h.length)) return null;
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return null;
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function colorDistance(hexA, hexB) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  if (!a || !b) return Infinity;
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

function isColor(value) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

function loadCanonical(p) {
  if (!fs.existsSync(p)) return { light: {}, dark: {} };
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return { light: {}, dark: {} };
  }
}

function diffTheme(themeName, extracted, canonical, report) {
  const NEAR_DUPLICATE_THRESHOLD = 12; // RGB euclidean distance

  for (const [name, value] of Object.entries(extracted)) {
    const existingValue = canonical[name];

    if (existingValue === undefined) {
      // Possibly a genuinely new token, or a near-duplicate of an existing one
      // under a different name.
      if (isColor(value)) {
        let nearestMatch = null;
        let nearestDistance = Infinity;
        for (const [existingName, existingVal] of Object.entries(canonical)) {
          if (!isColor(existingVal)) continue;
          const d = colorDistance(value, existingVal);
          if (d < nearestDistance) {
            nearestDistance = d;
            nearestMatch = existingName;
          }
        }
        if (nearestMatch && nearestDistance <= NEAR_DUPLICATE_THRESHOLD) {
          report.nearDuplicates.push({
            theme: themeName,
            newName: name,
            newValue: value,
            existingName: nearestMatch,
            existingValue: canonical[nearestMatch],
            distance: Math.round(nearestDistance * 10) / 10,
          });
          continue;
        }
      }
      report.newTokens.push({ theme: themeName, name, value });
    } else if (existingValue !== value) {
      report.changedTokens.push({
        theme: themeName,
        name,
        oldValue: existingValue,
        newValue: value,
      });
    }
  }
}

function collectByName(themeName, perFileExtractions, report) {
  // name -> [{ value, file }]
  const occurrences = {};
  for (const { file, vars } of perFileExtractions) {
    for (const [name, value] of Object.entries(vars)) {
      (occurrences[name] = occurrences[name] || []).push({ value, file });
    }
  }

  const representative = {};
  for (const [name, list] of Object.entries(occurrences)) {
    const distinctValues = [...new Set(list.map((o) => o.value))];
    if (distinctValues.length > 1) {
      report.crossMockupConflicts.push({
        theme: themeName,
        name,
        occurrences: list,
      });
    }
    // Representative value: most frequent, ties broken by first occurrence.
    const counts = new Map();
    for (const v of distinctValues) counts.set(v, list.filter((o) => o.value === v).length);
    const best = distinctValues.sort((a, b) => counts.get(b) - counts.get(a))[0];
    representative[name] = best;
  }
  return representative;
}

function main() {
  if (!fs.existsSync(mockupsDir)) {
    console.error(`Mockups directory not found: ${mockupsDir}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(mockupsDir)
    .filter((f) => f.toLowerCase().endsWith(".html"))
    .sort(); // deterministic order regardless of OS directory listing

  if (files.length === 0) {
    console.warn(`No .html files found in ${mockupsDir}. Nothing to extract.`);
    process.exit(0);
  }

  const canonical = loadCanonical(canonicalPath);
  const perFile = { light: [], dark: [] };

  for (const file of files) {
    const full = path.join(mockupsDir, file);
    const { light, dark } = parseHtmlFile(full);
    perFile.light.push({ file, vars: light });
    perFile.dark.push({ file, vars: dark });
  }

  const report = { newTokens: [], changedTokens: [], nearDuplicates: [], crossMockupConflicts: [] };
  const merged = {
    light: collectByName("light", perFile.light, report),
    dark: collectByName("dark", perFile.dark, report),
  };

  diffTheme("light", merged.light, canonical.light || {}, report);
  diffTheme("dark", merged.dark, canonical.dark || {}, report);

  const proposal = {
    generatedAt: new Date().toISOString(),
    sourceFiles: files,
    light: merged.light,
    dark: merged.dark,
    report,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(proposal, null, 2));

  console.log(`Scanned ${files.length} mockup file(s): ${files.join(", ")}`);
  console.log(`Proposal written to ${outPath}\n`);

  console.log(`CROSS-MOCKUP CONFLICTS (same name, different files disagree): ${report.crossMockupConflicts.length}`);
  for (const c of report.crossMockupConflicts) {
    const detail = c.occurrences.map((o) => `${o.value} (${o.file})`).join(" vs ");
    console.log(`  [${c.theme}] --${c.name}: ${detail}`);
  }

  console.log(`\nNEW tokens: ${report.newTokens.length}`);
  for (const t of report.newTokens) {
    console.log(`  [${t.theme}] --${t.name}: ${t.value}`);
  }

  console.log(`\nCHANGED tokens: ${report.changedTokens.length}`);
  for (const t of report.changedTokens) {
    console.log(`  [${t.theme}] --${t.name}: ${t.oldValue} -> ${t.newValue}`);
  }

  console.log(`\nNEAR-DUPLICATE colors (review before adding): ${report.nearDuplicates.length}`);
  for (const t of report.nearDuplicates) {
    console.log(
      `  [${t.theme}] --${t.newName}: ${t.newValue} is close to existing --${t.existingName}: ${t.existingValue} (distance ${t.distance}). Consider reusing --${t.existingName}.`
    );
  }

  if (
    report.newTokens.length ||
    report.changedTokens.length ||
    report.nearDuplicates.length ||
    report.crossMockupConflicts.length
  ) {
    console.log(`\nReview ${outPath} and merge accepted changes into ${canonicalPath} by hand.`);
  } else {
    console.log(`\nNo differences from canonical tokens.`);
  }
}

main();
