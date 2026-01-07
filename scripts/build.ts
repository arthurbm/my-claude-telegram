#!/usr/bin/env bun

import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

const DIST_DIR = join(import.meta.dir, "..", "dist");
const ENTRY_POINT = join(import.meta.dir, "..", "src", "notify.ts");

// Read version from package.json
const packageJson = await Bun.file(
  join(import.meta.dir, "..", "package.json")
).json();
const VERSION = packageJson.version;

interface BuildTarget {
  target: string;
  outfile: string;
}

const TARGETS: BuildTarget[] = [
  { target: "bun-linux-x64", outfile: "claude-telegram-linux-x64" },
  { target: "bun-linux-arm64", outfile: "claude-telegram-linux-arm64" },
  { target: "bun-darwin-x64", outfile: "claude-telegram-macos-x64" },
  { target: "bun-darwin-arm64", outfile: "claude-telegram-macos-arm64" },
  { target: "bun-windows-x64", outfile: "claude-telegram-windows-x64.exe" },
];

async function build() {
  console.log(`Building claude-telegram v${VERSION}\n`);

  // Clean and create dist directory
  await rm(DIST_DIR, { recursive: true, force: true });
  await mkdir(DIST_DIR, { recursive: true });

  const results: { target: string; success: boolean; size?: number }[] = [];

  for (const { target, outfile } of TARGETS) {
    const outPath = join(DIST_DIR, outfile);
    console.log(`Building for ${target}...`);

    try {
      const result = await Bun.build({
        entrypoints: [ENTRY_POINT],
        outdir: DIST_DIR,
        naming: outfile,
        minify: true,
        sourcemap: "linked",
        target: target as "bun",
        define: {
          VERSION: JSON.stringify(VERSION),
        },
      });

      if (!result.success) {
        console.error(`  Failed: ${result.logs.join("\n")}`);
        results.push({ target, success: false });
        continue;
      }

      // For compiled binaries, we need to use the compile option
      const proc = Bun.spawn(
        [
          "bun",
          "build",
          "--compile",
          "--minify",
          "--sourcemap",
          `--target=${target}`,
          `--define=VERSION=${JSON.stringify(VERSION)}`,
          ENTRY_POINT,
          "--outfile",
          outPath,
        ],
        {
          stdout: "pipe",
          stderr: "pipe",
        }
      );

      await proc.exited;

      if (proc.exitCode !== 0) {
        const stderr = await new Response(proc.stderr).text();
        console.error(`  Failed: ${stderr}`);
        results.push({ target, success: false });
        continue;
      }

      const file = Bun.file(outPath);
      const size = file.size;
      const sizeMB = (size / 1024 / 1024).toFixed(2);

      console.log(`  Success: ${outfile} (${sizeMB} MB)`);
      results.push({ target, success: true, size });
    } catch (error) {
      console.error(`  Error: ${(error as Error).message}`);
      results.push({ target, success: false });
    }
  }

  console.log(`\n${"─".repeat(50)}`);
  console.log("Build Summary:");
  console.log("─".repeat(50));

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log(`  Successful: ${successful.length}/${results.length}`);

  if (failed.length > 0) {
    console.log(`  Failed: ${failed.map((r) => r.target).join(", ")}`);
    process.exit(1);
  }

  console.log(`\nBinaries written to: ${DIST_DIR}`);
}

build().catch((error) => {
  console.error("Build failed:", error);
  process.exit(1);
});
