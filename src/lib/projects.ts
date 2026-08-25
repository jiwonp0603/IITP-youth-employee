import "server-only";

import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Project = {
  projectId: string;
  projectName: string;
  companyName: string;
  companyType: string;
  currentYearPeriod: string;
  requiredYouthCount: number;
  actualYouthCount: number;
};

type ProjectLoadResult =
  | { ok: true; projects: Project[] }
  | { ok: false; message: string };

const FIELD_HEADERS = {
  projectId: "과제번호",
  projectName: "한글과제명",
  companyName: "기관명",
  companyType: "기관유형",
  currentYearPeriod: "당해연도 연구기간",
  requiredYouthCount: "정부지원금 비례 신규채용 의무인원",
  actualYouthCount: "정부지원금 비례 신규채용 실채용인력",
} as const;

export function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .replace(/&nbsp;|&#160;|&#xa0;/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<\/?(?:p|div|li|tr|td|span)[^>]*>/gi, " ")
    .replace(/\\[nr]/g, " ")
    .replace(/[\r\n\u00a0\u2007\u202f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toCount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function loadProjectsFromWorkbook(): ProjectLoadResult {
  const workbookPath = path.join(process.cwd(), "data", "projects.xlsx");

  if (!fs.existsSync(workbookPath)) {
    return {
      ok: false,
      message: "과제정보 파일(data/projects.xlsx)을 찾을 수 없습니다. 파일을 확인해 주세요.",
    };
  }

  try {
    const workbook = XLSX.readFile(workbookPath, { cellDates: true });
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      return { ok: false, message: "Excel 파일에 조회할 시트가 없습니다." };
    }

    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[firstSheetName], {
      header: 1,
      defval: "",
      raw: false,
    });

    if (rows.length === 0) {
      return { ok: false, message: "Excel 파일에 과제정보가 없습니다." };
    }

    const normalizedHeaders = rows[0].map(normalizeHeader);
    const indexes = Object.fromEntries(
      Object.entries(FIELD_HEADERS).map(([field, header]) => [
        field,
        normalizedHeaders.indexOf(normalizeHeader(header)),
      ]),
    ) as Record<keyof Project, number>;

    const missingHeaders = Object.entries(indexes)
      .filter(([, index]) => index < 0)
      .map(([field]) => FIELD_HEADERS[field as keyof Project]);

    if (missingHeaders.length > 0) {
      return {
        ok: false,
        message: `Excel 필수 컬럼이 누락되었습니다: ${missingHeaders.join(", ")}`,
      };
    }

    const projects = rows.slice(1).flatMap((row) => {
      const projectName = String(row[indexes.projectName] ?? "").trim();
      const projectId = String(row[indexes.projectId] ?? "").trim();

      if (!projectName && !projectId) return [];

      return [{
        projectId,
        projectName,
        companyName: String(row[indexes.companyName] ?? "").trim(),
        companyType: String(row[indexes.companyType] ?? "").trim(),
        currentYearPeriod: String(row[indexes.currentYearPeriod] ?? "").trim(),
        requiredYouthCount: toCount(row[indexes.requiredYouthCount]),
        actualYouthCount: toCount(row[indexes.actualYouthCount]),
      }];
    });

    if (projects.length === 0) {
      return { ok: false, message: "Excel 파일에 조회 가능한 과제정보가 없습니다." };
    }

    return { ok: true, projects };
  } catch (error) {
    console.error("Excel 과제정보를 읽는 중 오류가 발생했습니다.", error);
    return {
      ok: false,
      message: "Excel 파일을 읽는 중 오류가 발생했습니다. 파일 형식과 내용을 확인해 주세요.",
    };
  }
}

export async function loadProjects(): Promise<ProjectLoadResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return loadProjectsFromWorkbook();
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("projects")
      .select("project_id, project_name, company_name, company_type, current_year_period, required_youth_count, actual_youth_count")
      .order("project_name");

    if (error) throw error;

    const projects = (data ?? []).map((row) => ({
      projectId: row.project_id,
      projectName: row.project_name,
      companyName: row.company_name,
      companyType: row.company_type,
      currentYearPeriod: row.current_year_period,
      requiredYouthCount: row.required_youth_count,
      actualYouthCount: row.actual_youth_count,
    }));

    return { ok: true, projects };
  } catch (error) {
    console.error("Supabase 과제정보를 읽는 중 오류가 발생했습니다. Excel 백업을 사용합니다.", error);
    return loadProjectsFromWorkbook();
  }
}
