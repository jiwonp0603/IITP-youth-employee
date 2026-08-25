import { NextResponse } from "next/server";
import { extractPdfText } from "@/lib/pdf/extract-text";
import { parseFourInsurance } from "@/lib/pdf/parse-four-insurance";
import { parseHealthInsurance } from "@/lib/pdf/parse-health-insurance";
import type {
  EvidenceType,
  ExtractedEvidenceData,
  ExtractionResponse,
  ExtractionStatus,
} from "@/types/evidence";

export const runtime = "nodejs";

const MAX_PDF_SIZE = 10 * 1024 * 1024;
const EVIDENCE_TYPES: EvidenceType[] = [
  "health-insurance-qualification",
  "four-major-insurance-list",
];

function isEvidenceType(value: FormDataEntryValue | null): value is EvidenceType {
  return typeof value === "string" && EVIDENCE_TYPES.includes(value as EvidenceType);
}

function extractionStatus(evidenceType: EvidenceType, data: ExtractedEvidenceData): ExtractionStatus {
  if (evidenceType === "health-insurance-qualification") {
    return data.name && data.birthDate && data.workplaceName && data.qualificationDate
      ? "success"
      : "partial";
  }

  const completeMember = data.members?.some(
    (member) => member.name && member.birthDate && member.qualificationDate,
  );
  return data.workplaceName && completeMember ? "success" : "partial";
}

function response(
  body: ExtractionResponse,
  status = 200,
): NextResponse<ExtractionResponse> {
  return NextResponse.json(body, { status });
}

export async function POST(request: Request) {
  let evidenceType: EvidenceType = "health-insurance-qualification";

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const requestedEvidenceType = formData.get("evidenceType");

    if (!isEvidenceType(requestedEvidenceType)) {
      return response({
        status: "failed",
        evidenceType,
        data: null,
        message: "증빙자료 종류를 확인해 주세요.",
      }, 400);
    }
    evidenceType = requestedEvidenceType;

    if (!(file instanceof File)) {
      return response({
        status: "failed",
        evidenceType,
        data: null,
        message: "증빙자료 PDF 파일을 업로드해 주세요.",
      }, 400);
    }

    const hasPdfExtension = file.name.toLocaleLowerCase("en-US").endsWith(".pdf");
    const hasPdfMimeType = !file.type || file.type === "application/pdf";
    if (!hasPdfExtension || !hasPdfMimeType) {
      return response({
        status: "failed",
        evidenceType,
        data: null,
        message: "PDF 파일만 업로드할 수 있습니다.",
      }, 400);
    }

    if (file.size > MAX_PDF_SIZE) {
      return response({
        status: "failed",
        evidenceType,
        data: null,
        message: "파일 크기는 10MB 이하만 업로드할 수 있습니다.",
      }, 413);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length < 5 || new TextDecoder("ascii").decode(bytes.slice(0, 5)) !== "%PDF-") {
      return response({
        status: "failed",
        evidenceType,
        data: null,
        message: "PDF 파일을 읽을 수 없습니다. 파일이 손상되지 않았는지 확인해 주세요.",
      }, 422);
    }

    let rawText: string;
    try {
      rawText = await extractPdfText(bytes);
    } catch {
      return response({
        status: "failed",
        evidenceType,
        data: null,
        message: "PDF 파일을 읽을 수 없습니다. 파일이 손상되지 않았는지 확인해 주세요.",
      }, 422);
    }

    if (rawText.replace(/\s/g, "").length < 10) {
      return response({
        status: "unsupported",
        evidenceType,
        data: null,
        message: "이 PDF는 텍스트 기반 문서가 아니거나 자동으로 읽을 수 없습니다. 추후 OCR 기능이 필요합니다.",
      });
    }

    const data = evidenceType === "health-insurance-qualification"
      ? parseHealthInsurance(rawText)
      : parseFourInsurance(rawText);
    const status = extractionStatus(evidenceType, data);

    return response({
      status,
      evidenceType,
      data,
      ...(status === "partial" ? { message: "일부 정보를 자동으로 확인하지 못했습니다." } : {}),
      rawText,
    });
  } catch {
    return response({
      status: "failed",
      evidenceType,
      data: null,
      message: "증빙자료 분석 중 오류가 발생했습니다. 다시 시도해 주세요.",
    }, 500);
  }
}
