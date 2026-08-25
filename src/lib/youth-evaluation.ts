import type { Project } from "@/lib/projects";
import type {
  EvidenceType,
  ExtractedEvidenceData,
  InsuranceMember,
} from "@/types/evidence";
import type { YouthEmployee } from "@/types/youth-employee";

export type ComparisonStatus =
  | "match"
  | "mismatch"
  | "needs-review"
  | "not-applicable";

export type YouthAgeStatus = "eligible" | "needs-review";
export type FinalVerificationStatus = "approved" | "needs-review";

export type VerificationItem = {
  key: "name" | "birthDate" | "hireDate" | "workplace" | "age" | "participationStart" | "participationEnd" | "laborCostRate";
  label: string;
  inputValue: string;
  evidenceValue: string;
  status: ComparisonStatus | YouthAgeStatus;
};

export type YouthEvaluation = {
  finalStatus: FinalVerificationStatus;
  age: number | null;
  items: VerificationItem[];
  actionItems: string[];
};

type EvaluationInput = {
  employee: YouthEmployee;
  evidenceType: EvidenceType;
  extractedEvidence: ExtractedEvidenceData | null;
  selectedProject: Pick<Project, "companyName">;
};

export type ProjectYouthCounts = {
  approvedCount: number;
  reviewCount: number;
  currentAcceptedCount: number;
  remainingCount: number;
};

function parseDateParts(value: string): { year: number; month: number; day: number } | null {
  const match = value.trim().match(/^(\d{4})[.\-/]?(\d{2})[.\-/]?(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;

  return { year, month, day };
}

export function normalizeComparisonText(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
  return normalized || null;
}

export function normalizeComparisonDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parts = parseDateParts(value);
  if (!parts) return null;
  return `${parts.year.toString().padStart(4, "0")}-${parts.month.toString().padStart(2, "0")}-${parts.day.toString().padStart(2, "0")}`;
}

export function compareName(input: string, evidence: string | null | undefined): ComparisonStatus {
  const normalizedInput = normalizeComparisonText(input);
  const normalizedEvidence = normalizeComparisonText(evidence);
  if (!normalizedEvidence) return "needs-review";
  return normalizedInput === normalizedEvidence ? "match" : "mismatch";
}

export function compareBirthDate(input: string, evidence: string | null | undefined): ComparisonStatus {
  const normalizedEvidence = normalizeComparisonDate(evidence);
  if (!normalizedEvidence) return "needs-review";
  return normalizeComparisonDate(input) === normalizedEvidence ? "match" : "mismatch";
}

export function compareHireDate(input: string, evidence: string | null | undefined): ComparisonStatus {
  const normalizedEvidence = normalizeComparisonDate(evidence);
  if (!normalizedEvidence) return "needs-review";
  return normalizeComparisonDate(input) === normalizedEvidence ? "match" : "mismatch";
}

export function compareWorkplace(input: string, evidence: string | null | undefined): ComparisonStatus {
  const normalizedEvidence = normalizeComparisonText(evidence);
  if (!normalizedEvidence) return "needs-review";
  return normalizeComparisonText(input) === normalizedEvidence ? "match" : "needs-review";
}

export function calculateAgeOnDate(birthDate: string, referenceDate: string): number | null {
  const birth = parseDateParts(birthDate);
  const reference = parseDateParts(referenceDate);
  if (!birth || !reference) return null;

  const birthNumber = birth.year * 10000 + birth.month * 100 + birth.day;
  const referenceNumber = reference.year * 10000 + reference.month * 100 + reference.day;
  if (birthNumber > referenceNumber) return null;

  let age = reference.year - birth.year;
  if (
    reference.month < birth.month ||
    (reference.month === birth.month && reference.day < birth.day)
  ) age -= 1;

  return age;
}

export function checkYouthAgeEligibility(age: number | null): YouthAgeStatus {
  return age !== null && age >= 19 && age <= 34 ? "eligible" : "needs-review";
}

function selectInsuranceMember(
  employee: YouthEmployee,
  members: InsuranceMember[] | undefined,
): { member: InsuranceMember | null; issue: "not-found" | "ambiguous" | null } {
  const inputName = normalizeComparisonText(employee.name);
  const nameMatches = (members ?? []).filter(
    (member) => normalizeComparisonText(member.name) === inputName,
  );

  if (nameMatches.length === 0) return { member: null, issue: "not-found" };
  if (nameMatches.length === 1) return { member: nameMatches[0], issue: null };

  const inputBirthDate = normalizeComparisonDate(employee.birthDate);
  const birthMatches = nameMatches.filter(
    (member) => normalizeComparisonDate(member.birthDate) === inputBirthDate,
  );
  return birthMatches.length === 1
    ? { member: birthMatches[0], issue: null }
    : { member: null, issue: "ambiguous" };
}

export function evaluateYouthEmployee({
  employee,
  evidenceType,
  extractedEvidence,
  selectedProject,
}: EvaluationInput): YouthEvaluation {
  let evidenceName = extractedEvidence?.name ?? null;
  let evidenceBirthDate = extractedEvidence?.birthDate ?? null;
  let evidenceQualificationDate = extractedEvidence?.qualificationDate ?? null;
  let memberIssue: "not-found" | "ambiguous" | null = null;

  if (evidenceType === "four-major-insurance-list") {
    const selection = selectInsuranceMember(employee, extractedEvidence?.members);
    memberIssue = selection.issue;
    evidenceName = selection.member?.name ?? null;
    evidenceBirthDate = selection.member?.birthDate ?? null;
    evidenceQualificationDate = selection.member?.qualificationDate ?? null;
  }

  const nameStatus = compareName(employee.name, evidenceName);
  const birthDateStatus = compareBirthDate(employee.birthDate, evidenceBirthDate);
  const hireDateStatus = compareHireDate(employee.hireDate, evidenceQualificationDate);
  const workplaceStatus = compareWorkplace(selectedProject.companyName, extractedEvidence?.workplaceName);
  const age = calculateAgeOnDate(employee.birthDate, employee.hireDate);
  const ageStatus = checkYouthAgeEligibility(age);
  const finalStatus: FinalVerificationStatus =
    nameStatus === "match" &&
    birthDateStatus === "match" &&
    hireDateStatus === "match" &&
    ageStatus === "eligible"
      ? "approved"
      : "needs-review";

  const actionItems: string[] = [];
  if (memberIssue === "not-found") {
    actionItems.push("4대보험 명부에서 입력한 성명과 일치하는 가입자를 찾지 못했습니다. 직접 확인해 주세요.");
  } else if (memberIssue === "ambiguous") {
    actionItems.push("4대보험 명부에서 입력한 인력을 한 명으로 특정하지 못했습니다. 직접 확인해 주세요.");
  } else if (nameStatus === "mismatch") {
    actionItems.push("입력한 성명과 증빙자료의 성명이 일치하지 않습니다.");
  } else if (nameStatus === "needs-review") {
    actionItems.push("증빙자료에서 성명을 자동으로 확인하지 못했습니다. 직접 확인해 주세요.");
  }

  if (birthDateStatus === "mismatch") {
    actionItems.push("입력한 생년월일과 증빙자료의 생년월일이 일치하지 않습니다.");
  } else if (birthDateStatus === "needs-review") {
    actionItems.push("증빙자료에서 생년월일을 자동으로 확인하지 못했습니다. 직접 확인해 주세요.");
  }

  if (hireDateStatus === "mismatch") {
    actionItems.push("입력한 채용일자와 증빙자료의 자격취득일이 일치하지 않습니다.");
  } else if (hireDateStatus === "needs-review") {
    actionItems.push("증빙자료에서 자격취득일을 자동으로 확인하지 못했습니다. 직접 확인해 주세요.");
  }

  if (ageStatus === "needs-review") {
    actionItems.push("채용일 기준 청년 연령요건(만 19~34세)을 충족하는지 확인해 주세요.");
  }

  if (workplaceStatus === "needs-review") {
    actionItems.push("선택한 과제의 기관명과 증빙자료의 사업장명이 다르거나 확인되지 않습니다. 사업장 정보를 확인해 주세요.");
  }

  return {
    finalStatus,
    age,
    items: [
      { key: "name", label: "성명", inputValue: employee.name, evidenceValue: evidenceName ?? "확인 불가", status: nameStatus },
      { key: "birthDate", label: "생년월일", inputValue: employee.birthDate, evidenceValue: evidenceBirthDate ?? "확인 불가", status: birthDateStatus },
      { key: "hireDate", label: "채용일자", inputValue: employee.hireDate, evidenceValue: evidenceQualificationDate ?? "확인 불가", status: hireDateStatus },
      { key: "workplace", label: "사업장명", inputValue: selectedProject.companyName || "확인 불가", evidenceValue: extractedEvidence?.workplaceName ?? "확인 불가", status: workplaceStatus },
      { key: "age", label: "채용 당시 만 나이", inputValue: `${employee.birthDate} · ${employee.hireDate}`, evidenceValue: age === null ? "계산 불가" : `만 ${age}세`, status: ageStatus },
      { key: "participationStart", label: "참여시작일", inputValue: employee.participationStartDate, evidenceValue: "-", status: "not-applicable" },
      { key: "participationEnd", label: "참여종료일", inputValue: employee.participationEndDate, evidenceValue: "-", status: "not-applicable" },
      { key: "laborCostRate", label: "인건비계상률", inputValue: `${employee.laborCostRate}%`, evidenceValue: "-", status: "not-applicable" },
    ],
    actionItems,
  };
}

export function calculateProjectYouthCounts(
  excelActualYouthCount: number,
  requiredYouthCount: number,
  statuses: FinalVerificationStatus[],
): ProjectYouthCounts {
  const approvedCount = statuses.filter((status) => status === "approved").length;
  const reviewCount = statuses.filter((status) => status === "needs-review").length;
  const currentAcceptedCount = excelActualYouthCount + approvedCount;
  return {
    approvedCount,
    reviewCount,
    currentAcceptedCount,
    remainingCount: Math.max(requiredYouthCount - currentAcceptedCount, 0),
  };
}
