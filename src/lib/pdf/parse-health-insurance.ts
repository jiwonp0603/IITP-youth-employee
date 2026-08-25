import type { ExtractedEvidenceData, QualificationRecord } from "@/types/evidence";
import { findLabeledValue, normalizeDate } from "./parsing-utils";

const STOP_LABELS = ["생년월일", "사업장명", "자격취득일", "자격상실일", "성명"];

function extractDateAfter(line: string, label: RegExp): string | null {
  const match = line.match(label);
  return match ? normalizeDate(line.slice((match.index ?? 0) + match[0].length)) : null;
}

export function parseHealthInsurance(text: string): ExtractedEvidenceData {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const name = findLabeledValue(lines, /(?:가입자\s*)?성명/, STOP_LABELS);
  const birthDate = normalizeDate(findLabeledValue(lines, /생년월일/, STOP_LABELS));
  const qualificationRecords: QualificationRecord[] = [];

  for (const line of lines) {
    const workplaceMatch = line.match(/사업장명\s*[:：]?\s*(.+?)(?=\s+(?:자격)?취득일|\s+자격상실일|$)/);
    const qualificationDate = extractDateAfter(line, /(?:자격)?취득일\s*[:：]?/);
    const lossDate = extractDateAfter(line, /자격상실일\s*[:：]?/);

    if (workplaceMatch && (qualificationDate || lossDate)) {
      qualificationRecords.push({
        workplaceName: workplaceMatch[1].replace(/[|｜]+$/g, "").trim() || null,
        qualificationDate,
        ...(lossDate ? { lossDate } : {}),
      });
    }
  }

  const labeledWorkplace = findLabeledValue(lines, /사업장명/, STOP_LABELS);
  const labeledQualificationDate = normalizeDate(
    findLabeledValue(lines, /(?:자격)?취득일/, STOP_LABELS),
  );
  const workplaceName = qualificationRecords[0]?.workplaceName ?? labeledWorkplace;
  const qualificationDate = qualificationRecords[0]?.qualificationDate ?? labeledQualificationDate;

  if (qualificationRecords.length === 0 && (workplaceName || qualificationDate)) {
    qualificationRecords.push({ workplaceName, qualificationDate });
  }

  return {
    name,
    birthDate,
    workplaceName,
    qualificationDate,
    ...(qualificationRecords.length > 0 ? { qualificationRecords } : {}),
  };
}
