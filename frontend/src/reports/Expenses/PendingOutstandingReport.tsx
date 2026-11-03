import React, {
    useEffect,
    useMemo,
    useState,
} from "react";
import { useNumericalFilter } from "../../hooks/useNumericalFilter";
import { NumericalFilterMenu } from "../../Components/NumericalFilterMenu";
import { SortableHeaderLabel } from "../../Components/SortableHeaderLabel";

import {
    Box,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
    CircularProgress,
} from "@mui/material";

import { useParams, useSearchParams } from "react-router-dom";
import PageHeader from "../../Layout/PageHeader";
import ReportFilterDrawer from "../../Components/ReportFilterDrawer";
import CommonPagination from "../../Components/CommonPagination";

import dayjs from "dayjs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

import { toast } from "react-toastify";

import { PartyOutstandingService } from "../../services/partyOutstanding.service";
import AppLayout from "../../Layout/appLayout";

const PendingOutstandingReport: React.FC = () => {
    const { accId } = useParams();
    const today = dayjs().format("YYYY-MM-DD");
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [fromDate, setFromDate] = useState(today);
    const [toDate, setToDate] = useState(today);
    const [tempFromDate, setTempFromDate] = useState(today);
    const [tempToDate, setTempToDate] = useState(today);

    const [page, setPage] = useState(1);

    const [rowsPerPage, setRowsPerPage] = useState(100);
    const [searchParams] =
        useSearchParams();

    const partyName =
        searchParams.get(
            "partyName"
        ) || "";

    /* ================= LOAD DATA ================= */

    const loadData =
        async () => {
            try {
                setLoading(true);

                const res =
                    await PartyOutstandingService.getPendingOutstanding(
                        accId || "",
                        fromDate,
                        toDate
                    );

                setRows(
                    res.data.data || []
                );
            } catch (err) {
                console.error(err);

                toast.error(
                    "Failed to load pending outstanding"
                );
            } finally {
                setLoading(false);
            }
        };

    useEffect(() => {
        if (accId) {
            loadData();
        }
    }, [
        accId,
        fromDate,
        toDate,
    ]);

    const handleToggleDrawer = () => {
        setDrawerOpen((prev) => {
            if (!prev) {
                setTempFromDate(fromDate);
                setTempToDate(toDate);
            }
            return !prev;
        });
    };

    const handleCloseDrawer = () => {
        setTempFromDate(fromDate);
        setTempToDate(toDate);
        setDrawerOpen(false);
    };

    const handleApplyFilters = () => {
        setFromDate(tempFromDate);
        setToDate(tempToDate);
        setPage(1);
        setDrawerOpen(false);
    };

    const getPendingDays = (date: string) => {
        if (!date) return "";
        return dayjs().diff(dayjs(date), "day");
    };

    const processedRows = useMemo(() => {
        return rows.map(row => ({
            ...row,
            pendingDays: row.eventDate ? dayjs().diff(dayjs(row.eventDate), "day") : 0
        }));
    }, [rows]);

    const {
        sortConfig: numSortConfig,
        rangeFilter: numRangeFilter,
        setRangeFilter: setNumRangeFilter,
        filterAnchor: numFilterAnchor,
        setFilterAnchor: setNumFilterAnchor,
        activeHeader: numActiveHeader,
        handleSort: handleNumSort,
        openFilter: openNumFilter,
        filteredAndSortedData: numFilteredAndSortedRows,
        getMinMax,
        clearRangeFilter,
    } = useNumericalFilter(processedRows, ["totalValue", "BalanceAmount", "pendingDays"]);

    const finalRows =
        useMemo(() => {
            const start =
                (page - 1) *
                rowsPerPage;

            return numFilteredAndSortedRows.slice(
                start,
                start + rowsPerPage
            );
        }, [
            numFilteredAndSortedRows,
            page,
            rowsPerPage,
        ]);

    /* ================= EXPORT EXCEL ================= */

    const handleExportExcel = () => {
        const decodedPartyName = decodeURIComponent(partyName || "");

        const exportRows = numFilteredAndSortedRows.map((row, index) => ({
            "S.No": index + 1,
            "Voucher No": row.voucherNumber,
            Date: row.eventDate
                ? dayjs(row.eventDate).format("DD-MM-YYYY")
                : "",
            Source: row.actualSource,
            "Dr / CR": row.accountSide,

            "Pending Days": row.eventDate
                ? dayjs().diff(dayjs(row.eventDate), "day")
                : "",

            Total: row.totalValue,
            Pending: row.BalanceAmount,
        }));

        const ws = XLSX.utils.json_to_sheet([]);

        // Add heading rows
        XLSX.utils.sheet_add_aoa(ws, [
            ["Pending Transaction Report"],
            [`Party Name : ${decodedPartyName}`],
            [],
        ]);

        // Add table data starting from row 4
        XLSX.utils.sheet_add_json(ws, exportRows, {
            origin: "A4",
        });

        // Optional column width
        ws["!cols"] = [
            { wch: 8 },
            { wch: 25 },
            { wch: 15 },
            { wch: 20 },
            { wch: 10 },
            { wch: 15 },
            { wch: 15 },
            { wch: 15 },
        ];

        const wb = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(
            wb,
            ws,
            "Pending Outstanding"
        );

        XLSX.writeFile(
            wb,
            `Pending Transaction_${decodedPartyName}_${dayjs().format(
                "DDMMYYYY"
            )}.xlsx`
        );
    };

    /* ================= EXPORT PDF ================= */

    const handleExportPDF = () => {
        const decodedPartyName =
            decodeURIComponent(partyName || "");

        const doc = new jsPDF("landscape");

        // Title
        doc.setFontSize(14);
        doc.text(
            "Pending Transaction Report",
            14,
            12
        );

        // Party Name
        doc.setFontSize(10);
        doc.text(
            `Party Name : ${decodedPartyName}`,
            14,
            20
        );

        autoTable(doc, {
            startY: 28,

            head: [[
                "S.No",
                "Voucher No",
                "Date",
                "Source",
                "Dr / CR",
                "Pending Days",
                "Total",
                "Pending",
            ]],

            body: numFilteredAndSortedRows.map((row, index) => [
                index + 1,
                row.voucherNumber,
                row.eventDate
                    ? dayjs(row.eventDate).format("DD-MM-YYYY")
                    : "",
                row.actualSource,
                row.accountSide,
                row.eventDate
                    ? dayjs().diff(dayjs(row.eventDate), "day")
                    : "",
                Number(row.totalValue || 0).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                }),
                Number(row.BalanceAmount || 0).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                }),
            ]),

            styles: {
                fontSize: 8,
            },

            headStyles: {
                fontStyle: "bold",
            },
        });

        doc.save(
            `Pending Transaction_${decodedPartyName}.pdf`
        );
    };

    return (
        < >
            <PageHeader
                onExportPDF={
                    handleExportPDF
                }
                onExportExcel={
                    handleExportExcel
                }
            />

            <ReportFilterDrawer
                open={drawerOpen}
                onToggle={handleToggleDrawer}
                onClose={handleCloseDrawer}
                fromDate={tempFromDate}
                toDate={tempToDate}
                onFromDateChange={setTempFromDate}
                onToDateChange={setTempToDate}
                fromDateLabel="From Date"
                toDateLabel="To Date"
                onApply={handleApplyFilters}
            />

            <AppLayout fullWidth>

                <Box p={2}>
                    <Box
                        display="flex"
                        alignItems="center"
                        gap={1}
                        mb={2}
                    >
                        <Typography
                            fontWeight={700}
                        >
                            {`Pending Balance of ${decodeURIComponent(
                                partyName || ""
                            )
                                }`}
                        </Typography>
                    </Box>

                    <Paper elevation={2}>
                        <TableContainer
                            sx={{
                                maxHeight: "72vh",
                            }}
                        >
                            <Table stickyHeader size="small">
                                <TableHead
                                    sx={{
                                        position: "sticky",
                                        top: 0,
                                        zIndex: 5,
                                    }}
                                >
                                    {/* HEADER */}
                                    <TableRow sx={{ background: "#1E3A8A" }}>
                                        {[
                                            "S.No",
                                            "Voucher No",
                                            "Date",
                                            "Source",
                                            "Dr / CR",
                                            "Pending Days",
                                            "Total",
                                            "Pending",
                                        ].map((header) => {
                                            const keyMap: Record<string, string> = {
                                                "Total": "totalValue",
                                                "Pending": "BalanceAmount",
                                                "Pending Days": "pendingDays"
                                            };
                                            const colKey = keyMap[header];
                                            const isNumeric = Boolean(colKey);

                                            return (
                                                <TableCell
                                                    key={header}
                                                    align={isNumeric ? "right" : "left"}
                                                    onClick={isNumeric ? (e) => openNumFilter(e, colKey) : undefined}
                                                    sx={{
                                                        color: "#fff",
                                                        fontWeight: 500,
                                                        background: "#1E3A8A",
                                                        whiteSpace: "nowrap",
                                                        borderBottom: "none",
                                                        cursor: isNumeric ? "pointer" : "default"
                                                    }}
                                                >
                                                    {isNumeric ? (
                                                        <SortableHeaderLabel
                                                            label={header}
                                                            columnKey={colKey}
                                                            sortConfig={numSortConfig}
                                                            onSort={handleNumSort}
                                                            onOpenFilter={(e) => openNumFilter(e, colKey)}
                                                        />
                                                    ) : (
                                                        header
                                                    )}
                                                </TableCell>
                                            );
                                        })}
                                    </TableRow>

                                    {/* TOTAL ROW */}
                                    <TableRow sx={{ background: "#F3F4F6" }}>
                                        <TableCell sx={{ fontWeight: 700 }}>Total</TableCell>

                                        <TableCell />
                                        <TableCell />
                                        <TableCell />
                                        <TableCell />
                                        <TableCell />

                                        {/* TOTAL */}
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                                            {Number(
                                                numFilteredAndSortedRows.reduce(
                                                    (sum, row) => sum + Number(row.totalValue || 0),
                                                    0
                                                )
                                            ).toLocaleString("en-IN", {
                                                minimumFractionDigits: 2,
                                            })}
                                        </TableCell>

                                        {/* PENDING */}
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                                            {Number(
                                                numFilteredAndSortedRows.reduce(
                                                    (sum, row) => sum + Number(row.BalanceAmount || 0),
                                                    0
                                                )
                                            ).toLocaleString("en-IN", {
                                                minimumFractionDigits: 2,
                                            })}
                                        </TableCell>
                                    </TableRow>
                                </TableHead>

                                <TableBody sx={{ background: "#fefeff" }}>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={8} align="center">
                                                <CircularProgress />
                                            </TableCell>
                                        </TableRow>
                                    ) : finalRows.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} align="center">
                                                No Data Found
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        finalRows.map((row, index) => (
                                            <TableRow key={index} hover sx={{ background: "#ffffff" }}>
                                                {/* S.No */}
                                                <TableCell>
                                                    {(page - 1) * rowsPerPage + index + 1}
                                                </TableCell>

                                                {/* Voucher No */}
                                                <TableCell>{row.voucherNumber}</TableCell>

                                                {/* Date */}
                                                <TableCell>
                                                    {row.eventDate
                                                        ? dayjs(row.eventDate).format("DD-MM-YYYY")
                                                        : ""}
                                                </TableCell>

                                                {/* Source */}
                                                <TableCell>{row.actualSource}</TableCell>

                                                {/* Dr / CR */}
                                                <TableCell>{row.accountSide}</TableCell>

                                                {/* Pending Days */}
                                                <TableCell align="right" >
                                                    {getPendingDays(row.eventDate)}
                                                </TableCell>

                                                {/* Total */}
                                                <TableCell align="right">
                                                    {Number(row.totalValue || 0).toLocaleString("en-IN", {
                                                        minimumFractionDigits: 2,
                                                    })}
                                                </TableCell>

                                                {/* Pending */}
                                                <TableCell align="right" sx={{ fontWeight: 700 }}>
                                                    {Number(row.BalanceAmount || 0).toLocaleString("en-IN", {
                                                        minimumFractionDigits: 2,
                                                    })}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>

                    <Box mt={2}>
                        <CommonPagination
                            totalRows={numFilteredAndSortedRows.length}
                            page={page}
                            rowsPerPage={rowsPerPage}
                            onPageChange={setPage}
                            onRowsPerPageChange={(value: number) => {
                                setRowsPerPage(value);
                                setPage(1);
                            }}
                        />
                    </Box>
                </Box>

            </AppLayout>

            <NumericalFilterMenu
                anchorEl={numFilterAnchor}
                open={Boolean(numFilterAnchor)}
                onClose={() => setNumFilterAnchor(null)}
                activeHeader={numActiveHeader}
                min={numActiveHeader ? getMinMax(numActiveHeader).min : 0}
                max={numActiveHeader ? getMinMax(numActiveHeader).max : 100}
                rangeFilter={numRangeFilter}
                onRangeChange={(key, range) => setNumRangeFilter(p => ({ ...p, [key]: range }))}
                onClear={clearRangeFilter}
            />
        </>
    );
};

export default PendingOutstandingReport;