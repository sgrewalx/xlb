import { createHash } from "node:crypto";

export const GOVERNANCE_EVIDENCE = {
  sourceHealth: "automation/reports/live-source-health.json",
  liveRisk: "automation/reports/live-risk-report.json",
  autonomyState: "automation/reports/autonomy-state.json",
};

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

export function hashGovernanceEvidence(value) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function buildEvidenceBindings({ health, risk, autonomyState }) {
  return {
    sourceHealth: {
      path: GOVERNANCE_EVIDENCE.sourceHealth,
      sha256: hashGovernanceEvidence(health),
    },
    liveRisk: {
      path: GOVERNANCE_EVIDENCE.liveRisk,
      sha256: hashGovernanceEvidence(risk),
    },
    autonomyState: {
      path: GOVERNANCE_EVIDENCE.autonomyState,
      sha256: hashGovernanceEvidence(autonomyState),
    },
  };
}

export function verifyEvidenceBindings(expected, evidence) {
  const actual = buildEvidenceBindings(evidence);

  for (const [key, expectedPath] of Object.entries(GOVERNANCE_EVIDENCE)) {
    const binding = expected?.[key];
    if (!binding || binding.path !== expectedPath || !/^[a-f0-9]{64}$/.test(binding.sha256 ?? "")) {
      return { valid: false, reason: `${key} evidence binding is missing or invalid` };
    }
    if (binding.sha256 !== actual[key].sha256) {
      return { valid: false, reason: `${key} evidence hash does not match the release state` };
    }
  }

  return { valid: true, reason: "governance evidence matches the release state" };
}
