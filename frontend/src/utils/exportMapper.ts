import dayjs from "dayjs";

export const formatCreatedOn = (dateString: any): string => {
  if (!dateString) return "-";
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "-";

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || "";

  const day = getPart("day");
  const month = getPart("month");
  const year = getPart("year");
  const hour = getPart("hour");
  const minute = getPart("minute");
  const dayPeriod = getPart("dayPeriod").toLowerCase();

  const ampm = dayPeriod.includes("pm") || dayPeriod.includes("p.m") ? "p.m." : "a.m.";

  return `${day}-${month}-${year} ${hour}.${minute} ${ampm}`;
};

export const mapForExport = (
  columns: any[],
  rows: any[]
) => {
  const headers = columns.map(c => c.header || c.label);
  const data = rows.map((row, index) =>
    columns.map(col => {
      if (col.key === "sno") return index + 1;

      let value = row[col.key];
      if ((value === undefined || value === null) && col.altKey) {
        value = row[col.altKey];
      }

      if (col.key === "Created_on" && value) {
        return formatCreatedOn(value);
      }

      if (col.type === "date" && value) {
        return dayjs(value).format("DD/MM/YYYY");
      }

      return value ?? "";
    })
  );

  return { headers, data };
};
