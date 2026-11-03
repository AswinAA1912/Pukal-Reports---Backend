import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useNumericalFilter } from "../../hooks/useNumericalFilter";
import { NumericalFilterMenu } from "../../Components/NumericalFilterMenu";
import { SortableHeaderLabel } from "../../Components/SortableHeaderLabel";
import HeaderFilterMenu from "../../Components/HeaderFilterMenu";
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
    Dialog,
    DialogTitle,
    DialogContent,
    Button,
    IconButton,
    Menu,
    Checkbox,
    FormControlLabel,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import dayjs from "dayjs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx-js-style";
import { toast } from "react-toastify";
import PageHeader, { ToggleMode } from "../../Layout/PageHeader";
import ReportFilterDrawer from "../../Components/ReportFilterDrawer";
import CommonPagination from "../../Components/CommonPagination";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import SettingsIcon from "@mui/icons-material/Settings";
import Switch from "@mui/material/Switch";
import Tooltip from "@mui/material/Tooltip";
import { CashBoxReportResponse, CashBoxTransaction, CashBoxMasterAccount } from "../../services/cashbox.service";

type ColumnConfig = {
    key: string;
    label: string;
    enabled: boolean;
    order: number;
};
import { bankboxService } from "../../services/bankbox.service";

interface GroupConfig {
    key: string;
    label: string;
    side: "debit" | "credit";
    masterKey: "Cash" | "Bank" | "LedgerGrp" | "DEX" | "IDEX" | "Others";
}

const DEBIT_GROUPS: GroupConfig[] = [
    { key: "bank_dep", label: "Bank Transfer (Contra)", side: "debit", masterKey: "Bank" },
    { key: "cash_paid", label: "Cash Withdraw (Contra)", side: "debit", masterKey: "Cash" },
    { key: "ledger_pay", label: "Ledger Groups (Payment)", side: "debit", masterKey: "LedgerGrp" },
    { key: "dex_deb", label: "Direct Expenses", side: "debit", masterKey: "DEX" },
    { key: "idex_deb", label: "In-Direct Expenses", side: "debit", masterKey: "IDEX" },
    { key: "others_deb", label: "Others", side: "debit", masterKey: "Others" }
];

const CREDIT_GROUPS: GroupConfig[] = [
    { key: "bank_rec", label: "Bank Received (Contra)", side: "credit", masterKey: "Bank" },
    { key: "cash_rec", label: "Cash Deposit (Contra)", side: "credit", masterKey: "Cash" },
    { key: "ledger_rec", label: "Ledger Groups (Receipts)", side: "credit", masterKey: "LedgerGrp" },
    { key: "dex_cred", label: "Direct Expenses- Income", side: "credit", masterKey: "DEX" },
    { key: "idex_cred", label: "InDirect Expenses- Income", side: "credit", masterKey: "IDEX" },
    { key: "others_cred", label: "Others", side: "credit", masterKey: "Others" }
];

const styleBankWorksheet = (ws: XLSX.WorkSheet) => {
    if (!ws || !ws['!ref']) return;
    const range = XLSX.utils.decode_range(ws['!ref']);

    const borderStyle = {
        top: { style: "thin", color: { rgb: "CFCFCF" } },
        bottom: { style: "thin", color: { rgb: "CFCFCF" } },
        left: { style: "thin", color: { rgb: "CFCFCF" } },
        right: { style: "thin", color: { rgb: "CFCFCF" } }
    };

    for (let R = range.s.r; R <= range.e.r; ++R) {
        const particularsCellDebit = ws[XLSX.utils.encode_cell({ r: R, c: 0 })];
        const particularsCellCredit = ws[XLSX.utils.encode_cell({ r: R, c: 2 })];

        const particularsValDebit = particularsCellDebit ? String(particularsCellDebit.v || "").trim() : "";
        const particularsValCredit = particularsCellCredit ? String(particularsCellCredit.v || "").trim() : "";

        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
            const cell = ws[cellAddress];
            if (!cell) continue;

            cell.s = cell.s || {};

            // Default font and borders
            cell.s.font = { name: "Arial", sz: 10, color: { rgb: "000000" } };
            cell.s.border = borderStyle;

            // 1. Report Title Row
            if (R === 0) {
                cell.s.font = { name: "Arial", sz: 12, bold: true, color: { rgb: "FFFFFF" } };
                cell.s.fill = { fgColor: { rgb: "1E3A8A" } };
                cell.s.alignment = { horizontal: "center", vertical: "center" };
                continue;
            }

            // 2. Main Headers Row or Transaction Details Section Header
            const isMainHeader = particularsValDebit === "Particulars (Debit)" || particularsValDebit === "Transaction Details";
            if (isMainHeader) {
                cell.s.font = { name: "Arial", sz: 10, bold: true, color: { rgb: "FFFFFF" } };
                cell.s.fill = { fgColor: { rgb: "1E3A8A" } };
                cell.s.alignment = { horizontal: "center", vertical: "center" };
                continue;
            }

            // 3. Opening/Closing Balance Row
            const isOpeningOrClosing = particularsValDebit === "Opening Balance" || particularsValCredit === "Opening Balance" ||
                particularsValDebit === "Closing Balance" || particularsValCredit === "Closing Balance";
            if (isOpeningOrClosing) {
                cell.s.font = { name: "Arial", sz: 10, bold: true, color: { rgb: "B45309" } }; // Amber/Brownish
                cell.s.fill = { fgColor: { rgb: "EEEEEE" } };
                if (C === 1 || C === 3) {
                    cell.s.alignment = { horizontal: "right", vertical: "center" };
                }
                continue;
            }

            // 4. Main Group Header Rows
            const isLeftGroupHeader = DEBIT_GROUPS.some(g => g.label === particularsValDebit);
            const isRightGroupHeader = CREDIT_GROUPS.some(g => g.label === particularsValCredit);
            if (isLeftGroupHeader || isRightGroupHeader) {
                cell.s.font = { name: "Arial", sz: 10, bold: true, color: { rgb: "1E3A8A" } };
                cell.s.fill = { fgColor: { rgb: "E2E8F0" } }; // Light grayish-blue
                if (C === 1 || C === 3) {
                    cell.s.alignment = { horizontal: "right", vertical: "center" };
                }
                continue;
            }

            // 5. Sub-ledgers (submain) rows
            const isLeftSubledger = particularsValDebit && /^\s*\d+\./.test(particularsValDebit);
            const isRightSubledger = particularsValCredit && /^\s*\d+\./.test(particularsValCredit);
            if (isLeftSubledger || isRightSubledger) {
                cell.s.font = { name: "Arial", sz: 10, color: { rgb: "000000" } };
                cell.s.fill = { fgColor: { rgb: "F8FAFC" } }; // Very light slate
                if (C === 1 || C === 3) {
                    cell.s.alignment = { horizontal: "right", vertical: "center" };
                }
                continue;
            }

            // 5.5. Narration and Nested Transaction styling
            const isLeftNarration = particularsValDebit && particularsValDebit.includes("*");
            const isRightNarration = particularsValCredit && particularsValCredit.includes("*");
            if (isLeftNarration || isRightNarration) {
                cell.s.font = { name: "Arial", sz: 9, italic: true, color: { rgb: "4F46E5" } }; // Indigo color
                continue;
            }

            const isLeftNestedTx = particularsValDebit && particularsValDebit.includes(" - ") && !/^\s*\d+\./.test(particularsValDebit);
            const isRightNestedTx = particularsValCredit && particularsValCredit.includes(" - ") && !/^\s*\d+\./.test(particularsValCredit);
            if (isLeftNestedTx || isRightNestedTx) {
                cell.s.font = { name: "Arial", sz: 9, italic: true, color: { rgb: "555555" } };
                continue;
            }

            // For amounts alignment
            if (C === 1 || C === 3) {
                cell.s.alignment = { horizontal: "right", vertical: "center" };
            }
        }
    }
};

const getInvoiceKey = (tx: CashBoxTransaction) => {
    if (tx.invoice_no) return String(tx.invoice_no).trim();
    if (tx.Trans_Id) return `TransId_${tx.Trans_Id}`;
    return "";
};

const BankAbstractReport: React.FC = () => {
    const today = dayjs().format("YYYY-MM-DD");

    const [loading, setLoading] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [exportModalOpen, setExportModalOpen] = useState(false);
    const [exportType, setExportType] = useState<"excel" | "pdf" | null>(null);
    const [exportDetails, setExportDetails] = useState(false);
    const [detailedExportStages, setDetailedExportStages] = useState({
        transactions: true,
        voucherDetails: true,
        narration: true,
        recPay: true,
    });
    const [fromDate, setFromDate] = useState(today);
    const [toDate, setToDate] = useState(today);
    const [filters, setFilters] = useState({
        Date: { from: today, to: today },
    });

    const [toggleMode, setToggleMode] = useState<ToggleMode>("Abstract");
    const [reportData, setReportData] = useState<CashBoxReportResponse | null>(null);
    const [detailedData, setDetailedData] = useState<{ OB: any[]; Data: any[]; Group: any[] } | null>(null);

    // Pagination for Expanded view
    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(100);

    // Selected groups for Abstract view filter chip
    const [selectedGroups, setSelectedGroups] = useState<string[]>(["All"]);

    // Selected groups for Expanded view chip filter
    const [selectedDetailedGroups, setSelectedDetailedGroups] = useState<string[]>(["All"]);

    const [settingsAnchor, setSettingsAnchor] = useState<null | HTMLElement>(null);
    const [detailedColumns, setDetailedColumns] = useState<ColumnConfig[]>([
        { key: "sno", label: "S.No", enabled: true, order: 0 },
        { key: "Ledger_Date", label: "Date", enabled: true, order: 1 },
        { key: "Created_on", label: "Time", enabled: true, order: 2 },
        { key: "Account_name", label: "Ledger Name", enabled: true, order: 3 },
        { key: "invoice_no", label: "Invoice No.", enabled: true, order: 4 },
        { key: "Narration", label: "Narration", enabled: true, order: 5 },
        { key: "Dr_Amount", label: "Debit", enabled: true, order: 6 },
        { key: "Cr_Amount", label: "Credit", enabled: true, order: 7 },
        { key: "Trans_Id", label: "Trans ID", enabled: false, order: 8 },
        { key: "voucher_name", label: "Voucher Name", enabled: false, order: 9 },
        { key: "Particulars", label: "Particulars", enabled: false, order: 10 },
        { key: "Month_Year", label: "Month Year", enabled: false, order: 11 },
        { key: "Debit_Names", label: "Debit Names", enabled: false, order: 12 },
        { key: "Credit_Names", label: "Credit Names", enabled: false, order: 13 },
        { key: "Group_Name", label: "Group Name", enabled: false, order: 14 }
    ]);

    const enabledColumns = useMemo(() => {
        return detailedColumns
            .filter(c => c.enabled)
            .sort((a, b) => a.order - b.order);
    }, [detailedColumns]);

    const SortableColumnItem: React.FC<{
        column: ColumnConfig;
        showFilter: boolean;
        onToggle: (key: string) => void;
    }> = ({ column, showFilter, onToggle }) => {
        const {
            attributes,
            listeners,
            setNodeRef,
            transform,
            transition,
        } = useSortable({ id: column.key });

        const style = {
            transform: CSS.Transform.toString(transform),
            transition,
        };

        return (
            <Box
                ref={setNodeRef}
                style={style}
                display="flex"
                alignItems="center"
                gap={1}
                px={2}
                py={0.5}
                mb={1}
            >
                {/* DRAG HANDLE */}
                <IconButton
                    size="small"
                    {...listeners}
                    {...attributes}
                    sx={{ cursor: "grab" }}
                >
                    <DragIndicatorIcon fontSize="small" />
                </IconButton>

                {/* LABEL + FILTER ICON */}
                <Box display="flex" alignItems="center" gap={1} sx={{ flex: 1 }}>
                    <Typography fontSize="0.75rem">
                        {column.label}
                    </Typography>
                    {showFilter && (
                        <Tooltip title="Header filter enabled">
                            <FilterAltIcon fontSize="small" color="action" />
                        </Tooltip>
                    )}
                </Box>

                {/* ENABLE / DISABLE SWITCH */}
                <Switch
                    size="medium"
                    checked={column.enabled}
                    onChange={() => onToggle(column.key)}
                    sx={{
                        "& .MuiSwitch-switchBase.Mui-checked": {
                            color: "#1E3A8A",
                        },
                        "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                            backgroundColor: "#b5b9c4",
                        },
                        "& .MuiSwitch-track": {
                            backgroundColor: "#CBD5E1",
                        },
                    }}
                />
            </Box>
        );
    };

    const getWidth = (key: string) => {
        switch (key) {
            case "sno": return "4%";
            case "Ledger_Date": return "10%";
            case "Created_on": return "8%";
            case "Account_name": return "17%";
            case "invoice_no": return "14%";
            case "Narration": return "23%";
            case "Cr_Amount": return "12%";
            case "Dr_Amount": return "12%";
            default: return undefined;
        }
    };

    const renderCell = (tx: any, colKey: string, tIdx: number) => {
        switch (colKey) {
            case "sno":
                return (
                    <TableCell align="center" sx={{ border: "1px solid #cbd5e1" }} key="sno">
                        {(page - 1) * rowsPerPage + tIdx + 1}
                    </TableCell>
                );
            case "Ledger_Date":
                return (
                    <TableCell sx={{ border: "1px solid #cbd5e1" }} key="Ledger_Date">
                        {tx.Ledger_Date ? dayjs(tx.Ledger_Date).format("DD-MM-YYYY") : ""}
                    </TableCell>
                );
            case "Created_on":
                return (
                    <TableCell sx={{ border: "1px solid #cbd5e1" }} key="Created_on">
                        {formatCreatedOn(tx.Created_on)}
                    </TableCell>
                );
            case "Account_name":
                return (
                    <TableCell sx={{ border: "1px solid #cbd5e1" }} key="Account_name">
                        {Number(tx.Dr_Amount) > 0 ? tx.Credit_Names : (Number(tx.Cr_Amount) > 0 ? tx.Debit_Names : tx.Account_name)}
                    </TableCell>
                );
            case "invoice_no":
                return (
                    <TableCell sx={{ border: "1px solid #cbd5e1" }} key="invoice_no">
                        {tx.invoice_no || "-"}
                    </TableCell>
                );
            case "Narration":
                return (
                    <TableCell sx={{ border: "1px solid #cbd5e1", maxWidth: 250, whiteSpace: "normal" }} key="Narration">
                        <Box
                            sx={{
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "normal",
                                wordBreak: "break-all"
                            }}
                        >
                            {tx.Narration || tx.Line_Naration || ""}
                        </Box>
                    </TableCell>
                );
            case "Dr_Amount":
                return (
                    <TableCell align="right" sx={{ border: "1px solid #cbd5e1", fontWeight: 600 }} key="Dr_Amount">
                        {Number(tx.Cr_Amount) > 0 ? formatNum(Number(tx.Cr_Amount)) : "-"}
                    </TableCell>
                );
            case "Cr_Amount":
                return (
                    <TableCell align="right" sx={{ border: "1px solid #cbd5e1", fontWeight: 600 }} key="Cr_Amount">
                        {Number(tx.Dr_Amount) > 0 ? formatNum(Number(tx.Dr_Amount)) : "-"}
                    </TableCell>
                );
            default:
                return (
                    <TableCell sx={{ border: "1px solid #cbd5e1" }} key={colKey}>
                        {tx[colKey] || "-"}
                    </TableCell>
                );
        }
    };

    // Extract all unique Account Names from Bank dataset only for Abstract view (only those with data)
    const allGroupNames = useMemo(() => {
        if (!reportData) return [];

        const names = new Set<string>();
        const transactions = reportData.Data1 || [];
        const obList = reportData.OB || [];
        const clsList = reportData.Cls || [];

        (reportData.Bank || []).forEach((acc) => {
            const accIdStr = String(acc.Acc_Id).trim();
            const accNameLower = acc.Account_name ? acc.Account_name.trim().toLowerCase() : "";

            // Check if there are transactions matching this bank account
            const hasTx = transactions.some((tx: any) =>
                (tx.Debit_Ac_Id && String(tx.Debit_Ac_Id).trim() === accIdStr) ||
                (tx.Credit_Ac_Id && String(tx.Credit_Ac_Id).trim() === accIdStr)
            );

            // Check if there is non-zero opening balance
            const hasOB = obList.some((ob: any) =>
                ((ob.Acc_Id && String(ob.Acc_Id).trim() === accIdStr) ||
                    (ob.Account_name && ob.Account_name.trim().toLowerCase() === accNameLower)) &&
                Number(ob.OB_Amount) !== 0
            );

            // Check if there is non-zero closing balance
            const hasCls = clsList.some((cls: any) =>
                ((cls.Acc_Id && String(cls.Acc_Id).trim() === accIdStr) ||
                 (cls.Account_name && cls.Account_name.trim().toLowerCase() === accNameLower)) &&
                Number(cls.CL_Amount) !== 0
            );

            if (acc.Account_name && (hasTx || hasOB || hasCls)) {
                names.add(acc.Account_name.trim());
            }
        });
        return Array.from(names).sort();
    }, [reportData]);

    // Extract unique Account Names for the Expanded view from the detailed Group dataset (only those with data)
    const detailedGroupNames = useMemo(() => {
        if (!detailedData || !detailedData.Group) return [];
        const names = new Set<string>();
        const transactions = detailedData.Data || [];
        const obList = detailedData.OB || [];

        detailedData.Group.forEach((g: any) => {
            const accIdStr = g.Acc_Id ? String(g.Acc_Id).trim() : "";
            const accNameLower = g.Account_name ? g.Account_name.trim().toLowerCase() : "";

            // Check if there are transactions in detailedData.Data matching this group account
            const hasTx = transactions.some((tx: any) => {
                if (!tx.Acc_Id) return false;
                const txAccIds = Array.isArray(tx.Acc_Id) ? tx.Acc_Id.map(String) : [String(tx.Acc_Id)];
                return txAccIds.includes(accIdStr);
            });

            // Check if there is non-zero opening balance
            const hasOB = obList.some((ob: any) =>
                ((ob.Acc_Id && String(ob.Acc_Id).trim() === accIdStr) ||
                    (ob.Account_name && ob.Account_name.trim().toLowerCase() === accNameLower)) &&
                Number(ob.OB_Amount) !== 0
            );

            // Calculate closing balance dynamically to check if it has a non-zero closing balance
            let obAmount = 0;
            const obItem = obList.find((ob: any) =>
                (ob.Acc_Id && String(ob.Acc_Id).trim() === accIdStr) ||
                (ob.Account_name && ob.Account_name.trim().toLowerCase() === accNameLower)
            );
            if (obItem) {
                obAmount = Number(obItem.OB_Amount) || 0;
            }

            let txDebitSum = 0;
            let txCreditSum = 0;
            transactions.forEach((tx: any) => {
                if (!tx.Acc_Id) return;
                const txAccIds = Array.isArray(tx.Acc_Id) ? tx.Acc_Id.map(String) : [String(tx.Acc_Id)];
                if (txAccIds.includes(accIdStr)) {
                    txDebitSum += Number(tx.Dr_Amount || 0);
                    txCreditSum += Number(tx.Cr_Amount || 0);
                }
            });

            const closingBalance = obAmount + txDebitSum - txCreditSum;
            const hasCls = closingBalance !== 0;

            if (g.Account_name && (hasTx || hasOB || hasCls)) {
                names.add(g.Account_name.trim());
            }
        });
        return Array.from(names).sort();
    }, [detailedData]);

    // Column header dropdown filtering for Expanded view
    const [activeHeader, setActiveHeader] = useState<string | null>(null);
    const [filterAnchor, setFilterAnchor] = useState<null | HTMLElement>(null);
    const [columnFilters, setColumnFilters] = useState<Record<string, string[] | undefined>>({
        voucher_name: undefined,
        Account_name: undefined,
        Particulars: undefined,
        invoice_no: undefined,
    });

    const filteredDetailedTransactions = useMemo(() => {
        if (!detailedData || !detailedData.Data) return [];
        const { Data } = detailedData;

        let filtered = Data.filter((item: any) => {
            const voucherFilter = columnFilters.voucher_name;
            if (voucherFilter !== undefined && !voucherFilter.includes(item.voucher_name)) return false;

            const nameFilter = columnFilters.Account_name;
            if (nameFilter !== undefined && !nameFilter.includes(item.Account_name)) return false;

            const particularsFilter = columnFilters.Particulars;
            if (particularsFilter !== undefined && !particularsFilter.includes(item.Particulars)) return false;

            const invoiceNoFilter = columnFilters.invoice_no;
            if (invoiceNoFilter !== undefined && !invoiceNoFilter.includes(item.invoice_no)) return false;

            return true;
        });

        const isGroupFiltered = !selectedDetailedGroups.includes("All") && selectedDetailedGroups.length > 0;
        if (isGroupFiltered) {
            filtered = filtered.filter((item: any) =>
                item.Account_name && selectedDetailedGroups.includes(item.Account_name.trim())
            );
        }

        return filtered;
    }, [detailedData, columnFilters, selectedDetailedGroups]);

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
    } = useNumericalFilter(filteredDetailedTransactions, ["Dr_Amount", "Cr_Amount"]);

    const handleGroupChipClick = (groupName: string) => {
        if (groupName === "All") {
            setSelectedGroups(["All"]);
            return;
        }

        setSelectedGroups((prev) => {
            const next = prev.filter((g) => g !== "All");
            if (next.includes(groupName)) {
                const updated = next.filter((g) => g !== groupName);
                return updated.length === 0 ? ["All"] : updated;
            } else {
                return [...next, groupName];
            }
        });
    };

    const handleDetailedGroupChipClick = (groupName: string) => {
        if (groupName === "All") {
            setSelectedDetailedGroups(["All"]);
            setPage(1);
            return;
        }

        setSelectedDetailedGroups((prev) => {
            const next = prev.filter((g) => g !== "All");
            if (next.includes(groupName)) {
                const updated = next.filter((g) => g !== groupName);
                setPage(1);
                return updated.length === 0 ? ["All"] : updated;
            } else {
                setPage(1);
                return [...next, groupName];
            }
        });
    };

    // Expansion state for each group key
    const [expanded, setExpanded] = useState<Record<string, boolean>>({
        bank_dep: false,
        bank_rec: false,
        cash_paid: false,
        cash_rec: false,
        ledger_pay: false,
        ledger_rec: false,
        dex_deb: false,
        dex_cred: false,
        idex_deb: false,
        idex_cred: false,
        others_deb: false,
        others_cred: false,
    });

    // Details Modal State
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [selectedLedger, setSelectedLedger] = useState<{
        accId: string;
        name: string;
        side: "debit" | "credit";
    } | null>(null);

    // Fetch transactions
    const fetchData = async () => {
        try {
            setLoading(true);
            if (toggleMode === "Abstract") {
                const res = await bankboxService.getBankBoxReport({
                    Fromdate: filters.Date.from,
                    Todate: filters.Date.to,
                });
                if (res && !Array.isArray(res)) {
                    const filterGroup = (arr: any[]) =>
                        (arr || []).filter(
                            (acc) =>
                                !acc.Group_Name ||
                                acc.Group_Name.trim().toLowerCase()
                        );

                    const filteredRes = {
                        ...res,
                        Cash: filterGroup(res.Cash),
                        Bank: filterGroup(res.Bank),
                        LedgerGrp: filterGroup(res.LedgerGrp),
                        DEX: filterGroup(res.DEX),
                        IDEX: filterGroup(res.IDEX),
                    };
                    setReportData(filteredRes);
                } else {
                    setReportData(null);
                }
            } else {
                const res = await bankboxService.getBankBoxDetailedReport({
                    Fromdate: filters.Date.from,
                    Todate: filters.Date.to,
                });
                if (res && res.Data) {
                    setDetailedData(res);
                } else {
                    setDetailedData(null);
                }
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to load bank report data ❌");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [filters.Date.from, filters.Date.to, toggleMode]);

    // Format helpers
    const formatNum = (v: number | undefined | null) => {
        if (v === undefined || v === null || isNaN(v) || v === 0) return "-";
        return "₹" + new Intl.NumberFormat("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(Number(v));
    };

    const formatTime = (dateStr: string) => {
        if (!dateStr) return "-";

        // Strip Z to avoid shifting local time to UTC
        const cleanStr = dateStr.endsWith("Z") ? dateStr.slice(0, -1) : dateStr;
        const d = dayjs(cleanStr);

        if (!d.isValid()) return "-";

        return d.format("h.mm a");
    };

    const formatCreatedOn = (dateString: any): string => {
        if (!dateString) return "-";
        
        let str = "";
        if (dateString instanceof Date) {
            const y = dateString.getFullYear();
            const m = String(dateString.getMonth() + 1).padStart(2, "0");
            const d = String(dateString.getDate()).padStart(2, "0");
            const h = String(dateString.getHours()).padStart(2, "0");
            const min = String(dateString.getMinutes()).padStart(2, "0");
            const s = String(dateString.getSeconds()).padStart(2, "0");
            str = `${y}-${m}-${d}T${h}:${min}:${s}`;
        } else {
            str = String(dateString);
        }

        const match = str.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);
        if (!match) return "-";

        const [_, yearStr, monthStr, dayStr, hourStr, minuteStr] = match;

        const day = dayStr;
        const month = monthStr;
        const year = yearStr;

        let hours = parseInt(hourStr, 10);
        const minutes = minuteStr;
        const ampm = hours >= 12 ? "p.m." : "a.m.";

        hours = hours % 12 || 12;

        return `${day}-${month}-${year} ${hours}.${minutes} ${ampm}`;
    };

    const toggleGroup = (key: string) => {
        setExpanded((prev) => ({
            ...prev,
            [key]: !prev[key],
        }));
    };

    // Get selected Bank Account IDs
    const selectedBankAccIds = useMemo(() => {
        const isFiltered = !selectedGroups.includes("All") && selectedGroups.length > 0;
        return new Set(
            (reportData?.Bank || [])
                .filter((acc) => !isFiltered || (acc.Account_name && selectedGroups.includes(acc.Account_name.trim())))
                .map((acc) => String(acc.Acc_Id).trim())
        );
    }, [reportData, selectedGroups]);

    // Get all Bank Account IDs
    const allBankAccIds = useMemo(() => {
        return new Set((reportData?.Bank || []).map((acc) => String(acc.Acc_Id).trim()));
    }, [reportData]);

    // Set of selected Bank Invoice Keys
    const selectedBankInvoiceKeys = useMemo(() => {
        const keys = new Set<string>();
        (reportData?.Data1 || []).forEach((tx) => {
            const key = getInvoiceKey(tx);
            if (!key) return;
            const debitIdStr = tx.Debit_Ac_Id ? String(tx.Debit_Ac_Id).trim() : "";
            const creditIdStr = tx.Credit_Ac_Id ? String(tx.Credit_Ac_Id).trim() : "";
            if (selectedBankAccIds.has(debitIdStr) || selectedBankAccIds.has(creditIdStr)) {
                keys.add(key);
            }
        });
        return keys;
    }, [reportData, selectedBankAccIds]);

    const invoiceKeysWithDebitSelectedBank = useMemo(() => {
        const keys = new Set<string>();
        (reportData?.Data1 || []).forEach((tx) => {
            const key = getInvoiceKey(tx);
            if (!key) return;
            const debitIdStr = tx.Debit_Ac_Id ? String(tx.Debit_Ac_Id).trim() : "";
            if (selectedBankAccIds.has(debitIdStr)) {
                keys.add(key);
            }
        });
        return keys;
    }, [reportData, selectedBankAccIds]);

    const invoiceKeysWithCreditSelectedBank = useMemo(() => {
        const keys = new Set<string>();
        (reportData?.Data1 || []).forEach((tx) => {
            const key = getInvoiceKey(tx);
            if (!key) return;
            const creditIdStr = tx.Credit_Ac_Id ? String(tx.Credit_Ac_Id).trim() : "";
            if (selectedBankAccIds.has(creditIdStr)) {
                keys.add(key);
            }
        });
        return keys;
    }, [reportData, selectedBankAccIds]);

    // Bank-to-Bank contra invoice keys
    const bankToBankInvoiceKeys = useMemo(() => {
        const keys = new Set<string>();
        (reportData?.Data1 || []).forEach((tx) => {
            const key = getInvoiceKey(tx);
            if (!key) return;
            const debitIdStr = tx.Debit_Ac_Id ? String(tx.Debit_Ac_Id).trim() : "";
            const creditIdStr = tx.Credit_Ac_Id ? String(tx.Credit_Ac_Id).trim() : "";
            if (debitIdStr && creditIdStr && allBankAccIds.has(debitIdStr) && allBankAccIds.has(creditIdStr)) {
                keys.add(key);
            }
        });
        return keys;
    }, [reportData, allBankAccIds]);

    // Filter transactions to bank-involved invoices
    const filteredTransactions = useMemo(() => {
        const allTx = reportData?.Data1 || [];
        return allTx.filter((tx) => {
            const key = getInvoiceKey(tx);
            if (!key || !selectedBankInvoiceKeys.has(key)) return false;
            return true;
        });
    }, [reportData, selectedBankInvoiceKeys]);

    // Parse and group data for Abstract side
    const parsedData = useMemo(() => {
        if (!reportData) {
            return {
                debitGroups: [],
                creditGroups: [],
                opening: 0,
                closing: 0,
                othersList: [],
            };
        }

        const cashList = reportData.Cash || [];
        const bankList = reportData.Bank || [];
        const ledgerGrpList = reportData.LedgerGrp || [];
        const dexList = reportData.DEX || [];
        const idexList = reportData.IDEX || [];
        const obList = reportData.OB || [];

        const allDefinedAccIds = new Set<string>();
        [cashList, bankList, ledgerGrpList, dexList, idexList].forEach((list) => {
            list.forEach((acc) => {
                if (acc.Acc_Id) allDefinedAccIds.add(String(acc.Acc_Id).trim());
            });
        });

        const othersMap = new Map<string, CashBoxMasterAccount>();
        filteredTransactions.forEach((tx) => {
            const debitIdStr = tx.Debit_Ac_Id ? String(tx.Debit_Ac_Id).trim() : "";
            const creditIdStr = tx.Credit_Ac_Id ? String(tx.Credit_Ac_Id).trim() : "";

            const isDebitBank = debitIdStr && selectedBankAccIds.has(debitIdStr);
            const isCreditBank = creditIdStr && selectedBankAccIds.has(creditIdStr);
            const isJournal = tx.voucher_name && tx.voucher_name.toLowerCase().includes("journal");

            if (isJournal) {
                if (debitIdStr && debitIdStr !== "0" && !allDefinedAccIds.has(debitIdStr)) {
                    if (!othersMap.has(debitIdStr)) {
                        othersMap.set(debitIdStr, {
                            Acc_Id: debitIdStr,
                            Account_name: tx.Particulars || `Account (${debitIdStr})`,
                            Group_Name: "Others",
                            Group_Id: "Others"
                        });
                    }
                }
                if (creditIdStr && creditIdStr !== "0" && !allDefinedAccIds.has(creditIdStr)) {
                    if (!othersMap.has(creditIdStr)) {
                        othersMap.set(creditIdStr, {
                            Acc_Id: creditIdStr,
                            Account_name: tx.Particulars || `Account (${creditIdStr})`,
                            Group_Name: "Others",
                            Group_Id: "Others"
                        });
                    }
                }
            } else {
                if (isDebitBank && creditIdStr && creditIdStr !== "0" && !allDefinedAccIds.has(creditIdStr)) {
                    if (!othersMap.has(creditIdStr)) {
                        othersMap.set(creditIdStr, {
                            Acc_Id: creditIdStr,
                            Account_name: tx.Particulars || `Account (${creditIdStr})`,
                            Group_Name: "Others",
                            Group_Id: "Others"
                        });
                    }
                }
                if (isCreditBank && debitIdStr && debitIdStr !== "0" && !allDefinedAccIds.has(debitIdStr)) {
                    if (!othersMap.has(debitIdStr)) {
                        othersMap.set(debitIdStr, {
                            Acc_Id: debitIdStr,
                            Account_name: tx.Particulars || `Account (${debitIdStr})`,
                            Group_Name: "Others",
                            Group_Id: "Others"
                        });
                    }
                }
            }
        });
        const othersList = Array.from(othersMap.values());

        const masterMap = {
            Cash: cashList,
            Bank: bankList,
            LedgerGrp: ledgerGrpList,
            DEX: dexList,
            IDEX: idexList,
            Others: othersList,
        };

        let opening = 0;
        if (obList.length > 0) {
            const isFiltered = !selectedGroups.includes("All") && selectedGroups.length > 0;
            const bankAccountNames = new Set((reportData?.Bank || []).map(acc => acc.Account_name ? acc.Account_name.trim() : ""));
            const bankGroupNames = new Set((reportData?.Bank || []).map(acc => acc.Group_Name ? acc.Group_Name.trim() : ""));

            let sum = 0;
            obList.forEach((obItem: any) => {
                const isSelected = isFiltered
                    ? (obItem.Acc_Id ? selectedBankAccIds.has(String(obItem.Acc_Id).trim()) : ((obItem.Account_name && selectedGroups.includes(obItem.Account_name.trim())) || (obItem.Group_Name && selectedGroups.includes(obItem.Group_Name.trim()))))
                    : (obItem.Acc_Id ? allBankAccIds.has(String(obItem.Acc_Id).trim()) : ((obItem.Account_name ? bankAccountNames.has(obItem.Account_name.trim()) : true) && (obItem.Group_Name ? bankGroupNames.has(obItem.Group_Name.trim()) : true)));

                if (isSelected) {
                    sum += Number(obItem.OB_Amount) || 0;
                }
            });
            opening = sum;
        }

        const getGroupData = (config: GroupConfig) => {
            const masters = masterMap[config.masterKey];
            const masterIds = new Set(masters.map((m) => String(m.Acc_Id).trim()));

            const matchedTransactions = filteredTransactions.filter((tx) => {
                const txCreditAcIdStr = tx.Credit_Ac_Id ? String(tx.Credit_Ac_Id).trim() : "";
                const txDebitAcIdStr = tx.Debit_Ac_Id ? String(tx.Debit_Ac_Id).trim() : "";
                const key = getInvoiceKey(tx);

                if (config.masterKey === "Bank") {
                    const isBankToBank = key && bankToBankInvoiceKeys.has(key);
                    if (!isBankToBank) return false;

                    if (config.side === "debit") {
                        return tx.Credit_Ac_Id && selectedBankAccIds.has(txCreditAcIdStr);
                    } else {
                        return tx.Debit_Ac_Id && selectedBankAccIds.has(txDebitAcIdStr);
                    }
                }

                if (config.side === "debit") {
                    // Outflows/Payments (Debit to opposing account, Credit to selected Bank)
                    return tx.Debit_Ac_Id && masterIds.has(txDebitAcIdStr) && key && invoiceKeysWithCreditSelectedBank.has(key);
                } else {
                    // Inflows/Receipts (Credit to opposing account, Debit to selected Bank)
                    return tx.Credit_Ac_Id && masterIds.has(txCreditAcIdStr) && key && invoiceKeysWithDebitSelectedBank.has(key);
                }
            });

            const subLedgerMap: Record<string, { accId: string; name: string; amount: number }> = {};
            matchedTransactions.forEach((tx) => {
                let accId = config.side === "debit" ? String(tx.Debit_Ac_Id).trim() : String(tx.Credit_Ac_Id).trim();
                let amount = config.side === "debit" ? tx.Dr_Amount : tx.Cr_Amount;

                if (config.masterKey === "Bank") {
                    const txDebitAcIdStr = tx.Debit_Ac_Id ? String(tx.Debit_Ac_Id).trim() : "";
                    const txCreditAcIdStr = tx.Credit_Ac_Id ? String(tx.Credit_Ac_Id).trim() : "";
                    if (tx.Debit_Ac_Id && allBankAccIds.has(txDebitAcIdStr)) {
                        accId = txDebitAcIdStr;
                        amount = tx.Dr_Amount;
                    } else if (tx.Credit_Ac_Id && allBankAccIds.has(txCreditAcIdStr)) {
                        accId = txCreditAcIdStr;
                        amount = tx.Cr_Amount;
                    }
                }

                if (!subLedgerMap[accId]) {
                    const allLists = [
                        ...(reportData?.Cash || []),
                        ...(reportData?.Bank || []),
                        ...(reportData?.LedgerGrp || []),
                        ...(reportData?.DEX || []),
                        ...(reportData?.IDEX || []),
                        ...othersList,
                    ];
                    const masterAcc = allLists.find((m) => String(m.Acc_Id).trim() === accId);
                    subLedgerMap[accId] = {
                        accId,
                        name: masterAcc ? masterAcc.Account_name : (tx.Particulars || `Account (${accId})`),
                        amount: 0,
                    };
                }
                subLedgerMap[accId].amount += amount;
            });

            const subLedgers = Object.values(subLedgerMap);
            const total = subLedgers.reduce((sum, s) => sum + s.amount, 0);
            return { total, subLedgers };
        };

        const debitGroups = DEBIT_GROUPS.map((grp) => ({
            ...grp,
            ...getGroupData(grp),
        }));

        const creditGroups = CREDIT_GROUPS.map((grp) => ({
            ...grp,
            ...getGroupData(grp),
        }));

        const totalDebits = debitGroups.reduce((sum, g) => sum + g.total, 0);
        const totalCredits = creditGroups.reduce((sum, g) => sum + g.total, 0);

        let closing = 0;
        const clsList = reportData?.Cls || [];
        if (clsList.length > 0) {
            const isFiltered = !selectedGroups.includes("All") && selectedGroups.length > 0;
            const bankAccountNames = new Set((reportData?.Bank || []).map(acc => acc.Account_name ? acc.Account_name.trim() : ""));
            const bankGroupNames = new Set((reportData?.Bank || []).map(acc => acc.Group_Name ? acc.Group_Name.trim() : ""));

            let sum = 0;
            clsList.forEach((clsItem: any) => {
                const isSelected = isFiltered
                    ? (clsItem.Acc_Id ? selectedBankAccIds.has(String(clsItem.Acc_Id).trim()) : ((clsItem.Account_name && selectedGroups.includes(clsItem.Account_name.trim())) || (clsItem.Group_Name && selectedGroups.includes(clsItem.Group_Name.trim()))))
                    : (clsItem.Acc_Id ? allBankAccIds.has(String(clsItem.Acc_Id).trim()) : ((clsItem.Account_name ? bankAccountNames.has(clsItem.Account_name.trim()) : true) && (clsItem.Group_Name ? bankGroupNames.has(clsItem.Group_Name.trim()) : true)));

                if (isSelected) {
                    sum += Number(clsItem.CL_Amount) || 0;
                }
            });
            closing = opening + sum;
        } else {
            closing = opening + totalCredits - totalDebits;
        }

        return {
            debitGroups,
            creditGroups,
            opening,
            closing,
            othersList,
        };
    }, [reportData, selectedBankAccIds, filteredTransactions, bankToBankInvoiceKeys, invoiceKeysWithCreditSelectedBank, invoiceKeysWithDebitSelectedBank, selectedGroups, allBankAccIds]);

    // Helper to group transactions into their respective Account groups
    const getGroupedDetailedTransactions = useCallback((transactionsList: any[]) => {
        if (!detailedData || !detailedData.Group || !detailedData.OB) return [];
        const { OB, Group } = detailedData;
        const isGroupFiltered = !selectedDetailedGroups.includes("All") && selectedDetailedGroups.length > 0;

        const activeGroups = Group.filter((g: any) =>
            !isGroupFiltered || (g.Account_name && selectedDetailedGroups.includes(g.Account_name.trim()))
        );

        const assignedObIndices = new Set<number>();

        return activeGroups.map((groupItem: any) => {
            const matchedTransactions = transactionsList.filter((item: any) => {
                if (!item.Acc_Id) return false;
                const txAccIds = Array.isArray(item.Acc_Id) ? item.Acc_Id.map(String) : [String(item.Acc_Id)];
                return txAccIds.includes(String(groupItem.Acc_Id));
            });

            const obIndex = OB.findIndex((ob, idx) => {
                if (assignedObIndices.has(idx)) return false;
                return (ob.Acc_Id && String(ob.Acc_Id) === String(groupItem.Acc_Id)) ||
                    (ob.Account_name && String(ob.Account_name).toLowerCase() === String(groupItem.Account_name).toLowerCase()) ||
                    (ob.Group_Name && String(ob.Group_Name).toLowerCase() === String(groupItem.Group_Name).toLowerCase());
            });

            let obAmount = 0;
            if (obIndex !== -1) {
                assignedObIndices.add(obIndex);
                obAmount = Number(OB[obIndex].OB_Amount) || 0;
            }

            let txDebitSum = 0;
            let txCreditSum = 0;
            matchedTransactions.forEach((tx: any) => {
                txDebitSum += Number(tx.Dr_Amount || 0);
                txCreditSum += Number(tx.Cr_Amount || 0);
            });

            const sortedTransactions = [...matchedTransactions].sort((a, b) => {
                const aDr = Number(a.Dr_Amount) || 0;
                const bDr = Number(b.Dr_Amount) || 0;
                if (aDr > 0 && bDr === 0) return -1;
                if (aDr === 0 && bDr > 0) return 1;
                return 0;
            });

            return {
                ...groupItem,
                obAmount,
                transactions: sortedTransactions,
                totalDebit: txDebitSum,
                totalCredit: txCreditSum,
                closingBalance: txDebitSum - txCreditSum
            };
        }).filter((g: any) => g.transactions.length > 0);
    }, [detailedData, selectedDetailedGroups]);

    // Group and calculate detailed data for Expanded side with pagination and chips
    const detailedReportSummary = useMemo(() => {
        const totalRows = numFilteredAndSortedRows.length;
        const paginatedTx = numFilteredAndSortedRows.slice((page - 1) * rowsPerPage, page * rowsPerPage);
        const groups = getGroupedDetailedTransactions(paginatedTx);

        return {
            groups,
            totalRows
        };
    }, [numFilteredAndSortedRows, page, rowsPerPage, getGroupedDetailedTransactions]);

    const totalOpeningBalance = useMemo(() => {
        if (!detailedData || !detailedData.OB) return 0;
        const { OB } = detailedData;
        const isGroupFiltered = !selectedDetailedGroups.includes("All") && selectedDetailedGroups.length > 0;

        let filteredOB = OB;
        if (isGroupFiltered) {
            filteredOB = OB.filter((ob: any) =>
                ob.Account_name && selectedDetailedGroups.includes(ob.Account_name.trim())
            );
        }
        return filteredOB.reduce((sum, item) => sum + (Number(item.OB_Amount) || 0), 0);
    }, [detailedData, selectedDetailedGroups]);

    const totalDetailedDebitsAndCredits = useMemo(() => {
        let debit = 0;
        let credit = 0;
        numFilteredAndSortedRows.forEach((tx: any) => {
            debit += Number(tx.Dr_Amount || 0);
            credit += Number(tx.Cr_Amount || 0);
        });

        return { debit, credit };
    }, [numFilteredAndSortedRows]);

    const finalClosing = useMemo(() => {
        return totalOpeningBalance + totalDetailedDebitsAndCredits.debit - totalDetailedDebitsAndCredits.credit;
    }, [totalOpeningBalance, totalDetailedDebitsAndCredits]);

    // Handle opening detail modal
    const handleLedgerClick = (accId: string, name: string, side: "debit" | "credit") => {
        setSelectedLedger({ accId, name, side });
        setDetailModalOpen(true);
    };

    const getTransactionsForLedger = useCallback((accId: string, side: "debit" | "credit") => {
        if (!filteredTransactions) return [];
        const accIdTrim = String(accId).trim();
        const isBank = allBankAccIds.has(accIdTrim);

        return filteredTransactions.filter((tx) => {
            if (isBank) {
                const key = getInvoiceKey(tx);
                const isBankToBank = key && bankToBankInvoiceKeys.has(key);
                if (!isBankToBank) return false;

                if (side === "debit") {
                    return String(tx.Credit_Ac_Id).trim() === accIdTrim;
                } else {
                    return String(tx.Debit_Ac_Id).trim() === accIdTrim;
                }
            } else {
                if (side === "debit") {
                    return String(tx.Debit_Ac_Id).trim() === accIdTrim;
                } else {
                    return String(tx.Credit_Ac_Id).trim() === accIdTrim;
                }
            }
        });
    }, [filteredTransactions, allBankAccIds, bankToBankInvoiceKeys]);

    const modalTransactions = useMemo(() => {
        if (!selectedLedger) return [];
        return getTransactionsForLedger(selectedLedger.accId, selectedLedger.side);
    }, [selectedLedger, getTransactionsForLedger]);

    const getTransactionAmount = useCallback((tx: CashBoxTransaction, accId: string, side: "debit" | "credit") => {
        const accIdTrim = String(accId).trim();
        const isBank = allBankAccIds.has(accIdTrim);
        if (isBank) {
            return String(tx.Debit_Ac_Id).trim() === accIdTrim ? tx.Dr_Amount : tx.Cr_Amount;
        } else {
            return side === "debit" ? tx.Dr_Amount : tx.Cr_Amount;
        }
    }, [allBankAccIds]);

    const getOpposingLedgerNameForExport = useCallback((tx: CashBoxTransaction, accId: string, side: "debit" | "credit") => {
        if (tx.invoice_no && reportData?.Jnl) {
            const jnlItem = reportData.Jnl.find(
                (j) => j.invoice_no && String(j.invoice_no).trim() === String(tx.invoice_no).trim()
            );
            if (jnlItem) {
                return side === "debit" ? jnlItem.Credit_Names : jnlItem.Debit_Names;
            }
        }

        const accIdTrim = String(accId).trim();
        const isBank = allBankAccIds.has(accIdTrim);

        let opposingId;
        if (isBank) {
            opposingId = String(tx.Debit_Ac_Id).trim() === accIdTrim ? tx.Credit_Ac_Id : tx.Debit_Ac_Id;
        } else {
            opposingId = side === "debit" ? tx.Credit_Ac_Id : tx.Debit_Ac_Id;
        }

        if (!opposingId || String(opposingId) === "0") {
            const currentLedger = (reportData?.Bank || []).find((x) => String(x.Acc_Id).trim() === accIdTrim);
            return currentLedger && currentLedger.Group_Name ? currentLedger.Group_Name.trim() : "BANK";
        }

        const allLists = [
            ...(reportData?.Cash || []),
            ...(reportData?.Bank || []),
            ...(reportData?.LedgerGrp || []),
            ...(reportData?.DEX || []),
            ...(reportData?.IDEX || []),
        ];
        const acc = allLists.find((x) => String(x.Acc_Id).trim() === String(opposingId).trim());
        return acc ? acc.Account_name : (tx.Particulars || `Account (${opposingId})`);
    }, [reportData, allBankAccIds]);

    const getOpposingLedgerName = (tx: CashBoxTransaction) => {
        if (!selectedLedger) return "";
        return getOpposingLedgerNameForExport(tx, selectedLedger.accId, selectedLedger.side);
    };

    const modalTotal = useMemo(() => {
        if (!selectedLedger) return 0;
        return modalTransactions.reduce((sum, tx) => {
            return sum + getTransactionAmount(tx, selectedLedger.accId, selectedLedger.side);
        }, 0);
    }, [modalTransactions, selectedLedger, getTransactionAmount]);

    const handleHeaderClick = (event: React.MouseEvent<HTMLElement>, key: keyof typeof columnFilters) => {
        setActiveHeader(key);
        setFilterAnchor(event.currentTarget);
    };

    const handleHeaderFilterClose = () => {
        setActiveHeader(null);
        setFilterAnchor(null);
    };

    const uniqueValuesForHeader = useMemo(() => {
        if (!activeHeader || !detailedData || !detailedData.Data) return [];
        const setVals = new Set<string>();
        detailedData.Data.forEach((item: any) => {
            const val = item[activeHeader];
            if (val !== undefined && val !== null && val !== "") {
                setVals.add(String(val));
            }
        });
        return Array.from(setVals).sort();
    }, [activeHeader, detailedData]);

    // Excel Export
    const handleExportExcel = (includeDetails: boolean = false, stages = detailedExportStages) => {
        try {
            const excelData: any[][] = [];
            const dateStr =
                filters.Date.from === filters.Date.to
                    ? dayjs(filters.Date.from).format("DD-MM-YYYY")
                    : `${dayjs(filters.Date.from).format("DD-MM-YYYY")} TO ${dayjs(filters.Date.to).format("DD-MM-YYYY")}`;

            excelData.push([`BANK ABSTRACT TRANSACTION - ${dateStr}`]);
            excelData.push([]);

            if (toggleMode === "Abstract") {
                excelData.push([
                    "Particulars (Debit)",
                    "Debit Amt",
                    "Particulars (Credit)",
                    "Credit amt",
                ]);

                excelData.push(["Opening Balance", parsedData.opening, "Opening Balance", ""]);

                for (let idx = 0; idx < parsedData.debitGroups.length; idx++) {
                    const leftGroup = parsedData.debitGroups[idx];
                    const rightGroup = parsedData.creditGroups[idx];

                    excelData.push([
                        leftGroup.label,
                        leftGroup.total || "",
                        rightGroup.label,
                        rightGroup.total || "",
                    ]);

                    const maxSubRows = Math.max(leftGroup.subLedgers.length, rightGroup.subLedgers.length);
                    for (let i = 0; i < maxSubRows; i++) {
                        const leftSub = leftGroup.subLedgers[i];
                        const rightSub = rightGroup.subLedgers[i];

                        excelData.push([
                            leftSub ? `  ${i + 1}. ${leftSub.name}` : "",
                            leftSub ? leftSub.amount : "",
                            rightSub ? `  ${i + 1}. ${rightSub.name}` : "",
                            rightSub ? rightSub.amount : "",
                        ]);

                        if (includeDetails) {
                            const leftTxs = leftSub ? getTransactionsForLedger(leftSub.accId, leftGroup.side) : [];
                            const rightTxs = rightSub ? getTransactionsForLedger(rightSub.accId, rightGroup.side) : [];
                            const maxTxRows = Math.max(leftTxs.length, rightTxs.length);

                            for (let j = 0; j < maxTxRows; j++) {
                                const txL = leftTxs[j];
                                const txR = rightTxs[j];

                                let col0 = "";
                                let col1: any = "";
                                let narrationL = "";
                                if (txL) {
                                    const opposingName = getOpposingLedgerNameForExport(txL, leftSub.accId, leftGroup.side);
                                    const timeStr = formatTime(txL.Created_Time);
                                    col0 = `      ${opposingName}${timeStr && timeStr !== "-" ? ` - ${timeStr}` : ""}`;
                                    col1 = getTransactionAmount(txL, leftSub.accId, leftGroup.side);
                                    if (stages.narration) {
                                        narrationL = (txL.Narration || txL.Line_Naration || "").trim();
                                    }
                                }

                                let col2 = "";
                                let col3: any = "";
                                let narrationR = "";
                                if (txR) {
                                    const opposingName = getOpposingLedgerNameForExport(txR, rightSub.accId, rightGroup.side);
                                    const timeStr = formatTime(txR.Created_Time);
                                    col2 = `      ${opposingName}${timeStr && timeStr !== "-" ? ` - ${timeStr}` : ""}`;
                                    col3 = getTransactionAmount(txR, rightSub.accId, rightGroup.side);
                                    if (stages.narration) {
                                        narrationR = (txR.Narration || txR.Line_Naration || "").trim();
                                    }
                                }

                                if (stages.transactions) {
                                    excelData.push([col0, col1, col2, col3]);
                                }

                                if (stages.narration && (narrationL || narrationR)) {
                                    excelData.push([
                                        narrationL ? `        * ${narrationL}` : "",
                                        "",
                                        narrationR ? `        * ${narrationR}` : "",
                                        ""
                                    ]);
                                }

                                if (stages.recPay) {
                                    const recPaysL = txL && txL.invoice_no && reportData?.RecPay
                                        ? reportData.RecPay.filter(r => r.invoice_no && String(r.invoice_no).trim() === String(txL.invoice_no).trim())
                                        : [];
                                    const recPaysR = txR && txR.invoice_no && reportData?.RecPay
                                        ? reportData.RecPay.filter(r => r.invoice_no && String(r.invoice_no).trim() === String(txR.invoice_no).trim())
                                        : [];

                                    const maxRecPayRows = Math.max(recPaysL.length, recPaysR.length);
                                    for (let k = 0; k < maxRecPayRows; k++) {
                                        const rpL = recPaysL[k];
                                        const rpR = recPaysR[k];

                                        let rCol0 = "";
                                        let rCol1: any = "";
                                        if (rpL) {
                                            const dateStr = rpL.INV_Date ? ` (${dayjs(rpL.INV_Date).format("DD-MM-YYYY")})` : "";
                                            rCol0 = `        ${rpL.bill_name}${dateStr}`;
                                            rCol1 = rpL.Amount;
                                        }

                                        let rCol2 = "";
                                        let rCol3: any = "";
                                        if (rpR) {
                                            const dateStr = rpR.INV_Date ? ` (${dayjs(rpR.INV_Date).format("DD-MM-YYYY")})` : "";
                                            rCol2 = `        ${rpR.bill_name}${dateStr}`;
                                            rCol3 = rpR.Amount;
                                        }

                                        excelData.push([rCol0, rCol1, rCol2, rCol3]);
                                    }
                                }
                            }
                        }
                    }
                }

                excelData.push(["", "", "Closing Balance", parsedData.closing]);
            } else {
                excelData.push(enabledColumns.map(c => c.label));

                excelData.push(enabledColumns.map(c => {
                    if (c.key === "Account_name") return "Opening Balance";
                    if (c.key === "Cr_Amount") return totalOpeningBalance;
                    return "-";
                }));

                const exportGroups = getGroupedDetailedTransactions(numFilteredAndSortedRows);
                exportGroups.forEach((group: any) => {
                    const groupRow = new Array(enabledColumns.length).fill("");
                    groupRow[0] = `${group.Account_name} (${group.Group_Name})`;
                    excelData.push(groupRow);
                    group.transactions.forEach((tx: any, tIdx: number) => {
                        excelData.push(enabledColumns.map(c => {
                            if (c.key === "sno") return tIdx + 1;
                            if (c.key === "Ledger_Date") return tx.Ledger_Date ? dayjs(tx.Ledger_Date).format("DD-MM-YYYY") : "";
                            if (c.key === "Created_on") return tx.Created_on ? formatCreatedOn(tx.Created_on) : "";
                            if (c.key === "Account_name") return (Number(tx.Dr_Amount) > 0 ? tx.Credit_Names : (Number(tx.Cr_Amount) > 0 ? tx.Debit_Names : tx.Account_name)) || "";
                            if (c.key === "invoice_no") return tx.invoice_no || "";
                            if (c.key === "Narration") return tx.Narration || tx.Line_Naration || "";
                            if (c.key === "Dr_Amount") return Number(tx.Cr_Amount) > 0 ? Number(tx.Cr_Amount) : "";
                            if (c.key === "Cr_Amount") return Number(tx.Dr_Amount) > 0 ? Number(tx.Dr_Amount) : "";
                            return tx[c.key] || "";
                        }));
                    });

                    excelData.push(enabledColumns.map(c => {
                        if (c.key === "Account_name") return `Sub Total (${group.Account_name})`;
                        if (c.key === "Dr_Amount") return group.totalCredit;
                        if (c.key === "Cr_Amount") return group.totalDebit;
                        return "";
                    }));
                });

                excelData.push(enabledColumns.map(c => {
                    if (c.key === "Account_name") return "Closing Balance";
                    if (c.key === "Cr_Amount") return finalClosing;
                    return "-";
                }));
            }

            const ws = XLSX.utils.aoa_to_sheet(excelData);
            styleBankWorksheet(ws);

            const wb = XLSX.utils.book_new();

            if (toggleMode === "Expanded") {
                ws["!cols"] = enabledColumns.map(c => {
                    if (c.key === "Narration") return { wch: 30 };
                    if (c.key === "Account_name") return { wch: 25 };
                    if (c.key === "invoice_no") return { wch: 20 };
                    return { wch: 12 };
                });
            } else {
                ws["!cols"] = [
                    { wch: 45 },
                    { wch: 15 },
                    { wch: 35 },
                    { wch: 15 },
                ];
            }

            XLSX.utils.book_append_sheet(wb, ws, "BankBox Report");
            XLSX.writeFile(wb, `BankBox_Report_${dayjs().format("YYYYMMDD_HHmmss")}.xlsx`);
            toast.success("Excel Exported ✅");
        } catch (err) {
            console.error(err);
            toast.error("Excel Export Failed ❌");
        }
    };

    // PDF Export
    const handleExportPDF = (includeDetails: boolean = false, stages = detailedExportStages) => {
        try {
            const doc = new jsPDF("landscape", "mm", "a4");
            const dateStr =
                filters.Date.from === filters.Date.to
                    ? dayjs(filters.Date.from).format("DD-MM-YYYY")
                    : `${dayjs(filters.Date.from).format("DD-MM-YYYY")} TO ${dayjs(filters.Date.to).format("DD-MM-YYYY")}`;

            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            doc.text(`BANK ABSTRACT TRANSACTION - ${dateStr}`, 148, 12, { align: "center" });

            if (toggleMode === "Abstract") {
                const pdfBody: any[][] = [];
                pdfBody.push(["Opening Balance", formatNum(parsedData.opening), "Opening Balance", ""]);

                for (let idx = 0; idx < parsedData.debitGroups.length; idx++) {
                    const leftGroup = parsedData.debitGroups[idx];
                    const rightGroup = parsedData.creditGroups[idx];

                    pdfBody.push([
                        leftGroup.label,
                        leftGroup.total ? formatNum(leftGroup.total) : "-",
                        rightGroup.label,
                        rightGroup.total ? formatNum(rightGroup.total) : "-",
                    ]);

                    const maxSubRows = Math.max(leftGroup.subLedgers.length, rightGroup.subLedgers.length);
                    for (let i = 0; i < maxSubRows; i++) {
                        const leftSub = leftGroup.subLedgers[i];
                        const rightSub = rightGroup.subLedgers[i];

                        pdfBody.push([
                            leftSub ? `  ${i + 1}. ${leftSub.name}` : "",
                            leftSub ? formatNum(leftSub.amount) : "",
                            rightSub ? `  ${i + 1}. ${rightSub.name}` : "",
                            rightSub ? formatNum(rightSub.amount) : "",
                        ]);

                        if (includeDetails) {
                            const leftTxs = leftSub ? getTransactionsForLedger(leftSub.accId, leftGroup.side) : [];
                            const rightTxs = rightSub ? getTransactionsForLedger(rightSub.accId, rightGroup.side) : [];
                            const maxTxRows = Math.max(leftTxs.length, rightTxs.length);

                            for (let j = 0; j < maxTxRows; j++) {
                                const txL = leftTxs[j];
                                const txR = rightTxs[j];

                                let col0 = "";
                                let col1 = "";
                                let narrationL = "";
                                if (txL) {
                                    const opposingName = getOpposingLedgerNameForExport(txL, leftSub.accId, leftGroup.side);
                                    const timeStr = formatTime(txL.Created_Time);
                                    col0 = `      ${opposingName}${timeStr && timeStr !== "-" ? ` - ${timeStr}` : ""}`;
                                    col1 = formatNum(getTransactionAmount(txL, leftSub.accId, leftGroup.side));
                                    if (stages.narration) {
                                        narrationL = (txL.Narration || txL.Line_Naration || "").trim();
                                    }
                                }

                                let col2 = "";
                                let col3 = "";
                                let narrationR = "";
                                if (txR) {
                                    const opposingName = getOpposingLedgerNameForExport(txR, rightSub.accId, rightGroup.side);
                                    const timeStr = formatTime(txR.Created_Time);
                                    col2 = `      ${opposingName}${timeStr && timeStr !== "-" ? ` - ${timeStr}` : ""}`;
                                    col3 = formatNum(getTransactionAmount(txR, rightSub.accId, rightGroup.side));
                                    if (stages.narration) {
                                        narrationR = (txR.Narration || txR.Line_Naration || "").trim();
                                    }
                                }

                                if (stages.transactions) {
                                    pdfBody.push([col0, col1, col2, col3]);
                                }

                                if (stages.narration && (narrationL || narrationR)) {
                                    pdfBody.push([
                                        narrationL ? `        * ${narrationL}` : "",
                                        "",
                                        narrationR ? `        * ${narrationR}` : "",
                                        ""
                                    ]);
                                }

                                if (stages.recPay) {
                                    const recPaysL = txL && txL.invoice_no && reportData?.RecPay
                                        ? reportData.RecPay.filter(r => r.invoice_no && String(r.invoice_no).trim() === String(txL.invoice_no).trim())
                                        : [];
                                    const recPaysR = txR && txR.invoice_no && reportData?.RecPay
                                        ? reportData.RecPay.filter(r => r.invoice_no && String(r.invoice_no).trim() === String(txR.invoice_no).trim())
                                        : [];

                                    const maxRecPayRows = Math.max(recPaysL.length, recPaysR.length);
                                    for (let k = 0; k < maxRecPayRows; k++) {
                                        const rpL = recPaysL[k];
                                        const rpR = recPaysR[k];

                                        let rCol0 = "";
                                        let rCol1 = "";
                                        if (rpL) {
                                            const dateStr = rpL.INV_Date ? ` (${dayjs(rpL.INV_Date).format("DD-MM-YYYY")})` : "";
                                            rCol0 = `        ${rpL.bill_name}${dateStr}`;
                                            rCol1 = formatNum(rpL.Amount);
                                        }

                                        let rCol2 = "";
                                        let rCol3 = "";
                                        if (rpR) {
                                            const dateStr = rpR.INV_Date ? ` (${dayjs(rpR.INV_Date).format("DD-MM-YYYY")})` : "";
                                            rCol2 = `        ${rpR.bill_name}${dateStr}`;
                                            rCol3 = formatNum(rpR.Amount);
                                        }

                                        pdfBody.push([rCol0, rCol1, rCol2, rCol3]);
                                    }
                                }
                            }
                        }
                    }
                }

                pdfBody.push(["", "", "Closing Balance", formatNum(parsedData.closing)]);

                autoTable(doc, {
                    startY: 20,
                    head: [["Particulars (Debit)", "Debit Amt", "Particulars (Credit)", "Credit amt"]],
                    body: pdfBody,
                    styles: { fontSize: 7.5, cellPadding: 1 },
                    headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255] },
                    theme: "grid",
                    didParseCell: (data) => {
                        const valL = data.row.cells[0]?.text?.[0] || "";
                        const valR = data.row.cells[2]?.text?.[0] || "";

                        const isOpeningOrClosing = valL === "Opening Balance" || valR === "Opening Balance" ||
                            valL === "Closing Balance" || valR === "Closing Balance";

                        const isGroupHeader = DEBIT_GROUPS.some(g => g.label === valL) ||
                            CREDIT_GROUPS.some(g => g.label === valR);

                        const isSubledger = (valL && /^\s*\d+\./.test(valL)) || (valR && /^\s*\d+\./.test(valR));

                        const isNestedTx = (valL && (valL.includes(" - ")) && !/^\s*\d+\./.test(valL)) ||
                            (valR && (valR.includes(" - ")) && !/^\s*\d+\./.test(valR));

                        const isNarration = (valL && valL.includes("* ")) || (valR && valR.includes("* "));

                        const isRecPay = (valL && valL.startsWith("        ") && !valL.includes("* ")) ||
                            (valR && valR.startsWith("        ") && !valR.includes("* "));

                        if (isOpeningOrClosing) {
                            data.cell.styles.fillColor = [238, 238, 238]; // EEEEEE
                            data.cell.styles.fontStyle = "bold";
                            data.cell.styles.textColor = [180, 83, 9]; // B45309
                        } else if (isGroupHeader) {
                            data.cell.styles.fillColor = [226, 232, 240]; // E2E8F0
                            data.cell.styles.fontStyle = "bold";
                            data.cell.styles.textColor = [30, 58, 138]; // 1E3A8A
                        } else if (isSubledger) {
                            data.cell.styles.fillColor = [248, 250, 252]; // F8FAFC
                            data.cell.styles.textColor = [0, 0, 0];
                        } else if (isNarration) {
                            data.cell.styles.textColor = [79, 70, 229]; // Indigo: #4f46e5
                            data.cell.styles.fontStyle = "italic";
                            data.cell.styles.fontSize = 7;
                        } else if (isRecPay) {
                            data.cell.styles.textColor = [100, 116, 139]; // Slate: #64748B
                            data.cell.styles.fontSize = 7;
                        } else if (isNestedTx) {
                            data.cell.styles.textColor = [85, 85, 85];
                            data.cell.styles.fontStyle = "italic";
                            data.cell.styles.fontSize = 7.5;
                        }
                    }
                });
            } else {
                const pdfBody: any[][] = [];
                pdfBody.push(enabledColumns.map(c => {
                    if (c.key === "Account_name") return "Opening Balance";
                    if (c.key === "Cr_Amount") return formatNum(totalOpeningBalance);
                    return "-";
                }));

                const exportGroups = getGroupedDetailedTransactions(numFilteredAndSortedRows);
                exportGroups.forEach((group: any) => {
                    const groupRow = new Array(enabledColumns.length).fill("");
                    groupRow[0] = `${group.Account_name} (${group.Group_Name})`;
                    pdfBody.push(groupRow);
                    group.transactions.forEach((tx: any, tIdx: number) => {
                        pdfBody.push(enabledColumns.map(c => {
                            if (c.key === "sno") return tIdx + 1;
                            if (c.key === "Ledger_Date") return tx.Ledger_Date ? dayjs(tx.Ledger_Date).format("DD-MM-YYYY") : "";
                            if (c.key === "Created_on") return tx.Created_on ? formatCreatedOn(tx.Created_on) : "-";
                            if (c.key === "Account_name") return (Number(tx.Dr_Amount) > 0 ? tx.Credit_Names : (Number(tx.Cr_Amount) > 0 ? tx.Debit_Names : tx.Account_name)) || "";
                            if (c.key === "invoice_no") return tx.invoice_no || "";
                            if (c.key === "Narration") return tx.Narration || tx.Line_Naration || "";
                            if (c.key === "Dr_Amount") return Number(tx.Cr_Amount) > 0 ? formatNum(Number(tx.Cr_Amount)) : "-";
                            if (c.key === "Cr_Amount") return Number(tx.Dr_Amount) > 0 ? formatNum(Number(tx.Dr_Amount)) : "-";
                            return tx[c.key] || "";
                        }));
                    });

                    pdfBody.push(enabledColumns.map(c => {
                        if (c.key === "Account_name") return `Sub Total (${group.Account_name})`;
                        if (c.key === "Dr_Amount") return formatNum(group.totalCredit);
                        if (c.key === "Cr_Amount") return formatNum(group.totalDebit);
                        return "";
                    }));
                });

                pdfBody.push(enabledColumns.map(c => {
                    if (c.key === "Account_name") return "Closing Balance";
                    if (c.key === "Cr_Amount") return formatNum(finalClosing);
                    return "-";
                }));

                autoTable(doc, {
                    startY: 20,
                    head: [enabledColumns.map(c => c.label)],
                    body: pdfBody,
                    styles: { fontSize: 7, cellPadding: 1 },
                    headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255] },
                    theme: "grid"
                });
            }

            doc.save(`BankBox_Report_${dayjs().format("YYYYMMDD_HHmmss")}.pdf`);
            toast.success("PDF Exported ✅");
        } catch (err) {
            console.error(err);
            toast.error("PDF Export Failed ❌");
        }
    };

    return (
        <Box sx={{ width: "100%", minHeight: "100%", bgcolor: "#f8fafc", boxSizing: "border-box" }}>
            <PageHeader
                onExportExcel={() => {
                    if (toggleMode === "Expanded") {
                        handleExportExcel();
                    } else {
                        setExportType("excel");
                        setExportModalOpen(true);
                    }
                }}
                onExportPDF={() => {
                    if (toggleMode === "Expanded") {
                        handleExportPDF();
                    } else {
                        setExportType("pdf");
                        setExportModalOpen(true);
                    }
                }}
                toggleMode={toggleMode}
                onToggleChange={(mode) => setToggleMode(mode)}
                showPages={true}
                settingsSlot={
                    toggleMode === "Expanded" && (
                        <Box display="flex" gap={1}>
                            <Tooltip title="Column Settings">
                                <IconButton
                                    size="small"
                                    onClick={e => setSettingsAnchor(e.currentTarget)}
                                    sx={{
                                        height: 24,
                                        width: 24,
                                        backgroundColor: "#fff",
                                        borderRadius: 0.5,
                                    }}
                                >
                                    <SettingsIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </Box>
                    )
                }
            />

            <ReportFilterDrawer
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                onToggle={() => setDrawerOpen((p) => !p)}
                fromDate={fromDate}
                toDate={toDate}
                onFromDateChange={setFromDate}
                onToDateChange={setToDate}
                onApply={() => {
                    setFilters({ Date: { from: fromDate, to: toDate } });
                    setPage(1);
                    setDrawerOpen(false);
                }}
            />

            <Box px={2} pb={4} pt={2}>
                <HeaderFilterMenu
                    anchorEl={filterAnchor}
                    open={Boolean(filterAnchor) && Boolean(activeHeader)}
                    onClose={handleHeaderFilterClose}
                    columnLabel={detailedColumns.find((c) => c.key === activeHeader)?.label || activeHeader || undefined}
                    options={uniqueValuesForHeader}
                    selectedValues={activeHeader ? columnFilters[activeHeader] : undefined}
                    onFilterChange={(selected: string[] | undefined) => {
                        if (activeHeader) {
                            setColumnFilters((prev) => ({
                                ...prev,
                                [activeHeader]: selected,
                            }));
                            setPage(1);
                        }
                    }}
                />

                {/* ===== COLUMN SETTINGS MENU ===== */}
                <Menu
                    anchorEl={settingsAnchor}
                    open={Boolean(settingsAnchor)}
                    onClose={() => setSettingsAnchor(null)}
                    PaperProps={{
                        sx: {
                            width: 280,
                            maxHeight: 420,
                        },
                    }}
                >
                    <Box px={2} py={1}>
                        <Typography fontWeight={600} fontSize={13}>
                            Enabled Columns
                        </Typography>
                    </Box>

                    <DndContext
                        collisionDetection={closestCenter}
                        onDragEnd={({ active, over }) => {
                            if (!over || active.id === over.id) return;

                            setDetailedColumns(prev => {
                                const enabledCols = prev
                                    .filter(c => c.enabled)
                                    .sort((a, b) => a.order - b.order);

                                const oldIndex = enabledCols.findIndex(c => c.key === active.id);
                                const newIndex = enabledCols.findIndex(c => c.key === over.id);

                                const reordered = arrayMove(enabledCols, oldIndex, newIndex);

                                return prev.map(col => {
                                    const idx = reordered.findIndex(r => r.key === col.key);
                                    return idx !== -1 ? { ...col, order: idx } : col;
                                });
                            });
                        }}
                    >
                        <SortableContext
                            items={detailedColumns.filter(c => c.enabled).map(c => c.key)}
                            strategy={verticalListSortingStrategy}
                        >
                            {detailedColumns
                                .filter(c => c.enabled)
                                .sort((a, b) => a.order - b.order)
                                .map(col => (
                                    <SortableColumnItem
                                        key={col.key}
                                        column={col}
                                        showFilter={
                                            col.key === "voucher_name" || col.key === "Account_name" || col.key === "invoice_no"
                                                ? (columnFilters[col.key as keyof typeof columnFilters] || []).length > 0
                                                : false
                                        }
                                        onToggle={() =>
                                            setDetailedColumns(prev =>
                                                prev.map(c =>
                                                    c.key === col.key
                                                        ? { ...c, enabled: false }
                                                        : c
                                                )
                                            )
                                        }
                                    />
                                ))}
                        </SortableContext>
                    </DndContext>

                    <Box px={2} py={1} mt={1}>
                        <Typography fontWeight={600} fontSize={13}>
                            Disabled Columns
                        </Typography>
                    </Box>

                    {detailedColumns
                        .filter(c => !c.enabled)
                        .sort((a, b) => a.order - b.order)
                        .map(col => (
                            <Box
                                key={col.key}
                                display="flex"
                                alignItems="center"
                                gap={1}
                                px={2}
                                py={0.5}
                                mb={1}
                            >
                                <Box sx={{ flex: 1 }}>
                                    <Typography fontSize="0.75rem">
                                        {col.label}
                                    </Typography>
                                </Box>
                                <Switch
                                    size="medium"
                                    checked={false}
                                    onChange={() =>
                                        setDetailedColumns(prev =>
                                            prev.map(c =>
                                                c.key === col.key
                                                    ? { ...c, enabled: true }
                                                    : c
                                            )
                                        )
                                    }
                                    sx={{
                                        "& .MuiSwitch-switchBase.Mui-checked": {
                                            color: "#1E3A8A",
                                        },
                                        "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                                            backgroundColor: "#b5b9c4",
                                        },
                                        "& .MuiSwitch-track": {
                                            backgroundColor: "#CBD5E1",
                                        },
                                    }}
                                />
                            </Box>
                        ))}
                </Menu>

                {/* Filter Chips Bar */}
                {toggleMode === "Abstract" ? (
                    reportData && allGroupNames.length > 0 && (
                        <Box
                            display="flex"
                            gap={1}
                            flexWrap="wrap"
                            mb={2}
                            alignItems="center"
                        >
                            <Box
                                onClick={() => handleGroupChipClick("All")}
                                sx={{
                                    px: 1.5,
                                    py: 0.5,
                                    borderRadius: "16px",
                                    fontSize: "0.78rem",
                                    fontWeight: "bold",
                                    cursor: "pointer",
                                    border: "1px solid",
                                    transition: "all 0.2s",
                                    backgroundColor: selectedGroups.includes("All") ? "#1e3a8a" : "#f1f5f9",
                                    color: selectedGroups.includes("All") ? "#ffffff" : "#475569",
                                    borderColor: selectedGroups.includes("All") ? "#1e3a8a" : "#cbd5e1",
                                    "&:hover": {
                                        backgroundColor: selectedGroups.includes("All") ? "#1e3a8a" : "#e2e8f0",
                                    },
                                }}
                            >
                                All
                            </Box>
                            {allGroupNames.map((gName) => {
                                const isSelected = selectedGroups.includes(gName);
                                return (
                                    <Box
                                        key={gName}
                                        onClick={() => handleGroupChipClick(gName)}
                                        sx={{
                                            px: 1.5,
                                            py: 0.5,
                                            borderRadius: "16px",
                                            fontSize: "0.78rem",
                                            fontWeight: "bold",
                                            cursor: "pointer",
                                            border: "1px solid",
                                            transition: "all 0.2s",
                                            backgroundColor: isSelected ? "#1e3a8a" : "#f1f5f9",
                                            color: isSelected ? "#ffffff" : "#475569",
                                            borderColor: isSelected ? "#1e3a8a" : "#cbd5e1",
                                            "&:hover": {
                                                backgroundColor: isSelected ? "#1e3a8a" : "#e2e8f0",
                                            },
                                        }}
                                    >
                                        {gName}
                                    </Box>
                                );
                            })}
                        </Box>
                    )
                ) : (
                    detailedData && detailedGroupNames.length > 0 && (
                        <Box
                            display="flex"
                            gap={1}
                            flexWrap="wrap"
                            mb={2}
                            alignItems="center"
                        >
                            <Box
                                onClick={() => handleDetailedGroupChipClick("All")}
                                sx={{
                                    px: 1.5,
                                    py: 0.5,
                                    borderRadius: "16px",
                                    fontSize: "0.78rem",
                                    fontWeight: "bold",
                                    cursor: "pointer",
                                    border: "1px solid",
                                    transition: "all 0.2s",
                                    backgroundColor: selectedDetailedGroups.includes("All") ? "#1e3a8a" : "#f1f5f9",
                                    color: selectedDetailedGroups.includes("All") ? "#ffffff" : "#475569",
                                    borderColor: selectedDetailedGroups.includes("All") ? "#1e3a8a" : "#cbd5e1",
                                    "&:hover": {
                                        backgroundColor: selectedDetailedGroups.includes("All") ? "#1e3a8a" : "#e2e8f0",
                                    },
                                }}
                            >
                                All
                            </Box>
                            {detailedGroupNames.map((gName) => {
                                const isSelected = selectedDetailedGroups.includes(gName);
                                return (
                                    <Box
                                        key={gName}
                                        onClick={() => handleDetailedGroupChipClick(gName)}
                                        sx={{
                                            px: 1.5,
                                            py: 0.5,
                                            borderRadius: "16px",
                                            fontSize: "0.78rem",
                                            fontWeight: "bold",
                                            cursor: "pointer",
                                            border: "1px solid",
                                            transition: "all 0.2s",
                                            backgroundColor: isSelected ? "#1e3a8a" : "#f1f5f9",
                                            color: isSelected ? "#ffffff" : "#475569",
                                            borderColor: isSelected ? "#1e3a8a" : "#cbd5e1",
                                            "&:hover": {
                                                backgroundColor: isSelected ? "#1e3a8a" : "#e2e8f0",
                                            },
                                        }}
                                    >
                                        {gName}
                                    </Box>
                                );
                            })}
                        </Box>
                    )
                )}

                {/* Main Content */}
                {loading ? (
                    <Box display="flex" justifyContent="center" p={5}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <>
                        {/* Header Banner */}
                        {toggleMode === "Abstract" && (
                            <Box
                                sx={{
                                    border: "1px solid #cbd5e1",
                                    borderRadius: 2,
                                    py: 1.2,
                                    textAlign: "center",
                                    mb: 3,
                                    background: "#fff",
                                    boxShadow: 1,
                                }}
                            >
                                <Typography variant="body1" fontWeight={700} sx={{ letterSpacing: 0.5, color: "#1e293b" }}>
                                    BANK BOX TRANSACTION {" "}
                                    {filters.Date.from === filters.Date.to
                                        ? dayjs(filters.Date.from).format("DD-MM-YYYY")
                                        : `${dayjs(filters.Date.from).format("DD-MM-YYYY")} - ${dayjs(filters.Date.to).format("DD-MM-YYYY")}`}
                                </Typography>
                            </Box>
                        )}
                        {toggleMode === "Abstract" ? (
                            <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 2, border: "1px solid #cbd5e1", width: "100%", overflowX: "hidden" }}>
                                <Table size="small" sx={{ width: "100%", tableLayout: "fixed", "& .MuiTableCell-root": { fontSize: "0.78rem", py: 0.8, px: 1.5 } }}>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell align="left" sx={{ backgroundColor: "#1E3A8A", color: "#fff", fontWeight: 700, py: 1.2, fontSize: "0.82rem", border: "1px solid #cbd5e1", width: "25%" }}>
                                                Particulars
                                            </TableCell>
                                            <TableCell align="right" sx={{ backgroundColor: "#1E3A8A", color: "#fff", fontWeight: 700, py: 1.2, fontSize: "0.82rem", border: "1px solid #cbd5e1", width: "25%" }}>
                                                Debit Amt
                                            </TableCell>
                                            <TableCell align="left" sx={{ backgroundColor: "#1E3A8A", color: "#fff", fontWeight: 700, py: 1.2, fontSize: "0.82rem", border: "1px solid #cbd5e1", width: "25%" }}>
                                                Particulars
                                            </TableCell>
                                            <TableCell align="right" sx={{ backgroundColor: "#1E3A8A", color: "#fff", fontWeight: 700, py: 1.2, fontSize: "0.82rem", border: "1px solid #cbd5e1", width: "25%" }}>
                                                Credit amt
                                            </TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {/* OPENING ROW */}
                                        <TableRow>
                                            <TableCell sx={{ border: "1px solid #cbd5e1" }} />
                                            <TableCell sx={{ border: "1px solid #cbd5e1" }} />
                                            <TableCell sx={{ py: 1, backgroundColor: "#eeeeeeff", fontWeight: 700, border: "1px solid #cbd5e1" }}>
                                                Opening Balance
                                            </TableCell>
                                            <TableCell align="right" sx={{ py: 1, backgroundColor: "#eeeeeeff", fontWeight: 700, border: "1px solid #cbd5e1", color: "#b45309" }}>
                                                {formatNum(parsedData.opening)}
                                            </TableCell>
                                        </TableRow>

                                        {/* GROUPS AND SUBLEDGERS */}
                                        {DEBIT_GROUPS.map((_, idx) => {
                                            const leftGroup = parsedData.debitGroups?.[idx];
                                            const rightGroup = parsedData.creditGroups?.[idx];

                                            if (!leftGroup || !rightGroup) return null;

                                            const isExpandedLeft = Boolean(expanded[leftGroup.key]);
                                            const isExpandedRight = Boolean(expanded[rightGroup.key]);

                                            return (
                                                <React.Fragment key={`group-row-${idx}`}>
                                                    {/* Group Summary Row */}
                                                    <TableRow sx={{ "&:hover": { bgcolor: "#f8fafc" } }}>
                                                        <TableCell
                                                            onClick={() => toggleGroup(leftGroup.key)}
                                                            sx={{
                                                                cursor: "pointer",
                                                                fontWeight: 700,
                                                                border: "1px solid #cbd5e1",
                                                                userSelect: "none",
                                                                py: 1.2,
                                                                "&:hover": { backgroundColor: "#f1f5f9" }
                                                            }}
                                                        >
                                                            <Box display="flex" alignItems="center" gap={1}>
                                                                {leftGroup.label}
                                                            </Box>
                                                        </TableCell>
                                                        <TableCell align="right" sx={{ fontWeight: 700, border: "1px solid #cbd5e1" }}>
                                                            {formatNum(leftGroup.total)}
                                                        </TableCell>

                                                        <TableCell
                                                            onClick={() => toggleGroup(rightGroup.key)}
                                                            sx={{
                                                                cursor: "pointer",
                                                                fontWeight: 700,
                                                                border: "1px solid #cbd5e1",
                                                                userSelect: "none",
                                                                py: 1.2,
                                                                "&:hover": { backgroundColor: "#f1f5f9" }
                                                            }}
                                                        >
                                                            <Box display="flex" alignItems="center" gap={1}>
                                                                {rightGroup.label}
                                                            </Box>
                                                        </TableCell>
                                                        <TableCell align="right" sx={{ fontWeight: 700, border: "1px solid #cbd5e1" }}>
                                                            {formatNum(rightGroup.total)}
                                                        </TableCell>
                                                    </TableRow>

                                                    {/* Expanded Sub-Ledgers Rows */}
                                                    {(isExpandedLeft || isExpandedRight) &&
                                                        Array.from({
                                                            length: Math.max(
                                                                isExpandedLeft ? leftGroup.subLedgers.length : 0,
                                                                isExpandedRight ? rightGroup.subLedgers.length : 0
                                                            ),
                                                        }).map((_, i) => {
                                                            const leftSub = isExpandedLeft ? leftGroup.subLedgers[i] : null;
                                                            const rightSub = isExpandedRight ? rightGroup.subLedgers[i] : null;

                                                            return (
                                                                <TableRow key={`sub-${idx}-${i}`} sx={{ backgroundColor: "#f8fafc" }}>
                                                                    {/* Left Subledger */}
                                                                    {leftSub ? (
                                                                        <>
                                                                            <TableCell
                                                                                onClick={() => handleLedgerClick(leftSub.accId, leftSub.name, "debit")}
                                                                                sx={{
                                                                                    pl: 5,
                                                                                    border: "1px solid #cbd5e1",
                                                                                    cursor: "pointer",
                                                                                    color: "#000000",
                                                                                    fontWeight: 600,
                                                                                    "&:hover": { color: "#000000" }
                                                                                }}
                                                                            >
                                                                                {i + 1}. {leftSub.name}
                                                                            </TableCell>
                                                                            <TableCell align="right" sx={{ border: "1px solid #cbd5e1", fontWeight: 600 }}>
                                                                                {formatNum(leftSub.amount)}
                                                                            </TableCell>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <TableCell sx={{ border: "1px solid #cbd5e1" }} />
                                                                            <TableCell sx={{ border: "1px solid #cbd5e1" }} />
                                                                        </>
                                                                    )}

                                                                    {/* Right Subledger */}
                                                                    {rightSub ? (
                                                                        <>
                                                                            <TableCell
                                                                                onClick={() => handleLedgerClick(rightSub.accId, rightSub.name, "credit")}
                                                                                sx={{
                                                                                    pl: 5,
                                                                                    border: "1px solid #cbd5e1",
                                                                                    cursor: "pointer",
                                                                                    color: "#000000",
                                                                                    fontWeight: 600,
                                                                                    "&:hover": { color: "#000000" }
                                                                                }}
                                                                            >
                                                                                {i + 1}. {rightSub.name}
                                                                            </TableCell>
                                                                            <TableCell align="right" sx={{ border: "1px solid #cbd5e1", fontWeight: 600 }}>
                                                                                {formatNum(rightSub.amount)}
                                                                            </TableCell>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <TableCell sx={{ border: "1px solid #cbd5e1" }} />
                                                                            <TableCell sx={{ border: "1px solid #cbd5e1" }} />
                                                                        </>
                                                                    )}
                                                                </TableRow>
                                                            );
                                                        })}
                                                </React.Fragment>
                                            );
                                        })}

                                        {/* CLOSING ROW */}
                                        <TableRow>
                                            <TableCell sx={{ border: "1px solid #cbd5e1" }} />
                                            <TableCell sx={{ border: "1px solid #cbd5e1" }} />
                                            <TableCell sx={{ py: 1, backgroundColor: "#eeeeeeff", fontWeight: 700, border: "1px solid #cbd5e1" }}>
                                                Closing Balance
                                            </TableCell>
                                            <TableCell align="right" sx={{ py: 1, backgroundColor: "#eeeeeeff", fontWeight: 700, border: "1px solid #cbd5e1", color: "#15803d" }}>
                                                {formatNum(parsedData.closing)}
                                            </TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        ) : (
                            <>
                                <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 2, border: "1px solid #cbd5e1", overflowX: "auto", maxHeight: "calc(100vh - 200px)" }}>
                                    <Table size="small" sx={{ minWidth: 1000, "& .MuiTableCell-root": { fontSize: "0.72rem", whiteSpace: "nowrap", py: 0.6 } }} stickyHeader>
                                        <TableHead>
                                            <TableRow>
                                                {enabledColumns.map((col) => {
                                                    const isClickable = col.key === "Account_name" || col.key === "invoice_no";
                                                    const isNumeric = col.key === "Dr_Amount" || col.key === "Cr_Amount";
                                                    const filterActive = isClickable && (columnFilters[col.key as keyof typeof columnFilters] || []).length > 0;

                                                    return (
                                                        <TableCell
                                                            key={col.key}
                                                            align={col.key === "Dr_Amount" || col.key === "Cr_Amount" ? "right" : (col.key === "sno" ? "center" : "left")}
                                                            onClick={isNumeric ? (e) => openNumFilter(e, col.key) : (isClickable ? (e) => handleHeaderClick(e, col.key as any) : undefined)}
                                                            sx={{
                                                                backgroundColor: "#1E3A8A",
                                                                color: "#fff",
                                                                fontWeight: 700,
                                                                py: 1.5,
                                                                border: "1px solid #cbd5e1",
                                                                cursor: (isClickable || isNumeric) ? "pointer" : "default",
                                                                width: getWidth(col.key)
                                                            }}
                                                        >
                                                            {isNumeric ? (
                                                                <SortableHeaderLabel
                                                                    label={col.label}
                                                                    columnKey={col.key}
                                                                    sortConfig={numSortConfig}
                                                                    onSort={handleNumSort}
                                                                    onOpenFilter={(e) => openNumFilter(e, col.key)}
                                                                />
                                                            ) : isClickable ? (
                                                                <Box display="flex" alignItems="center" gap={0.5}>
                                                                    {col.label}
                                                                    {filterActive && <FilterAltIcon fontSize="small" sx={{ color: "#ffffff" }} />}
                                                                </Box>
                                                            ) : (
                                                                col.label
                                                            )}
                                                        </TableCell>
                                                    );
                                                })}
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {/* ONE SINGLE OPENING BALANCE ROW AT THE TOP */}
                                            <TableRow hover>
                                                {enabledColumns.map((col) => {
                                                    if (col.key === "Account_name") {
                                                        return (
                                                            <TableCell sx={{ border: "1px solid #cbd5e1", fontWeight: 700, color: "#b45309" }} key={col.key}>
                                                                Opening Balance
                                                            </TableCell>
                                                        );
                                                    }
                                                    if (col.key === "Cr_Amount") {
                                                        return (
                                                            <TableCell align="right" sx={{ border: "1px solid #cbd5e1", fontWeight: 700, color: "#b45309" }} key={col.key}>
                                                                {formatNum(totalOpeningBalance)}
                                                            </TableCell>
                                                        );
                                                    }
                                                    return (
                                                        <TableCell align={col.key === "Dr_Amount" ? "right" : "left"} sx={{ border: "1px solid #cbd5e1", fontWeight: 600 }} key={col.key}>
                                                            -
                                                        </TableCell>
                                                    );
                                                })}
                                            </TableRow>

                                            {detailedReportSummary.groups.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={enabledColumns.length} align="center" sx={{ py: 6, color: "#94a3b8" }}>
                                                        No detailed bank transactions match your filter criteria.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                detailedReportSummary.groups.map((group: any, gIdx: number) => {
                                                    const hasTransactions = group.transactions.length > 0;

                                                    return (
                                                        <React.Fragment key={`detailed-group-${group.Acc_Id}-${gIdx}`}>
                                                            {/* Group Name Header Row */}
                                                            <TableRow sx={{ backgroundColor: "#f1f5f9" }}>
                                                                <TableCell colSpan={enabledColumns.length} sx={{ fontWeight: 800, color: "#1e3a8a", py: 1, border: "1px solid #cbd5e1" }}>
                                                                    {group.Account_name} ({group.Group_Name})
                                                                </TableCell>
                                                            </TableRow>

                                                            {/* Transactions List */}
                                                            {hasTransactions && group.transactions.map((tx: any, tIdx: number) => (
                                                                <React.Fragment key={`tx-${tx.Trans_Id}-${tIdx}`}>
                                                                    <TableRow hover>
                                                                        {enabledColumns.map((col) => renderCell(tx, col.key, tIdx))}
                                                                    </TableRow>
                                                                </React.Fragment>
                                                            ))}

                                                            {/* Sub-Total Row */}
                                                            <TableRow sx={{ backgroundColor: "#f8fafc" }}>
                                                                {(() => {
                                                                    const nonAmountCols = enabledColumns.filter(c => c.key !== "Dr_Amount" && c.key !== "Cr_Amount");
                                                                    const cells = [];

                                                                    if (nonAmountCols.length > 0) {
                                                                        cells.push(
                                                                            <TableCell colSpan={nonAmountCols.length} align="right" sx={{ fontWeight: 800, py: 1, border: "1px solid #cbd5e1" }} key="subtotal-label">
                                                                                Sub Total ({group.Account_name})
                                                                            </TableCell>
                                                                        );
                                                                    }

                                                                    enabledColumns.forEach((col) => {
                                                                        if (col.key === "Dr_Amount") {
                                                                            cells.push(
                                                                                <TableCell align="right" sx={{ fontWeight: 800, py: 1, border: "1px solid #cbd5e1", color: "#1e3a8a" }} key="Dr_Amount">
                                                                                    {formatNum(group.totalCredit)}
                                                                                </TableCell>
                                                                            );
                                                                        } else if (col.key === "Cr_Amount") {
                                                                            cells.push(
                                                                                <TableCell align="right" sx={{ fontWeight: 800, py: 1, border: "1px solid #cbd5e1", color: "#1e3a8a" }} key="Cr_Amount">
                                                                                    {formatNum(group.totalDebit)}
                                                                                </TableCell>
                                                                            );
                                                                        }
                                                                    });

                                                                    return cells;
                                                                })()}
                                                            </TableRow>
                                                        </React.Fragment>
                                                    );
                                                })
                                            )}

                                            {/* ONE SINGLE CLOSING BALANCE ROW AT THE BOTTOM */}
                                            <TableRow sx={{ backgroundColor: "#f8fafc" }}>
                                                {enabledColumns.map((col) => {
                                                    if (col.key === "Account_name") {
                                                        return (
                                                            <TableCell sx={{ border: "1px solid #cbd5e1", fontWeight: 700, color: "#15803d" }} key={col.key}>
                                                                Closing Balance
                                                            </TableCell>
                                                        );
                                                    }
                                                    if (col.key === "Cr_Amount") {
                                                        return (
                                                            <TableCell align="right" sx={{ border: "1px solid #cbd5e1", fontWeight: 700, color: "#15803d" }} key={col.key}>
                                                                {formatNum(finalClosing)}
                                                            </TableCell>
                                                        );
                                                    }
                                                    return (
                                                        <TableCell align={col.key === "Dr_Amount" ? "right" : "left"} sx={{ border: "1px solid #cbd5e1", fontWeight: 600 }} key={col.key}>
                                                            -
                                                        </TableCell>
                                                    );
                                                })}
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                                <CommonPagination
                                    totalRows={detailedReportSummary.totalRows}
                                    page={page}
                                    rowsPerPage={rowsPerPage}
                                    onPageChange={setPage}
                                    onRowsPerPageChange={setRowsPerPage}
                                />
                            </>
                        )}
                    </>
                )}
            </Box>

            {/* Details Popup Modal */}
            <Dialog
                open={detailModalOpen}
                onClose={() => setDetailModalOpen(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle sx={{ backgroundColor: "#1E3A8A", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="h6" fontWeight={700}>
                        Transaction Details: {selectedLedger?.name} ({selectedLedger?.side === "debit" ? "Debit" : "Credit"} Account)
                    </Typography>
                    <IconButton
                        onClick={() => setDetailModalOpen(false)}
                        sx={{
                            color: "#fff",
                            borderRadius: "4px",
                            border: "1px solid #fff",
                            padding: "4px",
                            "&:hover": {
                                backgroundColor: "#ef4444",
                                color: "#fff",
                            }
                        }}
                    >
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </DialogTitle>
                <DialogContent dividers sx={{ p: 0 }}>
                    <TableContainer sx={{ maxHeight: 400, overflowY: "auto" }}>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow sx={{ height: "33px" }}>
                                    <TableCell sx={{ fontWeight: 700, backgroundColor: "#f1f5f9", height: "33px", py: 0 }}>Date</TableCell>
                                    <TableCell sx={{ fontWeight: 700, backgroundColor: "#f1f5f9", height: "33px", py: 0 }}>Time</TableCell>
                                    <TableCell sx={{ fontWeight: 700, backgroundColor: "#f1f5f9", height: "33px", py: 0 }}>Ledgers</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700, backgroundColor: "#f1f5f9", pr: 2, height: "33px", py: 0 }}>Amount</TableCell>
                                </TableRow>
                                {modalTransactions.length > 0 && (
                                    <TableRow>
                                        <TableCell colSpan={3} sx={{ position: "sticky", top: "33px", zIndex: 2, fontWeight: 700, backgroundColor: "#f8fafc" }} align="right">Total</TableCell>
                                        <TableCell align="right" sx={{ position: "sticky", top: "33px", zIndex: 2, fontWeight: 700, color: selectedLedger?.side === "debit" ? "#0f766e" : "#be123c", backgroundColor: "#f8fafc", pr: 2 }}>
                                            {formatNum(modalTotal)}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableHead>
                            <TableBody>
                                {modalTransactions.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} align="center" sx={{ py: 4, color: "#94a3b8" }}>
                                            No transactions found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    modalTransactions.map((tx, idx) => {
                                        const narration = (tx.Narration || tx.Line_Naration || "").trim();
                                        return (
                                            <React.Fragment key={`${tx.Trans_Id}-${idx}`}>
                                                <TableRow hover>
                                                    <TableCell>{dayjs(tx.Ledger_Date).format("DD-MM-YYYY")}</TableCell>
                                                    <TableCell>{formatTime(tx.Created_Time)}</TableCell>
                                                    <TableCell>{getOpposingLedgerName(tx)}</TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 600, pr: 2 }}>
                                                        {formatNum(
                                                            selectedLedger && allBankAccIds.has(String(selectedLedger.accId).trim())
                                                                ? (String(tx.Debit_Ac_Id).trim() === String(selectedLedger.accId).trim() ? tx.Dr_Amount : tx.Cr_Amount)
                                                                : (selectedLedger?.side === "debit" ? tx.Dr_Amount : tx.Cr_Amount)
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                                {narration && (
                                                    <TableRow>
                                                        <TableCell colSpan={4} sx={{ py: 0.5, borderTop: "none", color: "#4f46e5", fontWeight: 600, fontStyle: "italic", fontSize: "0.8rem", pl: 4 }}>
                                                            * {narration}
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </React.Fragment>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </DialogContent>
            </Dialog>

            {/* Export Dialog Modal */}
            <Dialog
                open={exportModalOpen}
                onClose={() => setExportModalOpen(false)}
                PaperProps={{
                    sx: {
                        borderRadius: "16px",
                        padding: "8px",
                        boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
                        width: "100%",
                        maxWidth: "440px"
                    }
                }}
            >
                <DialogTitle sx={{ m: 0, p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9' }}>
                    <Typography variant="h6" fontWeight="bold" color="#1e3a8a">
                        Export Report
                    </Typography>
                    <IconButton onClick={() => setExportModalOpen(false)} size="small">
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>

                <DialogContent sx={{ p: 3, pt: 3 }}>
                    <Typography variant="body2" color="text.secondary" mb={3}>
                        Select how you would like to export your Bank Abstract report.
                    </Typography>

                    <Box display="flex" flexDirection="column" gap={2}>
                        {/* Option 1: Summary */}
                        <Box
                            onClick={() => setExportDetails(false)}
                            sx={{
                                border: `2px solid ${!exportDetails ? '#3b82f6' : '#e2e8f0'}`,
                                borderRadius: '12px',
                                p: 2,
                                cursor: 'pointer',
                                bgcolor: !exportDetails ? '#eff6ff' : 'transparent',
                                transition: 'all 0.2s',
                                '&:hover': {
                                    borderColor: '#3b82f6',
                                    bgcolor: '#f8fafc'
                                }
                            }}
                        >
                            <Typography variant="subtitle1" fontWeight="bold" color={!exportDetails ? '#1e40af' : '#1e293b'}>
                                Summary Report
                            </Typography>
                            <Typography variant="body2" color="text.secondary" mt={0.5}>
                                Exports Group totals and Sub-ledger balances.
                            </Typography>
                        </Box>

                        {/* Option 2: Detailed */}
                        <Box
                            onClick={() => setExportDetails(true)}
                            sx={{
                                border: `2px solid ${exportDetails ? '#3b82f6' : '#e2e8f0'}`,
                                borderRadius: '12px',
                                p: 2,
                                cursor: 'pointer',
                                bgcolor: exportDetails ? '#eff6ff' : 'transparent',
                                transition: 'all 0.2s',
                                '&:hover': {
                                    borderColor: '#3b82f6',
                                    bgcolor: '#f8fafc'
                                }
                            }}
                        >
                            <Typography variant="subtitle1" fontWeight="bold" color={exportDetails ? '#1e40af' : '#1e293b'}>
                                Detailed Report
                            </Typography>
                            <Typography variant="body2" color="text.secondary" mt={0.5}>
                                Includes individual transactions, timestamps, voucher details, narration, and RecPay breakdown.
                            </Typography>

                            {exportDetails && (
                                <Box
                                    sx={{
                                        mt: 2,
                                        pt: 1.5,
                                        borderTop: "1px dashed #94a3b8"
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <Typography variant="caption" fontWeight="bold" color="#1e40af" sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
                                        Detailed Export Stages (Select options to include):
                                    </Typography>
                                    <Box display="flex" flexDirection="column" gap={0.5} mt={1}>
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    size="small"
                                                    checked={detailedExportStages.transactions}
                                                    onChange={(e) => setDetailedExportStages(prev => ({ ...prev, transactions: e.target.checked }))}
                                                    sx={{ color: "#2563eb", "&.Mui-checked": { color: "#2563eb" } }}
                                                />
                                            }
                                            label={
                                                <Typography variant="body2" fontSize="0.82rem" color="#334155" fontWeight={500}>
                                                    Stage 1: Basic Transactions & Timestamps
                                                </Typography>
                                            }
                                        />
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    size="small"
                                                    checked={detailedExportStages.narration}
                                                    onChange={(e) => setDetailedExportStages(prev => ({ ...prev, narration: e.target.checked }))}
                                                    sx={{ color: "#2563eb", "&.Mui-checked": { color: "#2563eb" } }}
                                                />
                                            }
                                            label={
                                                <Typography variant="body2" fontSize="0.82rem" color="#334155" fontWeight={500}>
                                                    Stage 2: Narration (Voucher & Line Narration)
                                                </Typography>
                                            }
                                        />
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    size="small"
                                                    checked={detailedExportStages.recPay}
                                                    onChange={(e) => setDetailedExportStages(prev => ({ ...prev, recPay: e.target.checked }))}
                                                    sx={{ color: "#2563eb", "&.Mui-checked": { color: "#2563eb" } }}
                                                />
                                            }
                                            label={
                                                <Typography variant="body2" fontSize="0.82rem" color="#334155" fontWeight={500}>
                                                    Stage 3: Receipt Payment Breakdown (Bill Settlement Details)
                                                </Typography>
                                            }
                                        />
                                    </Box>
                                </Box>
                            )}
                        </Box>
                    </Box>

                    <Box display="flex" justifyContent="flex-end" gap={1.5} mt={4}>
                        <Button
                            onClick={() => setExportModalOpen(false)}
                            sx={{
                                color: '#64748b',
                                textTransform: 'none',
                                fontWeight: 'semibold',
                                borderRadius: '8px'
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            onClick={() => {
                                setExportModalOpen(false);
                                if (exportType === "excel") {
                                    handleExportExcel(exportDetails, detailedExportStages);
                                } else if (exportType === "pdf") {
                                    handleExportPDF(exportDetails, detailedExportStages);
                                }
                            }}
                            sx={{
                                bgcolor: '#2563eb',
                                '&:hover': { bgcolor: '#1d4ed8' },
                                textTransform: 'none',
                                fontWeight: 'semibold',
                                borderRadius: '8px',
                                px: 3
                            }}
                        >
                            Export
                        </Button>
                    </Box>
                </DialogContent>
            </Dialog>

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
        </Box>
    );
};

export default BankAbstractReport;
