import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from "@mui/material";

export type ReportColumn<T> = {
  label: string;
  key: keyof T;
  align?: "left" | "right" | "center";
  isNumeric?: boolean;
  format?: (value: number) => string;
};

type Props<T> = {
  rows: T[];
  columns: ReportColumn<T>[];
  page: number;
  rowsPerPage: number;
  summaryType: "sum" | "avg";
  summaryColumn: keyof T | null;
  onHeaderClick: (e: React.MouseEvent<HTMLElement>, key: string) => void;
};

export function ReportTable<T extends Record<string, any>>({
  rows,
  columns,
  page,
  rowsPerPage,
  summaryType,
  summaryColumn,
  onHeaderClick,
}: Props<T>) {
  const paginated = rows.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage
  );

  const getSummary = (key: keyof T) => {
    const values = rows.map((r) => Number(r[key]) || 0);
    const total = values.reduce((a, b) => a + b, 0);
    return summaryType === "sum"
      ? total
      : values.length
        ? total / values.length
        : 0;
  };

  return (
    <TableContainer
      component={Paper}
      sx={{ maxHeight: "calc(100vh - 100px)", overflow: "auto" }}
    >
      <Table size="small">
        {/* HEADER */}
        <TableHead
          sx={{
            background: "#1E3A8A",
            position: "sticky",
            top: 0,
            zIndex: 2,
          }}
        >
          <TableRow>
            <TableCell sx={{ color: "#fff", fontWeight: 600 }}>S.No</TableCell>
            {columns.map((c) => (
              <TableCell
                key={String(c.key)}
                align={c.align}
                sx={{ color: "#fff", fontWeight: 600, cursor: "pointer" }}
                onClick={(e) => onHeaderClick(e, String(c.key))}
              >
                {c.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>

        {/* SUMMARY */}
        <TableBody>
          <TableRow
            sx={{
              background: "#f3f4f6",
              position: "sticky",
              top: 37,
              zIndex: 1,
            }}
          >
            <TableCell colSpan={3} sx={{ fontWeight: 700 }}>
              {summaryType === "sum" ? "Total" : "Average"}
            </TableCell>

            {columns
              .filter((c) => c.isNumeric)
              .map((c) => {
                const show = !summaryColumn || summaryColumn === c.key;
                return (
                  <TableCell key={String(c.key)} align={c.align} sx={{ fontWeight: 700 }}>
                    {show
                      ? c.format
                        ? c.format(getSummary(c.key))
                        : getSummary(c.key).toFixed(2)
                      : ""}
                  </TableCell>
                );
              })}
          </TableRow>
        </TableBody>

        {/* BODY */}
        <TableBody>
          {paginated.map((row, i) => (
            <TableRow key={i}>
              <TableCell>
                {(page - 1) * rowsPerPage + i + 1}
              </TableCell>
              {columns.map((c) => (
                <TableCell key={String(c.key)} align={c.align}>
                  {c.format && c.isNumeric
                    ? c.format(Number(row[c.key]))
                    : String(row[c.key] ?? "")}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
