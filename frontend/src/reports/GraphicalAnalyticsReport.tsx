import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  Tooltip,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  CircularProgress,
  TableContainer,
  Paper,
  useMediaQuery
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import BarChartIcon from "@mui/icons-material/BarChart";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs from "dayjs";
import AppLayout from "../Layout/appLayout";
import PageHeader from "../Layout/PageHeader";
import ReportFilterDrawer from "../Components/ReportFilterDrawer";
import { DashBoardSalesGraph, DashBoardPurchaseGraph, StockValueGraph } from "../services/graphAnalysis.services";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
  BarChart,
  Bar,
} from "recharts";

/* ================= TYPES ================= */

type ReportType = "sales" | "purchase" | "stock";
type ViewType = "day" | "week";

type DayData = {
  Invoice_Date: string;
  Invoice_Count: number;
  Total_Invoice_value: number;
};

type WeekData = {
  Week_No: number;
  Invoice_Count: number;
  Total_Invoice_value: number;
};

type DayTonnage = {
  Invoice_Date: string;
  Total_Tons: number;
};

type WeekTonnage = {
  Week_No: number;
  Total_Tons: number;
};

/* ================= COMPONENT ================= */

const AnalyticsReportPage: React.FC = () => {
  /* ---------- DEFAULT MONTH ---------- */

  const today = dayjs();
  const firstDay = today.startOf("month");

  const [fromDate, setFromDate] = useState(firstDay.format("YYYY-MM-DD"));
  const [toDate, setToDate] = useState(today.format("YYYY-MM-DD"));

  const [selectedMonth, setSelectedMonth] = useState(dayjs());
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);

  const [filters, setFilters] = useState({
    Date: { from: fromDate, to: toDate },
  });

  /* ---------- UI STATES ---------- */

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [reportType, setReportType] = useState<ReportType>("sales");
  const [viewType, setViewType] = useState<ViewType>("day");

  const [loading, setLoading] = useState(false);

  /* ---------- DATA STATES ---------- */

  const [dayData, setDayData] = useState<DayData[]>([]);
  const [weekData, setWeekData] = useState<WeekData[]>([]);
  const [dayTonnage, setDayTonnage] = useState<DayTonnage[]>([]);
  const [weekTonnage, setWeekTonnage] = useState<WeekTonnage[]>([]);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  /* ================= LOAD GRAPH ================= */

  const loadGraph = async () => {
    setLoading(true);

    try {
      let res;

      const params = {
        Fromdate: filters.Date.from,
        Todate: filters.Date.to,
      };

      if (reportType === "sales") {
        res = await DashBoardSalesGraph.getDashboardGraph(params);

        const data = res.data.data;

        setDayData(data.DayWise || []);
        setWeekData(data.WeekWiseData || []);
        setDayTonnage(data.DayWiseTonnage || []);
        setWeekTonnage(data.WeekWiseTonnage || []);
      }

      else if (reportType === "purchase") {
        res = await DashBoardPurchaseGraph.getDashboardGraph(params);

        const data = res.data.data;

        setDayData(data.DayWise || []);
        setWeekData(data.WeekWiseData || []);
        setDayTonnage(data.DayWiseTonnage || []);
        setWeekTonnage(data.WeekWiseTonnage || []);
      }

      else if (reportType === "stock") {
        res = await StockValueGraph.getDashboardGraph(params);

        const data = res.data.data;

        // 🔥 NORMALIZE STOCK DATA

        setDayData(
          (data.DayWise || []).map((d: any) => ({
            Invoice_Date: d.Trans_Date,
            Invoice_Count: d.Group_Count,
            Total_Invoice_value: d.Total_value,
          }))
        );

        setWeekData(
          (data.WeekWiseData || []).map((w: any) => ({
            Week_No: w.Week_No,
            Invoice_Count: w.Group_Count,
            Total_Invoice_value: w.Total_value,
          }))
        );

        setDayTonnage(
          (data.DayWiseTonnage || []).map((t: any) => ({
            Invoice_Date: t.Trans_Date,
            Total_Tons: t.Total_Tons,
          }))
        );

        setWeekTonnage(data.WeekWiseTonnage || []);
      }

    } catch (err) {
      console.error(err);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadGraph();
  }, [filters, reportType]);

  /* ================= KPI VALUES ================= */

  const totalValue = useMemo(() => {
    const source = viewType === "day" ? dayData : weekData;
    return source.reduce(
      (sum, r) => sum + Number(r.Total_Invoice_value || 0),
      0
    );
  }, [dayData, weekData, viewType]);

  const totalInvoices = useMemo(() => {
    const source = viewType === "day" ? dayData : weekData;
    return source.reduce((sum, r) => sum + Number(r.Invoice_Count || 0), 0);
  }, [dayData, weekData, viewType]);

  /* ================= GRAPH DATA ================= */

  const formattedDayData = useMemo(() => {
    return dayData.map((d) => {
      const ton = dayTonnage.find(
        (t) => dayjs(t.Invoice_Date).format("YYYY-MM-DD") ===
          dayjs(d.Invoice_Date).format("YYYY-MM-DD")
      );

      return {
        label: dayjs(d.Invoice_Date).format("DD MMM"),
        value: d.Total_Invoice_value,
        invoiceCount: d.Invoice_Count,
        tonnage: ton?.Total_Tons || 0,
      };
    });
  }, [dayData, dayTonnage]);

  const formattedWeekData = useMemo(() => {
    if (!weekData.length) return [];

    const sortedWeeks = [...weekData].sort(
      (a, b) => a.Week_No - b.Week_No
    );

    const minWeek = Math.min(...sortedWeeks.map((w) => w.Week_No));

    return sortedWeeks.map((w) => {
      const ton = weekTonnage.find((t) => t.Week_No === w.Week_No);

      return {
        label: `Week ${w.Week_No - minWeek + 1}`,
        value: w.Total_Invoice_value,
        invoiceCount: w.Invoice_Count,
        tonnage: ton?.Total_Tons || 0,
      };
    });
  }, [weekData, weekTonnage]);

  const graphData = viewType === "day" ? formattedDayData : formattedWeekData;

  const tableData = useMemo(() => {
    const source =
      viewType === "day" ? formattedDayData : formattedWeekData;

    // ✅ Reverse for table (latest first)
    return [...source].reverse();
  }, [formattedDayData, formattedWeekData, viewType]);

  const formatINR = (value: number) => {
    return new Intl.NumberFormat("en-IN").format(value || 0);
  };

  const totalTonnage = useMemo(() => {
    const source = viewType === "day" ? formattedDayData : formattedWeekData;
    return source.reduce((sum, r) => sum + Number(r.tonnage || 0), 0);
  }, [formattedDayData, formattedWeekData, viewType]);

  const activeCount = useMemo(() => {
    return graphData.length || 1;
  }, [graphData]);

  const avgValue = useMemo(() => totalValue / activeCount, [totalValue, activeCount]);

  const avgInvoices = useMemo(() => totalInvoices / activeCount, [totalInvoices, activeCount]);

  const avgTonnage = useMemo(() => totalTonnage / activeCount, [totalTonnage, activeCount]);

  const isStock = reportType === "stock";

  const valueLabel = isStock ? "Stock Value" : "Invoice Value";
  const countLabel = isStock ? "Group Count" : "Invoice Count";
  const periodLabel = viewType === "day" ? "Days" : "Weeks";


  /* ================= UI ================= */

  return (
    <>
      <PageHeader showPages={false} />

      <AppLayout fullWidth>
        {/* ================= TOP REPORT BUTTONS ================= */}

        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 1,
            m: 1,
          }}
        >
          {[
            { label: "Sales", key: "sales" },
            { label: "Purchase", key: "purchase" },
            { label: "Stock Values", key: "stock" },
          ].map((btn) => (
            <Button
              key={btn.key}
              variant={reportType === btn.key ? "contained" : "outlined"}
              onClick={() => setReportType(btn.key as ReportType)}
              sx={{
                fontSize: "0.75rem",
                textTransform: "none",
                fontWeight: 600,
                borderRadius: 2,
                backgroundColor:
                  reportType === btn.key ? "#1E3A8A" : "transparent",
              }}
            >
              {btn.label}
            </Button>
          ))}
        </Box>

        {/* ================= GRAPH CARD ================= */}

        <Card>
          <CardContent sx={{ p: 1.5 }}>
            {/* HEADER */}

            <Box
              sx={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                alignItems: isMobile ? "flex-start" : "center",
                gap: 1,
                mb: 1,
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                {/* Toggle Day / Week */}
                <Tooltip
                  title={
                    viewType === "week" ? "View Day Wise" : "View Week Wise"
                  }
                >
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={() =>
                      setViewType(viewType === "week" ? "day" : "week")
                    }
                  >
                    {viewType === "week" ? (
                      <ShowChartIcon fontSize="small" />
                    ) : (
                      <BarChartIcon fontSize="small" />
                    )}
                  </IconButton>
                </Tooltip>

                {/* Month Selector */}
                <Tooltip title="Select Month">
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={() => setMonthPickerOpen(true)}
                    sx={{ display: "flex", gap: 0.5 }}
                  >
                    <CalendarMonthIcon fontSize="small" />
                    <Typography fontSize={12} fontWeight={600}>
                      {selectedMonth.format("MMMM YYYY")}
                    </Typography>
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            {/* MAIN CONTENT */}

            <Box
              sx={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                gap: 2,
              }}
            >
              {/* LEFT SIDE */}

              <Box
                sx={{
                  flex: 3,
                  display: "flex",
                  flexDirection: "column",
                  gap: 1,
                }}
              >
                {/* KPI CARDS */}
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: isMobile
                      ? "1fr"
                      : isStock
                        ? "repeat(2, 1fr)"
                        : "repeat(3, 1fr)",
                    gap: 1,
                  }}
                >
                  {/* ✅ STOCK KPI */}
                  {isStock ? (
                    <>
                      <DualKpiCard
                        totalLabel="Today's Stock Value"
                        totalValue={
                          formattedDayData[formattedDayData.length - 1]?.value || 0
                        }
                        avgLabel={`Monthly Avg (${activeCount} ${periodLabel})`}
                        avgValue={avgValue}
                        isCurrency
                      />

                      <DualKpiCard
                        totalLabel="Today's Tonnage"
                        totalValue={
                          formattedDayData[formattedDayData.length - 1]?.tonnage || 0
                        }
                        avgLabel={`Avg Tonnage (${activeCount} ${periodLabel})`}
                        avgValue={avgTonnage}
                        isCurrency={false}
                      />
                    </>
                  ) : (
                    <>
                      <DualKpiCard
                        totalLabel={`Total ${valueLabel}`}
                        totalValue={totalValue}
                        avgLabel={`Avg Value (${activeCount} ${periodLabel})`}
                        avgValue={avgValue}
                        isCurrency
                      />

                      <DualKpiCard
                        totalLabel={countLabel}
                        totalValue={totalInvoices}
                        avgLabel={`Avg ${countLabel} (${activeCount} ${periodLabel})`}
                        avgValue={avgInvoices}
                        isCurrency={false}
                      />

                      <DualKpiCard
                        totalLabel="Total Tonnage"
                        totalValue={totalTonnage}
                        avgLabel={`Avg Tonnage (${activeCount} ${periodLabel})`}
                        avgValue={avgTonnage}
                        isCurrency={false}
                      />
                    </>
                  )}
                </Box>

                {/* GRAPH */}

                <Box sx={{ height: isMobile ? 250 : 350 }}>
                  {loading ? (
                    <Box
                      display="flex"
                      justifyContent="center"
                      alignItems="center"
                      height="100%"
                    >
                      <CircularProgress size={28} />
                    </Box>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      {viewType === "day" ? (
                        <BarChart data={graphData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="label" />
                          <YAxis
                            yAxisId="left"
                            tickFormatter={(value) => {
                              if (value >= 10000000) return `${(value / 10000000).toFixed(1)}Cr`;
                              if (value >= 100000) return `${(value / 100000).toFixed(1)}L`;
                              if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
                              return value;
                            }}
                          />
                          <YAxis yAxisId="right" orientation="right" />

                          <ChartTooltip
                            formatter={(value, name) => {
                              if (name === valueLabel)
                                return [`₹${formatINR(value as number)}`, name];

                              if (name === "Tonnage")
                                return [`${value} Tons`, name];

                              return value;
                            }}
                          />

                          <Bar
                            yAxisId="left"
                            dataKey="value"
                            fill="#1E3A8A"
                            name={valueLabel}
                          />

                          <Bar
                            yAxisId="right"
                            dataKey="tonnage"
                            fill="#2e7d32"
                            name="Tonnage"
                          />
                        </BarChart>
                      ) : (
                        <LineChart data={graphData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="label" />
                          <YAxis yAxisId="left" />
                          <YAxis yAxisId="right" orientation="right" />

                          <ChartTooltip
                            formatter={(value, name) => {
                              if (name === valueLabel)
                                return [`₹${formatINR(value as number)}`, name];

                              if (name === "Tonnage")
                                return [`${value} Tons`, name];

                              return value;
                            }}
                          />

                          <Line
                            yAxisId="left"
                            type="monotone"
                            dataKey="value"
                            stroke="#1E3A8A"
                            strokeWidth={2}
                            name={valueLabel}
                          />

                          <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="tonnage"
                            stroke="#2e7d32"
                            strokeWidth={2}
                            name="Tonnage"
                          />
                        </LineChart>
                      )}
                    </ResponsiveContainer>
                  )}
                </Box>
              </Box>

              {/* RIGHT SIDE TABLE */}

              <Box sx={{ flex: 1, width: isMobile ? "100%" : "auto" }}>
                <TableContainer
                  component={Paper}
                  sx={{
                    height: isMobile ? 250 : 430,
                    overflow: "auto",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <Table size="small">
                    <TableHead
                      sx={{
                        position: "sticky",
                        top: 0,
                        background: "#f3f4f6",
                        zIndex: 1,
                      }}
                    >
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>
                          {viewType === "day" ? "Date" : "Week"}
                        </TableCell>

                        {!isStock && (
                          <TableCell align="right" sx={{ fontWeight: 600 }}>
                            {countLabel}
                          </TableCell>
                        )}

                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          Tonnage
                        </TableCell>

                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          {valueLabel}
                        </TableCell>
                      </TableRow>
                    </TableHead>

                    <TableBody>
                      {tableData.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell>{row.label}</TableCell>

                          {!isStock && (
                            <TableCell align="right">
                              {formatINR(row.invoiceCount)}
                            </TableCell>
                          )}

                          <TableCell align="right">
                            {row.tonnage.toFixed(2)}
                          </TableCell>

                          <TableCell align="right">
                            ₹{formatINR(row.value)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </AppLayout>

      {/* FILTER DRAWER */}

      <ReportFilterDrawer
        open={drawerOpen}
        onToggle={() => setDrawerOpen((p) => !p)}
        onClose={() => setDrawerOpen(false)}
        fromDate={fromDate}
        toDate={toDate}
        onFromDateChange={setFromDate}
        onToDateChange={setToDate}
        onApply={() =>
          setFilters({
            ...filters,
            Date: { from: fromDate, to: toDate },
          })
        }
      />

      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <DatePicker
          views={["year", "month"]}
          openTo="month"
          open={monthPickerOpen}
          value={selectedMonth}
          onClose={() => setMonthPickerOpen(false)}
          onChange={(newDate) => {
            if (!newDate) return;

            setSelectedMonth(newDate);

            const start = newDate.startOf("month");
            const end =
              newDate.month() === dayjs().month() &&
                newDate.year() === dayjs().year()
                ? dayjs()
                : newDate.endOf("month");

            const from = start.format("YYYY-MM-DD");
            const to = end.format("YYYY-MM-DD");

            setFromDate(from);
            setToDate(to);

            setFilters({
              ...filters,
              Date: { from, to },
            });

            setMonthPickerOpen(false);
          }}
          slotProps={{
            textField: { sx: { display: "none" } },
          }}
        />
      </LocalizationProvider>
    </>
  );
};

/* ================= KPI CARD ================= */

const formatINR = (value: number) => {
  return new Intl.NumberFormat("en-IN").format(value || 0);
};

const DualKpiCard = ({
  totalLabel,
  totalValue,
  avgLabel,
  avgValue,
  isCurrency = true,
}: {
  totalLabel: string;
  totalValue: number;
  avgLabel: string;
  avgValue: number;
  isCurrency?: boolean;
}) => (
  <Card sx={{ height: 70 }}>
    <CardContent sx={{ p: "8px !important", height: "100%" }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: "100%",
        }}
      >
        {/* TOTAL */}
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
          }}
        >
          <Typography
            fontSize={11}
            color="text.secondary"
            noWrap
          >
            {totalLabel}
          </Typography>

          <Typography
            fontWeight={700}
            fontSize={14}
            noWrap
          >
            {isCurrency
              ? `₹${formatINR(totalValue)}`
              : formatINR(totalValue)}
          </Typography>
        </Box>

        {/* DIVIDER */}
        <Box
          sx={{
            width: "1px",
            height: "70%",
            background: "#e5e7eb",
            mx: 1,
          }}
        />

        {/* AVG */}
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            textAlign: "right",
          }}
        >
          <Typography
            fontSize={11}
            color="text.secondary"
            noWrap
          >
            {avgLabel}
          </Typography>

          <Typography
            fontWeight={600}
            fontSize={13}
            noWrap
          >
            {isCurrency
              ? `₹${formatINR(avgValue)}`
              : avgValue.toFixed(2)}
          </Typography>
        </Box>
      </Box>
    </CardContent>
  </Card>
);

export default AnalyticsReportPage;