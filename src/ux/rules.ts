export type UxIssue = {
  code: string;
  message: string;
  level: "error" | "warning";
  path?: string;
};

export type UxReport = {
  errors: UxIssue[];
  warnings: UxIssue[];
};

export function uxReportEmpty(): UxReport {
  return { errors: [], warnings: [] };
}

export function uxPush(r: UxReport, issue: UxIssue): void {
  if (issue.level === "error") r.errors.push(issue);
  else r.warnings.push(issue);
}

