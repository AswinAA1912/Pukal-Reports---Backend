import React, { useEffect, useMemo, useState } from "react";
import {
    Box,
    CircularProgress,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
    Menu,
    TextField,
    Button,
} from "@mui/material";
import dayjs from "dayjs";
import { useSearchParams } from "react-router-dom";
import AppLayout from "../../Layout/appLayout";
import PageHeader from "../../Layout/PageHeader";
import { exportToPDF } from "../../utils/exportToPDF";
import { exportToExcel } from "../../utils/exportToExcel";
import { mapForExport } from "../../utils/exportMapper";
import { godownItemTransactionService } from "../../services/stockWiseReport.service";

/* ================= UTIL ================= */
const formatDate = (d?: string) =>
    d ? dayjs(d).format("DD/MM/YYYY") : "";

/* ================= LEDGER LOGIC (UNCHANGED) ================= */
const buildLedgerRows = (transactions: any[]) => {
    let running = 0;

    const sorted = [...transactions].sort(
        (a, b) =>
            new Date(a.Ledger_Date).getTime() -
            new Date(b.Ledger_Date).getTime()
    );

    return sorted.map((row, index) => {
        running += Number(row.In_Qty || 0) - Number(row.Out_Qty || 0);

        const next = sorted[index + 1];
        const isLastOfDate =
            !next ||
            new Date(next.Ledger_Date).toDateString() !==
            new Date(row.Ledger_Date).toDateString();

        return {
            ...row,
            closing: isLastOfDate ? running : null,
        };
    });
};

/* ================= COMPONENT ================= */
const GodownItemWiseTransaction = () => {
    const [searchParams] = useSearchParams();

    const fromDate = searchParams.get("fromDate") || "";
    const toDate = searchParams.get("toDate") || "";
    const ProductId = searchParams.get("ProductId") || "";
    const Godown_Id = searchParams.get("Godown_Id") || "";
    const productName = searchParams.get("productName") || "";
    const godownName = searchParams.get("godownName") || "";

    /* -------- DATA -------- */
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    /* -------- DATE FILTER (REFERENCE STYLE) -------- */
    const [filters, setFilters] = useState({
        Date: { from: fromDate, to: toDate },
    });
    const [activeHeader, setActiveHeader] = useState<
        "voucher_name" | "invoice_no" | "Retailer_Name" | "Date" | null
    >(null);

    const [searchText, setSearchText] = useState("");

    const [columnFilters, setColumnFilters] = useState({
        voucher_name: "",
        invoice_no: "",
        Retailer_Name: "",
    });

    const [tempDate, setTempDate] = useState(filters.Date);
    const [filterAnchor, setFilterAnchor] = useState<HTMLElement | null>(null);

    const EXPORT_COLUMNS = [
        { label: "Date", key: "Ledger_Date" },
        { label: "Vch.Ty", key: "voucher_name" },
        { label: "Vch.No", key: "invoice_no" },
        { label: "Retailer", key: "Retailer_Name" },
        { label: "In Qty", key: "In_Qty", type: "number" },
        { label: "Out Qty", key: "Out_Qty", type: "number" },
        { label: "Closing", key: "closing", type: "number" },
    ];

    /* ================= LOAD DATA ================= */
    useEffect(() => {
        if (!ProductId || !Godown_Id) return;

        setLoading(true);
        godownItemTransactionService
            .getGodownItemTransactions({
                fromDate: filters.Date.from,
                toDate: filters.Date.to,
                Product_Id: Number(ProductId),
                Godown_Id: Number(Godown_Id),
            })
            .then(res => setRows(res.data.data || []))
            .finally(() => setLoading(false));
    }, [filters.Date, ProductId, Godown_Id]);

    /* ================= FILTERED ROWS ================= */
    const filteredRows = useMemo(() => {
        return rows.filter(r => {
            if (
                columnFilters.voucher_name &&
                r.voucher_name !== columnFilters.voucher_name
            )
                return false;

            if (
                columnFilters.invoice_no &&
                r.invoice_no !== columnFilters.invoice_no
            )
                return false;

            if (
                columnFilters.Retailer_Name &&
                r.Retailer_Name !== columnFilters.Retailer_Name
            )
                return false;

            return true;
        });
    }, [rows, columnFilters]);

    /* ================= LEDGER ROWS ================= */
    const ledgerRows = useMemo(
        () => buildLedgerRows(filteredRows),
        [filteredRows]
    );

    /* ================= GROUP BY DATE + TOTAL ================= */
    const groupedRows = useMemo(() => {
        const map = new Map<string, any[]>();

        ledgerRows.forEach(r => {
            const key = dayjs(r.Ledger_Date).format("YYYY-MM-DD");
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(r);
        });

        return Array.from(map.entries()).map(([date, items]) => {
            const totalIn = items.reduce(
                (s, r) => s + Number(r.In_Qty || 0),
                0
            );
            const totalOut = items.reduce(
                (s, r) => s + Number(r.Out_Qty || 0),
                0
            );
            const closing = items[items.length - 1]?.closing;

            return { date, items, totalIn, totalOut, closing };
        });
    }, [ledgerRows]);

    const exportRows = useMemo(() => {
        const rows: any[] = [];

        groupedRows.forEach(g => {
            g.items.forEach(r => {
                rows.push({
                    ...r,
                    Ledger_Date: dayjs(r.Ledger_Date).format("DD/MM/YYYY"),
                    In_Qty: Number(r.In_Qty || 0),
                    Out_Qty: Number(r.Out_Qty || 0),
                    closing: r.closing ?? "",
                });
            });

            // TOTAL ROW (STRING DATE — SAFE)
            rows.push({
                Ledger_Date: `TOTAL (${dayjs(g.date).format("DD/MM/YYYY")})`,
                voucher_name: "",
                invoice_no: "",
                Retailer_Name: "",
                In_Qty: g.totalIn,
                Out_Qty: g.totalOut,
                closing: g.closing ?? "",
            });
        });

        return rows;
    }, [groupedRows]);

    const openHeaderFilter = (
        e: React.MouseEvent<HTMLElement>,
        column: "voucher_name" | "invoice_no" | "Retailer_Name" | "Date"
    ) => {
        setActiveHeader(column);
        setFilterAnchor(e.currentTarget);
        setSearchText("");
    };

    const getUniqueValues = (
        key: "voucher_name" | "invoice_no" | "Retailer_Name"
    ) => {
        return [
            ...new Set(
                rows
                    .map(r => r[key])
                    .filter(Boolean)
                    .filter(v =>
                        v.toLowerCase().includes(searchText.toLowerCase())
                    )
            ),
        ];
    };

    /* ================= EXPORT ================= */
    const handleExportPDF = () => {
        const { headers, data } = mapForExport(EXPORT_COLUMNS, exportRows);
        exportToPDF(
            `Godownwise Item Transactions - ${productName}`,
            headers,
            data
        );
    };

    const handleExportExcel = () => {
        const { headers, data } = mapForExport(EXPORT_COLUMNS, exportRows);
        exportToExcel(
            `Godownwise Item Transactions - ${productName}`,
            headers,
            data
        );
    };

    /* ================= RENDER ================= */
    return (
        <>
            <PageHeader
                onExportPDF={handleExportPDF}
                onExportExcel={handleExportExcel}
            />

            <AppLayout fullWidth>
                <Box px={2} pb={1}>
                    <Typography variant="h6" align="center">
                        {productName} — {godownName}
                    </Typography>
                    <Typography variant="body2" align="center" color="text.secondary">
                        From {formatDate(filters.Date.from)} To{" "}
                        {formatDate(filters.Date.to)}
                    </Typography>
                </Box>

                {loading ? (
                    <Box display="flex" justifyContent="center" py={6}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <TableContainer
                        component={Paper}
                        sx={{
                            maxHeight: "calc(100vh - 140px)",
                            overflow: "auto",
                        }}
                    >
                        <Table size="small">
                            {/* ===== HEADER ===== */}
                            <TableHead
                                sx={{
                                    background: "#1E3A8A",
                                    position: "sticky",
                                    top: 0,
                                    zIndex: 2,
                                }}
                            >
                                <TableRow>
                                    <TableCell
                                        sx={{ color: "#fff", cursor: "pointer", fontWeight: 600 }}
                                        onClick={e => openHeaderFilter(e, "Date")}
                                    >
                                        Date
                                    </TableCell>
                                    <TableCell
                                        sx={{ color: "#fff", fontWeight: 600 }}
                                    >
                                        Batch
                                    </TableCell>
                                    <TableCell
                                        sx={{ color: "#fff", cursor: "pointer", fontWeight: 600 }}
                                        onClick={e => openHeaderFilter(e, "voucher_name")}
                                    >
                                        Voucher Type
                                    </TableCell>

                                    <TableCell
                                        sx={{ color: "#fff", cursor: "pointer", fontWeight: 600 }}
                                        onClick={e => openHeaderFilter(e, "invoice_no")}
                                    >
                                        Voucher No
                                    </TableCell>
                                    <TableCell
                                        sx={{ color: "#fff", cursor: "pointer", fontWeight: 600 }}
                                        onClick={e => openHeaderFilter(e, "Retailer_Name")}
                                    >
                                        Retailer
                                    </TableCell>
                                    <TableCell align="right" sx={{ color: "#fff", fontWeight: 600 }}>
                                        In
                                    </TableCell>
                                    <TableCell align="right" sx={{ color: "#fff", fontWeight: 600 }}>
                                        Out
                                    </TableCell>
                                    <TableCell align="right" sx={{ color: "#fff", fontWeight: 600 }}>
                                        Cls
                                    </TableCell>
                                </TableRow>
                            </TableHead>

                            {/* ===== BODY ===== */}
                            <TableBody>
                                {groupedRows.map(g => (
                                    <React.Fragment key={g.date}>
                                        {g.items.map((r, i) => (
                                            <TableRow key={i}>
                                                <TableCell>{formatDate(r.Ledger_Date)}</TableCell>
                                                <TableCell>{r.Batch || "-"}</TableCell>
                                                <TableCell>{r.voucher_name || "-"}</TableCell>
                                                <TableCell>{r.invoice_no || "-"}</TableCell>
                                                <TableCell>{r.Retailer_Name || "-"}</TableCell>
                                                <TableCell align="right" sx={{ color: "green" }}>
                                                    {Number(r.In_Qty || 0).toFixed(2)}
                                                </TableCell>
                                                <TableCell align="right" sx={{ color: "red" }}>
                                                    {Number(r.Out_Qty || 0).toFixed(2)}
                                                </TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 600 }}>
                                                    {r.closing ?? ""}
                                                </TableCell>
                                            </TableRow>
                                        ))}

                                        {/* ===== DAILY TOTAL ===== */}
                                        <TableRow sx={{ background: "#f3f4f6" }}>
                                            <TableCell colSpan={4} sx={{ fontWeight: 700 }}>
                                                TOTAL ({formatDate(g.date)})
                                            </TableCell>
                                            <TableCell>
                                            </TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 700 }}>
                                                {g.totalIn.toFixed(2)}
                                            </TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 700 }}>
                                                {g.totalOut.toFixed(2)}
                                            </TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 700 }}>
                                                {g.closing}
                                            </TableCell>
                                        </TableRow>
                                    </React.Fragment>
                                ))}

                                {!groupedRows.length && (
                                    <TableRow>
                                        <TableCell colSpan={7} align="center">
                                            No transactions found
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}

                {/* ===== DATE FILTER MENU (REFERENCE MATCH) ===== */}
                <Menu
                    anchorEl={filterAnchor}
                    open={Boolean(filterAnchor)}
                    onClose={() => setFilterAnchor(null)}
                    sx={{
                        "& .MuiButton-root": {
                            color: "#000 !important",
                            justifyContent: "flex-start",
                            textTransform: "none",
                            fontWeight: 500,
                        },
                        "& .MuiTypography-root": {
                            color: "#000 !important",
                        },
                        "& .MuiInputBase-input": {
                            color: "#000",
                        },
                    }}
                >
                    {/* DATE FILTER */}
                    {activeHeader === "Date" && (
                        <Box p={2} display="flex" flexDirection="column" gap={1}>
                            <TextField
                                type="date"
                                value={tempDate.from}
                                onChange={e =>
                                    setTempDate(p => ({ ...p, from: e.target.value }))
                                }
                            />
                            <TextField
                                type="date"
                                value={tempDate.to}
                                onChange={e =>
                                    setTempDate(p => ({ ...p, to: e.target.value }))
                                }
                            />
                            <Button
                                variant="contained"
                                onClick={() => {
                                    setFilters({ Date: tempDate });
                                    setFilterAnchor(null);
                                }}
                                sx={{ backgroundColor: "#1E3A8A", fontWeight: 600 }}
                            >
                                Apply
                            </Button>
                        </Box>
                    )}

                    {/* COLUMN FILTER */}
                    {activeHeader && activeHeader !== "Date" && (
                        <Box p={2} sx={{ minWidth: 220 }}>
                            <TextField
                                size="small"
                                fullWidth
                                placeholder="Search"
                                value={searchText}
                                onChange={e => setSearchText(e.target.value)}
                                sx={{ mb: 1 }}
                            />

                            {getUniqueValues(activeHeader).map(val => (
                                <Button
                                    key={val}
                                    fullWidth
                                    onClick={() => {
                                        setColumnFilters(p => ({
                                            ...p,
                                            [activeHeader]: val,
                                        }));
                                        setFilterAnchor(null);
                                    }}
                                >
                                    {val}
                                </Button>
                            ))}

                            <Button
                                fullWidth
                                onClick={() => {
                                    setColumnFilters(p => ({
                                        ...p,
                                        [activeHeader]: "",
                                    }));
                                    setFilterAnchor(null);
                                }}
                            >
                                All
                            </Button>
                        </Box>
                    )}
                </Menu>
            </AppLayout>
        </>
    );
};

export default GodownItemWiseTransaction;