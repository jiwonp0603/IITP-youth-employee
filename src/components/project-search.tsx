"use client";

import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import type { Project } from "@/lib/projects";
import {
  calculateProjectYouthCounts,
  evaluateYouthEmployee,
  type YouthEvaluation,
} from "@/lib/youth-evaluation";
import {
  EMPTY_YOUTH_FORM,
  validateYouthForm,
  type YouthFormErrors,
  type YouthFormValues,
} from "@/lib/youth-validation";
import type { YouthEmployee } from "@/types/youth-employee";
import {
  EVIDENCE_TYPE_LABELS,
  type Evidence,
  type EvidenceType,
  type ExtractionResponse,
} from "@/types/evidence";

type ProjectSearchProps = { projects: Project[] };
type SessionRegistration = {
  employee: YouthEmployee;
  evidence: Evidence;
  evaluation: YouthEvaluation;
};

const MAX_PDF_SIZE = 10 * 1024 * 1024;

function formatDate(value: string): string {
  return value.replaceAll("-", ".");
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function validateEvidenceFile(file: File): string | null {
  const hasPdfExtension = file.name.toLocaleLowerCase("en-US").endsWith(".pdf");
  const hasPdfMimeType = !file.type || file.type === "application/pdf";

  if (!hasPdfExtension || !hasPdfMimeType) {
    return "PDF 파일만 업로드할 수 있습니다.";
  }

  if (file.size > MAX_PDF_SIZE) {
    return "파일 크기는 10MB 이하만 업로드할 수 있습니다.";
  }

  return null;
}

function CountCard({
  label,
  value,
  tone,
  detail,
}: {
  label: string;
  value: number;
  tone?: string;
  detail?: string;
}) {
  return (
    <div className={`count-card ${tone ?? ""}`}>
      <span>{label}</span>
      <strong>{value.toLocaleString("ko-KR")}<small>명</small></strong>
      {detail && <p className="count-detail">{detail}</p>}
    </div>
  );
}

function FormField({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`form-field ${error ? "has-error" : ""}`}>
      <label htmlFor={id}>{label}<span aria-hidden="true">*</span></label>
      {children}
      {error && <p className="field-error" id={`${id}-error`}>{error}</p>}
    </div>
  );
}

function ExtractionResultPanel({ result }: { result: ExtractionResponse }) {
  const value = (text: string | null | undefined) => text || "확인 불가";
  const statusLabel = {
    success: "자동 추출 완료",
    partial: "일부 정보 확인 불가",
    unsupported: "자동 추출 불가",
    failed: "분석 실패",
  }[result.status];

  return (
    <section className={`extraction-result ${result.status}`} aria-labelledby="extraction-result-heading" aria-live="polite">
      <div className="extraction-result-heading">
        <div>
          <h3 id="extraction-result-heading">증빙자료 자동 추출 결과</h3>
          <p>문서에 적힌 내용을 구조화한 결과이며, 입력정보와의 일치 여부를 판정한 결과가 아닙니다.</p>
        </div>
        <span>{statusLabel}</span>
      </div>

      {result.message && <p className="extraction-message">{result.message}</p>}

      {result.data && result.evidenceType === "health-insurance-qualification" && (
        <div className="extraction-key-values">
          <div><span>증빙자료 종류</span><strong>{EVIDENCE_TYPE_LABELS[result.evidenceType]}</strong></div>
          <div><span>성명</span><strong>{value(result.data.name)}</strong></div>
          <div><span>생년월일</span><strong>{value(result.data.birthDate)}</strong></div>
          <div><span>사업장명</span><strong>{value(result.data.workplaceName)}</strong></div>
          <div><span>자격취득일</span><strong>{value(result.data.qualificationDate)}</strong></div>
        </div>
      )}

      {result.data && result.evidenceType === "four-major-insurance-list" && (
        <div className="member-result">
          <div className="workplace-result"><span>사업장명</span><strong>{value(result.data.workplaceName)}</strong></div>
          {result.data.members && result.data.members.length > 0 ? (
            <div className="member-table-wrap">
              <table>
                <thead><tr><th>성명</th><th>생년월일</th><th>자격취득일</th></tr></thead>
                <tbody>
                  {result.data.members.map((member, index) => (
                    <tr key={`${member.name ?? "member"}-${index}`}>
                      <td>{value(member.name)}</td>
                      <td>{value(member.birthDate)}</td>
                      <td>{value(member.qualificationDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="no-members">가입자 정보를 확인할 수 없습니다.</p>}
        </div>
      )}

      {result.rawText && (
        <details className="raw-text-details">
          <summary>PDF 추출 원문 보기</summary>
          <p>분석 확인용 표시이며 저장되지 않습니다.</p>
          <pre>{result.rawText}</pre>
        </details>
      )}
    </section>
  );
}

function VerificationResultPanel({ evaluation }: { evaluation: YouthEvaluation }) {
  const statusLabel = {
    match: "일치",
    mismatch: "불일치",
    "needs-review": "확인필요",
    "not-applicable": "검증대상 아님",
    eligible: "충족",
  } as const;
  const approved = evaluation.finalStatus === "approved";

  return (
    <section className={`verification-result ${approved ? "approved" : "needs-review"}`} aria-labelledby="verification-result-heading" aria-live="polite">
      <div className="verification-heading">
        <div>
          <p>최종 판정</p>
          <h3 id="verification-result-heading">{approved ? "정상" : "확인필요"}</h3>
          <strong>
            {approved
              ? "입력한 청년정보와 증빙자료의 주요 정보가 일치하며 청년 연령요건을 충족합니다."
              : "입력정보와 증빙자료 중 확인이 필요한 항목이 있습니다."}
          </strong>
        </div>
        <span>{approved ? "✓ 정상" : "! 확인필요"}</span>
      </div>

      <div className="verification-table-wrap">
        <table>
          <thead><tr><th>확인항목</th><th>입력정보</th><th>증빙/계산정보</th><th>판정</th></tr></thead>
          <tbody>
            {evaluation.items.map((item) => (
              <tr key={item.key}>
                <th scope="row">{item.label}</th>
                <td>{item.inputValue}</td>
                <td>{item.evidenceValue}</td>
                <td><span className={`comparison-badge ${item.status}`}>{statusLabel[item.status]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="action-items">
        <h4>조치 필요사항</h4>
        {evaluation.actionItems.length > 0 ? (
          <ul>{evaluation.actionItems.map((item) => <li key={item}>{item}</li>)}</ul>
        ) : <p>추가 확인이 필요한 사항이 없습니다.</p>}
      </div>
    </section>
  );
}

function YouthRegistration({
  project,
  registrations,
  onRegister,
}: {
  project: Project;
  registrations: SessionRegistration[];
  onRegister: (employee: YouthEmployee, evidence: Evidence, evaluation: YouthEvaluation) => void;
}) {
  const [values, setValues] = useState<YouthFormValues>(EMPTY_YOUTH_FORM);
  const [errors, setErrors] = useState<YouthFormErrors>({});
  const [evidenceType, setEvidenceType] = useState<EvidenceType | "">("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceTypeError, setEvidenceTypeError] = useState("");
  const [fileError, setFileError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [extractionResult, setExtractionResult] = useState<ExtractionResponse | null>(null);
  const [verificationResult, setVerificationResult] = useState<YouthEvaluation | null>(null);
  const [pendingReviewId, setPendingReviewId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastSubmissionSignatureRef = useRef("");

  const updateField = (field: keyof YouthFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSuccessMessage("");
    setVerificationResult(null);
  };

  const selectEvidenceType = (type: EvidenceType) => {
    setEvidenceType(type);
    setEvidenceTypeError("");
    setSuccessMessage("");
    setExtractionResult(null);
    setVerificationResult(null);
  };

  const selectFile = (file: File | null) => {
    if (!file) return;

    const error = validateEvidenceFile(file);
    if (error) {
      setEvidenceFile(null);
      setFileError(error);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setEvidenceFile(file);
    setFileError("");
    setSuccessMessage("");
    setExtractionResult(null);
    setVerificationResult(null);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    selectFile(event.target.files?.[0] ?? null);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    selectFile(event.dataTransfer.files?.[0] ?? null);
  };

  const removeFile = () => {
    setEvidenceFile(null);
    setFileError("");
    setSuccessMessage("");
    setExtractionResult(null);
    setVerificationResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateYouthForm(values);
    const nextEvidenceTypeError = evidenceType ? "" : "증빙자료 종류를 선택해 주세요.";
    const nextFileError = evidenceFile ? "" : fileError || "증빙자료 PDF 파일을 업로드해 주세요.";

    if (Object.keys(nextErrors).length > 0 || nextEvidenceTypeError || nextFileError) {
      setErrors(nextErrors);
      setEvidenceTypeError(nextEvidenceTypeError);
      setFileError(nextFileError);
      setSuccessMessage("");
      setExtractionResult(null);
      setVerificationResult(null);
      return;
    }

    if (!evidenceType || !evidenceFile) return;

    const employee: YouthEmployee = {
      id: pendingReviewId ?? crypto.randomUUID(),
      projectId: project.projectId,
      name: values.name.trim(),
      birthDate: values.birthDate,
      hireDate: values.hireDate,
      participationStartDate: values.participationStartDate,
      participationEndDate: values.participationEndDate,
      laborCostRate: Number(values.laborCostRate),
    };

    const evidence: Evidence = {
      type: evidenceType,
      file: evidenceFile,
      fileName: evidenceFile.name,
      fileSize: evidenceFile.size,
    };

    const submissionSignature = JSON.stringify([
      project.projectId,
      values,
      evidenceType,
      evidenceFile.name,
      evidenceFile.size,
      evidenceFile.lastModified,
    ]);
    if (lastSubmissionSignatureRef.current === submissionSignature) {
      setSuccessMessage("동일한 정보와 증빙자료는 이미 이번 세션 목록에 등록되어 있습니다.");
      return;
    }

    setIsAnalyzing(true);
    setSuccessMessage("");
    setVerificationResult(null);

    try {
      const formData = new FormData();
      formData.append("file", evidenceFile);
      formData.append("evidenceType", evidenceType);
      const apiResponse = await fetch("/api/evidence/extract", {
        method: "POST",
        body: formData,
      });
      const result = await apiResponse.json() as ExtractionResponse;
      setExtractionResult(result);

      if (!apiResponse.ok || result.status === "failed") return;

      const evaluation = evaluateYouthEmployee({
        employee,
        evidenceType,
        extractedEvidence: result.data,
        selectedProject: project,
      });
      setVerificationResult(evaluation);
      onRegister(employee, evidence, evaluation);
      lastSubmissionSignatureRef.current = submissionSignature;

      if (evaluation.finalStatus === "approved") {
        setPendingReviewId(null);
        setValues(EMPTY_YOUTH_FORM);
        setErrors({});
        setEvidenceType("");
        setEvidenceFile(null);
        setEvidenceTypeError("");
        setFileError("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        setSuccessMessage(`${employee.name} 님이 정상 등록되었습니다.`);
      } else {
        setPendingReviewId(employee.id);
        setSuccessMessage(`${employee.name} 님이 검토 필요 상태로 이번 세션 목록에 추가되었습니다. 입력정보를 수정한 뒤 다시 검증할 수 있습니다.`);
      }
    } catch {
      setExtractionResult({
        status: "failed",
        evidenceType,
        data: null,
        message: "증빙자료 분석 중 오류가 발생했습니다. 다시 시도해 주세요.",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="registration-block">
      <div className="section-heading registration-heading">
        <span className="step">3</span>
        <div>
          <h2 id="registration-heading">신규 청년인력 등록</h2>
          <p>신규 채용한 청년인력의 정보를 입력해 주세요.</p>
        </div>
      </div>

      <form className="youth-form" onSubmit={handleSubmit} noValidate aria-labelledby="registration-heading">
        <div className="form-grid">
          <FormField id="youth-name" label="성명" error={errors.name}>
            <input
              id="youth-name"
              type="text"
              value={values.name}
              onChange={(event) => updateField("name", event.target.value)}
              placeholder="성명을 입력하세요"
              required
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "youth-name-error" : undefined}
            />
          </FormField>

          <FormField id="birth-date" label="생년월일" error={errors.birthDate}>
            <input
              id="birth-date"
              type="date"
              value={values.birthDate}
              onChange={(event) => updateField("birthDate", event.target.value)}
              required
              aria-invalid={Boolean(errors.birthDate)}
              aria-describedby={errors.birthDate ? "birth-date-error" : undefined}
            />
          </FormField>

          <FormField id="hire-date" label="채용일자" error={errors.hireDate}>
            <input
              id="hire-date"
              type="date"
              value={values.hireDate}
              onChange={(event) => updateField("hireDate", event.target.value)}
              required
              aria-invalid={Boolean(errors.hireDate)}
              aria-describedby={errors.hireDate ? "hire-date-error" : undefined}
            />
          </FormField>

          <FormField id="participation-start-date" label="2026년도 과제 참여시작일자" error={errors.participationStartDate}>
            <input
              id="participation-start-date"
              type="date"
              value={values.participationStartDate}
              onChange={(event) => updateField("participationStartDate", event.target.value)}
              required
              aria-invalid={Boolean(errors.participationStartDate)}
              aria-describedby={errors.participationStartDate ? "participation-start-date-error" : undefined}
            />
          </FormField>

          <FormField id="participation-end-date" label="2026년도 과제 참여종료일자" error={errors.participationEndDate}>
            <input
              id="participation-end-date"
              type="date"
              value={values.participationEndDate}
              onChange={(event) => updateField("participationEndDate", event.target.value)}
              required
              aria-invalid={Boolean(errors.participationEndDate)}
              aria-describedby={errors.participationEndDate ? "participation-end-date-error" : undefined}
            />
          </FormField>

          <FormField id="labor-cost-rate" label="인건비계상률" error={errors.laborCostRate}>
            <div className="percent-input">
              <input
                id="labor-cost-rate"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={values.laborCostRate}
                onChange={(event) => updateField("laborCostRate", event.target.value)}
                placeholder="0"
                required
                aria-invalid={Boolean(errors.laborCostRate)}
                aria-describedby={errors.laborCostRate ? "labor-cost-rate-error" : undefined}
              />
              <span aria-hidden="true">%</span>
            </div>
          </FormField>
        </div>

        <section className="evidence-section" aria-labelledby="evidence-heading">
          <div className="evidence-heading">
            <div>
              <h3 id="evidence-heading">증빙자료 제출</h3>
              <p>청년 채용정보 확인을 위한 증빙자료를 선택하고 PDF 파일을 첨부해 주세요.</p>
            </div>
            <span>PDF · 최대 10MB</span>
          </div>

          <fieldset className="evidence-type-fieldset" aria-describedby={evidenceTypeError ? "evidence-type-error" : undefined}>
            <legend>증빙자료 종류 <span aria-hidden="true">*</span></legend>
            <div className="evidence-options">
              {(Object.entries(EVIDENCE_TYPE_LABELS) as Array<[EvidenceType, string]>).map(([type, label]) => (
                <label key={type} className={evidenceType === type ? "selected" : ""}>
                  <input
                    type="radio"
                    name="evidence-type"
                    value={type}
                    checked={evidenceType === type}
                    onChange={() => selectEvidenceType(type)}
                  />
                  <span className="radio-indicator" aria-hidden="true" />
                  <span>
                    <strong>{label}</strong>
                    <small>{type === "health-insurance-qualification" ? "개인 가입 및 자격 이력 확인" : "사업장 가입 인력 명부 확인"}</small>
                  </span>
                </label>
              ))}
            </div>
            {evidenceTypeError && <p className="field-error" id="evidence-type-error">{evidenceTypeError}</p>}
          </fieldset>

          <div className="file-upload-field">
            <label className="file-upload-label" htmlFor="evidence-file">PDF 파일 <span aria-hidden="true">*</span></label>
            <input
              ref={fileInputRef}
              className="visually-hidden-file"
              id="evidence-file"
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileChange}
              aria-describedby={fileError ? "evidence-file-error" : "privacy-notice"}
            />

            <div
              className={`file-drop-zone ${isDragging ? "dragging" : ""} ${fileError ? "has-error" : ""}`}
              onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <span className="pdf-mark" aria-hidden="true">PDF</span>
              <div>
                <strong>{evidenceFile ? "선택한 PDF 파일" : "PDF 파일을 선택하거나 여기에 끌어 놓으세요."}</strong>
                <p>{evidenceFile ? "다른 파일을 선택하면 기존 파일이 교체됩니다." : "PDF 형식, 최대 10MB"}</p>
              </div>
              <label className="file-select-button" htmlFor="evidence-file">
                {evidenceFile ? "다른 파일 선택" : "파일 선택"}
              </label>
            </div>

            {!evidenceFile && !fileError && <p className="no-file">선택된 파일이 없습니다.</p>}
            {fileError && <p className="field-error" id="evidence-file-error">{fileError}</p>}

            {evidenceFile && (
              <div className="selected-evidence">
                <span className="pdf-file-icon" aria-hidden="true">PDF</span>
                <div className="selected-evidence-details">
                  <div><span>증빙자료 종류</span><strong>{evidenceType ? EVIDENCE_TYPE_LABELS[evidenceType] : "미선택"}</strong></div>
                  <div><span>파일명</span><strong>{evidenceFile.name}</strong></div>
                  <div><span>파일 크기</span><strong>{formatFileSize(evidenceFile.size)}</strong></div>
                </div>
                <button type="button" className="remove-file" onClick={removeFile}>파일 삭제</button>
              </div>
            )}
          </div>

          <p className="privacy-notice" id="privacy-notice">
            <span aria-hidden="true">!</span>
            본 화면은 기능 검증을 위한 데모입니다. 실제 개인정보가 포함된 증빙자료는 테스트에 사용하지 마세요.
          </p>
        </section>

        {extractionResult && <ExtractionResultPanel result={extractionResult} />}
        {verificationResult && <VerificationResultPanel evaluation={verificationResult} />}

        <div className="form-actions">
          <p><span aria-hidden="true">*</span> 필수 입력 항목</p>
          <button type="submit" disabled={isAnalyzing}>
            {isAnalyzing ? "증빙자료를 분석하고 있습니다..." : "청년정보 등록 및 검증"}
          </button>
        </div>
      </form>

      {successMessage && <p className="registration-success" role="status">✓ {successMessage}</p>}

      {registrations.length > 0 && (
        <section className="session-employees" aria-labelledby="session-employees-heading">
          <div className="session-list-title">
            <div>
              <h3 id="session-employees-heading">이번 세션 등록 인력</h3>
              <p>브라우저를 새로고침하면 등록 내역이 초기화됩니다.</p>
            </div>
            <span>{registrations.length.toLocaleString("ko-KR")}명</span>
          </div>

          <div className="employee-list">
            {registrations.map(({ employee, evidence, evaluation }) => (
              <article key={employee.id} className="employee-card">
                <div className="employee-name"><span>성명</span><strong>{employee.name}</strong></div>
                <div><span>생년월일</span><strong>{formatDate(employee.birthDate)}</strong></div>
                <div><span>채용일자</span><strong>{formatDate(employee.hireDate)}</strong></div>
                <div><span>과제 참여기간</span><strong>{formatDate(employee.participationStartDate)} ~ {formatDate(employee.participationEndDate)}</strong></div>
                <div><span>인건비계상률</span><strong>{employee.laborCostRate.toLocaleString("ko-KR")}%</strong></div>
                <div><span>증빙자료</span><strong>{EVIDENCE_TYPE_LABELS[evidence.type]}</strong></div>
                <div className="employee-file"><span>파일</span><strong>{evidence.fileName}</strong></div>
                <div className="employee-verification"><span>검증상태</span><strong className={evaluation.finalStatus}>{evaluation.finalStatus === "approved" ? "정상" : "확인필요"}</strong></div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default function ProjectSearch({ projects }: ProjectSearchProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Project | null>(null);
  const [registrationsByProject, setRegistrationsByProject] = useState<Record<string, SessionRegistration[]>>({});
  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");

  const results = useMemo(() => {
    if (!normalizedQuery) return [];
    return projects.filter((project) =>
      project.projectName.toLocaleLowerCase("ko-KR").includes(normalizedQuery),
    );
  }, [normalizedQuery, projects]);

  const selectedRegistrations = selected ? registrationsByProject[selected.projectId] ?? [] : [];
  const counts = selected
    ? calculateProjectYouthCounts(
        selected.actualYouthCount,
        selected.requiredYouthCount,
        selectedRegistrations.map(({ evaluation }) => evaluation.finalStatus),
      )
    : { approvedCount: 0, reviewCount: 0, currentAcceptedCount: 0, remainingCount: 0 };
  const remaining = counts.remainingCount;
  const fulfilled = selected ? remaining === 0 : false;

  const registerEmployee = (employee: YouthEmployee, evidence: Evidence, evaluation: YouthEvaluation) => {
    setRegistrationsByProject((current) => {
      const registrations = current[employee.projectId] ?? [];
      const existingIndex = registrations.findIndex(
        ({ employee: registeredEmployee }) => registeredEmployee.id === employee.id,
      );
      const nextRegistration = { employee, evidence, evaluation };
      const nextRegistrations = existingIndex >= 0
        ? registrations.map((registration, index) => index === existingIndex ? nextRegistration : registration)
        : [...registrations, nextRegistration];
      return { ...current, [employee.projectId]: nextRegistrations };
    });
  };

  return (
    <div className="content-stack">
      <section className="search-panel" aria-labelledby="search-heading">
        <div className="section-heading">
          <span className="step">1</span>
          <div>
            <h2 id="search-heading">과제 검색</h2>
            <p>수행 중인 과제의 한글과제명을 입력해 주세요.</p>
          </div>
        </div>

        <div className="search-field">
          <span className="search-symbol" aria-hidden="true">⌕</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="한글과제명을 입력하세요"
            aria-label="한글과제명 검색"
            autoComplete="off"
          />
          {query && (
            <button className="clear-button" type="button" onClick={() => setQuery("")}>지우기</button>
          )}
        </div>

        {!normalizedQuery && (
          <p className="search-help">과제명의 일부만 입력해도 검색할 수 있습니다.</p>
        )}

        {normalizedQuery && results.length > 0 && (
          <div className="results" aria-live="polite">
            <p className="result-count"><strong>{results.length}건</strong>의 과제를 찾았습니다.</p>
            <ul>
              {results.map((project) => (
                <li key={`${project.projectId}-${project.companyName}`}>
                  <button
                    type="button"
                    className={selected?.projectId === project.projectId ? "selected" : ""}
                    onClick={() => setSelected(project)}
                  >
                    <span className="result-main">
                      <strong>{project.projectName}</strong>
                      <span>{project.companyName}</span>
                    </span>
                    <span className="project-id">{project.projectId}</span>
                    <span className="chevron" aria-hidden="true">›</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {normalizedQuery && results.length === 0 && (
          <div className="empty-results" role="status">
            <span aria-hidden="true">⌕</span>
            <strong>검색 결과가 없습니다.</strong>
            <p>과제명을 확인한 후 다른 검색어를 입력해 주세요.</p>
          </div>
        )}
      </section>

      {selected && (
        <section className="detail-section" aria-labelledby="detail-heading">
          <div className="section-heading">
            <span className="step">2</span>
            <div>
              <h2 id="detail-heading">선택된 과제 정보</h2>
              <p>선택한 과제의 기본 정보와 채용 현황입니다.</p>
            </div>
          </div>

          <div className="project-summary">
            <div className="summary-title">
              <span>한글과제명</span>
              <h3>{selected.projectName}</h3>
            </div>
            <dl>
              <div><dt>기관명</dt><dd>{selected.companyName || "-"}</dd></div>
              <div><dt>기관유형</dt><dd>{selected.companyType || "-"}</dd></div>
              <div><dt>과제번호</dt><dd>{selected.projectId || "-"}</dd></div>
              <div><dt>2026년도 연구기간</dt><dd>{selected.currentYearPeriod || "-"}</dd></div>
            </dl>
          </div>

          <div className={`status-panel ${fulfilled ? "fulfilled" : "needed"}`}>
            <div className="status-header">
              <div>
                <p className="status-kicker">청년고용 현황</p>
                <h3>{fulfilled ? "의무채용 충족" : "추가 등록 필요"}</h3>
              </div>
              <span className="status-badge">
                <span aria-hidden="true">{fulfilled ? "✓" : "!"}</span>
                {fulfilled ? "충족" : "확인 필요"}
              </span>
            </div>

            <div className="count-grid status-count-grid">
              <CountCard label="청년 의무채용 인원" value={selected.requiredYouthCount} />
              <CountCard label="Excel 기준 기존 실채용 인원" value={selected.actualYouthCount} />
              <CountCard label="이번 세션 정상 등록 인원" value={counts.approvedCount} />
              <CountCard label="검토 필요 인원" value={counts.reviewCount} tone="review" />
              <CountCard label="현재 인정 인원" value={counts.currentAcceptedCount} detail={`Excel ${selected.actualYouthCount.toLocaleString("ko-KR")}명 + 정상 등록 ${counts.approvedCount.toLocaleString("ko-KR")}명`} />
              <CountCard label="추가 등록 필요 인원" value={remaining} tone="emphasis" />
            </div>

            <p className="status-message">
              <span aria-hidden="true">{fulfilled ? "✓" : "!"}</span>
              {fulfilled
                ? "청년고용 의무채용 인원을 충족하였습니다."
                : `청년 ${remaining.toLocaleString("ko-KR")}명의 추가 등록이 필요합니다.`}
            </p>
          </div>

          <YouthRegistration
            key={selected.projectId}
            project={selected}
            registrations={selectedRegistrations}
            onRegister={registerEmployee}
          />
        </section>
      )}
    </div>
  );
}
