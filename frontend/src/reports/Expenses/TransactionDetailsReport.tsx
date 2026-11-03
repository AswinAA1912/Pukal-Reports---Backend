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

import { useParams } from "react-router-dom";

import dayjs from "dayjs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

import { toast } from "react-toastify";

import AppLayout from "../../Layout/appLayout";
import PageHeader from "../../Layout/PageHeader";
import ReportFilterDrawer from "../../Components/ReportFilterDrawer";
import CommonPagination from "../../Components/CommonPagination";

import {
    PartyOutstandingService,
} from "../../services/partyOutstanding.service";

const formatCurrency = (
    value: number
) =>
    Number(
        value || 0
    ).toLocaleString(
        "en-IN",
        {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }
    );

const TransactionDetailsReport:
    React.FC = () => {

        const {
            accId,
        } = useParams();
        const partyName = new URLSearchParams(window.location.search).get("partyName");

        /* ================= DEFAULT LAST 30 DAYS ================= */

        const defaultFromDate = dayjs().subtract(30, "day").format("YYYY-MM-DD");
        const defaultToDate = dayjs().format("YYYY-MM-DD");

        const [fromDate, setFromDate] = useState(defaultFromDate);
        const [toDate, setToDate] = useState(defaultToDate);
        const [tempFromDate, setTempFromDate] = useState(defaultFromDate);
        const [tempToDate, setTempToDate] = useState(defaultToDate);

        /* ================= STATES ================= */

        const [rows, setRows] =
            useState<any[]>([]);

        const [loading, setLoading] =
            useState(false);

        const [drawerOpen, setDrawerOpen] =
            useState(false);

        const [page, setPage] =
            useState(1);

        const [rowsPerPage, setRowsPerPage] =
            useState(100);

        /* ================= LOAD DATA ================= */

        const loadData =
            async () => {

                try {

                    setLoading(true);

                    const res =
                        await PartyOutstandingService.getAccountTransactions(
                            accId || "",
                            fromDate,
                            toDate
                        );

                    setRows(
                        res.data.data || []
                    );

                } catch (err) {

                    console.error(
                        err
                    );

                    toast.error(
                        "Failed to load transaction details"
                    );

                } finally {

                    setLoading(
                        false
                    );
                }
            };

        useEffect(() => {

            if (
                accId
            ) {

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
        } = useNumericalFilter(rows, ["Debit_Amt", "Credit_Amt"]);

        /* ================= PAGINATION ================= */

        const paginatedRows =
            useMemo(() => {

                const start =
                    (
                        page - 1
                    ) *
                    rowsPerPage;

                return numFilteredAndSortedRows.slice(
                    start,
                    start +
                    rowsPerPage
                );

            }, [
                numFilteredAndSortedRows,
                page,
                rowsPerPage,
            ]);

        /* ================= TOTALS ================= */

        const totalDebit =
            numFilteredAndSortedRows.reduce(
                (
                    sum,
                    row
                ) =>
                    sum +
                    Number(
                        row.Debit_Amt ||
                        0
                    ),
                0
            );

        const totalCredit =
            numFilteredAndSortedRows.reduce(
                (
                    sum,
                    row
                ) =>
                    sum +
                    Number(
                        row.Credit_Amt ||
                        0
                    ),
                0
            );

        const netBalance =
            totalDebit - totalCredit;

        const balanceType =
            netBalance >= 0
                ? "DR"
                : "CR";

        const formattedBalance =
            Math.abs(
                netBalance
            );

        /* ================= EXPORT EXCEL ================= */

        /* ================= EXPORT EXCEL ================= */

        const handleExportExcel = () => {

            const totalDebit =
                rows.reduce(
                    (sum, row) =>
                        sum + Number(row.Debit_Amt || 0),
                    0
                );

            const totalCredit =
                numFilteredAndSortedRows.reduce(
                    (sum, row) =>
                        sum + Number(row.Credit_Amt || 0),
                    0
                );

            const netBalance =
                totalDebit - totalCredit;

            const exportRows = numFilteredAndSortedRows.map(
                (row, index) => ({
                    "S.No":
                        index + 1,

                    "Date":
                        row.Ledger_Date
                            ? dayjs(
                                row.Ledger_Date
                            ).format(
                                "DD-MM-YYYY"
                            )
                            : "",

                    "Invoice No":
                        row.invoice_no,

                    "Particulars":
                        row.Particulars,

                    "Debit Amount":
                        row.Debit_Amt,

                    "Credit Amount":
                        row.Credit_Amt,

                    "Ledger Description":
                        row.Ledger_Desc,
                })
            );

            const worksheet =
                XLSX.utils.json_to_sheet([]);

            /* ================= HEADING ================= */

            XLSX.utils.sheet_add_aoa(
                worksheet,
                [[
                    `Transaction Details - ${decodeURIComponent(
                        partyName || ""
                    )}`
                ]],
                { origin: "A1" }
            );

            XLSX.utils.sheet_add_aoa(
                worksheet,
                [[
                    `From : ${dayjs(fromDate).format(
                        "DD-MM-YYYY"
                    )}   To : ${dayjs(
                        toDate
                    ).format(
                        "DD-MM-YYYY"
                    )}`
                ]],
                { origin: "A2" }
            );

            XLSX.utils.sheet_add_aoa(
                worksheet,
                [[
                    `Total Debit : ${formatCurrency(totalDebit)}`
                ]],
                { origin: "A4" }
            );

            XLSX.utils.sheet_add_aoa(
                worksheet,
                [[
                    `Total Credit : ${formatCurrency(totalCredit)}`
                ]],
                { origin: "C4" }
            );

            XLSX.utils.sheet_add_aoa(
                worksheet,
                [[
                    `Net Balance : ${formatCurrency(
                        Math.abs(netBalance)
                    )} ${netBalance >= 0 ? "DR" : "CR"}`
                ]],
                { origin: "E4" }
            );

            /* ================= TABLE ================= */

            XLSX.utils.sheet_add_json(
                worksheet,
                exportRows,
                {
                    origin: "A7",
                }
            );

            const workbook =
                XLSX.utils.book_new();

            XLSX.utils.book_append_sheet(
                workbook,
                worksheet,
                "Transaction Details"
            );

            XLSX.writeFile(
                workbook,
                `TransactionDetails_${dayjs().format(
                    "DDMMYYYY"
                )}.xlsx`
            );
        };

        /* ================= EXPORT PDF ================= */

        const handleExportPDF = () => {

            const totalDebit =
                numFilteredAndSortedRows.reduce(
                    (sum, row) =>
                        sum + Number(row.Debit_Amt || 0),
                    0
                );

            const totalCredit =
                numFilteredAndSortedRows.reduce(
                    (sum, row) =>
                        sum + Number(row.Credit_Amt || 0),
                    0
                );

            const netBalance =
                totalDebit - totalCredit;

            const doc =
                new jsPDF(
                    "landscape"
                );

            doc.setFontSize(16);

            doc.text(
                `Transaction Details - ${decodeURIComponent(
                    partyName || ""
                )}`,
                14,
                12
            );

            doc.setFontSize(10);

            doc.text(
                `From : ${dayjs(fromDate).format(
                    "DD-MM-YYYY"
                )}   To : ${dayjs(
                    toDate
                ).format(
                    "DD-MM-YYYY"
                )}`,
                14,
                20
            );

            /* ================= SUMMARY ================= */

            doc.setFontSize(11);

            doc.text(
                `Total Debit : ${formatCurrency(
                    totalDebit
                )}`,
                14,
                30
            );

            doc.text(
                `Total Credit : ${formatCurrency(
                    totalCredit
                )}`,
                110,
                30
            );

            doc.text(
                `Net Balance : ${formatCurrency(
                    Math.abs(
                        netBalance
                    )
                )} ${netBalance >= 0 ? "DR" : "CR"}`,
                210,
                30
            );

            autoTable(doc, {
                startY: 40,

                head: [[
                    "S.No",
                    "Date",
                    "Invoice No",
                    "Particulars",
                    "Debit Amount",
                    "Credit Amount",
                    "Ledger Description",
                ]],

                body:
                    numFilteredAndSortedRows.map(
                        (
                            row,
                            index
                        ) => [
                                index + 1,

                                row.Ledger_Date
                                    ? dayjs(
                                        row.Ledger_Date
                                    ).format(
                                        "DD-MM-YYYY"
                                    )
                                    : "",

                                row.invoice_no,

                                row.Particulars,

                                formatCurrency(
                                    row.Debit_Amt
                                ),

                                formatCurrency(
                                    row.Credit_Amt
                                ),

                                row.Ledger_Desc,
                            ]
                    ),

                styles: {
                    fontSize: 8,
                },

                headStyles: {
                    fillColor: [
                        30,
                        58,
                        138,
                    ],
                },
            });

            doc.save(
                `TransactionDetails_${decodeURIComponent(
                    partyName || ""
                )}.pdf`
            );
        };

        return (
            <>
                <PageHeader
                    onExportPDF={
                        handleExportPDF
                    }
                    onExportExcel={
                        handleExportExcel
                    }
                />

                <AppLayout fullWidth>

                    <Box p={2}>

                        <Box
                            display="flex"
                            justifyContent="space-between"
                            alignItems="center"
                            gap={2}
                            mb={2}
                            flexWrap="wrap"
                        >
                            {/* LEFT SIDE - TITLE */}
                            <Box>
                                <Typography
                                    variant="h6"
                                    fontWeight={700}
                                >
                                    {`Transaction Details - ${decodeURIComponent(
                                        partyName || ""
                                    )}`}
                                </Typography>

                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                >
                                    {`(From: ${dayjs(
                                        fromDate
                                    ).format(
                                        "DD/MM/YYYY"
                                    )} To: ${dayjs(
                                        toDate
                                    ).format(
                                        "DD/MM/YYYY"
                                    )})`}
                                </Typography>
                            </Box>

                            {/* RIGHT SIDE - SUMMARY CARDS */}
                            <Box
                                display="flex"
                                gap={1.5}
                                flexWrap="wrap"
                            >
                                {/* TOTAL DEBIT */}
                                <Paper
                                    elevation={0}
                                    sx={{
                                        px: 2,
                                        py: 1.5,
                                        minWidth: 170,
                                        borderRadius: 2,
                                        background: "transparent",
                                        border:
                                            "1px solid #cbcfd6",
                                    }}
                                >
                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        fontWeight={700}
                                    >
                                        Total Debit
                                    </Typography>

                                    <Typography
                                        fontWeight={700}
                                        color="error.main"
                                    >
                                        {formatCurrency(
                                            totalDebit
                                        )}
                                    </Typography>
                                </Paper>

                                {/* TOTAL CREDIT */}
                                <Paper
                                    elevation={0}
                                    sx={{
                                        px: 2,
                                        py: 1.5,
                                        minWidth: 170,
                                        borderRadius: 2,
                                        background: "transparent",
                                        border:
                                            "1px solid #cbcfd6",
                                    }}
                                >
                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        fontWeight={700}
                                    >
                                        Total Credit
                                    </Typography>

                                    <Typography
                                        fontWeight={700}
                                        color={
                                            totalCredit > 0
                                                ? "success.main"
                                                : "text.primary"
                                        }
                                    >
                                        {formatCurrency(
                                            totalCredit
                                        )}
                                    </Typography>
                                </Paper>

                                {/* NET BALANCE */}
                                <Paper
                                    elevation={0}
                                    sx={{
                                        px: 2,
                                        py: 1.5,
                                        minWidth: 190,
                                        borderRadius: 2,
                                        background: "transparent",
                                        border:
                                            "1px solid #cbcfd6",
                                    }}
                                >
                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        fontWeight={700}
                                    >
                                        Net Balance
                                    </Typography>

                                    <Typography
                                        fontWeight={700}
                                        color={
                                            balanceType ===
                                                "CR"
                                                ? "success.main"
                                                : "error.main"
                                        }
                                    >
                                        {`${formatCurrency(
                                            formattedBalance
                                        )} ${balanceType}`}
                                    </Typography>
                                </Paper>
                            </Box>
                        </Box>

                        {/* FILTER DRAWER */}

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

                        <Paper
                            elevation={0}
                            sx={{
                                borderRadius: 2,
                                border: "1px solid #E5E7EB",
                                overflow: "hidden",
                            }}
                        >
                            <TableContainer
                                sx={{
                                    maxHeight: "68vh",
                                }}
                            >
                                <Table
                                    stickyHeader
                                    size="small"
                                >
                                    <TableHead
                                        sx={{
                                            position: "sticky",
                                            top: 0,
                                            zIndex: 10,
                                        }}
                                    >
                                        {/* HEADER ROW */}
                                        <TableRow
                                            sx={{
                                                background: "#1E3A8A",
                                            }}
                                        >
                                            {[
                                                "Date",
                                                "Invoice No",
                                                "Particulars",
                                                "Debit Amount",
                                                "Credit Amount",
                                                "Ledger Description",
                                            ].map((header) => {
                                                const keyMap: Record<string, string> = {
                                                    "Debit Amount": "Debit_Amt",
                                                    "Credit Amount": "Credit_Amt",
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
                                                            fontWeight: 700,
                                                            background: "#1E3A8A",
                                                            whiteSpace: "nowrap",
                                                            position: "sticky",
                                                            top: 0,
                                                            zIndex: 11,
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
                                        <TableRow
                                            sx={{
                                                background: "#F3F4F6",
                                            }}
                                        >
                                            <TableCell
                                                sx={{
                                                    fontWeight: 700,
                                                    background: "#F3F4F6",
                                                    position: "sticky",
                                                    top: 33,
                                                    zIndex: 10,
                                                }}
                                            >
                                                Total
                                            </TableCell>

                                            <TableCell
                                                sx={{
                                                    background: "#F3F4F6",
                                                    position: "sticky",
                                                    top: 33,
                                                    zIndex: 10,
                                                }}
                                            />

                                            <TableCell
                                                sx={{
                                                    background: "#F3F4F6",
                                                    position: "sticky",
                                                    top: 33,
                                                    zIndex: 10,
                                                }}
                                            />

                                            {/* DEBIT TOTAL */}
                                            <TableCell
                                                align="right"
                                                sx={{
                                                    fontWeight: 700,
                                                    background: "#F3F4F6",
                                                    position: "sticky",
                                                    top: 33,
                                                    zIndex: 10,
                                                }}
                                            >
                                                {totalDebit > 0
                                                    ? `${formatCurrency(totalDebit)} DR`
                                                    : ""}
                                            </TableCell>

                                            {/* CREDIT TOTAL */}
                                            <TableCell
                                                align="right"
                                                sx={{
                                                    fontWeight: 700,
                                                    background: "#F3F4F6",
                                                    position: "sticky",
                                                    top: 33,
                                                    zIndex: 10,
                                                }}
                                            >
                                                {totalCredit > 0
                                                    ? `${formatCurrency(totalCredit)} CR`
                                                    : ""}
                                            </TableCell>

                                            <TableCell
                                                sx={{
                                                    background: "#F3F4F6",
                                                    position: "sticky",
                                                    top: 33,
                                                    zIndex: 10,
                                                }}
                                            />
                                        </TableRow>
                                    </TableHead>

                                    <TableBody>

                                        {loading ? (

                                            <TableRow>
                                                <TableCell
                                                    colSpan={
                                                        6
                                                    }
                                                    align="center"
                                                >
                                                    <CircularProgress />
                                                </TableCell>
                                            </TableRow>

                                        ) : paginatedRows.length === 0 ? (

                                            <TableRow>
                                                <TableCell
                                                    colSpan={
                                                        6
                                                    }
                                                    align="center"
                                                >
                                                    No Data Found
                                                </TableCell>
                                            </TableRow>

                                        ) : (

                                            paginatedRows.map(
                                                (
                                                    row,
                                                    index
                                                ) => (

                                                    <TableRow
                                                        key={
                                                            index
                                                        }
                                                        hover
                                                    >
                                                        <TableCell>
                                                            {row.Ledger_Date
                                                                ? dayjs(
                                                                    row.Ledger_Date
                                                                ).format(
                                                                    "DD-MM-YYYY"
                                                                )
                                                                : ""}
                                                        </TableCell>

                                                        <TableCell>
                                                            {
                                                                row.invoice_no
                                                            }
                                                        </TableCell>

                                                        <TableCell>
                                                            {
                                                                row.Particulars
                                                            }
                                                        </TableCell>

                                                        <TableCell
                                                            align="right"
                                                        >
                                                            {formatCurrency(
                                                                row.Debit_Amt
                                                            )}
                                                        </TableCell>

                                                        <TableCell
                                                            align="right"
                                                        >
                                                            {formatCurrency(
                                                                row.Credit_Amt
                                                            )}
                                                        </TableCell>

                                                        <TableCell>
                                                            {
                                                                row.Ledger_Desc
                                                            }
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            )
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Paper>

                        <Box mt={2}>
                            <CommonPagination
                                totalRows={
                                    numFilteredAndSortedRows.length
                                }
                                page={
                                    page
                                }
                                rowsPerPage={
                                    rowsPerPage
                                }
                                onPageChange={
                                    setPage
                                }
                                onRowsPerPageChange={(
                                    value: number
                                ) => {
                                    setRowsPerPage(
                                        value
                                    );

                                    setPage(
                                        1
                                    );
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

export default TransactionDetailsReport;