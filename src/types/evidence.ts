export type EvidenceType =
  | "health-insurance-qualification"
  | "four-major-insurance-list";

export type Evidence = {
  type: EvidenceType;
  file: File;
  fileName: string;
  fileSize: number;
};

export type ExtractionStatus =
  | "success"
  | "partial"
  | "unsupported"
  | "failed";

export type QualificationRecord = {
  workplaceName: string | null;
  qualificationDate: string | null;
  lossDate?: string | null;
};

export type InsuranceMember = {
  name: string | null;
  birthDate: string | null;
  qualificationDate: string | null;
};

export type ExtractedEvidenceData = {
  name?: string | null;
  birthDate?: string | null;
  workplaceName: string | null;
  qualificationDate?: string | null;
  qualificationRecords?: QualificationRecord[];
  members?: InsuranceMember[];
};

export type ExtractionResponse = {
  status: ExtractionStatus;
  evidenceType: EvidenceType;
  data: ExtractedEvidenceData | null;
  message?: string;
  rawText?: string;
};

export const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  "health-insurance-qualification": "건강보험자격득실확인서",
  "four-major-insurance-list": "4대보험 사업장가입자명부",
};
