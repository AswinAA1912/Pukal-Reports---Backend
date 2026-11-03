import { ReportColumn } from "../Components/ReportTableHeader";

export const mapReportDataForExport = <T extends Record<string, any>>(
  columns: ReportColumn[],
  data: T[]
) => {
  const headers = columns.map((col) => col.label);

  const rows = data.map((row) =>
    columns.map((col) => {
      const value = row[col.key];

      if (value === null || value === undefined) return "";

      // Optional formatting
      if (col.filterType === "date") {
        return new Date(value).toLocaleDateString("en-IN");
      }

      return value;
    })
  );

  return { headers, rows };
};
