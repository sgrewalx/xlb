import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export function buildHistoryRecord(experiment, { whatWasLearned, recommendedFollowUp, completedAt }) {
  if (experiment.status !== "completed" || experiment.decision?.state !== "decided") throw new Error("Only decided, completed experiments can enter history");
  return {
    schemaVersion: 1,
    id: experiment.id,
    hypothesis: experiment.hypothesis,
    targetPaths: structuredClone(experiment.targetPaths),
    baseline: structuredClone(experiment.baseline),
    treatment: {
      productionReleaseSha: experiment.measurementStart.productionReleaseSha,
      productionDeployedAt: experiment.measurementStart.productionDeployedAt,
    },
    measurementWindow: structuredClone(experiment.measurement.sourceWindow),
    metrics: structuredClone(experiment.measurement.metrics),
    decision: structuredClone(experiment.decision),
    whatWasLearned,
    recommendedFollowUp,
    createdAt: experiment.baseline.capturedAt,
    completedAt,
  };
}

export async function appendHistoryRecord(directory, record) {
  await mkdir(directory, { recursive: true });
  const filename = `${record.completedAt.slice(0, 10)}-${record.id}.json`;
  const output = resolve(directory, filename);
  await writeFile(output, `${JSON.stringify(record, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  return output;
}
