import React, { useMemo, useState, useEffect } from "react";
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
    TextField,
    Button,
    IconButton,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Switch,
    FormControlLabel,
    FormControl,
    Menu,
    CircularProgress,
    LinearProgress,
    RadioGroup,
    Radio,
    FormLabel,
    Chip
} from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import CloseIcon from "@mui/icons-material/Close";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import dayjs from "dayjs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx-js-style";
import PageHeader from "../../Layout/PageHeader";
import ReportFilterDrawer from "../../Components/ReportFilterDrawer";
import HeaderFilterMenu from "../../Components/HeaderFilterMenu";
import { toast } from "react-toastify";
import { SettingsService } from "../../services/reportSettings.services";
import { employeeReportGroupService, VoucherType, GodownMaster } from "../../services/staffBasedReport.services";
import { useAuth } from "../../auth/authContext";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Column config type for dynamic columns
export interface ColumnConfig {
    key: string;
    label: string;
    enabled: boolean;
    order: number;
}

// Default columns for the 2nd API (invoicewithitems)
// Brand, Item_Name_Modified, and Inv_No are enabled by default as requested
const DEFAULT_ITEM_COLUMNS: ColumnConfig[] = [
    { key: "Brand", label: "Brand", enabled: true, order: 0 },
    { key: "Item_Name_Modified", label: "Item_Name_Modified", enabled: true, order: 1 },
    { key: "Inv_No", label: "Inv_No", enabled: true, order: 2 },
    { key: "Stock_Item", label: "Stock_Item", enabled: false, order: 3 },
    { key: "Group_ST", label: "Group_ST", enabled: false, order: 4 },
    { key: "Bag", label: "Bag", enabled: false, order: 5 },
    { key: "Stock_Group", label: "Stock_Group", enabled: false, order: 6 },
    { key: "S_Sub_Group_1", label: "S_Sub_Group_1", enabled: false, order: 7 },
    { key: "Grade_Item_Group", label: "Grade_Item_Group", enabled: false, order: 8 },
    { key: "POS_Group", label: "POS_Group", enabled: false, order: 9 },
    { key: "Voucher_Date", label: "Voucher_Date", enabled: false, order: 10 },
    { key: "Cost_Center_Name", label: "Cost_Center_Name", enabled: false, order: 11 },
    { key: "Cost_Category", label: "Cost_Category", enabled: false, order: 12 },
    { key: "Brokerage", label: "Brokerage", enabled: false, order: 13 },
    { key: "Coolie", label: "Coolie", enabled: false, order: 14 },
    { key: "Stock_Date_Added", label: "Stock_Date_Added", enabled: false, order: 15 },
];

const EXCLUDED_ITEM_KEYS = new Set([
    "Voucher_Ref_Id",
    "Ref_Id",
    "Bill_Qty",
    "Act_Qty",
    "Total_Qty",
    "Total_Act_Qty",
    "Voucher_Type",
    "Voucher_Type_Id",
    "Group_Name",
    "Overall_GroupName",
    "Cost_Center_Id",
    "Active",
]);

const discoverItemColumns = (items: any[], currentCols: ColumnConfig[]): ColumnConfig[] => {
    if (!items || items.length === 0) return currentCols;

    const discoveredKeys = new Set<string>();
    items.forEach((row) => {
        Object.keys(row).forEach((key) => {
            if (EXCLUDED_ITEM_KEYS.has(key)) return;
            discoveredKeys.add(key);
        });
    });

    const newCols = [...currentCols];
    discoveredKeys.forEach((key) => {
        const exists = newCols.some((c) => c.key.toUpperCase() === key.toUpperCase());
        if (!exists) {
            newCols.push({
                key: key,
                label: key,
                enabled: false,
                order: newCols.length,
            });
        }
    });

    return newCols.map((c, index) => ({ ...c, order: index }));
};

interface SortableColumnRowProps {
    column: ColumnConfig;
    onToggle: (key: string) => void;
    hasActiveFilter?: boolean;
}

const SortableColumnRow = ({ column, onToggle, hasActiveFilter }: SortableColumnRowProps) => {
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
            mb={0.5}
            px={0.5}
        >
            <Box
                {...listeners}
                {...attributes}
                sx={{
                    display: "flex",
                    alignItems: "center",
                    cursor: "grab",
                    color: "text.secondary",
                    p: 0.5
                }}
            >
                <DragIndicatorIcon fontSize="small" />
            </Box>

            <Box display="flex" alignItems="center" gap={1} sx={{ flex: 1 }}>
                <Typography fontSize="0.75rem">
                    {column.label}
                </Typography>
                {Boolean(hasActiveFilter) && (
                    <Tooltip title="Header filter enabled">
                        <FilterAltIcon fontSize="small" color="primary" sx={{ fontSize: "0.85rem" }} />
                    </Tooltip>
                )}
            </Box>

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

// Group Mapping Config
interface GroupConfig {
    name: string;
    parentCategory: "INWARDS" | "OUTWARDS" | "ADJUSTMENTS";
    voucherTypes: string[];
}

interface ApiMasterData {
    invoice_no?: string;
    Ledger_Date?: string;
    Month_No?: number;
    Invoice_Month?: string;
    Invoice_Year?: number;
    Month_Year?: string;
    Trans_Id?: string | number;
    voucher_name?: string;
    Retailer_Name?: string;
    Cancel_status?: string | number;
    Total_Invoice_value?: number;
    Retailer_Id?: number;
    Contact_Person?: string;
    Reatailer_Address?: string;
    Reatailer_City?: string;
    Mobile_No?: string;
    Narration?: string;
    Created_on?: string;
    Created_By?: string;
    creditLimit?: number;
    creditDays?: number;
    Cancel_status_Type?: string;
    Godown_Name?: string;
    [key: string]: any;
}

interface ApiItemData {
    Product_Id?: number;
    Product_Name?: string;
    GoDown_Id?: string | number;
    S_No?: number;
    Item_Id?: number;
    Bill_Qty?: number;
    Act_Qty?: number;
    Alt_Act_Qty?: number | null;
    Taxable_Rate?: number;
    Item_Rate?: number;
    Amount?: number;
    Free_Qty?: number;
    Total_Qty?: number;
    Taxble?: number;
    HSN_Code?: string;
    Unit_Id?: number;
    Unit_Name?: string;
    Act_unit_Id?: number;
    Alt_Act_Unit_Id?: number;
    Taxable_Amount?: number;
    Tax_Rate?: number;
    Cgst?: number;
    Cgst_Amo?: number;
    Sgst?: number;
    Sgst_Amo?: number;
    Igst?: number;
    Igst_Amo?: number;
    Final_Amo?: number;
    Created_on?: string;
    Batch_Name?: string;
    Alt_Bill_Qty?: number | null;
    COGS_Rate?: number;
    Min_Rate?: number;
    itemReadyForDelivery?: any;
    Godown_Name?: string;
    Trans_Id?: string;
    [key: string]: any;
}

interface ApiCostCenterData {
    Do_Id?: string | number;
    Emp_Type_Id?: number;
    Emp_Id?: number;
    Cost_Center_Name?: string;
    Allias_Name?: string;
    Cost_Category?: string;
    Cost_Category_Alias?: string;
    [key: string]: any;
}

interface ApiExpenseData {
    Do_Id?: string | number;
    Expense_Id?: number;
    Expence_Value_DR?: number;
    Expence_Value_CR?: number;
    Account_name?: string;
    Account_Alias_name?: string;
    Expense_Value_DR?: number;
    Expense_Value_CR?: number;
    [key: string]: any;
}

interface ApiDetailedData {
    Masters: ApiMasterData[];
    Items: ApiItemData[];
    CostCenter: ApiCostCenterData[];
    Expenses: ApiExpenseData[];
}

interface DialogItemRow {
    id: number;
    item: string;
    qty: number;
    bags: string | number | null;
    batch: string;
    rate: number | null;
    amt: number | null;
    godown: string;
    raw: any;
}

interface InvoiceDetailsDialogProps {
    open: boolean;
    onClose: () => void;
    invoiceData: {
        invoiceNo: string;
        voucherKey: string;
        parentCategory: string;
        groupName: string;
        voucherName: string;
        clickedItem: any;
        transType?: string;
        refId?: string;
    } | null;
    rawItems: any[];
}

// Helper to extract a valid numeric Transaction ID (Ref_Id) from an item row
// Note: Voucher_Ref_Id is a voucher type master ID (e.g. 39, 21), NEVER the transaction Ref_Id!
const extractValidRefId = (item?: any): string => {
    if (!item) return "";
    const candidates = [
        item.Ref_Id,
        item.ref_id,
        item.Trans_Id,
        item.trans_id,
        item.Delivery_Id,
        item.Trip_Id,
        item.Process_Id,
        item.Purchase_Id,
        item.Credit_Note_Id,
        item.Debit_Note_Id,
        item.PR_Id,
        item.CR_Id,
        item.DB_Id,
        item.PIN_Id,
        item.Do_Id,
        item.ST_Inv_Id,
        item.Invoice_Id,
        item.Id
    ];

    for (const c of candidates) {
        if (c !== undefined && c !== null) {
            const s = String(c).trim().replace(/^["']+|["']+$/g, "").trim();
            if (s !== "" && s !== "-" && !isNaN(Number(s)) && Number(s) > 0) {
                return s;
            }
        }
    }
    return "";
};

// Normalize Trans_Type string to match one of the stored procedure's supported branches
const normalizeTransType = (val?: any): string => {
    if (!val) return "";
    const raw = String(val).trim().replace(/^["']+|["']+$/g, "").trim();
    const upper = raw.toUpperCase().replace(/\s+/g, "_");

    // Exact matches to the 9 supported stored procedure branches
    if (upper === "SALES") return "SALES";
    if (upper === "SALES_TRIP") return "SALES_TRIP";
    if (upper === "PURCHASE") return "PURCHASE";
    if (upper === "PROCESSING" || upper === "PROCESS") return "PROCESSING";
    if (upper === "ARRIVAL_TRIP" || upper === "ARRIVAL") return "ARRIVAL_TRIP";
    if (upper === "CREDIT_NOTE") return "CREDIT_NOTE";
    if (upper === "CREDIT_NOTE_TRIP") return "CREDIT_NOTE_TRIP";
    if (upper === "DEBIT_NOTE") return "DEBIT_NOTE";
    if (upper === "DEBIT_NOTE_TRIP") return "DEBIT_NOTE_TRIP";

    // Keyword matching
    if (upper.includes("CREDIT") && upper.includes("TRIP")) return "CREDIT_NOTE_TRIP";
    if (upper.includes("CREDIT")) return "CREDIT_NOTE";
    if (upper.includes("DEBIT") && upper.includes("TRIP")) return "DEBIT_NOTE_TRIP";
    if (upper.includes("DEBIT")) return "DEBIT_NOTE";
    if (upper.includes("PURCHASE")) return "PURCHASE";
    if (upper.includes("PROCESS") || upper.includes("PRODUCTION") || upper.includes("CONSUMPTION") || upper.includes("JOURNAL")) return "PROCESSING";
    if (upper.includes("SALE") && upper.includes("TRIP")) return "SALES_TRIP";
    if (upper.includes("SALE")) return "SALES";
    if (upper.includes("ARRIVAL") || upper.includes("TRIP") || upper.includes("INW") || upper.includes("TRANSFER") || upper.includes("INTRF") || upper.includes("OUTWARD")) return "ARRIVAL_TRIP";

    return raw;
};

// Infer Trans_Type from parent category, group name, voucher name, and raw item fields
const inferTransType = (
    parentCategory?: string,
    groupName?: string,
    voucherName?: string,
    rawItem?: any
): string => {
    // 1. Direct Trans_Type from item
    const direct = rawItem?.Trans_Type ?? rawItem?.trans_type ?? rawItem?.Transaction_Type ?? rawItem?.Bill_type;
    if (direct) {
        const norm = normalizeTransType(direct);
        if (norm) return norm;
    }

    const pCat = String(parentCategory || "").trim().toUpperCase();
    const gName = String(groupName || "").trim().toUpperCase();
    const vName = String(voucherName || "").trim().toUpperCase();

    // 2. Adjustments / Process
    if (
        pCat === "ADJUSTMENTS" ||
        pCat === "PROCESS" ||
        gName.includes("PROCESS") ||
        gName === "ADJ" ||
        gName === "CLEANING" ||
        gName === "ATTY" ||
        gName === "WT.CHECK" ||
        gName === "DIFFERENCE"
    ) {
        return "PROCESSING";
    }

    // 3. Outward transfers / Trips in OUTWARDS
    if (
        gName.includes("OUTWARDS/INT TRF") ||
        gName.includes("OUTWARD") ||
        vName.includes("OUTWARDS") ||
        vName.includes("INTRF") ||
        vName.includes("TRANSFER")
    ) {
        return "ARRIVAL_TRIP";
    }

    // 4. Sales in OUTWARDS
    if (
        pCat === "OUTWARDS" ||
        gName.includes("SALE") ||
        vName.includes("SALE") ||
        vName.includes("BILL") ||
        vName.includes("CASH")
    ) {
        if (vName.includes("TRIP") || gName.includes("TRIP")) return "SALES_TRIP";
        return "SALES";
    }

    // 5. Inwards / Purchase / Material Inward / Returns / Internal Transfers
    if (
        pCat === "INWARDS" ||
        gName.includes("INWARD") ||
        gName.includes("PUR") ||
        gName.includes("INT TRF")
    ) {
        if (vName.includes("PURCHASE") || gName.includes("PURCHASE")) return "PURCHASE";
        return "ARRIVAL_TRIP";
    }

    // 6. Credit / Debit Note
    if (gName.includes("CREDIT") || vName.includes("CR")) {
        if (vName.includes("TRIP")) return "CREDIT_NOTE_TRIP";
        return "CREDIT_NOTE";
    }
    if (gName.includes("DEBIT") || vName.includes("DB")) {
        if (vName.includes("TRIP")) return "DEBIT_NOTE_TRIP";
        return "DEBIT_NOTE";
    }

    return "SALES";
};

const InvoiceDetailsDialog: React.FC<InvoiceDetailsDialogProps> = ({
    open,
    onClose,
    invoiceData,
    rawItems
}) => {
    const [apiData, setApiData] = useState<ApiDetailedData | null>(null);
    const [apiLoading, setApiLoading] = useState<boolean>(false);

    // Resolve Ref_Id (Trans_Id) for the reportingDetailedList API
    const refId = useMemo(() => {
        if (!invoiceData) return "";
        const inv = String(invoiceData.invoiceNo || "").trim().toUpperCase();

        const matched = (rawItems || []).find((r: any) => {
            const itemInv = String(r.Inv_No || r.Invoice_no || r.Journal_no || "").trim().toUpperCase();
            return itemInv && itemInv === inv;
        });

        // 1. Explicitly passed refId (validated numeric ID)
        if (invoiceData.refId && !isNaN(Number(invoiceData.refId)) && Number(invoiceData.refId) > 0) {
            return String(invoiceData.refId).trim();
        }

        // 2. Check clickedItem
        const clickedRef = extractValidRefId(invoiceData.clickedItem);
        if (clickedRef) return clickedRef;

        // 3. Check matched row from 2nd API list
        const matchedRef = extractValidRefId(matched);
        if (matchedRef) return matchedRef;

        // 4. Fallback: Numeric invoice number itself
        if (inv && !isNaN(Number(inv)) && Number(inv) > 0) {
            return inv;
        }

        return "";
    }, [invoiceData, rawItems]);

    // Resolve Trans_Type for the reportingDetailedList API
    const transType = useMemo(() => {
        if (!invoiceData) return "";
        const inv = String(invoiceData.invoiceNo || "").trim().toUpperCase();
        const matched = (rawItems || []).find((r: any) => {
            const itemInv = String(r.Inv_No || r.Invoice_no || r.Journal_no || "").trim().toUpperCase();
            return itemInv && itemInv === inv;
        });

        // 1. Explicitly passed transType
        if (invoiceData.transType) {
            const norm = normalizeTransType(invoiceData.transType);
            if (norm) return norm;
        }

        // 2. Infer from category, group, voucher, and raw item
        return inferTransType(
            invoiceData.parentCategory,
            invoiceData.groupName,
            invoiceData.voucherName,
            invoiceData.clickedItem || matched
        );
    }, [invoiceData, rawItems]);

    // Fetch reporting detailed list on modal open
    useEffect(() => {
        if (!open || !refId || !transType) {
            setApiData(null);
            setApiLoading(false);
            return;
        }

        let isMounted = true;
        setApiLoading(true);

        employeeReportGroupService.getReportingDetailedList({
            Ref_Id: refId,
            Trans_Type: transType
        })
        .then(res => {
            if (!isMounted) return;
            if (res.data?.success && res.data?.data) {
                setApiData(res.data.data);
            } else {
                setApiData(null);
            }
        })
        .catch(err => {
            if (!isMounted) return;
            console.error("Error fetching detailed reporting list:", err);
            setApiData(null);
        })
        .finally(() => {
            if (isMounted) {
                setApiLoading(false);
            }
        });

        return () => {
            isMounted = false;
        };
    }, [open, refId, transType]);

    // 1. Masters Dataset Mapping for 2nd Grid (Party, Voucher Type, Date, Godown) & Narration - strictly from 3rd API
    const apiMaster = apiData?.Masters?.[0];

    // Check if voucher represents a true Process Journal (Production & Consumption) strictly from 3rd API
    const isProcessing = useMemo(() => {
        if (!apiData) return false;
        const hasPRStatus = apiData.Masters?.[0]?.PR_Status !== undefined && apiData.Masters?.[0]?.PR_Status !== null && String(apiData.Masters?.[0]?.PR_Status).trim() !== "";
        const hasSourQty = Boolean(apiData.Items && apiData.Items.length > 0 && apiData.Items[0].Sour_Qty !== undefined);
        const hasDestQty = Boolean(apiData.CostCenter && apiData.CostCenter.length > 0 && apiData.CostCenter[0].Dest_Qty !== undefined);
        const isProcessBillType = String(apiData.Masters?.[0]?.BillType || "").toUpperCase() === "PROCESSING" || String(apiData.Masters?.[0]?.BillType || "").toUpperCase() === "PROCESS";

        return hasPRStatus || hasSourQty || hasDestQty || isProcessBillType;
    }, [apiData]);

    const partyName = useMemo(() => {
        if (!apiMaster && !apiData) return "-";
        if (isProcessing) {
            return apiMaster?.Party_Name || apiMaster?.Party || (apiMaster?.PR_Status ? `Process (${apiMaster.PR_Status})` : "Internal Process");
        }
        return (
            apiMaster?.Retailer_Name ||
            apiMaster?.Party_Name ||
            apiMaster?.Supplier_Name ||
            apiMaster?.Customer_Name ||
            apiMaster?.Ledger_Name ||
            apiMaster?.Contact_Person ||
            (apiMaster?.Narration && apiMaster.Narration.includes("(") ? apiMaster.Narration.split("(")[0].trim() : "") ||
            (apiMaster?.Vehicle_No ? `${apiMaster.Vehicle_No}${apiMaster.BillType ? ` (${apiMaster.BillType})` : ""}` : "") ||
            apiMaster?.BillType ||
            apiData?.Items?.[0]?.Party_Name ||
            apiData?.Items?.[0]?.Party ||
            apiData?.Items?.[0]?.Supplier_Name ||
            apiData?.Items?.[0]?.Customer_Name ||
            "-"
        );
    }, [apiMaster, apiData, isProcessing]);

    const voucherTypeName =
        apiMaster?.voucher_name ||
        apiMaster?.Voucher_Type ||
        apiMaster?.Voucher_Name ||
        "-";

    const voucherDate = apiMaster?.Ledger_Date
        ? dayjs(apiMaster.Ledger_Date).format("DD-MM-YY")
        : apiMaster?.Voucher_Date
            ? dayjs(apiMaster.Voucher_Date).format("DD-MM-YY")
            : apiMaster?.Date
                ? dayjs(apiMaster.Date).format("DD-MM-YY")
                : "-";

    const narrationText = String(
        apiMaster?.Narration !== undefined && apiMaster?.Narration !== null
            ? apiMaster.Narration
            : ""
    ).trim();

    const hasNarration = Boolean(
        narrationText &&
        narrationText !== "-" &&
        narrationText !== "null" &&
        narrationText !== "undefined"
    );

    // 2. CostCenter / Staff Dataset Mapping for 1st Grid (Staff Grid) - strictly from 3rd API
    const staffRows = useMemo(() => {
        const rows: { staffName: string; category: string }[] = [];
        const seen = new Set<string>();

        const addRow = (staff?: any, cat?: any) => {
            const s = String(staff || "").trim();
            const c = String(cat || "").trim();
            if (s && s !== "-" && s !== "null" && s !== "undefined") {
                const key = `${s.toUpperCase()}___${c.toUpperCase()}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    rows.push({ staffName: s, category: c || "Staff" });
                }
            }
        };

        // 1. Created_By from 3rd API Masters[0]
        if (apiData?.Masters?.[0]?.Created_By) {
            addRow(apiData.Masters[0].Created_By, "Created_By");
        }

        // 2. Staff from 3rd API CostCenter (dataset 2)
        if (apiData?.CostCenter && apiData.CostCenter.length > 0) {
            apiData.CostCenter.forEach(cc => {
                if (isProcessing && (cc.Dest_Qty !== undefined || cc.Product_Id !== undefined)) {
                    return;
                }
                const sName = cc.Cost_Center_Name || cc.Allias_Name || cc.Staff_Name || cc.Employee_Name;
                const sCat = cc.Cost_Category || cc.Cost_Category_Alias || cc.Category || "Staff";
                if (sName) {
                    addRow(sName, sCat);
                }
            });
        }

        // 3. Staff from 3rd API Expenses (dataset 3 for processing)
        if (apiData?.Expenses && apiData.Expenses.length > 0) {
            apiData.Expenses.forEach((exp: any) => {
                const sName = exp.Cost_Center_Name || exp.Allias_Name || exp.Staff_Name || exp.Employee_Name;
                const sCat = exp.Cost_Category || exp.Cost_Category_Alias || exp.Category;
                if (sName && sCat) {
                    addRow(sName, sCat);
                }
            });
        }

        // 4. Broker / Transport from 3rd API Masters[0] if present
        if (apiMaster?.Broker || apiMaster?.Broker_Name || apiMaster?.Brokerage) {
            addRow(apiMaster.Broker || apiMaster.Broker_Name || `Brokerage: ${apiMaster.Brokerage}`, "Broker");
        }
        if (apiMaster?.Transport || apiMaster?.Transporter_Name || apiMaster?.Coolie) {
            addRow(apiMaster.Transport || apiMaster.Transporter_Name || `Coolie: ${apiMaster.Coolie}`, "Transport");
        }

        if (rows.length === 0) {
            rows.push({ staffName: "-", category: "-" });
        }

        return rows;
    }, [apiData, apiMaster, isProcessing]);

    // Check if the transaction is a Godown-to-Godown transfer or adjustment - strictly from 3rd API
    const isGodownToGodown = useMemo(() => {
        if (isProcessing) return true;

        const hasFrom =
            apiData?.Items?.some((x: any) => (x.From_Godown && x.From_Godown !== "-") || (x.FromGodown && x.FromGodown !== "-") || (x.Sour_Godown && x.Sour_Godown !== "-") || (x.Godown_Out && x.Godown_Out !== "-")) ||
            Boolean(apiMaster?.From_Godown && apiMaster.From_Godown !== "-") ||
            Boolean(apiMaster?.Sour_Godown && apiMaster.Sour_Godown !== "-") ||
            Boolean(apiMaster?.Godown_Out && apiMaster.Godown_Out !== "-");

        const hasTo =
            apiData?.Items?.some((x: any) => (x.To_Godown && x.To_Godown !== "-") || (x.ToGodown && x.ToGodown !== "-") || (x.Dest_Godown && x.Dest_Godown !== "-") || (x.Godown_In && x.Godown_In !== "-")) ||
            Boolean(apiMaster?.To_Godown && apiMaster.To_Godown !== "-") ||
            Boolean(apiMaster?.Dest_Godown && apiMaster.Dest_Godown !== "-") ||
            Boolean(apiMaster?.Godown_In && apiMaster.Godown_In !== "-");

        if (hasFrom && hasTo) return true;

        const vName = String(apiMaster?.voucher_name || apiMaster?.Voucher_Type || "").trim().toUpperCase();
        if (
            vName.includes("TRANSFER") ||
            vName.includes("INTRF") ||
            vName.includes("G.INTRF") ||
            vName.includes("G2G") ||
            vName.includes("GODOWN TO GODOWN") ||
            vName.includes("ADJ")
        ) {
            return true;
        }

        const billType = String(apiMaster?.BillType || "").trim().toUpperCase();
        if (billType.includes("TRANSFER") || billType.includes("ADJ")) {
            return true;
        }

        return false;
    }, [apiData, apiMaster, isProcessing]);

    // Godown In: The destination godown where stock is received (strictly from 3rd API)
    const rawGodownIn = useMemo(() => {
        const itemWithTo = apiData?.Items?.find((x: any) => x.To_Godown || x.ToGodown || x.Dest_Godown || x.Godown_In || x.GodownIn);
        if (itemWithTo) {
            const val = itemWithTo.To_Godown || itemWithTo.ToGodown || itemWithTo.Dest_Godown || itemWithTo.Godown_In || itemWithTo.GodownIn;
            if (val && val !== "-") return val;
        }

        if (isProcessing) {
            const ccWithTo = apiData?.CostCenter?.find((x: any) => x.Dest_Godown || x.To_Godown || x.Godown_Name);
            if (ccWithTo) {
                const val = ccWithTo.Dest_Godown || ccWithTo.To_Godown || ccWithTo.Godown_Name;
                if (val && val !== "-") return val;
            }
        }

        const mVal = apiMaster?.To_Godown || apiMaster?.Dest_Godown || apiMaster?.Godown_In;
        if (mVal && mVal !== "-") return mVal;

        const fallback =
            (apiMaster?.Godown_Name && apiMaster.Godown_Name !== "-" ? apiMaster.Godown_Name : "") ||
            (apiData?.Items?.[0]?.Godown_Name && apiData.Items[0].Godown_Name !== "-" ? apiData.Items[0].Godown_Name : "") ||
            "-";

        return fallback;
    }, [apiData, apiMaster, isProcessing]);

    // Godown Out: The source godown where stock is issued from (strictly from 3rd API)
    const rawGodownOut = useMemo(() => {
        const itemWithFrom = apiData?.Items?.find((x: any) => x.From_Godown || x.FromGodown || x.Sour_Godown || x.Godown_Out || x.GodownOut);
        if (itemWithFrom) {
            const val = itemWithFrom.From_Godown || itemWithFrom.FromGodown || itemWithFrom.Sour_Godown || itemWithFrom.Godown_Out || itemWithFrom.GodownOut;
            if (val && val !== "-") return val;
        }

        if (isProcessing) {
            const ccWithFrom = apiData?.CostCenter?.find((x: any) => x.Sour_Godown || x.From_Godown);
            if (ccWithFrom) {
                const val = ccWithFrom.Sour_Godown || ccWithFrom.From_Godown;
                if (val && val !== "-") return val;
            }
        }

        const mVal = apiMaster?.From_Godown || apiMaster?.Sour_Godown || apiMaster?.Godown_Out;
        if (mVal && mVal !== "-") return mVal;

        const fallback =
            (apiMaster?.Godown_Name && apiMaster.Godown_Name !== "-" ? apiMaster.Godown_Name : "") ||
            "-";

        return fallback;
    }, [apiData, apiMaster, isProcessing]);

    const godownIn = rawGodownIn || "-";
    const godownOut = rawGodownOut || "-";

    // Standard Godown for Sales / single-godown transactions (strictly from 3rd API)
    const rawGodown =
        apiData?.Items?.[0]?.Godown_Name ||
        apiMaster?.Godown_Name ||
        apiMaster?.Godown ||
        "-";

    const godownName = rawGodown;

    // 3. Items Dataset Mapping for 3rd Grid (Item Details Grid) - strictly from 3rd API (apiData.Items)
    const itemRows = useMemo<DialogItemRow[]>(() => {
        if (!apiData?.Items || apiData.Items.length === 0) {
            return [];
        }

        return apiData.Items.map((it, idx) => {
            const name = it.Product_Name || it.Item_Name_Modified || it.Stock_Item || it.Item_Name || `Item ${idx + 1}`;
            const qty = Number(it.KGS ?? it.QTY ?? it.Total_Qty ?? it.Bill_Qty ?? it.Act_Qty ?? it.Sour_Qty ?? it.Dest_Qty ?? 0);

            // Extract bags strictly from 3rd API item data or product name
            let bags: string | number | null = null;
            if (it.Alt_Act_Qty !== undefined && it.Alt_Act_Qty !== null && !isNaN(Number(it.Alt_Act_Qty))) {
                bags = Number(it.Alt_Act_Qty);
            } else if (it.Alt_Bill_Qty !== undefined && it.Alt_Bill_Qty !== null && !isNaN(Number(it.Alt_Bill_Qty))) {
                bags = Number(it.Alt_Bill_Qty);
            } else if (it.Bag !== undefined && it.Bag !== null && String(it.Bag).trim() !== "" && String(it.Bag).trim() !== "-") {
                bags = !isNaN(Number(it.Bag)) ? Number(it.Bag) : String(it.Bag).trim();
            } else if (it.Bags !== undefined && it.Bags !== null && String(it.Bags).trim() !== "" && String(it.Bags).trim() !== "-") {
                bags = !isNaN(Number(it.Bags)) ? Number(it.Bags) : String(it.Bags).trim();
            } else {
                const match = String(name).match(/(\d+(?:\.\d+)?)\s*KG/i);
                if (match) {
                    bags = `${match[1]}KG`;
                }
            }

            const batch = it.Batch_Name || it.Batch || it.Batch_No || "-";
            const rate =
                it.Gst_Rate !== undefined && it.Gst_Rate !== null && !isNaN(Number(it.Gst_Rate))
                    ? Number(it.Gst_Rate)
                    : it.Item_Rate !== undefined && it.Item_Rate !== null && !isNaN(Number(it.Item_Rate))
                        ? Number(it.Item_Rate)
                        : it.Taxable_Rate !== undefined && it.Taxable_Rate !== null && !isNaN(Number(it.Taxable_Rate))
                            ? Number(it.Taxable_Rate)
                            : it.Sour_Rate !== undefined && it.Sour_Rate !== null && !isNaN(Number(it.Sour_Rate)) && Number(it.Sour_Rate) > 0
                                ? Number(it.Sour_Rate)
                                : it.Dest_Rate !== undefined && it.Dest_Rate !== null && !isNaN(Number(it.Dest_Rate)) && Number(it.Dest_Rate) > 0
                                    ? Number(it.Dest_Rate)
                                    : null;
            const amt =
                it.Taxable_Value !== undefined && it.Taxable_Value !== null && !isNaN(Number(it.Taxable_Value)) && Number(it.Taxable_Value) > 0
                    ? Number(it.Taxable_Value)
                    : it.Final_Amo !== undefined && it.Final_Amo !== null && !isNaN(Number(it.Final_Amo)) && Number(it.Final_Amo) > 0
                        ? Number(it.Final_Amo)
                        : it.Amount !== undefined && it.Amount !== null && !isNaN(Number(it.Amount)) && Number(it.Amount) > 0
                            ? Number(it.Amount)
                            : it.Taxable_Amount !== undefined && it.Taxable_Amount !== null && !isNaN(Number(it.Taxable_Amount)) && Number(it.Taxable_Amount) > 0
                                ? Number(it.Taxable_Amount)
                                : it.Total_Value !== undefined && it.Total_Value !== null && !isNaN(Number(it.Total_Value)) && Number(it.Total_Value) > 0
                                    ? Number(it.Total_Value)
                                    : it.Sour_Amt !== undefined && it.Sour_Amt !== null && !isNaN(Number(it.Sour_Amt)) && Number(it.Sour_Amt) > 0
                                        ? Number(it.Sour_Amt)
                                        : it.Dest_Amt !== undefined && it.Dest_Amt !== null && !isNaN(Number(it.Dest_Amt)) && Number(it.Dest_Amt) > 0
                                            ? Number(it.Dest_Amt)
                                            : rate && qty
                                                ? rate * qty
                                                : null;

            return {
                id: idx,
                item: name,
                qty,
                bags,
                batch,
                rate,
                amt,
                godown: it.Godown_Name || it.To_Godown || it.From_Godown || "-",
                raw: it
            };
        });
    }, [apiData]);

    // 4. Expenses Dataset Mapping for 4th Grid (Expense Grid at Bottom)
    const expenseRows = useMemo(() => {
        // Processing transactions do not have an Expenses dataset (their 4th dataset is Staff)
        if (isProcessing) {
            return [];
        }

        if (!apiData?.Expenses || apiData.Expenses.length === 0) {
            return [];
        }

        return apiData.Expenses.map((exp, idx) => {
            const expenseName = exp.Account_name || exp.Account_Alias_name || `Expense ${idx + 1}`;
            const cr = exp.Expence_Value_CR !== undefined && exp.Expence_Value_CR !== null && !isNaN(Number(exp.Expence_Value_CR))
                ? Number(exp.Expence_Value_CR)
                : exp.Expense_Value_CR !== undefined && exp.Expense_Value_CR !== null && !isNaN(Number(exp.Expense_Value_CR))
                    ? Number(exp.Expense_Value_CR)
                    : 0;
            const dr = exp.Expence_Value_DR !== undefined && exp.Expence_Value_DR !== null && !isNaN(Number(exp.Expence_Value_DR))
                ? Number(exp.Expence_Value_DR)
                : exp.Expense_Value_DR !== undefined && exp.Expense_Value_DR !== null && !isNaN(Number(exp.Expense_Value_DR))
                    ? Number(exp.Expense_Value_DR)
                    : 0;

            let valueStr = "-";
            if (cr > 0 && dr > 0) {
                valueStr = `${cr} CR / ${dr} DR`;
            } else if (cr > 0) {
                valueStr = `${cr} CR`;
            } else if (dr > 0) {
                valueStr = `${dr} DR`;
            } else if (cr !== 0) {
                valueStr = `${cr} CR`;
            } else if (dr !== 0) {
                valueStr = `${dr} DR`;
            } else {
                valueStr = "0";
            }

            return {
                id: idx,
                sNo: idx + 1,
                expenseName,
                valueStr,
                cr,
                dr,
                raw: exp
            };
        });
    }, [isProcessing, apiData]);

    // Split for Process Journal: Production vs Consumption
    const { productionItems, consumptionItems } = useMemo<{
        productionItems: DialogItemRow[];
        consumptionItems: DialogItemRow[];
    }>(() => {
        if (isProcessing) {
            const hasApiProduction = Boolean(
                apiData?.CostCenter &&
                apiData.CostCenter.length > 0 &&
                (apiData.CostCenter[0].Dest_Qty !== undefined || (apiData.CostCenter[0].Product_Name && !apiData.CostCenter[0].Cost_Center_Name))
            );
            const hasApiConsumption = Boolean(
                apiData?.Items &&
                apiData.Items.length > 0 &&
                (apiData.Items[0].Sour_Qty !== undefined || (apiData.Items[0].Product_Name && isProcessing))
            );

            if (hasApiProduction || hasApiConsumption) {
                // 1. Production (Destination) Items from apiData.CostCenter
                const prod = hasApiProduction
                    ? (apiData?.CostCenter || []).map((it: any, idx: number) => {
                        const name = it.Product_Name || it.Item_Name_Modified || it.Stock_Item || `Production Item ${idx + 1}`;
                        const qty = Number(it.Dest_Qty ?? it.Qty ?? it.QTY ?? it.KGS ?? 0);
                        const bagVal = it.Bag ?? it.Dest_Bag ?? it.Alt_Qty ?? it.Alt_Bill_Qty;
                        const match = String(name).match(/(\d+(?:\.\d+)?)\s*KG/i);
                        const bags = bagVal !== undefined && bagVal !== null && String(bagVal).trim() !== "" && String(bagVal).trim() !== "-"
                            ? (!isNaN(Number(bagVal)) ? Number(bagVal) : String(bagVal).trim())
                            : (match ? `${match[1]}KG` : null);
                        const batch = it.Batch_Name || it.Batch || it.Batch_No || "-";
                        const rate = it.Dest_Rate !== undefined && it.Dest_Rate !== null && !isNaN(Number(it.Dest_Rate)) && Number(it.Dest_Rate) > 0
                            ? Number(it.Dest_Rate)
                            : null;
                        const amt = it.Dest_Amt !== undefined && it.Dest_Amt !== null && !isNaN(Number(it.Dest_Amt)) && Number(it.Dest_Amt) > 0
                            ? Number(it.Dest_Amt)
                            : (rate && qty ? rate * qty : null);

                        return {
                            id: idx,
                            item: name,
                            qty,
                            bags,
                            batch,
                            rate,
                            amt,
                            godown: it.Godown_Name || it.Dest_Godown || "-",
                            raw: it
                        };
                    })
                    : [];

                // 2. Consumption (Source) Items from apiData.Items
                const cons = hasApiConsumption
                    ? (apiData?.Items || []).map((it: any, idx: number) => {
                        const name = it.Product_Name || it.Item_Name_Modified || it.Stock_Item || `Consumption Item ${idx + 1}`;
                        const qty = Number(it.Sour_Qty ?? it.Qty ?? it.QTY ?? it.KGS ?? 0);
                        const bagVal = it.Bag ?? it.Sour_Bag ?? it.Alt_Qty ?? it.Alt_Bill_Qty;
                        const match = String(name).match(/(\d+(?:\.\d+)?)\s*KG/i);
                        const bags = bagVal !== undefined && bagVal !== null && String(bagVal).trim() !== "" && String(bagVal).trim() !== "-"
                            ? (!isNaN(Number(bagVal)) ? Number(bagVal) : String(bagVal).trim())
                            : (match ? `${match[1]}KG` : null);
                        const batch = it.Batch_Name || it.Batch || it.Batch_No || "-";
                        const rate = it.Sour_Rate !== undefined && it.Sour_Rate !== null && !isNaN(Number(it.Sour_Rate)) && Number(it.Sour_Rate) > 0
                            ? Number(it.Sour_Rate)
                            : (it.Gst_Rate !== undefined && it.Gst_Rate !== null && !isNaN(Number(it.Gst_Rate)) && Number(it.Gst_Rate) > 0
                                ? Number(it.Gst_Rate)
                                : (it.Item_Rate ? Number(it.Item_Rate) : null));
                        const amt = it.Sour_Amt !== undefined && it.Sour_Amt !== null && !isNaN(Number(it.Sour_Amt)) && Number(it.Sour_Amt) > 0
                            ? Number(it.Sour_Amt)
                            : (it.Taxable_Value !== undefined && it.Taxable_Value !== null && !isNaN(Number(it.Taxable_Value)) && Number(it.Taxable_Value) > 0
                                ? Number(it.Taxable_Value)
                                : (it.Total_Value && Number(it.Total_Value) > 0 ? Number(it.Total_Value) : (rate && qty ? rate * qty : null)));

                        return {
                            id: idx,
                            item: name,
                            qty,
                            bags,
                            batch,
                            rate,
                            amt,
                            godown: it.Godown_Name || it.Sour_Godown || "-",
                            raw: it
                        };
                    })
                    : [];

                return { productionItems: prod, consumptionItems: cons };
            }
        }

        // Fallback or non-API: Split itemRows based on type keywords or positive/negative qty
        const prod: typeof itemRows = [];
        const cons: typeof itemRows = [];

        itemRows.forEach(it => {
            const raw = it.raw || {};
            const typeStr = String(
                raw.Type ||
                raw.Item_Type ||
                raw.Transaction_Type ||
                raw.Process_Type ||
                raw.Nature ||
                raw.Category ||
                raw.Cost_Category ||
                ""
            ).toUpperCase();

            if (
                typeStr.includes("CONSUM") ||
                typeStr.includes("RAW") ||
                typeStr.includes("INPUT") ||
                typeStr.includes("RM") ||
                typeStr.includes("ISSUE") ||
                typeStr.includes("SOUR")
            ) {
                cons.push(it);
            } else if (
                typeStr.includes("PRODUC") ||
                typeStr.includes("OUTPUT") ||
                typeStr.includes("FG") ||
                typeStr.includes("FINISHED") ||
                typeStr.includes("RECEIPT") ||
                typeStr.includes("DEST")
            ) {
                prod.push(it);
            } else if (it.qty < 0) {
                cons.push({ ...it, qty: Math.abs(it.qty) });
            } else {
                prod.push(it);
            }
        });

        return { productionItems: prod, consumptionItems: cons };
    }, [isProcessing, apiData, itemRows]);

    const renderItemTable = (
        items: DialogItemRow[],
        title?: string,
        badgeColor?: "success" | "warning" | "primary"
    ) => {
        const totalQty = items.reduce((sum, it) => sum + (it.qty || 0), 0);
        const hasBags = items.some(it => it.bags !== null && it.bags !== undefined && String(it.bags).trim() !== "");
        const totalBags = items.reduce((sum, it) => {
            const b = it.bags;
            if (typeof b === "number") return sum + b;
            if (typeof b === "string") {
                const num = Number(b.replace(/[^0-9.]/g, ""));
                return sum + (isNaN(num) ? 0 : num);
            }
            return sum;
        }, 0);
        const totalAmt = items.reduce((sum, it) => sum + (it.amt || 0), 0);

        return (
            <Box sx={{ mb: title ? 1.5 : 0 }}>
                {title && (
                    <Box display="flex" alignItems="center" gap={1} mb={0.75}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#1e3a8a", fontSize: "0.825rem" }}>
                            {title}
                        </Typography>
                        <Chip
                            size="small"
                            label={`${items.length} ${items.length === 1 ? "item" : "items"}`}
                            color={badgeColor || "primary"}
                            variant="outlined"
                            sx={{ height: 18, fontSize: "0.675rem", fontWeight: 600 }}
                        />
                    </Box>
                )}
                <TableContainer
                    component={Paper}
                    variant="outlined"
                    sx={{
                        borderColor: "#cbd5e1",
                        borderRadius: "6px",
                        overflowX: "hidden",
                        overflowY: "auto",
                        maxHeight: title ? "165px" : (!isProcessing && expenseRows.length > 0 ? "260px" : "360px")
                    }}
                >
                    <Table size="small" stickyHeader sx={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse" }}>
                        <TableHead>
                            {/* Fixed Header Row */}
                            <TableRow
                                sx={{
                                    bgcolor: "#f8fafc",
                                    borderBottom: "1px solid #cbd5e1",
                                    "& .MuiTableCell-root": {
                                        position: "sticky",
                                        top: 0,
                                        zIndex: 6,
                                        bgcolor: "#f8fafc",
                                        py: 0.5,
                                        px: 1,
                                        height: "30px",
                                        boxSizing: "border-box",
                                        borderRight: "1px solid #cbd5e1",
                                        borderBottom: "1px solid #cbd5e1",
                                        fontWeight: 700,
                                        fontSize: "0.785rem",
                                        color: "#334155",
                                        whiteSpace: "nowrap"
                                    }
                                }}
                            >
                                <TableCell sx={{ width: "8%" }} align="center">
                                    S.No
                                </TableCell>
                                <TableCell sx={{ width: "28%", px: 1.5 }}>
                                    Item
                                </TableCell>
                                <TableCell sx={{ width: "13%" }} align="center">
                                    Qty
                                </TableCell>
                                <TableCell sx={{ width: "11%" }} align="center">
                                    Bag
                                </TableCell>
                                <TableCell sx={{ width: "13%" }} align="center">
                                    Batch
                                </TableCell>
                                <TableCell sx={{ width: "12%" }} align="right">
                                    Rate
                                </TableCell>
                                <TableCell sx={{ width: "15%", px: 1.5, borderRight: "none" }} align="right">
                                    Amt
                                </TableCell>
                            </TableRow>

                            {/* Fixed Summary / Total Row directly under header */}
                            <TableRow
                                sx={{
                                    bgcolor: "#f1f5f9",
                                    "& .MuiTableCell-root": {
                                        position: "sticky",
                                        top: "30px",
                                        zIndex: 5,
                                        bgcolor: "#f1f5f9",
                                        py: 0.5,
                                        px: 1,
                                        height: "30px",
                                        boxSizing: "border-box",
                                        borderRight: "1px solid #cbd5e1",
                                        borderBottom: "2px solid #cbd5e1",
                                        fontWeight: 700,
                                        fontSize: "0.785rem",
                                        color: "#0f172a",
                                        whiteSpace: "nowrap"
                                    }
                                }}
                            >
                                <TableCell align="center" sx={{ color: "#64748b" }}>
                                    -
                                </TableCell>
                                <TableCell sx={{ px: 1.5 }}>
                                    Total
                                </TableCell>
                                <TableCell align="center">
                                    {totalQty ? `${totalQty.toLocaleString()} kg` : "-"}
                                </TableCell>
                                <TableCell align="center">
                                    {hasBags || totalBags > 0 ? totalBags.toLocaleString() : "-"}
                                </TableCell>
                                <TableCell align="center" />
                                <TableCell align="right" />
                                <TableCell sx={{ px: 1.5, borderRight: "none" }} align="right">
                                    {totalAmt > 0 ? `Rs. ${totalAmt.toLocaleString()}` : "-"}
                                </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {/* Item rows */}
                            {items.length > 0 ? (
                                items.map((it, idx) => (
                                    <TableRow
                                        key={idx}
                                        sx={{
                                            borderBottom: idx === items.length - 1 ? "none" : "1px solid #e2e8f0",
                                            "&:hover": { bgcolor: "#f8fafc" }
                                        }}
                                    >
                                        <TableCell
                                            sx={{
                                                fontSize: "0.785rem",
                                                color: "#64748b",
                                                fontWeight: 600,
                                                borderRight: "1px solid #cbd5e1",
                                                py: 0.5,
                                                px: 1
                                            }}
                                            align="center"
                                        >
                                            {idx + 1}
                                        </TableCell>
                                        <TableCell
                                            sx={{
                                                fontSize: "0.785rem",
                                                color: "#1e293b",
                                                fontWeight: 500,
                                                borderRight: "1px solid #cbd5e1",
                                                py: 0.5,
                                                px: 1.5
                                            }}
                                        >
                                            {it.item}
                                        </TableCell>
                                        <TableCell
                                            sx={{
                                                fontSize: "0.785rem",
                                                color: "#334155",
                                                borderRight: "1px solid #cbd5e1",
                                                py: 0.5,
                                                px: 1
                                            }}
                                            align="center"
                                        >
                                            {it.qty ? `${it.qty.toLocaleString()} kg` : "-"}
                                        </TableCell>
                                        <TableCell
                                            sx={{
                                                fontSize: "0.785rem",
                                                color: "#334155",
                                                borderRight: "1px solid #cbd5e1",
                                                py: 0.5,
                                                px: 1
                                            }}
                                            align="center"
                                        >
                                            {it.bags !== null ? it.bags : "-"}
                                        </TableCell>
                                        <TableCell
                                            sx={{
                                                fontSize: "0.785rem",
                                                color: "#334155",
                                                borderRight: "1px solid #cbd5e1",
                                                py: 0.5,
                                                px: 1
                                            }}
                                            align="center"
                                        >
                                            {it.batch}
                                        </TableCell>
                                        <TableCell
                                            sx={{
                                                fontSize: "0.785rem",
                                                color: "#334155",
                                                borderRight: "1px solid #cbd5e1",
                                                py: 0.5,
                                                px: 1
                                            }}
                                            align="right"
                                        >
                                            {it.rate !== null ? it.rate.toLocaleString() : "-"}
                                        </TableCell>
                                        <TableCell sx={{ fontSize: "0.785rem", color: "#334155", py: 0.5, px: 1.5, borderRight: "none" }} align="right">
                                            {it.amt !== null ? it.amt.toLocaleString() : "-"}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell
                                        colSpan={7}
                                        align="center"
                                        sx={{ py: 1.5, color: "#94a3b8", fontStyle: "italic", fontSize: "0.785rem" }}
                                    >
                                        {apiLoading ? "Loading items..." : "No items recorded"}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Box>
        );
    };

    // Render Bottom Expense Grid with S.No, Expense, Expense Value
    const renderExpenseTable = () => {
        if (!expenseRows || expenseRows.length === 0) {
            return null;
        }

        const totalDR = expenseRows.reduce((sum, e) => sum + e.dr, 0);
        const totalCR = expenseRows.reduce((sum, e) => sum + e.cr, 0);
        let totalExpenseDisplay = "-";
        if (totalCR > 0 && totalDR > 0) {
            totalExpenseDisplay = `${totalCR.toLocaleString()} CR / ${totalDR.toLocaleString()} DR`;
        } else if (totalCR > 0) {
            totalExpenseDisplay = `${totalCR.toLocaleString()} CR`;
        } else if (totalDR > 0) {
            totalExpenseDisplay = `${totalDR.toLocaleString()} DR`;
        }

        return (
            <Box sx={{ mt: 1 }}>
                <TableContainer
                    component={Paper}
                    variant="outlined"
                    sx={{
                        borderColor: "#cbd5e1",
                        borderRadius: "6px",
                        overflowX: "hidden",
                        overflowY: "auto",
                        maxHeight: "140px"
                    }}
                >
                    <Table size="small" stickyHeader sx={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse" }}>
                        <TableHead>
                            {/* Fixed Header Row */}
                            <TableRow
                                sx={{
                                    bgcolor: "#f8fafc",
                                    borderBottom: "1px solid #cbd5e1",
                                    "& .MuiTableCell-root": {
                                        position: "sticky",
                                        top: 0,
                                        zIndex: 6,
                                        bgcolor: "#f8fafc",
                                        py: 0.5,
                                        px: 1,
                                        height: "30px",
                                        boxSizing: "border-box",
                                        borderRight: "1px solid #cbd5e1",
                                        borderBottom: "1px solid #cbd5e1",
                                        fontWeight: 700,
                                        fontSize: "0.785rem",
                                        color: "#334155",
                                        whiteSpace: "nowrap"
                                    }
                                }}
                            >
                                <TableCell sx={{ width: "8%" }} align="center">
                                    S.No
                                </TableCell>
                                <TableCell sx={{ width: "52%", px: 1.5 }}>
                                    Expense
                                </TableCell>
                                <TableCell sx={{ width: "40%", px: 1.5, borderRight: "none" }} align="right">
                                    Expense Value
                                </TableCell>
                            </TableRow>

                            {/* Fixed Summary / Total Row directly under header */}
                            <TableRow
                                sx={{
                                    bgcolor: "#f1f5f9",
                                    "& .MuiTableCell-root": {
                                        position: "sticky",
                                        top: "30px",
                                        zIndex: 5,
                                        bgcolor: "#f1f5f9",
                                        py: 0.5,
                                        px: 1,
                                        height: "30px",
                                        boxSizing: "border-box",
                                        borderRight: "1px solid #cbd5e1",
                                        borderBottom: "2px solid #cbd5e1",
                                        fontWeight: 700,
                                        fontSize: "0.785rem",
                                        color: "#0f172a",
                                        whiteSpace: "nowrap"
                                    }
                                }}
                            >
                                <TableCell align="center" sx={{ color: "#64748b" }}>
                                    -
                                </TableCell>
                                <TableCell sx={{ px: 1.5 }}>
                                    Total
                                </TableCell>
                                <TableCell sx={{ px: 1.5, borderRight: "none" }} align="right">
                                    {totalExpenseDisplay}
                                </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {expenseRows.map((exp, idx) => (
                                <TableRow
                                    key={idx}
                                    sx={{
                                        borderBottom: idx === expenseRows.length - 1 ? "none" : "1px solid #e2e8f0",
                                        "&:hover": { bgcolor: "#f8fafc" }
                                    }}
                                >
                                    <TableCell
                                        sx={{
                                            fontSize: "0.785rem",
                                            color: "#64748b",
                                            fontWeight: 600,
                                            borderRight: "1px solid #cbd5e1",
                                            py: 0.5,
                                            px: 1
                                        }}
                                        align="center"
                                    >
                                        {exp.sNo}
                                    </TableCell>
                                    <TableCell
                                        sx={{
                                            fontSize: "0.785rem",
                                            color: "#1e293b",
                                            fontWeight: 500,
                                            borderRight: "1px solid #cbd5e1",
                                            py: 0.5,
                                            px: 1.5
                                        }}
                                    >
                                        {exp.expenseName}
                                    </TableCell>
                                    <TableCell
                                        sx={{
                                            fontSize: "0.785rem",
                                            color: "#0f766e",
                                            fontWeight: 700,
                                            py: 0.5,
                                            px: 1.5,
                                            borderRight: "none"
                                        }}
                                        align="right"
                                    >
                                        {exp.valueStr}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Box>
        );
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="xl"
            fullWidth
            PaperProps={{
                sx: {
                    width: "96vw",
                    maxWidth: "1280px",
                    maxHeight: "92vh",
                    borderRadius: "10px",
                    overflow: "hidden",
                    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                    m: "auto"
                }
            }}
        >
            {/* Header / Title */}
            <DialogTitle
                sx={{
                    m: 0,
                    py: 1,
                    px: 2.5,
                    bgcolor: "#1E3A8A",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between"
                }}
            >
                <Typography variant="subtitle1" component="div" sx={{ fontWeight: 700, fontSize: "0.95rem", letterSpacing: 0.3 }}>
                    Invoice Details of {apiMaster?.invoice_no || invoiceData?.invoiceNo}
                </Typography>
                <IconButton
                    aria-label="close"
                    onClick={onClose}
                    size="small"
                    sx={{
                        color: "#ffffff",
                        p: 0.5,
                        "&:hover": { bgcolor: "rgba(255, 255, 255, 0.15)" }
                    }}
                >
                    <CloseIcon fontSize="small" />
                </IconButton>
            </DialogTitle>

            <DialogContent
                sx={{
                    p: 1.5,
                    mt: 1.5,
                    bgcolor: "#ffffff",
                    overflowY: "auto",
                    overflowX: "hidden"
                }}
            >
                {apiLoading && (
                    <LinearProgress
                        sx={{
                            height: 2,
                            borderRadius: 1,
                            mb: 1,
                            bgcolor: "#e2e8f0",
                            "& .MuiLinearProgress-bar": { bgcolor: "#1e3a8a" }
                        }}
                    />
                )}
                {apiLoading && !apiData ? (
                    <Box sx={{ py: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                        <CircularProgress size={32} sx={{ color: "#1e3a8a", mb: 2 }} />
                        <Typography variant="body2" sx={{ color: "#64748b", fontWeight: 600, fontSize: "0.85rem" }}>
                            Loading invoice details from server...
                        </Typography>
                    </Box>
                ) : !apiData ? (
                    <Box sx={{ py: 8, textAlign: "center" }}>
                        <Typography variant="body1" sx={{ color: "#475569", fontWeight: 600, mb: 0.5 }}>
                            No transaction details found for invoice {invoiceData?.invoiceNo}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "#94a3b8", display: "block" }}>
                            Trans_Id: {refId || "-"} | Trans_Type: {transType || "-"}
                        </Typography>
                    </Box>
                ) : (
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: { xs: "column", md: "row" },
                            gap: 1.5,
                            alignItems: "flex-start",
                            width: "100%"
                        }}
                    >
                        {/* LEFT COLUMN: Staff & Category Table */}
                        <Box sx={{ width: { xs: "100%", md: "280px" }, flexShrink: 0 }}>
                            <TableContainer
                                component={Paper}
                                variant="outlined"
                                sx={{
                                    borderColor: "#cbd5e1",
                                    borderRadius: "6px",
                                    overflowX: "hidden",
                                    overflowY: "auto",
                                    maxHeight: "360px"
                                }}
                            >
                                <Table size="small" stickyHeader sx={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse" }}>
                                    <TableHead>
                                        <TableRow
                                            sx={{
                                                bgcolor: "#f8fafc",
                                                borderBottom: "1px solid #cbd5e1",
                                                "& .MuiTableCell-root": {
                                                    position: "sticky",
                                                    top: 0,
                                                    zIndex: 6,
                                                    bgcolor: "#f8fafc",
                                                    py: 0.5,
                                                    px: 1,
                                                    height: "30px",
                                                    boxSizing: "border-box",
                                                    borderRight: "1px solid #cbd5e1",
                                                    borderBottom: "1px solid #cbd5e1",
                                                    fontWeight: 700,
                                                    fontSize: "0.785rem",
                                                    color: "#334155",
                                                    whiteSpace: "nowrap"
                                                }
                                            }}
                                        >
                                            <TableCell sx={{ width: "16%" }} align="center">
                                                S.No
                                            </TableCell>
                                            <TableCell sx={{ width: "42%" }}>
                                                Staff
                                            </TableCell>
                                            <TableCell sx={{ width: "42%", borderRight: "none" }}>
                                                Category
                                            </TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {staffRows.map((sr, idx) => (
                                            <TableRow
                                                key={idx}
                                                sx={{
                                                    borderBottom: idx === staffRows.length - 1 ? "none" : "1px solid #e2e8f0",
                                                    "&:hover": { bgcolor: "#f8fafc" }
                                                }}
                                            >
                                                <TableCell
                                                    sx={{
                                                        fontSize: "0.785rem",
                                                        color: "#64748b",
                                                        fontWeight: 600,
                                                        borderRight: "1px solid #cbd5e1",
                                                        py: 0.5,
                                                        px: 1
                                                    }}
                                                    align="center"
                                                >
                                                    {idx + 1}
                                                </TableCell>
                                                <TableCell
                                                    sx={{
                                                        fontSize: "0.785rem",
                                                        color: "#1e293b",
                                                        fontWeight: 500,
                                                        borderRight: "1px solid #cbd5e1",
                                                        py: 0.5,
                                                        px: 1,
                                                        wordBreak: "break-word"
                                                    }}
                                                >
                                                    {sr.staffName}
                                                </TableCell>
                                                <TableCell
                                                    sx={{
                                                        fontSize: "0.785rem",
                                                        color: "#475569",
                                                        py: 0.5,
                                                        px: 1,
                                                        wordBreak: "break-word",
                                                        borderRight: "none"
                                                    }}
                                                >
                                                    {sr.category}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Box>

                        {/* RIGHT COLUMN: Party details, Narration, Item Grid, Expense Grid */}
                        <Box sx={{ flex: 1, minWidth: 0, width: { xs: "100%", md: "auto" } }}>
                            {/* 1. Party, Voucher Type, Date, Godown (Single Line) */}
                            <TableContainer
                                component={Paper}
                                variant="outlined"
                                sx={{
                                    borderColor: "#cbd5e1",
                                    borderRadius: "6px",
                                    overflowX: "hidden",
                                    mb: 1
                                }}
                            >
                                <Table size="small" sx={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse" }}>
                                    <TableHead>
                                        <TableRow sx={{ bgcolor: "#f8fafc", borderBottom: "1px solid #cbd5e1" }}>
                                            <TableCell
                                                sx={{
                                                    fontWeight: 700,
                                                    fontSize: "0.785rem",
                                                    color: "#334155",
                                                    borderRight: "1px solid #cbd5e1",
                                                    py: 0.6,
                                                    px: 1.2,
                                                    width: isGodownToGodown ? "28%" : "38%"
                                                }}
                                            >
                                                Party
                                            </TableCell>
                                            <TableCell
                                                sx={{
                                                    fontWeight: 700,
                                                    fontSize: "0.785rem",
                                                    color: "#334155",
                                                    borderRight: "1px solid #cbd5e1",
                                                    py: 0.6,
                                                    px: 1.2,
                                                    width: isGodownToGodown ? "20%" : "24%"
                                                }}
                                            >
                                                Voucher Type
                                            </TableCell>
                                            <TableCell
                                                sx={{
                                                    fontWeight: 700,
                                                    fontSize: "0.785rem",
                                                    color: "#334155",
                                                    borderRight: "1px solid #cbd5e1",
                                                    py: 0.6,
                                                    px: 1.2,
                                                    width: isGodownToGodown ? "14%" : "16%"
                                                }}
                                            >
                                                Date
                                            </TableCell>
                                            {isGodownToGodown ? (
                                                <>
                                                    <TableCell
                                                        sx={{
                                                            fontWeight: 700,
                                                            fontSize: "0.785rem",
                                                            color: "#334155",
                                                            borderRight: "1px solid #cbd5e1",
                                                            py: 0.6,
                                                            px: 1.2,
                                                            width: "19%"
                                                        }}
                                                    >
                                                        Godown In
                                                    </TableCell>
                                                    <TableCell
                                                        sx={{
                                                            fontWeight: 700,
                                                            fontSize: "0.785rem",
                                                            color: "#334155",
                                                            borderRight: "none",
                                                            py: 0.6,
                                                            px: 1.2,
                                                            width: "19%"
                                                        }}
                                                    >
                                                        Godown Out
                                                    </TableCell>
                                                </>
                                            ) : (
                                                <TableCell
                                                    sx={{
                                                        fontWeight: 700,
                                                        fontSize: "0.785rem",
                                                        color: "#334155",
                                                        borderRight: "none",
                                                        py: 0.6,
                                                        px: 1.2,
                                                        width: "22%"
                                                    }}
                                                >
                                                    Godown
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        <TableRow sx={{ "&:hover": { bgcolor: "#f8fafc" } }}>
                                            <TableCell
                                                sx={{
                                                    py: 0.6,
                                                    px: 1.2,
                                                    fontSize: "0.785rem",
                                                    fontWeight: 600,
                                                    color: "#1e293b",
                                                    borderRight: "1px solid #cbd5e1",
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap"
                                                }}
                                                title={partyName}
                                            >
                                                {partyName}
                                            </TableCell>
                                            <TableCell
                                                sx={{
                                                    py: 0.6,
                                                    px: 1.2,
                                                    fontSize: "0.785rem",
                                                    color: "#334155",
                                                    borderRight: "1px solid #cbd5e1",
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap"
                                                }}
                                                title={voucherTypeName}
                                            >
                                                {voucherTypeName}
                                            </TableCell>
                                            <TableCell
                                                sx={{
                                                    py: 0.6,
                                                    px: 1.2,
                                                    fontSize: "0.785rem",
                                                    color: "#334155",
                                                    borderRight: "1px solid #cbd5e1"
                                                }}
                                            >
                                                {voucherDate}
                                            </TableCell>
                                            {isGodownToGodown ? (
                                                <>
                                                    <TableCell
                                                        sx={{
                                                            py: 0.6,
                                                            px: 1.2,
                                                            fontSize: "0.785rem",
                                                            color: "#334155",
                                                            borderRight: "1px solid #cbd5e1",
                                                            overflow: "hidden",
                                                            textOverflow: "ellipsis",
                                                            whiteSpace: "nowrap"
                                                        }}
                                                        title={godownIn}
                                                    >
                                                        {godownIn}
                                                    </TableCell>
                                                    <TableCell
                                                        sx={{
                                                            py: 0.6,
                                                            px: 1.2,
                                                            fontSize: "0.785rem",
                                                            color: "#334155",
                                                            borderRight: "none",
                                                            overflow: "hidden",
                                                            textOverflow: "ellipsis",
                                                            whiteSpace: "nowrap"
                                                        }}
                                                        title={godownOut}
                                                    >
                                                        {godownOut}
                                                    </TableCell>
                                                </>
                                            ) : (
                                                <TableCell
                                                    sx={{
                                                        py: 0.6,
                                                        px: 1.2,
                                                        fontSize: "0.785rem",
                                                        color: "#334155",
                                                        borderRight: "none",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        whiteSpace: "nowrap"
                                                    }}
                                                    title={godownName}
                                                >
                                                    {godownName}
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </TableContainer>

                            {/* 2. Narration Line */}
                            {hasNarration && (
                                <Box sx={{ mb: 1, px: 0.5, display: "flex", alignItems: "baseline", gap: 0.75 }}>
                                    <Typography
                                        component="span"
                                        sx={{
                                            fontWeight: 700,
                                            fontSize: "0.785rem",
                                            color: "#1e3a8a",
                                            flexShrink: 0
                                        }}
                                    >
                                        Narration :
                                    </Typography>
                                    <Typography
                                        component="span"
                                        sx={{
                                            fontSize: "0.785rem",
                                            color: "#334155",
                                            fontStyle: "italic",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap"
                                        }}
                                        title={narrationText}
                                    >
                                        {narrationText}
                                    </Typography>
                                </Box>
                            )}

                            {/* 3. Item Details Grid */}
                            {isProcessing ? (
                                <Box>
                                    {renderItemTable(productionItems, "Production Details", "success")}
                                    {renderItemTable(consumptionItems, "Consumption Details", "warning")}
                                </Box>
                            ) : (
                                renderItemTable(itemRows)
                            )}

                            {/* 4. Expense Details Grid */}
                            {!isProcessing && renderExpenseTable()}
                        </Box>
                    </Box>
                )}
            </DialogContent>
        </Dialog>
    );
};

const OverallItemwise: React.FC = () => {
    const today = dayjs().format("YYYY-MM-DD");
    const { user } = useAuth();
    const companyId = user?.companyId || "default";

    // Date & UI States
    const [fromDate, setFromDate] = useState(today);
    const [toDate, setToDate] = useState(today);
    const [tempFromDate, setTempFromDate] = useState(today);
    const [tempToDate, setTempToDate] = useState(today);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    // Godown Master State & Filter
    const [godowns, setGodowns] = useState<GodownMaster[]>([]);
    const [selectedGodownIds, setSelectedGodownIds] = useState<number[]>([]);
    const [tempSelectedGodownIds, setTempSelectedGodownIds] = useState<number[]>([]);

    // Quantity Type: "Qty" vs "Act_Qty"
    const [qtyType, setQtyType] = useState<"Qty" | "Act_Qty">("Qty");

    useEffect(() => {
        if (companyId) {
            const stored = localStorage.getItem(`group_wise_item_qty_type_${companyId}`);
            setQtyType(stored === "Act_Qty" ? "Act_Qty" : "Qty");
        }
    }, [companyId]);

    const handleQtyTypeChange = (newType: "Qty" | "Act_Qty") => {
        setQtyType(newType);
        if (companyId) {
            localStorage.setItem(`group_wise_item_qty_type_${companyId}`, newType);
        }
    };

    useEffect(() => {
        if (drawerOpen) {
            setTempFromDate(fromDate);
            setTempToDate(toDate);
            setTempSelectedGodownIds(selectedGodownIds);
        }
    }, [drawerOpen, fromDate, toDate, selectedGodownIds]);

    // Live Report Data State (from 1st API: overallStaffCategorywise)
    const [reportData, setReportData] = useState<any[]>([]);

    // Cached Item Data (from 2nd API: invoicewithitems) keyed by voucherKey
    const [itemData, setItemData] = useState<Record<string, any[]>>({});
    const [loadingItems, setLoadingItems] = useState<Record<string, boolean>>({});

    // Column Config State for 2nd API columns
    const [itemColumns, setItemColumns] = useState<ColumnConfig[]>(DEFAULT_ITEM_COLUMNS);

    // Enabled columns sorted by order
    const enabledItemColumns = useMemo(() => {
        return itemColumns.filter(c => c.enabled).sort((a, b) => a.order - b.order);
    }, [itemColumns]);

    // Template states
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);
    const [exportModalOpen, setExportModalOpen] = useState(false);
    const [exportType, setExportType] = useState<"excel" | "pdf">("excel");
    const [exportDetails, setExportDetails] = useState(false);
    const [reportName, setReportName] = useState("");
    const parentReportName = "GROUP WISE ITEM";
    const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);

    // Invoice Details Modal state
    const [selectedInvoice, setSelectedInvoice] = useState<{
        invoiceNo: string;
        voucherKey: string;
        parentCategory: string;
        groupName: string;
        voucherName: string;
        clickedItem: any;
        transType?: string;
        refId?: string;
    } | null>(null);

    const handleOpenInvoiceModal = (
        invoiceNo: string,
        voucherKey: string,
        parentCategory: string,
        groupName: string,
        voucherName: string,
        clickedItem: any
    ) => {
        const rawList = itemData[voucherKey] || [];
        const invUpper = String(invoiceNo).trim().toUpperCase();
        const matched = rawList.find((r: any) => {
            const itemInv = String(r.Inv_No || r.Invoice_no || r.Journal_no || "").trim().toUpperCase();
            return itemInv && itemInv === invUpper;
        });

        const resolvedTransType = inferTransType(
            parentCategory,
            groupName,
            voucherName,
            clickedItem || matched
        );

        let resolvedRefId = extractValidRefId(clickedItem);
        if (!resolvedRefId && matched) {
            resolvedRefId = extractValidRefId(matched);
        }
        if (!resolvedRefId && invoiceNo && !isNaN(Number(invoiceNo)) && Number(invoiceNo) > 0) {
            resolvedRefId = String(invoiceNo).trim();
        }

        setSelectedInvoice({
            invoiceNo,
            voucherKey,
            parentCategory,
            groupName,
            voucherName,
            clickedItem,
            transType: resolvedTransType || undefined,
            refId: resolvedRefId || undefined
        });
    };

    const handleCloseInvoiceModal = () => {
        setSelectedInvoice(null);
    };

    // 2nd API Column Filters & Header Filter Menu
    const [columnFilters, setColumnFilters] = useState<Record<string, string[] | undefined>>({});
    const [filterAnchor, setFilterAnchor] = useState<null | HTMLElement>(null);
    const [activeHeader, setActiveHeader] = useState<string | null>(null);

    // Column Settings Popover/Dialog Anchor
    const [settingsAnchor, setSettingsAnchor] = useState<null | HTMLElement>(null);

    // Expanded Vouchers state
    const [expandedVouchers, setExpandedVouchers] = useState<string[]>([]);

    // Grouping Config & Master Voucher Types
    const [groups, setGroups] = useState<GroupConfig[]>([]);
    const [voucherTypes, setVoucherTypes] = useState<VoucherType[]>([]);

    // Drag-and-drop sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        })
    );

    const handleDragEnd = (event: any) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        setItemColumns((prev) => {
            const enabledCols = prev.filter(c => c.enabled).sort((a, b) => a.order - b.order);
            const oldIndex = enabledCols.findIndex(c => c.key === active.id);
            const newIndex = enabledCols.findIndex(c => c.key === over.id);
            if (oldIndex === -1 || newIndex === -1) return prev;
            const reordered = arrayMove(enabledCols, oldIndex, newIndex);

            return prev.map((col) => {
                const idx = reordered.findIndex(r => r.key === col.key);
                return idx !== -1 ? { ...col, order: idx } : col;
            });
        });
    };

    // Toggle column visibility
    const handleToggleColumn = (key: string) => {
        setItemColumns(p => p.map(col => col.key === key ? { ...col, enabled: !col.enabled } : col));
    };

    // Fetch voucher types, godowns, and groups concurrently on mount
    useEffect(() => {
        const fetchMetadata = async () => {
            try {
                const [vtRes, gRes, ergRes] = await Promise.allSettled([
                    employeeReportGroupService.getVoucherTypes(),
                    employeeReportGroupService.getGodownsWithVoucherTypes().catch(() => employeeReportGroupService.getGodowns()),
                    employeeReportGroupService.getEmployeeReportGroups()
                ]);

                if (vtRes.status === "fulfilled" && vtRes.value?.data?.success) {
                    setVoucherTypes(vtRes.value.data.data || []);
                }

                if (gRes.status === "fulfilled" && gRes.value?.data?.success) {
                    const gData = gRes.value.data.data || [];
                    const filteredG = gData.filter((g: any) => g.Godown_Name && g.Godown_Name.trim() !== "");
                    setGodowns(filteredG);
                }

                if (ergRes.status === "fulfilled" && ergRes.value?.data?.success) {
                    const rows = ergRes.value.data.data || [];
                    const groupsMap: Record<string, {
                        name: string;
                        parentCategory: "INWARDS" | "OUTWARDS" | "ADJUSTMENTS";
                        voucherTypes: string[];
                    }> = {};

                    rows.forEach((row: any) => {
                        const name = row.Group_Name;
                        if (!groupsMap[name]) {
                            const catId = Number(row.Overall_GroupId);
                            const parentCategory = catId === 1 ? "INWARDS" : catId === 2 ? "ADJUSTMENTS" : "OUTWARDS";
                            groupsMap[name] = {
                                name,
                                parentCategory,
                                voucherTypes: []
                            };
                        }
                        if (row.Voucher_Type_Name) {
                            groupsMap[name].voucherTypes.push(row.Voucher_Type_Name);
                        }
                    });

                    setGroups(Object.values(groupsMap));
                }
            } catch (err) {
                console.error("Error loading group/voucher metadata:", err);
                toast.error("Failed to load metadata from backend");
            }
        };

        fetchMetadata();
    }, []);

    // Fetch 1st API: overallStaffCategorywise
    const fetchReportData = async () => {
        setLoading(true);
        try {
            const res = await employeeReportGroupService.getOverallStaffCategorywise({
                Fromdate: fromDate,
                Todate: toDate
            });
            if (res.data?.success) {
                const data = res.data.data || [];
                setReportData(data);
            } else {
                setReportData([]);
            }
        } catch (err) {
            console.error("Error loading report data:", err);
            toast.error("Failed to load report data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReportData();
        setExpandedVouchers([]);
        setItemData({});
    }, [fromDate, toDate]);

    // Set of voucher type names linked to the selected godown(s)
    const linkedVoucherNames = useMemo(() => {
        if (!selectedGodownIds || selectedGodownIds.length === 0) return null;
        const godownIdSet = new Set(selectedGodownIds.map(Number));
        const set = new Set<string>();
        voucherTypes.forEach((vt) => {
            if (vt.GodownId !== null && vt.GodownId !== undefined && godownIdSet.has(Number(vt.GodownId))) {
                const name = (vt.label || vt.Voucher_Type || "").trim();
                if (name) set.add(name.toUpperCase());
            }
        });
        return set;
    }, [selectedGodownIds, voucherTypes]);

    // Dropdown options for ReportFilterDrawer
    const godownDropdownOptions = useMemo(() => {
        return godowns.map((g) => ({
            label: g.Godown_Name,
            value: Number(g.Godown_Id)
        }));
    }, [godowns]);

    // Normalize Category helper
    const normalizeCategory = (cat: string) => {
        if (!cat) return "";
        const c = cat.toUpperCase();
        if (c === "PROCESS") return "ADJUSTMENTS";
        return c;
    };

    // Process & Aggregate raw 2nd API items for a voucher
    const processVoucherItems = (rawItems: any[], enabledCols: ColumnConfig[]) => {
        if (!rawItems || rawItems.length === 0) return [];

        // 1. Deduplicate by unique invoice item: (Inv_No, Item, Batch) so cost center allocations do not multiply item Kgs
        const uniqueItemMap = new Map<string, any>();

        rawItems.forEach(row => {
            const invRef = row.Inv_No ? String(row.Inv_No).trim().toUpperCase() : String(row.Voucher_Ref_Id || "");
            const itemName = String(row.Item_Name_Modified || row.Stock_Item || row.Item_Name || row.Item || row.POS_Item_Name || "").trim();
            const stockItem = String(row.Stock_Item || row.Product_Name || itemName).trim().toUpperCase();
            const bag = String(row.Bag || row.Bags || "").trim().toUpperCase();
            const batch = String(row.Batch || row.Batch_Name || row.Batch_No || "").trim().toUpperCase();

            const uniqueKey = `${invRef}___${stockItem}___${bag}___${batch}`;

            if (!uniqueItemMap.has(uniqueKey)) {
                // Ensure Cost_Center_Name is populated with Staff Name (from Cost_Center_Name, Cost_Center, or Godown_Name)
                const staff =
                    (row.Cost_Center_Name && row.Cost_Center_Name !== "-" ? row.Cost_Center_Name : "") ||
                    (row.Cost_Center && row.Cost_Center !== "-" ? row.Cost_Center : "") ||
                    (row.Staff_Name && row.Staff_Name !== "-" ? row.Staff_Name : "") ||
                    (row.Staff && row.Staff !== "-" ? row.Staff : "") ||
                    (row.Godown_Name && row.Godown_Name !== "-" && row.Godown_Name !== "Default" ? row.Godown_Name : "");

                uniqueItemMap.set(uniqueKey, {
                    ...row,
                    Item_Name_Modified: row.Item_Name_Modified || itemName || row.Stock_Item || row.Item_Name || "",
                    Cost_Center_Name: staff || row.Cost_Center_Name || "-"
                });
            } else {
                const existing = uniqueItemMap.get(uniqueKey);
                const newStaff =
                    (row.Cost_Center_Name && row.Cost_Center_Name !== "-" ? row.Cost_Center_Name : "") ||
                    (row.Cost_Center && row.Cost_Center !== "-" ? row.Cost_Center : "") ||
                    (row.Staff_Name && row.Staff_Name !== "-" ? row.Staff_Name : "") ||
                    (row.Godown_Name && row.Godown_Name !== "-" && row.Godown_Name !== "Default" ? row.Godown_Name : "");
                const oldStaff = existing.Cost_Center_Name;
                if (newStaff && oldStaff && oldStaff !== "-" && !String(oldStaff).includes(String(newStaff))) {
                    existing.Cost_Center_Name = `${oldStaff}, ${newStaff}`;
                }
            }
        });

        let deduplicatedItems = Array.from(uniqueItemMap.values());

        // 2. Filter by active columnFilters if any
        const activeFilterEntries = Object.entries(columnFilters).filter(
            ([, vals]) => Array.isArray(vals) && vals.length > 0
        );

        if (activeFilterEntries.length > 0) {
            deduplicatedItems = deduplicatedItems.filter(item => {
                return activeFilterEntries.every(([key, selectedVals]) => {
                    const itemVal = String(item[key] ?? "").trim();
                    return selectedVals!.includes(itemVal);
                });
            });
        }

        if (deduplicatedItems.length === 0) return [];

        // 3. Group items dynamically by active enabled columns
        const groupMap = new Map<string, any>();

        deduplicatedItems.forEach(item => {
            const compositeKey = enabledCols.length > 0
                ? enabledCols.map(c => `${c.key}:${String(item[c.key] ?? "-").trim()}`).join(":::")
                : "__ALL__";

            if (!groupMap.has(compositeKey)) {
                const entry: Record<string, any> = {
                    ...item,
                    Bill_Qty: 0,
                    Act_Qty: 0,
                    itemCount: 0,
                    invoices: new Set<string>()
                };

                // Ensure all enabled column values are explicitly captured
                enabledCols.forEach(c => {
                    entry[c.key] = item[c.key] ?? "-";
                });

                groupMap.set(compositeKey, entry);
            }

            const target = groupMap.get(compositeKey);
            const rowQty = Number(item.splitKgs ?? item.Bill_Qty ?? item.Kgs ?? item.Qty ?? 0) || 0;
            const rowActQty = Number(item.Act_Qty ?? item.Bill_Qty ?? item.Kgs ?? item.Qty ?? 0) || 0;
            target.Bill_Qty += rowQty;
            target.Act_Qty += rowActQty;
            target.itemCount += 1;
            if (item.Inv_No) {
                target.invoices.add(String(item.Inv_No).trim());
            }
        });

        const result = Array.from(groupMap.values()).map(entry => ({
            ...entry,
            invoiceCount: entry.invoices.size,
            splitKgs: qtyType === "Act_Qty" ? entry.Act_Qty : entry.Bill_Qty
        }));

        // Sort dynamically by enabled columns in their configured order
        result.sort((a, b) => {
            for (const col of enabledCols) {
                const valA = String(a[col.key] ?? "");
                const valB = String(b[col.key] ?? "");
                const cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: "base" });
                if (cmp !== 0) return cmp;
            }
            return 0;
        });

        return result;
    };

    // Build hierarchical Categories and Groups from 1st API
    const tableCategories = useMemo(() => {
        const catList: ("INWARDS" | "ADJUSTMENTS" | "OUTWARDS")[] = ["INWARDS", "ADJUSTMENTS", "OUTWARDS"];
        const categoryGroupsMap: Record<string, any[]> = {
            INWARDS: [],
            ADJUSTMENTS: [],
            OUTWARDS: []
        };

        const activeFilterEntries = Object.entries(columnFilters).filter(
            ([, vals]) => Array.isArray(vals) && vals.length > 0
        );
        const hasActiveFilters = activeFilterEntries.length > 0;

        // 1. Process configured groups
        groups.forEach(group => {
            const matchedRows = reportData.filter(row =>
                row.Group_Name === group.name &&
                normalizeCategory(row.Overall_GroupName) === group.parentCategory &&
                row.Voucher_Type &&
                (!linkedVoucherNames || linkedVoucherNames.has(String(row.Voucher_Type).trim().toUpperCase()))
            );
            if (matchedRows.length === 0) return;

            const voucherTypesData = matchedRows.map(r => {
                const totalTonnage = qtyType === "Act_Qty"
                    ? (r.Total_Act_Tonnage ?? r.Act_Total_Tonnage ?? r.Total_Act_Qty ?? r.Total_Tonnage ?? 0)
                    : (r.Total_Tonnage || 0);

                const vtId = r.Voucher_Type_Id || r.VoucherId || r.Vocher_Type_Id || voucherTypes.find((v: any) =>
                    String(v.label).trim().toUpperCase() === String(r.Voucher_Type).trim().toUpperCase() ||
                    String(v.Voucher_Type).trim().toUpperCase() === String(r.Voucher_Type).trim().toUpperCase()
                )?.Value;

                const vKey = `${group.parentCategory}_${group.name}_${r.Voucher_Type}`;
                let effectiveKgs = totalTonnage;
                let hasMatches = true;

                if (hasActiveFilters) {
                    const rawItems = itemData[vKey];
                    if (rawItems) {
                        const processed = processVoucherItems(rawItems, enabledItemColumns);
                        effectiveKgs = processed.reduce((sum, it) => sum + (Number(it.splitKgs) || 0), 0);
                        if (processed.length === 0) {
                            hasMatches = false;
                        }
                    }
                }

                return {
                    name: r.Voucher_Type,
                    voucherTypeId: vtId !== undefined && vtId !== null ? Number(vtId) : undefined,
                    baseKgs: effectiveKgs,
                    invoiceCount: r.Invoice_Count || 0,
                    itemCount: r.Item_Count || 0,
                    hasMatches
                };
            }).filter(vt => !hasActiveFilters || vt.hasMatches);

            if (voucherTypesData.length === 0) return;

            const groupKgsSum = voucherTypesData.reduce((sum, vt) => sum + vt.baseKgs, 0);

            const groupData = {
                groupName: group.name,
                groupKgs: groupKgsSum,
                voucherTypes: voucherTypesData
            };

            if (categoryGroupsMap[group.parentCategory]) {
                categoryGroupsMap[group.parentCategory].push(groupData);
            }
        });

        // 2. Process unassigned groups
        catList.forEach(cat => {
            const definedGroupNames = groups.filter(g => g.parentCategory === cat).map(g => g.name);

            const unassignedRows = reportData.filter(row =>
                normalizeCategory(row.Overall_GroupName) === cat &&
                row.Voucher_Type &&
                (row.Group_Name === null || row.Group_Name === undefined || !definedGroupNames.includes(row.Group_Name)) &&
                (!linkedVoucherNames || linkedVoucherNames.has(String(row.Voucher_Type).trim().toUpperCase()))
            );

            if (unassignedRows.length > 0) {
                const voucherTypesData = unassignedRows.map(r => {
                    const totalTonnage = qtyType === "Act_Qty"
                        ? (r.Total_Act_Tonnage ?? r.Act_Total_Tonnage ?? r.Total_Act_Qty ?? r.Total_Tonnage ?? 0)
                        : (r.Total_Tonnage || 0);

                    const vtId = r.Voucher_Type_Id || r.VoucherId || r.Vocher_Type_Id || voucherTypes.find((v: any) =>
                        String(v.label).trim().toUpperCase() === String(r.Voucher_Type).trim().toUpperCase() ||
                        String(v.Voucher_Type).trim().toUpperCase() === String(r.Voucher_Type).trim().toUpperCase()
                    )?.Value;

                    const vKey = `${cat}_UNASSIGNED_${r.Voucher_Type}`;
                    let effectiveKgs = totalTonnage;
                    let hasMatches = true;

                    if (hasActiveFilters) {
                        const rawItems = itemData[vKey];
                        if (rawItems) {
                            const processed = processVoucherItems(rawItems, enabledItemColumns);
                            effectiveKgs = processed.reduce((sum, it) => sum + (Number(it.splitKgs) || 0), 0);
                            if (processed.length === 0) {
                                hasMatches = false;
                            }
                        }
                    }

                    return {
                        name: r.Voucher_Type,
                        voucherTypeId: vtId !== undefined && vtId !== null ? Number(vtId) : undefined,
                        baseKgs: effectiveKgs,
                        invoiceCount: r.Invoice_Count || 0,
                        itemCount: r.Item_Count || 0,
                        hasMatches
                    };
                }).filter(vt => !hasActiveFilters || vt.hasMatches);

                if (voucherTypesData.length > 0) {
                    const groupKgsSum = voucherTypesData.reduce((sum, vt) => sum + vt.baseKgs, 0);
                    const unassignedGroupData = {
                        groupName: "UNASSIGNED",
                        groupKgs: groupKgsSum,
                        voucherTypes: voucherTypesData
                    };
                    categoryGroupsMap[cat].push(unassignedGroupData);
                }
            }
        });

        return catList.map(cat => ({
            name: cat,
            groups: categoryGroupsMap[cat],
            categoryKgs: categoryGroupsMap[cat].reduce((sum, g) => sum + g.groupKgs, 0)
        })).filter(cat => cat.groups.length > 0);
    }, [groups, reportData, voucherTypes, linkedVoucherNames, qtyType, columnFilters, itemData, enabledItemColumns]);

    // Grand Totals Calculation
    const grandTotals = useMemo(() => {
        let totalKgs = 0;
        tableCategories.forEach(cat => {
            totalKgs += cat.categoryKgs;
        });
        return { totalKgs };
    }, [tableCategories]);

    // Toggle expand voucher type & fetch 2nd API data on-demand
    const handleToggleExpandVoucher = async (parentCategory: string, groupName: string, voucherName: string, voucherTypeId?: number) => {
        const vKey = `${parentCategory}_${groupName}_${voucherName}`;
        const isExpanded = expandedVouchers.includes(vKey);

        if (!isExpanded) {
            setExpandedVouchers(prev => [...prev, vKey]);

            if (!itemData[vKey]) {
                setLoadingItems(prev => ({ ...prev, [vKey]: true }));
                try {
                    const matchedVoucher = voucherTypes.find((v: any) =>
                        String(v.label).trim().toUpperCase() === String(voucherName).trim().toUpperCase() ||
                        String(v.Voucher_Type).trim().toUpperCase() === String(voucherName).trim().toUpperCase() ||
                        String(v.Value) === String(voucherName)
                    );
                    const resolvedVoucherTypeId = voucherTypeId !== undefined && voucherTypeId !== null
                        ? Number(voucherTypeId)
                        : (matchedVoucher ? Number(matchedVoucher.Value) : undefined);

                    const res = await employeeReportGroupService.getEmployeeInvoicesWithItems({
                        Fromdate: fromDate,
                        Todate: toDate,
                        Overall_GroupName: parentCategory === "ADJUSTMENTS" ? "PROCESS" : parentCategory,
                        Group_Name: groupName,
                        Voucher_Type: resolvedVoucherTypeId !== undefined ? resolvedVoucherTypeId : voucherName
                    });

                    if (res.data?.success && res.data?.data) {
                        const rawItems = res.data.data;
                        setItemData(prev => ({
                            ...prev,
                            [vKey]: rawItems
                        }));
                        // Discover new dynamic columns from API response
                        setItemColumns(prev => discoverItemColumns(rawItems, prev));
                    } else {
                        setItemData(prev => ({ ...prev, [vKey]: [] }));
                    }
                } catch (err) {
                    console.error("Error loading voucher items:", err);
                    toast.error("Failed to load item split-up");
                } finally {
                    setLoadingItems(prev => ({ ...prev, [vKey]: false }));
                }
            }
        } else {
            setExpandedVouchers(prev => prev.filter(k => k !== vKey));
        }
    };

    // Fetch all missing 2nd API item data in batches of 4
    const fetchAllItemData = async () => {
        const allVKeys: { vKey: string; parentCategory: string; groupName: string; voucherName: string; voucherTypeId?: number }[] = [];
        tableCategories.forEach(cat => {
            cat.groups.forEach((g: any) => {
                g.voucherTypes.forEach((vt: any) => {
                    const vKey = `${cat.name}_${g.groupName}_${vt.name}`;
                    allVKeys.push({
                        vKey,
                        parentCategory: cat.name,
                        groupName: g.groupName,
                        voucherName: vt.name,
                        voucherTypeId: vt.voucherTypeId
                    });
                });
            });
        });

        const missing = allVKeys.filter(k => !itemData[k.vKey]);
        if (missing.length === 0) return allVKeys;

        const batchSize = 4;
        for (let i = 0; i < missing.length; i += batchSize) {
            const batch = missing.slice(i, i + batchSize);
            await Promise.all(
                batch.map(async (item) => {
                    setLoadingItems(prev => ({ ...prev, [item.vKey]: true }));
                    try {
                        const res = await employeeReportGroupService.getEmployeeInvoicesWithItems({
                            Fromdate: fromDate,
                            Todate: toDate,
                            Overall_GroupName: item.parentCategory === "ADJUSTMENTS" ? "PROCESS" : item.parentCategory,
                            Group_Name: item.groupName,
                            Voucher_Type: item.voucherTypeId !== undefined ? item.voucherTypeId : item.voucherName
                        });
                        if (res.data?.success && res.data?.data) {
                            setItemData(prev => ({ ...prev, [item.vKey]: res.data.data }));
                            setItemColumns(prev => discoverItemColumns(res.data.data, prev));
                        }
                    } catch (err) {
                        console.error(`Error loading items for ${item.vKey}:`, err);
                    } finally {
                        setLoadingItems(prev => ({ ...prev, [item.vKey]: false }));
                    }
                })
            );
        }
        return allVKeys;
    };

    // Auto-prefetch item data in background when report data arrives
    useEffect(() => {
        if (reportData.length > 0 && tableCategories.length > 0) {
            fetchAllItemData();
        }
    }, [reportData, tableCategories.length, fromDate, toDate]);

    // Header click handler for 2nd API columns
    const handleHeaderClick = (e: React.MouseEvent<HTMLElement>, key: string) => {
        setActiveHeader(key);
        setFilterAnchor(e.currentTarget);
        fetchAllItemData();
    };

    // Filter options for the active column header
    const filterOptions = useMemo(() => {
        if (!activeHeader) return [];
        const allItems = Object.values(itemData).flat();
        const vals = Array.from(
            new Set(
                allItems
                    .map(item => String(item[activeHeader] ?? "").trim())
                    .filter(Boolean)
            )
        );
        return vals.sort((a, b) => a.localeCompare(b));
    }, [activeHeader, itemData]);

    // When column filters are applied, auto-expand matching vouchers so items are immediately visible
    useEffect(() => {
        const activeFilters = Object.entries(columnFilters).filter(([, v]) => Array.isArray(v) && v.length > 0);
        if (activeFilters.length > 0) {
            const matchingKeys: string[] = [];
            tableCategories.forEach(cat => {
                cat.groups.forEach((g: any) => {
                    g.voucherTypes.forEach((vt: any) => {
                        const vKey = `${cat.name}_${g.groupName}_${vt.name}`;
                        matchingKeys.push(vKey);
                    });
                });
            });
            if (matchingKeys.length > 0) {
                setExpandedVouchers(matchingKeys);
            }
        }
    }, [columnFilters, tableCategories]);


    // Template Save Handler
    const handleQuickSave = async () => {
        try {
            if (!reportName.trim()) {
                toast.error("Enter Report Name");
                return;
            }

            const payloadColumns = itemColumns.map((c) => ({
                key: c.key,
                label: c.label,
                enabled: c.enabled,
                order: c.order,
                groupBy: 0,
                dataType: "string"
            }));

            if (selectedTemplateId) {
                await SettingsService.updateReport({
                    reportId: selectedTemplateId,
                    typeId: 1,
                    reportName: reportName.trim(),
                    columns: payloadColumns
                });
                await SettingsService.updateReport({
                    reportId: selectedTemplateId,
                    typeId: 2,
                    reportName: reportName.trim(),
                    columns: payloadColumns
                });
                toast.success("Template Updated Successfully ✅");
            } else {
                const userData = JSON.parse(localStorage.getItem("user") || "{}");
                const createdBy = userData?.id || 0;

                await SettingsService.saveReportSettings({
                    reportName,
                    parentReport: parentReportName,
                    abstractSP: "SP_Get_EmployeeReport_EmployeeInvoices_with_ITEM",
                    expandedSP: "SP_Get_EmployeeReport_EmployeeInvoices_with_ITEM",
                    abstractColumns: payloadColumns,
                    expandedColumns: payloadColumns,
                    createdBy
                });
                toast.success("Template Saved Successfully ✅");
            }
            setSaveDialogOpen(false);
            setTimeout(() => {
                window.location.reload();
            }, 300);
        } catch (err) {
            console.error(err);
            toast.error("Failed to save template ❌");
        }
    };

    // Template Load Handler
    const handleLoadTemplate = async (templateId: number) => {
        try {
            setSelectedTemplateId(templateId);
            setExpandedVouchers([]);
            const res = await SettingsService.getReportEditData({ reportId: templateId, typeId: 1 });

            const data = res?.data?.data || {};
            if (res.data.success && data.reportInfo) {
                setReportName(data.reportInfo.Report_Name || "");
            }

            const templateCols = Array.isArray(data.abstractColumns)
                ? data.abstractColumns
                : Array.isArray(data.columns)
                    ? data.columns
                    : [];

            const parsedTemplateCols: ColumnConfig[] = templateCols
                .filter((matched: any) => {
                    const key = matched.key || matched.Key || matched.Column_Name || matched.ColumnName || "";
                    return key && !EXCLUDED_ITEM_KEYS.has(key);
                })
                .map((matched: any, idx: number) => {
                    const key = matched.key || matched.Key || matched.Column_Name || matched.ColumnName || "";
                    const label = matched.label || matched.Label || matched.Alias_Name || key;
                    const enabled = matched.enabled ?? matched.Enabled ?? false;
                    const order = matched.order ?? matched.Order ?? idx;

                    return {
                        key,
                        label,
                        enabled,
                        order
                    };
                });

            // Merge with existing discovered columns
            const updatedCols = [...parsedTemplateCols];
            itemColumns.forEach(col => {
                if (EXCLUDED_ITEM_KEYS.has(col.key)) return;
                const exists = updatedCols.some(c => c.key.toUpperCase() === col.key.toUpperCase());
                if (!exists) {
                    updatedCols.push({
                        ...col,
                        enabled: false,
                        order: updatedCols.length
                    });
                }
            });

            updatedCols.sort((a, b) => a.order - b.order);
            setItemColumns(updatedCols.map((c, index) => ({ ...c, order: index })));
            if (data.filters?.columnFilters) {
                setColumnFilters(data.filters.columnFilters);
            }

            toast.success("Template Loaded Successfully ✅");
        } catch (err) {
            console.error(err);
            toast.error("Failed to load template ❌");
        }
    };

    // Reset Template
    const handleClearTemplate = () => {
        setSelectedTemplateId(null);
        setReportName("");
        setSelectedGodownIds([]);
        setTempSelectedGodownIds([]);
        setColumnFilters({});
        setItemColumns(DEFAULT_ITEM_COLUMNS);
        setExpandedVouchers([]);
    };

    // Excel Export: Summary
    const handleSummaryExportExcel = () => {
        const rows: any[] = [];
        tableCategories.forEach(cat => {
            cat.groups.forEach((g: any) => {
                g.voucherTypes.forEach((vt: any) => {
                    rows.push({
                        Category: cat.name,
                        Group: g.groupName,
                        "Group Kgs": g.groupKgs,
                        "Voucher Type": vt.name,
                        "Voucher Kgs": vt.baseKgs
                    });
                });
            });
        });

        // Add Grand Total
        rows.push({
            Category: "Total",
            Group: "",
            "Group Kgs": "",
            "Voucher Type": "Grand Total",
            "Voucher Kgs": grandTotals.totalKgs
        });

        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Summary");
        XLSX.writeFile(workbook, `Group_Wise_Item_Summary_${fromDate}_to_${toDate}.xlsx`);
    };

    // Excel Export: Detailed with Item Split-up
    const handleDetailedExportExcel = async () => {
        toast.info("Preparing detailed item export...");
        // Ensure all item data is fetched without modifying UI expanded rows
        await fetchAllItemData();

        const rows: any[] = [];
        tableCategories.forEach(cat => {
            cat.groups.forEach((g: any) => {
                g.voucherTypes.forEach((vt: any) => {
                    const vKey = `${cat.name}_${g.groupName}_${vt.name}`;
                    const rawItems = itemData[vKey] || [];
                    const processed = processVoucherItems(rawItems, enabledItemColumns);

                    if (processed.length > 0) {
                        processed.forEach(item => {
                            const rowObj: Record<string, any> = {
                                Category: cat.name,
                                Group: g.groupName,
                                "Voucher Type": vt.name
                            };
                            enabledItemColumns.forEach(col => {
                                rowObj[col.label] = item[col.key] ?? "-";
                            });
                            rowObj["Split Kgs"] = item.splitKgs;
                            rows.push(rowObj);
                        });
                    } else {
                        const rowObj: Record<string, any> = {
                            Category: cat.name,
                            Group: g.groupName,
                            "Voucher Type": vt.name
                        };
                        enabledItemColumns.forEach(col => {
                            rowObj[col.label] = "-";
                        });
                        rowObj["Split Kgs"] = vt.baseKgs;
                        rows.push(rowObj);
                    }
                });
            });
        });

        // Total
        const totalObj: Record<string, any> = {
            Category: "Total",
            Group: "",
            "Voucher Type": "Grand Total"
        };
        enabledItemColumns.forEach(col => {
            totalObj[col.label] = "";
        });
        totalObj["Split Kgs"] = grandTotals.totalKgs;
        rows.push(totalObj);

        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Item Split-up");
        XLSX.writeFile(workbook, `Group_Wise_Item_Detailed_${fromDate}_to_${toDate}.xlsx`);
    };

    // PDF Export: Summary
    const handleSummaryExportPDF = () => {
        const doc = new jsPDF("l", "pt", "a4");
        doc.setFontSize(14);
        doc.text(`Group Wise Item Report (${fromDate} to ${toDate}) - Summary`, 40, 30);

        const tableBody: any[] = [];
        tableCategories.forEach(cat => {
            cat.groups.forEach((g: any) => {
                g.voucherTypes.forEach((vt: any) => {
                    tableBody.push([
                        cat.name,
                        g.groupName,
                        g.groupKgs.toLocaleString(),
                        vt.name,
                        vt.baseKgs.toLocaleString()
                    ]);
                });
            });
        });

        tableBody.push([
            "Total",
            "",
            "",
            "Grand Total",
            grandTotals.totalKgs.toLocaleString()
        ]);

        autoTable(doc, {
            head: [["Category", "Group", "Group Kgs", "Voucher Type", "Voucher Kgs"]],
            body: tableBody,
            startY: 45,
            theme: "grid",
            styles: { fontSize: 8 },
            headStyles: { fillColor: [30, 58, 138], textColor: 255 }
        });

        doc.save(`Group_Wise_Item_Summary_${fromDate}_to_${toDate}.pdf`);
    };

    // PDF Export: Detailed
    const handleDetailedExportPDF = async () => {
        toast.info("Preparing detailed item PDF...");
        // Ensure all item data is fetched without modifying UI expanded rows
        await fetchAllItemData();

        const doc = new jsPDF("l", "pt", "a4");
        doc.setFontSize(14);
        doc.text(`Group Wise Item Report (${fromDate} to ${toDate}) - Detailed Items`, 40, 30);

        const headCols = ["Category", "Group", "Voucher Type", ...enabledItemColumns.map(c => c.label), "Split Kgs"];
        const tableBody: any[] = [];

        tableCategories.forEach(cat => {
            cat.groups.forEach((g: any) => {
                g.voucherTypes.forEach((vt: any) => {
                    const vKey = `${cat.name}_${g.groupName}_${vt.name}`;
                    const rawItems = itemData[vKey] || [];
                    const processed = processVoucherItems(rawItems, enabledItemColumns);

                    if (processed.length > 0) {
                        processed.forEach(item => {
                            const row = [
                                cat.name,
                                g.groupName,
                                vt.name,
                                ...enabledItemColumns.map(col => String(item[col.key] ?? "-")),
                                item.splitKgs.toLocaleString()
                            ];
                            tableBody.push(row);
                        });
                    } else {
                        const row = [
                            cat.name,
                            g.groupName,
                            vt.name,
                            ...enabledItemColumns.map(() => "-"),
                            vt.baseKgs.toLocaleString()
                        ];
                        tableBody.push(row);
                    }
                });
            });
        });

        tableBody.push([
            "Total",
            "",
            "Grand Total",
            ...enabledItemColumns.map(() => ""),
            grandTotals.totalKgs.toLocaleString()
        ]);

        autoTable(doc, {
            head: [headCols],
            body: tableBody,
            startY: 45,
            theme: "grid",
            styles: { fontSize: 7 },
            headStyles: { fillColor: [30, 58, 138], textColor: 255 }
        });

        doc.save(`Group_Wise_Item_Detailed_${fromDate}_to_${toDate}.pdf`);
    };

    // Styling constants
    const headerCellHeight = 38;
    const headerCellSx = {
        color: "#ffffff",
        fontWeight: 700,
        height: headerCellHeight,
        maxHeight: headerCellHeight,
        minHeight: headerCellHeight,
        lineHeight: "38px",
        py: 0,
        borderRight: "1px solid #2448b2",
        whiteSpace: "nowrap" as const,
        fontSize: "0.8rem",
        bgcolor: "#1E3A8A",
        position: "sticky" as const,
        top: 0,
        zIndex: 4
    };

    const totalCellSx = {
        fontWeight: 800,
        color: "#1e3a8a",
        fontSize: "0.825rem",
        py: 0.8,
        bgcolor: "#bfdbfe",
        borderRight: "1px solid #93c5fd",
        borderBottom: "none",
        whiteSpace: "nowrap" as const,
        position: "sticky" as const,
        top: headerCellHeight,
        zIndex: 3
    };

    return (
        <Box sx={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", overflow: "hidden" }}>
            <PageHeader
                parentReportName={parentReportName}
                onExportExcel={() => {
                    setExportType("excel");
                    setExportModalOpen(true);
                }}
                onExportPDF={() => {
                    setExportType("pdf");
                    setExportModalOpen(true);
                }}
                onReportChange={(template) => {
                    if (!template || !template.Report_Id) {
                        handleClearTemplate();
                    } else {
                        setSelectedTemplateId(template.Report_Id);
                        setReportName(template.Report_Name || "");
                        handleLoadTemplate(template.Report_Id);
                    }
                }}
                onQuickSave={() => {
                    if (!selectedTemplateId) {
                        setReportName("");
                    }
                    setSaveDialogOpen(true);
                }}
                settingsSlot={
                    <Tooltip title="Column Settings">
                        <IconButton
                            size="small"
                            onClick={(e) => setSettingsAnchor(e.currentTarget)}
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
                }
            />

            <ReportFilterDrawer
                open={drawerOpen}
                onToggle={() => setDrawerOpen((prev) => !prev)}
                onClose={() => setDrawerOpen(false)}
                fromDate={tempFromDate}
                onFromDateChange={setTempFromDate}
                toDate={tempToDate}
                onToDateChange={setTempToDate}
                dropdownLabel="Godown"
                dropdownMultiple={true}
                dropdownValue={tempSelectedGodownIds}
                dropdownOptions={godownDropdownOptions}
                onDropdownChange={(val) => {
                    const ids = Array.isArray(val) ? val.map(Number) : [];
                    setTempSelectedGodownIds(ids);
                }}
                onApply={() => {
                    setFromDate(tempFromDate);
                    setToDate(tempToDate);
                    setSelectedGodownIds(tempSelectedGodownIds);
                    setDrawerOpen(false);
                }}
            >
                {/* Qty / Act Qty Selection */}
                <FormControl sx={{ mb: 2, display: "block" }}>
                    <FormLabel sx={{ fontWeight: 600, color: "#1E3A8A", fontSize: "0.875rem", display: "block", mb: 0.5 }}>
                        Quantity Type
                    </FormLabel>
                    <RadioGroup
                        value={qtyType}
                        onChange={(e) => handleQtyTypeChange(e.target.value as "Qty" | "Act_Qty")}
                    >
                        <FormControlLabel
                            value="Qty"
                            control={<Radio size="small" sx={{ color: "#1E3A8A", "&.Mui-checked": { color: "#1E3A8A" } }} />}
                            label={<Typography sx={{ fontSize: "0.825rem" }}>Qty</Typography>}
                        />
                        <FormControlLabel
                            value="Act_Qty"
                            control={<Radio size="small" sx={{ color: "#1E3A8A", "&.Mui-checked": { color: "#1E3A8A" } }} />}
                            label={<Typography sx={{ fontSize: "0.825rem" }}>Act Qty</Typography>}
                        />
                    </RadioGroup>
                </FormControl>
            </ReportFilterDrawer>

            <Box px={2} pb={1} pt={1} sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {/* Active Godown & Column Filter Chips */}
                {(selectedGodownIds.length > 0 || Object.entries(columnFilters).some(([, v]) => Array.isArray(v) && v.length > 0)) && (
                    <Box display="flex" alignItems="center" flexWrap="wrap" gap={1} mb={1}>
                        {selectedGodownIds.length > 0 && (
                            <>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: "#475569", fontSize: "0.75rem" }}>
                                    Godowns:
                                </Typography>
                                {selectedGodownIds.map((gid) => {
                                    const matched = godowns.find((g) => Number(g.Godown_Id) === gid);
                                    return (
                                        <Chip
                                            key={gid}
                                            label={matched?.Godown_Name || gid}
                                            size="small"
                                            onDelete={() => {
                                                setSelectedGodownIds(prev => prev.filter(id => id !== gid));
                                                setTempSelectedGodownIds(prev => prev.filter(id => id !== gid));
                                            }}
                                            sx={{
                                                bgcolor: "#e2e8f0",
                                                fontWeight: 600,
                                                fontSize: "0.75rem",
                                                color: "#334155"
                                            }}
                                        />
                                    );
                                })}
                            </>
                        )}

                        {Object.entries(columnFilters).map(([key, vals]) => {
                            if (!Array.isArray(vals) || vals.length === 0) return null;
                            const colLabel = itemColumns.find(c => c.key === key)?.label || key;
                            const chipText = vals.length <= 2
                                ? `${colLabel}: ${vals.join(", ")}`
                                : `${colLabel}: ${vals.length} selected`;
                            return (
                                <Chip
                                    key={key}
                                    label={chipText}
                                    size="small"
                                    onDelete={() => {
                                        setColumnFilters(prev => {
                                            const copy = { ...prev };
                                            delete copy[key];
                                            return copy;
                                        });
                                    }}
                                    sx={{
                                        bgcolor: "#e0f2fe",
                                        fontWeight: 600,
                                        fontSize: "0.75rem",
                                        color: "#0369a1"
                                    }}
                                />
                            );
                        })}

                        <Chip
                            label="Clear All Filters"
                            size="small"
                            onClick={() => {
                                setSelectedGodownIds([]);
                                setTempSelectedGodownIds([]);
                                setColumnFilters({});
                            }}
                            sx={{
                                bgcolor: "#fee2e2",
                                fontWeight: 600,
                                fontSize: "0.75rem",
                                color: "#ef4444",
                                cursor: "pointer",
                                "&:hover": { bgcolor: "#fecaca" }
                            }}
                        />
                    </Box>
                )}

                {/* Main Table */}
                {loading ? (
                    <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="60vh" gap={2}>
                        <CircularProgress size={40} />
                        <Typography variant="body1" color="text.secondary" fontWeight={500}>
                            Loading report data...
                        </Typography>
                    </Box>
                ) : (
                    <TableContainer component={Paper} elevation={1} sx={{ flex: 1, minHeight: 0, borderRadius: 2, border: "1px solid #cbd5e1", overflow: "auto" }}>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow sx={{ bgcolor: "#1E3A8A" }}>
                                    <TableCell sx={headerCellSx} align="center">
                                        Category
                                    </TableCell>
                                    <TableCell sx={headerCellSx} align="center">
                                        Groups
                                    </TableCell>
                                    <TableCell sx={headerCellSx} align="center">
                                        Group Kgs
                                    </TableCell>
                                    <TableCell sx={headerCellSx}>
                                        Voucher Type
                                    </TableCell>
                                    <TableCell sx={headerCellSx} align="center">
                                        Voucher Kgs
                                    </TableCell>
                                    {enabledItemColumns.map(col => {
                                        return (
                                            <TableCell
                                                key={col.key}
                                                sx={{
                                                    ...headerCellSx,
                                                    cursor: "pointer",
                                                    userSelect: "none",
                                                    "&:hover": { bgcolor: "#2448b2" }
                                                }}
                                                align={col.key === "Brokerage" || col.key === "Coolie" ? "center" : "left"}
                                                onClick={(e) => handleHeaderClick(e, col.key)}
                                            >
                                                <Box display="flex" alignItems="center" justifyContent="space-between" gap={0.5}>
                                                    <span>{col.label}</span>
                                                </Box>
                                            </TableCell>
                                        );
                                    })}
                                    <TableCell sx={{ ...headerCellSx, borderRight: "none" }} align="center">
                                        Split Kgs
                                    </TableCell>
                                </TableRow>

                                {/* Grand Total Row */}
                                <TableRow sx={{ bgcolor: "#bfdbfe" }}>
                                    <TableCell colSpan={2} sx={totalCellSx} align="center">
                                        Total
                                    </TableCell>
                                    <TableCell sx={totalCellSx} align="center">
                                        {grandTotals.totalKgs.toLocaleString()}
                                    </TableCell>
                                    <TableCell sx={totalCellSx}>
                                        Grand Total
                                    </TableCell>
                                    <TableCell sx={totalCellSx} align="center">
                                        {grandTotals.totalKgs.toLocaleString()}
                                    </TableCell>
                                    {enabledItemColumns.map(col => (
                                        <TableCell key={col.key} sx={totalCellSx} />
                                    ))}
                                    <TableCell sx={{ ...totalCellSx, borderRight: "none" }} align="center">
                                        {grandTotals.totalKgs.toLocaleString()}
                                    </TableCell>
                                </TableRow>
                            </TableHead>

                            <TableBody>
                                {tableCategories.length > 0 ? (
                                    tableCategories.map((category) => {
                                        // Calculate total spans for category including expanded items
                                        let categorySpan = 0;
                                        category.groups.forEach((group: any) => {
                                            group.voucherTypes.forEach((vt: any) => {
                                                categorySpan += 1;
                                                const vKey = `${category.name}_${group.groupName}_${vt.name}`;
                                                if (expandedVouchers.includes(vKey)) {
                                                    const rawItems = itemData[vKey] || [];
                                                    const processed = processVoucherItems(rawItems, enabledItemColumns);
                                                    categorySpan += (processed.length > 0 ? processed.length : (loadingItems[vKey] ? 1 : 1));
                                                }
                                            });
                                        });

                                        let isFirstCategoryRow = true;

                                        return category.groups.map((group: any) => {
                                            let groupSpan = 0;
                                            group.voucherTypes.forEach((vt: any) => {
                                                groupSpan += 1;
                                                const vKey = `${category.name}_${group.groupName}_${vt.name}`;
                                                if (expandedVouchers.includes(vKey)) {
                                                    const rawItems = itemData[vKey] || [];
                                                    const processed = processVoucherItems(rawItems, enabledItemColumns);
                                                    groupSpan += (processed.length > 0 ? processed.length : (loadingItems[vKey] ? 1 : 1));
                                                }
                                            });

                                            let isFirstGroupRow = true;

                                            return group.voucherTypes.map((vt: any) => {
                                                const vKey = `${category.name}_${group.groupName}_${vt.name}`;
                                                const isExpanded = expandedVouchers.includes(vKey);
                                                const isLoadingItemData = loadingItems[vKey];
                                                const rawItems = itemData[vKey] || [];
                                                const processedItems = processVoucherItems(rawItems, enabledItemColumns);

                                                const mainRow = (
                                                    <TableRow key={vt.name} sx={{ bgcolor: "#f8fafc", "&:hover": { bgcolor: "#f1f5f9" } }}>
                                                        {isFirstCategoryRow && (
                                                            <TableCell
                                                                rowSpan={categorySpan}
                                                                sx={{
                                                                    fontWeight: 800,
                                                                    bgcolor: "#e0f2fe",
                                                                    color: "#0369a1",
                                                                    borderRight: "2px solid #7dd3fc",
                                                                    borderBottom: "2px solid #7dd3fc",
                                                                    verticalAlign: "middle",
                                                                    fontSize: "0.85rem"
                                                                }}
                                                                align="center"
                                                            >
                                                                <Typography variant="body2" fontWeight={800} mb={0.5}>
                                                                    {category.name}
                                                                </Typography>
                                                                <Typography variant="caption" fontWeight={800} color="#0369a1">
                                                                    {category.categoryKgs.toLocaleString()}
                                                                </Typography>
                                                            </TableCell>
                                                        )}

                                                        {isFirstGroupRow && (
                                                            <TableCell
                                                                rowSpan={groupSpan}
                                                                sx={{
                                                                    fontWeight: 750,
                                                                    bgcolor: "#f0f9ff",
                                                                    color: "#0c4a6e",
                                                                    borderRight: "2px solid #bae6fd",
                                                                    borderBottom: "2px solid #bae6fd",
                                                                    verticalAlign: "middle",
                                                                    fontSize: "0.825rem"
                                                                }}
                                                                align="center"
                                                            >
                                                                {group.groupName}
                                                            </TableCell>
                                                        )}

                                                        {isFirstGroupRow && (
                                                            <TableCell
                                                                rowSpan={groupSpan}
                                                                sx={{
                                                                    fontWeight: 750,
                                                                    bgcolor: "#f0f9ff",
                                                                    color: "#0c4a6e",
                                                                    borderRight: "2px solid #bae6fd",
                                                                    borderBottom: "2px solid #bae6fd",
                                                                    verticalAlign: "middle",
                                                                    fontSize: "0.825rem"
                                                                }}
                                                                align="center"
                                                            >
                                                                {group.groupKgs.toLocaleString()}
                                                            </TableCell>
                                                        )}

                                                        {/* Voucher Type Column with expansion click */}
                                                        <TableCell
                                                            sx={{
                                                                fontWeight: 700,
                                                                borderRight: "1px solid #cbd5e1",
                                                                color: "#334155",
                                                                cursor: "pointer",
                                                                "&:hover": { color: "#1e3a8a", bgcolor: "#f1f5f9" },
                                                                fontSize: "0.825rem",
                                                                py: 0.8
                                                            }}
                                                            onClick={() => handleToggleExpandVoucher(category.name, group.groupName, vt.name, vt.voucherTypeId)}
                                                        >
                                                            <Box display="flex" alignItems="center" gap={0.5}>
                                                                {isExpanded ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
                                                                <span>{vt.name}</span>
                                                            </Box>
                                                        </TableCell>

                                                        {/* Voucher Kgs */}
                                                        <TableCell sx={{ fontWeight: 700, borderRight: "1px solid #cbd5e1", fontSize: "0.825rem", py: 0.8 }} align="center">
                                                            {vt.baseKgs.toLocaleString()}
                                                        </TableCell>

                                                        {/* Placeholder cells for item columns in the main voucher summary row */}
                                                        {enabledItemColumns.map(col => (
                                                            <TableCell key={col.key} sx={{ color: "#94a3b8", fontStyle: "italic", borderRight: "1px solid #cbd5e1", py: 0.8 }} align="center">
                                                                -
                                                            </TableCell>
                                                        ))}

                                                        <TableCell sx={{ fontWeight: 700, color: "#64748b", borderRight: "none", py: 0.8 }} align="center">
                                                            {vt.baseKgs.toLocaleString()}
                                                        </TableCell>
                                                    </TableRow>
                                                );

                                                isFirstCategoryRow = false;
                                                isFirstGroupRow = false;

                                                // Expanded Item Rows
                                                const itemRows = isExpanded ? (
                                                    isLoadingItemData ? (
                                                        <TableRow key={`${vKey}_loading`}>
                                                            <TableCell colSpan={enabledItemColumns.length + 3} sx={{ py: 1.5, textAlign: "center", bgcolor: "#fafafa" }}>
                                                                <Box display="flex" alignItems="center" justifyContent="center" gap={1}>
                                                                    <CircularProgress size={18} />
                                                                    <Typography variant="body2" color="text.secondary" fontSize="0.775rem">
                                                                        Loading items for {vt.name}...
                                                                    </Typography>
                                                                </Box>
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : processedItems.length > 0 ? (
                                                        processedItems.map((item: any, itemIdx: number) => (
                                                            <TableRow
                                                                key={`${vKey}_item_${itemIdx}`}
                                                                sx={{
                                                                    bgcolor: itemIdx % 2 === 0 ? "#ffffff" : "#fdfdfe",
                                                                    "&:hover": { bgcolor: "#f8fafc" },
                                                                    borderBottom: "1px solid #e2e8f0"
                                                                }}
                                                            >
                                                                <TableCell sx={{ borderRight: "1px solid #cbd5e1", py: 0.5 }} />
                                                                <TableCell sx={{ borderRight: "1px solid #cbd5e1", py: 0.5 }} />

                                                                {/* Render all enabled item columns */}
                                                                {enabledItemColumns.map((col) => {
                                                                    const val = item[col.key];
                                                                    const isNumeric = col.key === "Brokerage" || col.key === "Coolie";

                                                                    if (col.key === "Inv_No") {
                                                                        const hasInv = val !== undefined && val !== null && val !== "" && String(val).trim() !== "-";
                                                                        return (
                                                                            <TableCell
                                                                                key={col.key}
                                                                                sx={{
                                                                                    color: hasInv ? "#1d4ed8" : "#94a3b8",
                                                                                    fontWeight: 600,
                                                                                    borderRight: "1px solid #cbd5e1",
                                                                                    py: 0.5,
                                                                                    fontSize: "0.775rem",
                                                                                    cursor: hasInv ? "pointer" : "default"
                                                                                }}
                                                                                align="left"
                                                                            >
                                                                                {hasInv ? (
                                                                                    <Tooltip title="Click to view invoice details" arrow>
                                                                                        <Box
                                                                                            component="span"
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                handleOpenInvoiceModal(
                                                                                                    String(val).trim(),
                                                                                                    vKey,
                                                                                                    category.name,
                                                                                                    group.groupName,
                                                                                                    vt.name,
                                                                                                    item
                                                                                                );
                                                                                            }}
                                                                                            sx={{
                                                                                                color: "#1d4ed8",
                                                                                                textDecoration: "underline",
                                                                                                textUnderlineOffset: "2px",
                                                                                                fontWeight: 600,
                                                                                                display: "inline-block",
                                                                                                transition: "all 0.15s ease",
                                                                                                "&:hover": {
                                                                                                    color: "#2563eb",
                                                                                                    fontWeight: 700
                                                                                                }
                                                                                            }}
                                                                                        >
                                                                                            {String(val)}
                                                                                        </Box>
                                                                                    </Tooltip>
                                                                                ) : (
                                                                                    "-"
                                                                                )}
                                                                            </TableCell>
                                                                        );
                                                                    }

                                                                    return (
                                                                        <TableCell
                                                                            key={col.key}
                                                                            sx={{
                                                                                color: col.key === "Item_Name_Modified" ? "#1e3a8a" : "#334155",
                                                                                fontWeight: col.key === "Item_Name_Modified" || col.key === "Brand" || col.key === "Stock_Group" ? 600 : 400,
                                                                                borderRight: "1px solid #cbd5e1",
                                                                                py: 0.5,
                                                                                fontSize: "0.775rem",
                                                                                pl: col.key === "Brand" ? 3 : (isNumeric ? 1 : 2)
                                                                            }}
                                                                            align={isNumeric ? "center" : "left"}
                                                                        >
                                                                            {val !== undefined && val !== null && val !== "" ? String(val) : "-"}
                                                                        </TableCell>
                                                                    );
                                                                })}

                                                                {/* Split Kgs cell */}
                                                                <TableCell
                                                                    sx={{
                                                                        fontWeight: 700,
                                                                        color: "#0f766e",
                                                                        bgcolor: "#f0fdfa",
                                                                        borderRight: "none",
                                                                        py: 0.5,
                                                                        fontSize: "0.8rem"
                                                                    }}
                                                                    align="center"
                                                                >
                                                                    {item.splitKgs.toLocaleString()}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))
                                                    ) : (
                                                        <TableRow key={`${vKey}_no_data`}>
                                                            <TableCell colSpan={enabledItemColumns.length + 3} sx={{ py: 1, textAlign: "center", bgcolor: "#fbfbfe", color: "text.secondary", fontSize: "0.75rem", fontStyle: "italic" }}>
                                                                No individual item records found for {vt.name}
                                                            </TableCell>
                                                        </TableRow>
                                                    )
                                                ) : null;

                                                return (
                                                    <React.Fragment key={vt.name}>
                                                        {mainRow}
                                                        {itemRows}
                                                    </React.Fragment>
                                                );
                                            });
                                        });
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={enabledItemColumns.length + 6} align="center" sx={{ py: 4 }}>
                                            <Typography variant="body2" color="text.secondary">
                                                No group data found for the selected dates and filters.
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Box>

            {/* ******* COLUMN SETTINGS MENU ******* */}
            <Menu
                anchorEl={settingsAnchor}
                open={Boolean(settingsAnchor)}
                onClose={() => setSettingsAnchor(null)}
                PaperProps={{
                    sx: {
                        width: 320,
                        maxHeight: 480,
                        px: 2,
                        py: 1.5,
                        boxShadow: "0px 4px 20px rgba(0, 0, 0, 0.1)",
                        borderRadius: 2
                    }
                }}
            >
                <Box sx={{ maxHeight: 420, overflowY: "auto" }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1} pb={0.5} borderBottom="1px solid #e2e8f0">
                        <Typography variant="subtitle2" fontWeight={700} color="#1E3A8A">
                            Column Settings
                        </Typography>
                        <Button
                            size="small"
                            variant="text"
                            onClick={() => {
                                setItemColumns(DEFAULT_ITEM_COLUMNS);
                                setColumnFilters({});
                            }}
                            sx={{ textTransform: "none", fontWeight: 600, minWidth: 0, p: 0, color: "#1E3A8A" }}
                        >
                            Reset
                        </Button>
                    </Box>

                    <Typography variant="caption" fontWeight="bold" color="textSecondary" display="block" mb={1}>
                        Enabled Columns
                    </Typography>

                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext
                            items={itemColumns.filter(c => c.enabled).sort((a, b) => a.order - b.order).map(c => c.key)}
                            strategy={verticalListSortingStrategy}
                        >
                            {itemColumns
                                .filter(c => c.enabled)
                                .sort((a, b) => a.order - b.order)
                                .map(col => (
                                    <SortableColumnRow
                                        key={col.key}
                                        column={col}
                                        onToggle={handleToggleColumn}
                                        hasActiveFilter={columnFilters[col.key] !== undefined && (columnFilters[col.key]?.length ?? 0) > 0}
                                    />
                                ))}
                        </SortableContext>
                    </DndContext>

                    <Box mt={2}>
                        <Typography variant="caption" fontWeight="bold" color="textSecondary" display="block" mb={1}>
                            Disabled Columns
                        </Typography>

                        {itemColumns
                            .filter(c => !c.enabled)
                            .map(col => (
                                <Box
                                    key={col.key}
                                    display="flex"
                                    justifyContent="space-between"
                                    alignItems="center"
                                    py={0.5}
                                    pl={1}
                                >
                                    <Box display="flex" alignItems="center" gap={1}>
                                        <Typography fontSize="0.75rem">{col.label}</Typography>
                                        {columnFilters[col.key] !== undefined && (columnFilters[col.key]?.length ?? 0) > 0 && (
                                            <Tooltip title="Header filter enabled">
                                                <FilterAltIcon fontSize="small" color="primary" sx={{ fontSize: "0.85rem" }} />
                                            </Tooltip>
                                        )}
                                    </Box>

                                    <Switch
                                        size="medium"
                                        checked={col.enabled}
                                        onChange={() => handleToggleColumn(col.key)}
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
                    </Box>
                </Box>
            </Menu>

            {/* ******* TEMPLATE SAVE DIALOG ******* */}
            <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ color: "#1E3A8A", fontWeight: "bold" }}>
                    {selectedTemplateId ? "Update Template" : "Save as Template"}
                </DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Template Name"
                        fullWidth
                        size="small"
                        value={reportName}
                        onChange={(e) => setReportName(e.target.value)}
                        sx={{ mt: 1 }}
                    />
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setSaveDialogOpen(false)} color="warning" sx={{ textTransform: "none" }}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleQuickSave}
                        variant="contained"
                        sx={{
                            bgcolor: "#1E3A8A",
                            textTransform: "none",
                            fontWeight: 600,
                            "&:hover": { bgcolor: "#152a66" }
                        }}
                    >
                        Save
                    </Button>
                </DialogActions>
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
                <DialogTitle sx={{ m: 0, p: 2, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9" }}>
                    <Typography variant="h6" fontWeight="bold" color="#1e3a8a">
                        Export Report
                    </Typography>
                    <IconButton onClick={() => setExportModalOpen(false)} size="small">
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>

                <DialogContent sx={{ p: 3, pt: 3 }}>
                    <Typography variant="body2" color="text.secondary" mb={3}>
                        Select how you would like to export your Group Wise Item report.
                    </Typography>

                    <Box display="flex" flexDirection="column" gap={2}>
                        {/* Option 1: Summary */}
                        <Box
                            onClick={() => setExportDetails(false)}
                            sx={{
                                border: `2px solid ${!exportDetails ? "#3b82f6" : "#e2e8f0"}`,
                                borderRadius: "12px",
                                p: 2,
                                cursor: "pointer",
                                bgcolor: !exportDetails ? "#eff6ff" : "transparent",
                                transition: "all 0.2s",
                                "&:hover": {
                                    borderColor: "#3b82f6",
                                    bgcolor: "#f8fafc"
                                }
                            }}
                        >
                            <Typography variant="subtitle1" fontWeight="bold" color={!exportDetails ? "#1e40af" : "#1e293b"}>
                                Summary Report
                            </Typography>
                            <Typography variant="body2" color="text.secondary" mt={0.5}>
                                Exports Category, Group, and Voucher Type overview summary with totals.
                            </Typography>
                        </Box>

                        {/* Option 2: Detailed */}
                        <Box
                            onClick={() => setExportDetails(true)}
                            sx={{
                                border: `2px solid ${exportDetails ? "#3b82f6" : "#e2e8f0"}`,
                                borderRadius: "12px",
                                p: 2,
                                cursor: "pointer",
                                bgcolor: exportDetails ? "#eff6ff" : "transparent",
                                transition: "all 0.2s",
                                "&:hover": {
                                    borderColor: "#3b82f6",
                                    bgcolor: "#f8fafc"
                                }
                            }}
                        >
                            <Typography variant="subtitle1" fontWeight="bold" color={exportDetails ? "#1e40af" : "#1e293b"}>
                                Detailed Report
                            </Typography>
                            <Typography variant="body2" color="text.secondary" mt={0.5}>
                                Includes Brand, Item Name, and individual item split-up Kgs breakdown.
                            </Typography>
                        </Box>
                    </Box>

                    <Box display="flex" justifyContent="flex-end" gap={1.5} mt={4}>
                        <Button
                            onClick={() => setExportModalOpen(false)}
                            sx={{
                                color: "#64748b",
                                textTransform: "none",
                                fontWeight: "semibold",
                                borderRadius: "8px"
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            onClick={() => {
                                setExportModalOpen(false);
                                if (exportType === "excel") {
                                    if (exportDetails) {
                                        handleDetailedExportExcel();
                                    } else {
                                        handleSummaryExportExcel();
                                    }
                                } else if (exportType === "pdf") {
                                    if (exportDetails) {
                                        handleDetailedExportPDF();
                                    } else {
                                        handleSummaryExportPDF();
                                    }
                                }
                            }}
                            sx={{
                                bgcolor: "#1e3a8a",
                                textTransform: "none",
                                fontWeight: "semibold",
                                borderRadius: "8px",
                                px: 3,
                                "&:hover": { bgcolor: "#152a66" }
                            }}
                        >
                            Export
                        </Button>
                    </Box>
                </DialogContent>
            </Dialog>

            {/* ******* 2ND API COLUMN HEADER FILTER MENU ******* */}
            <HeaderFilterMenu
                anchorEl={filterAnchor}
                open={Boolean(filterAnchor) && Boolean(activeHeader)}
                onClose={() => {
                    setFilterAnchor(null);
                    setActiveHeader(null);
                }}
                columnLabel={itemColumns.find((c) => c.key === activeHeader)?.label || activeHeader || undefined}
                options={filterOptions}
                selectedValues={activeHeader ? columnFilters[activeHeader] : undefined}
                onFilterChange={(selected: string[] | undefined) => {
                    if (activeHeader) {
                        setColumnFilters((prev) => {
                            const copy = { ...prev };
                            if (selected === undefined) {
                                delete copy[activeHeader];
                            } else {
                                copy[activeHeader] = selected;
                            }
                            return copy;
                        });
                    }
                }}
            />

            {/* ******* INVOICE DETAILS VERIFICATION MODAL ******* */}
            <InvoiceDetailsDialog
                open={Boolean(selectedInvoice)}
                onClose={handleCloseInvoiceModal}
                invoiceData={selectedInvoice}
                rawItems={itemData[selectedInvoice?.voucherKey || ""] || []}
            />
        </Box>
    );
};

export default OverallItemwise;
