#!/usr/bin/env bun

import { readdir } from "node:fs/promises";
import { join } from "node:path";

const DIST_DIR = join(import.meta.dir, "..", "dist");

async function generateChecksums(): Promise<void> {
  console.log("Generating checksums...\n");

  const files = await readdir(DIST_DIR);
  const binaries = files.filter(
    (f) => !(f.endsWith(".txt") || f.endsWith(".map"))
  );

  const checksums: string[] = [];

  for (const filename of binaries) {
    const filepath = join(DIST_DIR, filename);
    const file = Bun.file(filepath);
    const buffer = await file.arrayBuffer();

    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    checksums.push(`${hashHex}  ${filename}`);
    console.log(`${hashHex}  ${filename}`);
  }

  const checksumsPath = join(DIST_DIR, "checksums.txt");
  await Bun.write(checksumsPath, `${checksums.join("\n")}\n`);

  console.log(`\nChecksums written to: ${checksumsPath}`);
}

async function release(): Promise<void> {
  // Read version from package.json
  const packageJson = await Bun.file(
    join(import.meta.dir, "..", "package.json")
  ).json();
  const version = packageJson.version;

  console.log(`Preparing release v${version}\n`);
  console.log("─".repeat(50));

  // Check if dist directory exists
  try {
    await readdir(DIST_DIR);
  } catch {
    console.error(
      "Error: dist/ directory not found. Run 'bun run build' first."
    );
    process.exit(1);
  }

  // Generate checksums
  await generateChecksums();

  console.log(`\n${"─".repeat(50)}`);
  console.log("Release Preparation Complete!");
  console.log("─".repeat(50));
  console.log(`
Next steps:
1. Commit and push your changes
2. Create a git tag: git tag v${version}
3. Push the tag: git push origin v${version}
4. GitHub Actions will automatically create the release

Or manually upload the binaries from dist/ to GitHub Releases.
`);
}

release().catch((error) => {
  console.error("Release preparation failed:", error);
  process.exit(1);
});
