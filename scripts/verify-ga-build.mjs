import { readFile } from "node:fs/promises";

const PLACEHOLDER = "%VITE_GA_MEASUREMENT_ID%";

export function verifyGaMeasurementBuild({ expectedMeasurementId, documents }) {
  if (!/^G-[A-Z0-9]+$/i.test(expectedMeasurementId ?? "")) {
    throw new Error("VITE_GA_MEASUREMENT_ID is missing or invalid");
  }
  if (!Array.isArray(documents) || documents.length === 0) {
    throw new Error("No built HTML documents were provided for GA verification");
  }

  for (const { label, html } of documents) {
    if (html.includes(PLACEHOLDER)) {
      throw new Error(`${label} contains an unresolved GA measurement placeholder`);
    }
    if (!html.includes(expectedMeasurementId)) {
      throw new Error(`${label} does not contain the configured GA measurement ID`);
    }
  }
}

async function main() {
  const manifest = JSON.parse(await readFile(new URL("../dist/route-documents.json", import.meta.url), "utf8"));
  const paths = ["index.html", "404.html", ...manifest.map((item) => item.documentPath)];
  const documents = await Promise.all([...new Set(paths)].map(async (path) => ({
    label: path,
    html: await readFile(new URL(`../dist/${path}`, import.meta.url), "utf8"),
  })));

  verifyGaMeasurementBuild({
    expectedMeasurementId: process.env.VITE_GA_MEASUREMENT_ID?.trim(),
    documents,
  });
  console.log(`Verified GA measurement ID in ${documents.length} built HTML documents`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
