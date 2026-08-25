import type { ExtractedEvidenceData, InsuranceMember } from "@/types/evidence";
import { findLabeledValue, normalizeDate } from "./parsing-utils";

const STOP_LABELS = ["가입자 성명", "성명", "생년월일", "생년정보", "자격취득일", "가입일", "사업장명"];
const DATE_PATTERN = String.raw`\d{4}[.\-/]?\d{1,2}[.\-/]?\d{1,2}`;

function extractWorkplaceName(text: string, lines: string[]): string | null {
  const match = text.match(
    /사업장명\s*[:：]?\s*([\s\S]+?)(?=\s*(?:사업장\s*관리번호|사업장관리번호|관리번호|대표자|발급기준일|발급일|순번|가입자\s*성명|성명)(?:\s|[:：]|\d|$))/,
  );
  if (match?.[1]) return match[1].replace(/\s+/g, " ").trim() || null;
  return findLabeledValue(lines, /사업장명/, STOP_LABELS);
}

function addMember(members: InsuranceMember[], member: InsuranceMember) {
  const duplicate = members.some(
    (current) =>
      current.name === member.name &&
      current.birthDate === member.birthDate &&
      current.qualificationDate === member.qualificationDate,
  );
  if (!duplicate) members.push(member);
}

export function parseFourInsurance(text: string): ExtractedEvidenceData {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const workplaceName = extractWorkplaceName(text, lines);
  const members: InsuranceMember[] = [];

  for (const line of lines) {
    const labeledName = line.match(/(?:가입자\s*)?성명\s*[:：]?\s*([가-힣]{2,5})(?=\s+(?:생년월일|생년정보|자격취득일|가입일)|\s*[|｜]|$)/);
    const birthMatch = line.match(/(?:생년월일|생년정보)\s*[:：]?\s*((?:\d{4}[.\-/]?\d{1,2}[.\-/]?\d{1,2}))/);
    const qualificationMatch = line.match(/(?:자격취득일|가입일)\s*[:：]?\s*((?:\d{4}[.\-/]?\d{1,2}[.\-/]?\d{1,2}))/);

    if (labeledName) {
      addMember(members, {
        name: labeledName[1],
        birthDate: normalizeDate(birthMatch?.[1]),
        qualificationDate: normalizeDate(qualificationMatch?.[1]),
      });
      continue;
    }

    const row = line.match(/^([가-힣]{2,5})\s+((?:\d{4}[.\-/]?\d{1,2}[.\-/]?\d{1,2}))\s+((?:\d{4}[.\-/]?\d{1,2}[.\-/]?\d{1,2}))$/);
    if (row) {
      addMember(members, {
        name: row[1],
        birthDate: normalizeDate(row[2]),
        qualificationDate: normalizeDate(row[3]),
      });
    }
  }

  const flattenedText = text.replace(/\s+/g, " ").trim();
  const listRowPattern = new RegExp(
    String.raw`(?:^|\s)(\d{1,4})\s*([가-힣]{2,5})\s*(${DATE_PATTERN})\s*(${DATE_PATTERN}|[-–])\s*(${DATE_PATTERN}|[-–])\s*(${DATE_PATTERN}|[-–])(?=\s|적용|$)`,
    "g",
  );

  for (const row of flattenedText.matchAll(listRowPattern)) {
    const pensionDate = normalizeDate(row[4]);
    const healthInsuranceDate = normalizeDate(row[5]);
    const employmentInsuranceDate = normalizeDate(row[6]);
    addMember(members, {
      name: row[2],
      birthDate: normalizeDate(row[3]),
      // 4대보험 명부의 비교 대표값은 건강보험 취득일을 우선 사용한다.
      qualificationDate: healthInsuranceDate ?? employmentInsuranceDate ?? pensionDate,
    });
  }

  return { workplaceName, members };
}
