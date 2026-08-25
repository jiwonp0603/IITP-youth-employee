export type YouthFormValues = {
  name: string;
  birthDate: string;
  hireDate: string;
  participationStartDate: string;
  participationEndDate: string;
  laborCostRate: string;
};

export type YouthFormErrors = Partial<Record<keyof YouthFormValues, string>>;

export const EMPTY_YOUTH_FORM: YouthFormValues = {
  name: "",
  birthDate: "",
  hireDate: "",
  participationStartDate: "",
  participationEndDate: "",
  laborCostRate: "",
};

export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export function validateYouthForm(values: YouthFormValues): YouthFormErrors {
  const errors: YouthFormErrors = {};
  const dateFields: Array<{
    field: keyof Pick<YouthFormValues, "birthDate" | "hireDate" | "participationStartDate" | "participationEndDate">;
    requiredMessage: string;
    invalidMessage: string;
  }> = [
    {
      field: "birthDate",
      requiredMessage: "생년월일을 입력해 주세요.",
      invalidMessage: "올바른 생년월일을 입력해 주세요.",
    },
    {
      field: "hireDate",
      requiredMessage: "채용일자를 입력해 주세요.",
      invalidMessage: "올바른 채용일자를 입력해 주세요.",
    },
    {
      field: "participationStartDate",
      requiredMessage: "과제 참여시작일자를 입력해 주세요.",
      invalidMessage: "올바른 과제 참여시작일자를 입력해 주세요.",
    },
    {
      field: "participationEndDate",
      requiredMessage: "과제 참여종료일자를 입력해 주세요.",
      invalidMessage: "올바른 과제 참여종료일자를 입력해 주세요.",
    },
  ];

  if (!values.name.trim()) errors.name = "성명을 입력해 주세요.";

  for (const { field, requiredMessage, invalidMessage } of dateFields) {
    if (!values[field]) {
      errors[field] = requiredMessage;
    } else if (!isValidDate(values[field])) {
      errors[field] = invalidMessage;
    }
  }

  if (!values.laborCostRate.trim()) {
    errors.laborCostRate = "인건비계상률을 입력해 주세요.";
  } else {
    const rate = Number(values.laborCostRate);
    if (!Number.isFinite(rate)) {
      errors.laborCostRate = "올바른 숫자를 입력해 주세요.";
    } else if (rate < 0) {
      errors.laborCostRate = "인건비계상률은 0 이상이어야 합니다.";
    } else if (rate > 100) {
      errors.laborCostRate = "인건비계상률은 100 이하여야 합니다.";
    }
  }

  if (
    isValidDate(values.participationStartDate)
    && isValidDate(values.participationEndDate)
    && values.participationEndDate < values.participationStartDate
  ) {
    errors.participationEndDate = "참여종료일은 참여시작일보다 빠를 수 없습니다.";
  }

  return errors;
}
