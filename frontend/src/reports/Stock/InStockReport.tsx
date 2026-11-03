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
    Chip,
    InputAdornment,
    Button,
    CircularProgress,
    Menu,
    Switch,
    Tooltip,
    IconButton,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    OutlinedInput,
    Checkbox,
    ListItemText,
    SelectChangeEvent,
    Dialog,
    DialogTitle,
    DialogContent
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import SettingsIcon from "@mui/icons-material/Settings";
import GroupWorkIcon from "@mui/icons-material/GroupWork";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import dayjs from "dayjs";
import PageHeader from "../../Layout/PageHeader";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "react-toastify";
import CommonPagination from "../../Components/CommonPagination";
import ReportFilterDrawer from "../../Components/ReportFilterDrawer";
import {
    StockAbstractReportService,
    StockAbstractData4,
    mergeGodownSummaryDatasets
} from "../../services/dayStockAbstract.service";
import {
    godownwisestockreportservice,
    stockWiseReport,
    stockInOutProcessService,
    godownItemTransactionService
} from "../../services/stockWiseReport.service";

export interface ColumnConfig {
    key: string;
    label: string;
    enabled: boolean;
    order: number;
}

const DEFAULT_CONFIGURABLE_COLUMNS: ColumnConfig[] = [
    { key: "Brand", label: "Brand Name", enabled: true, order: 0 },
    { key: "stock_item_name", label: "Product Name", enabled: true, order: 1 },
    { key: "Product_Id", label: "Product ID", enabled: false, order: 2 },
    { key: "Trans_Date", label: "Transaction Date", enabled: false, order: 3 },
    { key: "Group_Name", label: "Group Name", enabled: false, order: 4 },
    { key: "Group_ST", label: "Group ST", enabled: false, order: 5 },
    { key: "Bag", label: "Bag", enabled: false, order: 6 },
    { key: "Stock_Group", label: "Stock Group", enabled: false, order: 7 },
    { key: "S_Sub_Group_1", label: "Sub Group 1", enabled: false, order: 8 },
    { key: "Grade_Item_Group", label: "Grade Item Group", enabled: false, order: 9 },
    { key: "Item_Name_Modified", label: "Item Name Modified", enabled: false, order: 10 },
    { key: "Date_Added", label: "Date Added", enabled: false, order: 11 },
    { key: "POS_Group", label: "POS Group", enabled: false, order: 12 },
    { key: "Active", label: "Active Status", enabled: false, order: 13 },
    { key: "POS_Item_Name", label: "POS Item Name", enabled: false, order: 14 },
    { key: "Product_Rate", label: "Product Rate", enabled: false, order: 15 },
    { key: "Godown_Name", label: "Godown Name", enabled: false, order: 16 }
];

const GROUPBY_OPTIONS = [
    { key: "Brand", label: "Brand Name" },
    { key: "Group_Name", label: "Group Name" },
    { key: "Stock_Group", label: "Stock Group" },
    { key: "S_Sub_Group_1", label: "Sub Group 1" },
    { key: "Grade_Item_Group", label: "Grade Item Group" },
    { key: "POS_Group", label: "POS Group" },
    { key: "Godown_Name", label: "Godown Name" }
];

const parseStaffInvolved = (staffStr: string): Record<string, string> => {
    const rolesMap: Record<string, string[]> = {};
    if (!staffStr) return {};
    const parts = staffStr.split(',');
    parts.forEach(part => {
        const trimmed = part.trim();
        const match = trimmed.match(/^(.*?)\s*\((.*?)\)$/);
        if (match) {
            const val = match[1].trim();
            const role = match[2].trim();
            if (val && role) {
                if (!rolesMap[role]) {
                    rolesMap[role] = [];
                }
                if (!rolesMap[role].includes(val)) {
                    rolesMap[role].push(val);
                }
            }
        }
    });
    const parsed: Record<string, string> = {};
    Object.keys(rolesMap).forEach(role => {
        parsed[role] = rolesMap[role].join(', ');
    });
    return parsed;
};

const getTakenByNameFromStaffInvolved = (staffInvolved: string | null | undefined): string => {
    if (!staffInvolved) return "";
    const parts = staffInvolved.split(",");
    const takenNames: string[] = [];
    parts.forEach(part => {
        const trimmed = part.trim();
        const match = trimmed.match(/^(.*?)\s*\(Taken\)$/i);
        if (match) {
            takenNames.push(match[1].trim());
        }
    });
    return takenNames.join(",");
};

const getTakenName = (r: any): string => {
    if (!r) return "";
    return String(r.Taken ?? r.Taken_By_Name ?? getTakenByNameFromStaffInvolved(r.Staff_Involved) ?? "").trim();
};

const isTrip = (pr: any): boolean => {
    if (!pr) return false;
    const vNo = pr.trip_voucher_number || pr.Trip_Voucher_Number || pr.trip_id || pr.Trip_Id || pr.Trip_No || pr.trip_no;
    return vNo !== null && vNo !== undefined && String(vNo).trim() !== "";
};

const InStockReport: React.FC = () => {
    const today = dayjs().format("YYYY-MM-DD");
    const [columnsConfig, setColumnsConfig] = useState<ColumnConfig[]>(() => {
        const saved = sessionStorage.getItem("inStockColumns");
        return saved ? JSON.parse(saved) : DEFAULT_CONFIGURABLE_COLUMNS;
    });
    const [settingsAnchor, setSettingsAnchor] = useState<null | HTMLElement>(null);
    const [groupByAnchor, setGroupByAnchor] = useState<null | HTMLElement>(null);

    useEffect(() => {
        sessionStorage.setItem("inStockColumns", JSON.stringify(columnsConfig));
    }, [columnsConfig]);

    const enabledConfigColumns = useMemo(() => {
        return columnsConfig
            .filter(col => col.enabled)
            .sort((a, b) => a.order - b.order);
    }, [columnsConfig]);

    const isPivotMode = useMemo(() => {
        return !enabledConfigColumns.some(col => col.key === "stock_item_name" || col.key === "Stock_Item");
    }, [enabledConfigColumns]);

    /* ================= SORTABLE COLUMN ================= */
    type SortableColumnProps = {
        column: ColumnConfig;
        toggle: (key: string) => void;
    };

    const SortableColumn: React.FC<SortableColumnProps> = ({ column, toggle }) => {
        const { attributes, listeners, setNodeRef, transform, transition } =
            useSortable({ id: column.key });

        const style = {
            transform: CSS.Transform.toString(transform),
            transition
        };

        return (
            <Box
                ref={setNodeRef}
                style={style}
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                py={0.7}
                px={1}
                sx={{
                    borderBottom: "1px solid #eee"
                }}
            >
                <Box display="flex" alignItems="center" gap={1}>
                    <Box
                        {...attributes}
                        {...listeners}
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            cursor: "grab"
                        }}
                    >
                        <DragIndicatorIcon fontSize="small" />
                    </Box>
                    <Typography fontSize={12}>
                        {column.label}
                    </Typography>
                </Box>
                <Switch
                    size="medium"
                    checked={column.enabled}
                    onChange={() => toggle(column.key)}
                />
            </Box>
        );
    };

    const [fromDate, setFromDate] = useState(today);
    const [toDate, setToDate] = useState(today);
    const [tempFromDate, setTempFromDate] = useState(today);
    const [tempToDate, setTempToDate] = useState(today);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [loadingGodowns, setLoadingGodowns] = useState(false);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const loading = loadingGodowns || loadingDetails;
    const latestGodownsReq = React.useRef(0);
    const latestDetailsReq = React.useRef(0);

    const [qtyMode, setQtyMode] = useState<"qty" | "actQty" | "bags">(() => {
        const saved = sessionStorage.getItem("inStockQtyMode");
        return (saved as "qty" | "actQty" | "bags") || "qty";
    });

    useEffect(() => {
        sessionStorage.setItem("inStockQtyMode", qtyMode);
    }, [qtyMode]);

    const formatQtyVal = (val: any): string => {
        if (val === null || val === undefined || val === "" || Number(val) === 0) return "-";
        const num = Number(val);
        if (isNaN(num)) return String(val);
        return Number(num.toFixed(2)).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    };

    const qtyKeys = useMemo(() => {
        if (qtyMode === "qty") {
            return {
                opening: "OB_Bal_Qty" as keyof stockWiseReport,
                in: "IN_Qty" as keyof stockWiseReport,
                procIn: "Proc_IN_Qty" as keyof stockWiseReport,
                procOut: "Proc_OUT_Qty" as keyof stockWiseReport,
                out: "OUT_Qty" as keyof stockWiseReport,
                closing: "Bal_Qty" as keyof stockWiseReport
            };
        } else {
            return {
                opening: "OB_Act_Qty" as keyof stockWiseReport,
                in: "IN_Act_Qty" as keyof stockWiseReport,
                procIn: "Proc_IN_Act_Qty" as keyof stockWiseReport,
                procOut: "Proc_OUT_Act_Qty" as keyof stockWiseReport,
                out: "OUT_Act_Qty" as keyof stockWiseReport,
                closing: "Act_Bal_Qty" as keyof stockWiseReport
            };
        }
    }, [qtyMode]);

    const getItemWeight = (item: stockWiseReport): number => {
        const bagWeightStr = String(item.Bag || item.bag || "").replace(/[^0-9.]/g, '');
        const bagWeight = parseFloat(bagWeightStr) || 0;
        if (bagWeight > 0) return bagWeight;
        const match = String(item.stock_item_name || item.Stock_Item || "").match(/(\d+(?:\.\d+)?)\s*(?:KG|kg)/);
        if (match) return parseFloat(match[1]);
        return 1;
    };

    const getPopupItemWeight = (): number => {
        if (!popupProductInfo) return 1;
        const matchingItem = detailedStockData.find(
            x => Number(x.Product_Id) === Number(popupProductInfo.productId)
        );
        if (matchingItem) {
            return getItemWeight(matchingItem);
        }
        const match = String(popupProductInfo.productName).match(/(\d+(?:\.\d+)?)\s*(?:KG|kg)/);
        if (match) return parseFloat(match[1]);
        return 1;
    };

    const [selectedGodown, setSelectedGodown] = useState<StockAbstractData4 | null>(null);
    const [searchText, setSearchText] = useState("");
    const [selectedBrand, setSelectedBrand] = useState<string>("All");
    const [groupByColumn, setGroupByColumn] = useState<string>(() => {
        return sessionStorage.getItem("inStockGroupByColumn") || "Stock_Group";
    });

    useEffect(() => {
        sessionStorage.setItem("inStockGroupByColumn", groupByColumn);
    }, [groupByColumn]);

    // Pagination states
    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(100);

    const [viewMode, setViewMode] = useState<"cumulative" | "trip">("cumulative");

    // Dynamic header split-up modes
    const [inwardMode, setInwardMode] = useState(false);
    const [outwardMode, setOutwardMode] = useState(false);
    const [processMode, setProcessMode] = useState(false);

    // Hidden dynamic columns
    const [hiddenInwardColumns, setHiddenInwardColumns] = useState<string[]>([]);
    const [hiddenOutwardColumns, setHiddenOutwardColumns] = useState<string[]>([]);
    const [hiddenProcessColumns, setHiddenProcessColumns] = useState<string[]>([]);

    const handleHideInwardColumn = (col: string) => {
        setHiddenInwardColumns(prev => [...prev, col]);
    };
    const handleShowInwardColumn = (col: string) => {
        setHiddenInwardColumns(prev => prev.filter(c => c !== col));
    };

    const handleHideOutwardColumn = (col: string) => {
        setHiddenOutwardColumns(prev => [...prev, col]);
    };
    const handleShowOutwardColumn = (col: string) => {
        setHiddenOutwardColumns(prev => prev.filter(c => c !== col));
    };

    const handleHideProcessColumn = (col: string) => {
        setHiddenProcessColumns(prev => [...prev, col]);
    };
    const handleShowProcessColumn = (col: string) => {
        setHiddenProcessColumns(prev => prev.filter(c => c !== col));
    };

    // Dynamic sticky header height calculation
    const headerRowRef = React.useRef<HTMLTableRowElement>(null);
    const [headerHeight, setHeaderHeight] = useState(41);

    // API Data state
    const [godownListData, setGodownListData] = useState<StockAbstractData4[]>([]);
    const [detailedStockData, setDetailedStockData] = useState<stockWiseReport[]>([]);
    const [processApiData, setProcessApiData] = useState<any[]>([]);

    const [godownFilterAnchor, setGodownFilterAnchor] = useState<null | HTMLElement>(null);
    const [godownFilterSearch, setGodownFilterSearch] = useState("");
    const [selectedGodowns, setSelectedGodowns] = useState<string[]>([]);

    const uniqueGodownNames = useMemo(() => {
        const activeGodowns = (godownListData || []).filter(g => {
            if (qtyMode === "actQty") {
                return Number(g.ACt_OB_Qty || 0) !== 0 ||
                    Number(g.ACt_In_Qty || 0) !== 0 ||
                    Number(g.Process_Act_IN_OUT_Qty || 0) !== 0 ||
                    Number(g.SOU_ACt_In_Qty || 0) !== 0 ||
                    Number(g.ACt_Out_Qty || 0) !== 0 ||
                    Number(g.CL_ACt_QTY || 0) !== 0;
            }
            return Number(g.OB_Qty || 0) !== 0 ||
                Number(g.IN_Qty || 0) !== 0 ||
                Number(g.Process_IN_OUT_Qty || 0) !== 0 ||
                Number(g.SOU_In_Qty || 0) !== 0 ||
                Number(g.Out_Qty || 0) !== 0 ||
                Number(g.CL_QTY || 0) !== 0;
        });
        const names = activeGodowns.map(g => g.godown_name).filter(Boolean);
        return Array.from(new Set(names)).sort();
    }, [godownListData, qtyMode]);

    const filteredGodowns = useMemo(() => {
        return (godownListData || []).filter(g => {
            if (selectedGodowns.length > 0 && !selectedGodowns.includes(g.godown_name)) {
                return false;
            }
            if (qtyMode === "actQty") {
                return Number(g.ACt_OB_Qty || 0) !== 0 ||
                    Number(g.ACt_In_Qty || 0) !== 0 ||
                    Number(g.Process_Act_IN_OUT_Qty || 0) !== 0 ||
                    Number(g.SOU_ACt_In_Qty || 0) !== 0 ||
                    Number(g.ACt_Out_Qty || 0) !== 0 ||
                    Number(g.CL_ACt_QTY || 0) !== 0;
            }
            return Number(g.OB_Qty || 0) !== 0 ||
                Number(g.IN_Qty || 0) !== 0 ||
                Number(g.Process_IN_OUT_Qty || 0) !== 0 ||
                Number(g.SOU_In_Qty || 0) !== 0 ||
                Number(g.Out_Qty || 0) !== 0 ||
                Number(g.CL_QTY || 0) !== 0;
        });
    }, [godownListData, selectedGodowns, qtyMode]);


    // Map stockinoutprocess API data by item_id and godown_name
    const mappedProcessData = useMemo(() => {
        const mapByProductAndGodown: Record<string, any[]> = {};
        const mapByProductIdOnly: Record<string, any[]> = {};
        const mapByProductNameAndGodown: Record<string, any[]> = {};

        processApiData.forEach((record) => {
            const pId = String(record.item_id || record.product_id || record.Product_Id || "").trim();
            const gName = String(record.godown_name || "").toLowerCase().trim();
            const pName = String(record.stock_item_name || record.item_name || record.product_name || "").toLowerCase().trim();

            if (pId) {
                const key1 = `${pId}_${gName}`;
                if (!mapByProductAndGodown[key1]) mapByProductAndGodown[key1] = [];
                mapByProductAndGodown[key1].push(record);

                if (!mapByProductIdOnly[pId]) mapByProductIdOnly[pId] = [];
                mapByProductIdOnly[pId].push(record);
            }

            if (pName) {
                const key2 = `${pName}_${gName}`;
                if (!mapByProductNameAndGodown[key2]) mapByProductNameAndGodown[key2] = [];
                mapByProductNameAndGodown[key2].push(record);
            }
        });

        return { mapByProductAndGodown, mapByProductIdOnly, mapByProductNameAndGodown };
    }, [processApiData]);

    // Detailed transaction popup states
    const [popupOpen, setPopupOpen] = useState(false);
    const [popupLoading, setPopupLoading] = useState(false);
    const [popupRows, setPopupRows] = useState<any[]>([]);
    const [popupProductInfo, setPopupProductInfo] = useState<{ productId: number; productName: string; godownId: number; godownName: string } | null>(null);
    const [popupFilterType, setPopupFilterType] = useState<string>('ALL');

    const [moduleFilter, setModuleFilter] = useState<string>('ALL');

    const handleQuantityClick = async (productId: number | string | undefined, productName: string, filterType: string = 'ALL', tripNo?: number | string) => {
        if (!productId || !selectedGodown) return;
        const gId = Number(selectedGodown.godown_id);
        const pId = Number(productId);
        setPopupProductInfo({
            productId: pId,
            productName,
            godownId: gId,
            godownName: selectedGodown.godown_name
        });
        setPopupFilterType(filterType);
        setPopupOpen(true);
        setPopupLoading(true);
        try {
            let res;
            if (outwardMode) {
                res = await godownItemTransactionService.getGodownItemOutExpandable({
                    fromDate,
                    toDate,
                    Product_Id: pId,
                    Godown_Id: gId,
                    Trip_No: tripNo ? Number(tripNo) : undefined
                });
            } else if (inwardMode) {
                res = await godownItemTransactionService.getGodownItemInExpandable({
                    fromDate,
                    toDate,
                    Product_Id: pId,
                    Godown_Id: gId,
                    Trip_No: tripNo ? Number(tripNo) : undefined
                });
            } else if (processMode && filterType.startsWith('PROCESS')) {
                res = await godownItemTransactionService.getGodownItemProcess({
                    fromDate,
                    toDate,
                    Product_Id: pId,
                    Godown_Id: gId
                });
            } else {
                res = await godownItemTransactionService.getGodownItemTransactions({
                    fromDate,
                    toDate,
                    Product_Id: pId,
                    Godown_Id: gId
                });
            }
            setPopupRows(res.data?.data || []);
        } catch (err) {
            console.error("Failed to load popup transactions:", err);
            toast.error("Failed to load transaction details");
            setPopupRows([]);
        } finally {
            setPopupLoading(false);
        }
    };

    const getTripOrTakenLabel = React.useCallback((t: any, _isOutward: boolean): string => {
        const rawVal = t.Trip_No || t.trip_no || t.trip_voucher_number || t.trip_id;
        if (!rawVal) return "N/A";
        const str = String(rawVal).trim();
        const prefix = "Trip";

        let label = "";
        if (str.toLowerCase().startsWith("trip") || str.toLowerCase().startsWith("taken")) {
            label = str.replace(/^(trip|taken)/i, prefix);
        } else {
            label = `${prefix} - ${str}`;
        }

        const loadman = t.Loadman_Name || t.loadman_name;
        if (loadman) {
            label = `${label} - ${String(loadman).trim()}`;
        }
        return label;
    }, []);

    const getRowTripOrTakenInfo = (r: any, isOutward: boolean) => {
        // 1. Check direct fields on r
        const hasDirectTrip = (
            (r.Trip_No !== null && r.Trip_No !== undefined && String(r.Trip_No).trim() !== "") ||
            (r.trip_no !== null && r.trip_no !== undefined && String(r.trip_no).trim() !== "") ||
            (r.Trip_Id !== null && r.Trip_Id !== undefined && String(r.Trip_Id).trim() !== "") ||
            (r.trip_id !== null && r.trip_id !== undefined && String(r.trip_id).trim() !== "") ||
            (r.Trip_Voucher_Number !== null && r.Trip_Voucher_Number !== undefined && String(r.Trip_Voucher_Number).trim() !== "") ||
            (r.trip_voucher_number !== null && r.trip_voucher_number !== undefined && String(r.trip_voucher_number).trim() !== "")
        );

        if (hasDirectTrip) {
            const rawVal = r.Trip_No ?? r.trip_no ?? r.Trip_Voucher_Number ?? r.trip_voucher_number ?? r.Trip_Id ?? r.trip_id;
            const label = getTripOrTakenLabel({ ...r, Trip_No: rawVal }, isOutward);
            return { isTrip: true, label };
        }

        // 2. Check matched record in processApiData
        if (popupProductInfo) {
            const godownName = String(popupProductInfo.godownName || "").toLowerCase().trim();
            const productIdStr = String(popupProductInfo.productId).trim();
            const key1 = `${productIdStr}_${godownName}`;
            let recs = mappedProcessData.mapByProductAndGodown[key1] || [];
            if (recs.length === 0) {
                const rawRecs = mappedProcessData.mapByProductIdOnly[productIdStr];
                if (rawRecs) {
                    recs = rawRecs.filter((pr: any) => {
                        const rGodown = String(pr.godown_name || "").toLowerCase().trim();
                        return !rGodown || rGodown === godownName;
                    });
                }
            }
            const invoiceNo = r.Do_Inv_No || r.Do_inv_no || r.invoice_no;
            const matchingRawRecord = recs.find(x => x.module_voucher_number === invoiceNo);
            if (matchingRawRecord) {
                const hasTripField = (
                    matchingRawRecord.trip_voucher_number !== null ||
                    matchingRawRecord.trip_id !== null ||
                    (matchingRawRecord.Trip_No !== null && matchingRawRecord.Trip_No !== undefined && String(matchingRawRecord.Trip_No).trim() !== "") ||
                    (matchingRawRecord.trip_no !== null && matchingRawRecord.trip_no !== undefined && String(matchingRawRecord.trip_no).trim() !== "")
                );
                if (hasTripField) {
                    const rawVal = matchingRawRecord.Trip_No || matchingRawRecord.trip_no || matchingRawRecord.trip_voucher_number || matchingRawRecord.trip_id;
                    const label = getTripOrTakenLabel({ ...matchingRawRecord, Trip_No: rawVal }, isOutward);
                    return { isTrip: true, label };
                }
            }
        }

        return { isTrip: false, label: "" };
    };

    const getRowQuantities = (r: any) => {
        const isOB = (r.Do_Inv_No || r.Do_inv_no || r.invoice_no) === "OB" || String(r.Particulars || r.Narration || "").toLowerCase().includes("opening balance");
        const isSJ = String(r.Narration || r.Particulars || "").toLowerCase().includes("stock journal") ||
            String(r.Voucher_Type || r.voucher_name || "").toLowerCase().includes("stock journal") ||
            String(r.module || r.Module || "").toLowerCase().includes("stock journal") ||
            r.Direction !== undefined;

        // Check if pending taken
        const isPending = String(r.Record_Type || "").toUpperCase() === "PENDING_DELIVERY" || String(r.Record_Type || "").toUpperCase() === "PENDING" || popupFilterType === "Pending Taken" || popupFilterType === "Pending Delivery" || popupFilterType === "PENDING TAKEN";

        let stockIn = Number(r.Stock_In_Qty ?? r.In_Qty ?? r.Bill_Qty ?? 0);
        let stockOut = Number(r.Stock_Out_Qty ?? r.Out_Qty ?? r.Bill_Qty ?? 0);

        if (r.Direction === "IN") {
            stockIn = Number(r.Qty || 0);
            stockOut = 0;
        } else if (r.Direction === "OUT") {
            stockIn = 0;
            stockOut = Number(r.Qty || 0);
        }

        // Fallbacks for specific modes if standard columns are missing
        if (stockIn === 0 && stockOut === 0) {
            const qtyVal = Number(r.QTY ?? r.qty ?? r.KGS ?? r.kgs ?? 0);
            if (inwardMode) {
                stockIn = qtyVal;
            } else if (outwardMode) {
                stockOut = qtyVal;
            } else {
                // If neither mode is active, check stock_direction if available
                const direction = String(r.stock_direction || "").toUpperCase();
                if (direction === "IN") {
                    stockIn = qtyVal;
                } else if (direction === "OUT") {
                    stockOut = qtyVal;
                } else {
                    // Fallback to both if direction is unknown
                    stockIn = qtyVal;
                    stockOut = qtyVal;
                }
            }
        }

        let inQty = 0;
        let processQty = 0;
        let outQty = 0;
        let pendingQty = 0;

        if (isOB) {
            inQty = stockIn;
        } else if (isSJ) {
            processQty = stockIn - stockOut;
            inQty = stockIn;
            outQty = stockOut;
        } else if (isPending) {
            pendingQty = stockOut;
        } else {
            // Regular transaction
            if (stockIn > 0) {
                inQty = stockIn;
            }
            if (stockOut > 0) {
                outQty = stockOut;
            }
        }

        const weight = qtyMode === "bags" ? getPopupItemWeight() : 1;
        return {
            inQty: qtyMode === "bags" ? Math.round(inQty / weight) : inQty / weight,
            processQty: qtyMode === "bags" ? Math.round(processQty / weight) : processQty / weight,
            outQty: qtyMode === "bags" ? Math.round(outQty / weight) : outQty / weight,
            pendingQty: qtyMode === "bags" ? Math.round(pendingQty / weight) : pendingQty / weight
        };
    };

    const getRowQtyForFilter = (r: any, filterType: string) => {
        const { inQty, processQty, outQty, pendingQty } = getRowQuantities(r);

        if (filterType === "OB") {
            return inQty;
        }
        if (filterType === "IN") {
            return inQty;
        }
        if (filterType === "OUT") {
            return outQty;
        }
        if (filterType === "PROCESS") {
            return processQty;
        }
        if (filterType === "PROCESS_IN") {
            return inQty;
        }
        if (filterType === "PROCESS_OUT") {
            return outQty;
        }
        if (filterType === "RETURN") {
            return inQty;
        }
        if (filterType === "PENDING TAKEN" || filterType === "Pending Taken" || filterType === "Pending Delivery") {
            return pendingQty;
        }
        if (filterType.startsWith("Taken")) {
            return inwardMode ? inQty : outQty;
        }

        return inwardMode ? inQty : outQty;
    };

    const getDynamicQtyHeader = () => {
        if (popupFilterType === "OB") return "OPENING QTY";
        if (popupFilterType === "IN" || popupFilterType === "RETURN" || inwardTripHeaders.includes(popupFilterType)) return "IN QTY";
        if (popupFilterType === "OUT" || outwardTakenHeaders.includes(popupFilterType)) return "OUT QTY";
        if (popupFilterType === "PENDING TAKEN" || popupFilterType === "Pending Taken" || popupFilterType === "Pending Delivery") return "PENDING QTY";
        if (popupFilterType === "PROCESS") return "PROCESS QTY";
        if (popupFilterType === "PROCESS_IN") return "PROCESS IN QTY";
        if (popupFilterType === "PROCESS_OUT") return "PROCESS OUT QTY";
        return "QTY";
    };

    const getRowInvNoDisplay = (r: any) => {
        const isIn = inwardMode || (!outwardMode && String(r.stock_direction || r.Direction || "").toUpperCase() === "IN");

        const invNo = r.Do_Inv_No || r.Do_inv_no || r.invoice_no || r.Invoice_No || r.Invoice_no || r.Bill_Nos || r.bill_nos;
        const tripNo = r.Trip_No || r.trip_no;
        const tripVoucherNo = r.Trip_Voucher_Number || r.trip_voucher_number;

        const tripStr = tripNo ? (
            String(tripNo).trim().toLowerCase().startsWith("trip")
                ? String(tripNo).trim()
                : String(tripNo).trim().toLowerCase().startsWith("taken")
                    ? String(tripNo).trim().replace(/taken/i, "Trip")
                    : `Trip - ${tripNo}`
        ) : "";

        if (isIn) {
            // For Stock In popup, show Trip_Voucher_No (or fallback invNo) along with Trip No
            const baseInv = tripVoucherNo || invNo;
            if (baseInv && tripStr) {
                return `${baseInv} (${tripStr})`;
            }
            if (baseInv) return baseInv;
            if (tripStr) return tripStr;
            return "-";
        } else {
            // For Process and Outwards, show Do_Inv_No (invNo) along with Trip No
            if (invNo && tripStr) {
                return `${invNo} (${tripStr})`;
            }
            if (invNo) return invNo;
            if (tripStr) return tripStr;
            return "-";
        }
    };











    const ledgerRows = useMemo(() => {
        let running = 0;
        const sorted = [...popupRows].sort(
            (a, b) => new Date(a.Do_Date || a.Ledger_Date || a.Process_Date).getTime() - new Date(b.Do_Date || b.Ledger_Date || b.Process_Date).getTime()
        );
        return sorted.map((row) => {
            const stockIn = Number(row.Stock_In_Qty ?? row.In_Qty ?? row.Bill_Qty ?? 0);
            const stockOut = Number(row.Stock_Out_Qty ?? row.Out_Qty ?? row.Bill_Qty ?? 0);
            running += stockIn - stockOut;
            return {
                ...row,
                runningBalance: running
            };
        });
    }, [popupRows]);



    const handleSetInwardMode = (val: boolean) => {
        setInwardMode(val);
        if (val) {
            setOutwardMode(false);
            setProcessMode(false);
        }
    };

    const handleSetOutwardMode = (val: boolean) => {
        setOutwardMode(val);
        if (val) {
            setInwardMode(false);
            setProcessMode(false);
        }
    };

    const handleSetProcessMode = (val: boolean) => {
        setProcessMode(val);
        if (val) {
            setInwardMode(false);
            setOutwardMode(false);
        }
    };

    // Reset page to 1 when filters change
    useEffect(() => {
        setPage(1);
    }, [searchText, selectedBrand, rowsPerPage, selectedGodown, moduleFilter]);

    // Reset modes when selected godown changes
    useEffect(() => {
        setInwardMode(false);
        setOutwardMode(false);
        setProcessMode(false);
        setModuleFilter('ALL');
    }, [selectedGodown]);

    // Fetch overall godowns list
    const loadGodownList = async () => {
        const reqId = ++latestGodownsReq.current;
        try {
            setLoadingGodowns(true);
            const res = await StockAbstractReportService.getGodownSummaryInstock({
                Predate: dayjs(fromDate).subtract(1, "day").format("YYYY-MM-DD"),
                Fromdate: dayjs(fromDate).format("YYYY-MM-DD"),
                Todate: dayjs(toDate).format("YYYY-MM-DD"),
            });
            if (reqId === latestGodownsReq.current) {
                const finalData = Array.isArray(res) ? res : mergeGodownSummaryDatasets(res);
                setGodownListData(finalData || []);
            }
        } catch (err) {
            console.error("Failed to load godown list:", err);
            if (reqId === latestGodownsReq.current) {
                toast.error("Failed to load godown list");
            }
        } finally {
            if (reqId === latestGodownsReq.current) {
                setLoadingGodowns(false);
            }
        }
    };

    // Fetch detailed stock items for the selected godown
    const loadDetailedStock = async (godownId: string | number) => {
        const reqId = ++latestDetailsReq.current;
        try {
            setLoadingDetails(true);
            const [res, processRes] = await Promise.all([
                godownwisestockreportservice.getGodownwiseReports({
                    Godown_Id: godownId,
                    Fromdate: dayjs(fromDate).format("YYYY-MM-DD"),
                    Todate: dayjs(toDate).format("YYYY-MM-DD"),
                }),
                stockInOutProcessService.getStockInOutProcess({
                    Todate: dayjs(toDate).format("YYYY-MM-DD"),
                    Fromdate: dayjs(fromDate).format("YYYY-MM-DD"),
                }).catch(err => {
                    console.error("Failed to load stock in out process details:", err);
                    return { data: { data: [] } };
                })
            ]);

            if (reqId !== latestDetailsReq.current) return;

            const apiRows = res.data?.data || [];
            const processData = processRes.data?.data || [];
            setProcessApiData(processData);

            // Merge items from processData that are not present in apiRows
            const godownIdStr = String(godownId);
            const extraRows: stockWiseReport[] = [];
            const existingProductIds = new Set(apiRows.map(r => Number(r.Product_Id)));

            processData.forEach((t: any) => {
                if (String(t.godown_id) === godownIdStr) {
                    const pId = Number(t.item_id);
                    const itemName = String(t.item_name || "").trim();
                    const qty = Number(t.quantity || 0);
                    if (pId && itemName && itemName !== "-" && qty !== 0 && !existingProductIds.has(pId)) {
                        existingProductIds.add(pId);
                        extraRows.push({
                            Product_Id: pId,
                            stock_item_name: itemName,
                            Stock_Item: itemName,
                            Brand: "Others",
                            Group_Name: "Others",
                            OB_Bal_Qty: 0,
                            Pur_Qty: 0,
                            Sal_Qty: 0,
                            Bal_Qty: 0,
                            OB_Act_Qty: 0,
                            Pur_Act_Qty: 0,
                            Sal_Act_Qty: 0,
                            Bal_Act_Qty: 0,
                            OB_Qty: 0,
                            IN_Qty: 0,
                            Out_Qty: 0,
                            CL_QTY: 0,
                            ACt_OB_Qty: 0,
                            ACt_In_Qty: 0,
                            Process_Act_IN_OUT_Qty: 0,
                            ACt_Out_Qty: 0,
                            CL_ACt_QTY: 0,
                            Process_IN_OUT_Qty: 0,
                            SOU_In_Qty: 0,
                            SOU_ACt_In_Qty: 0,
                            SOU_Out_Qty: 0,
                            SOU_ACt_Out_Qty: 0
                        } as any);
                    }
                }
            });

            const mergedRows = [...apiRows, ...extraRows];

            // Filter out empty items: only keep items that have valid product names and actual data/movements
            const validRows = mergedRows.filter((item) => {
                const pName = String(item.stock_item_name || item.Stock_Item || item.product_name || "").trim();
                if (!pName || pName === "-" || pName.toLowerCase() === "undefined" || pName.toLowerCase() === "null") {
                    return false;
                }

                const hasRawQty =
                    Number(item.OB_Bal_Qty || 0) !== 0 ||
                    Number(item.Pur_Qty || 0) !== 0 ||
                    Number(item.Sal_Qty || 0) !== 0 ||
                    Number(item.Bal_Qty || 0) !== 0 ||
                    Number(item.OB_Act_Qty || 0) !== 0 ||
                    Number(item.Pur_Act_Qty || 0) !== 0 ||
                    Number(item.Sal_Act_Qty || 0) !== 0 ||
                    Number(item.Bal_Act_Qty || 0) !== 0 ||
                    Number(item.Act_Bal_Qty || 0) !== 0 ||
                    Number(item.OB_Qty || 0) !== 0 ||
                    Number(item.IN_Qty || 0) !== 0 ||
                    Number(item.Out_Qty || 0) !== 0 ||
                    Number(item.OUT_Qty || 0) !== 0 ||
                    Number(item.CL_QTY || 0) !== 0 ||
                    Number(item.ACt_OB_Qty || 0) !== 0 ||
                    Number(item.ACt_In_Qty || 0) !== 0 ||
                    Number(item.IN_Act_Qty || 0) !== 0 ||
                    Number(item.ACt_Out_Qty || 0) !== 0 ||
                    Number(item.OUT_Act_Qty || 0) !== 0 ||
                    Number(item.CL_ACt_QTY || 0) !== 0 ||
                    Number(item.Process_IN_OUT_Qty || 0) !== 0 ||
                    Number(item.Process_Act_IN_OUT_Qty || 0) !== 0 ||
                    Number(item.Proc_IN_Qty || 0) !== 0 ||
                    Number(item.Proc_OUT_Qty || 0) !== 0 ||
                    Number(item.Proc_IN_Act_Qty || 0) !== 0 ||
                    Number(item.Proc_OUT_Act_Qty || 0) !== 0 ||
                    Number(item.SOU_In_Qty || 0) !== 0 ||
                    Number(item.SOU_ACt_In_Qty || 0) !== 0 ||
                    Number(item.SOU_Out_Qty || 0) !== 0 ||
                    Number(item.SOU_ACt_Out_Qty || 0) !== 0 ||
                    Object.keys(item).some(k => /qty/i.test(k) && Number(item[k] || 0) !== 0);

                if (hasRawQty) return true;

                const pId = Number(item.Product_Id);
                const pNameLower = pName.toLowerCase();
                const hasProcessRecord = processData.some((t: any) => {
                    if (String(t.godown_id) !== godownIdStr) return false;
                    const matchesId = pId && Number(t.item_id) === pId;
                    const matchesName = t.item_name && String(t.item_name).trim().toLowerCase() === pNameLower;
                    return (matchesId || matchesName) && Number(t.quantity || 0) !== 0;
                });

                return hasProcessRecord;
            });

            setDetailedStockData(validRows);

            if (validRows.length || apiRows.length) {
                const sourceRow = validRows[0] || apiRows[0];
                const FIXED_KEYS = [
                    "OB_Bal_Qty",
                    "Pur_Qty",
                    "Sal_Qty",
                    "Bal_Qty",
                    "OB_Act_Qty",
                    "Pur_Act_Qty",
                    "Sal_Act_Qty",
                    "Bal_Act_Qty",
                    "OB_Qty",
                    "IN_Qty",
                    "Out_Qty",
                    "CL_QTY"
                ];
                const DEFAULT_COLUMNS = ["Brand", "stock_item_name", "Stock_Item"];

                const baseCols = Object.keys(sourceRow)
                    .filter(key => !FIXED_KEYS.includes(key))
                    .map((key, index) => {
                        const matchedDefault = DEFAULT_CONFIGURABLE_COLUMNS.find(c => c.key === key);
                        return {
                            key,
                            label: matchedDefault ? matchedDefault.label : key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
                            enabled: matchedDefault ? matchedDefault.enabled : DEFAULT_COLUMNS.includes(key),
                            order: matchedDefault ? matchedDefault.order : index
                        };
                    });

                const saved = sessionStorage.getItem("inStockColumns");
                if (saved) {
                    const savedParsed = JSON.parse(saved) as ColumnConfig[];
                    const merged = savedParsed.map(col => {
                        const base = baseCols.find(b => b.key === col.key);
                        return {
                            ...col,
                            label: base?.label ?? col.label
                        };
                    });
                    const missing = baseCols
                        .filter(b => !savedParsed.some(s => s.key === b.key))
                        .map(b => ({ ...b, enabled: false }));
                    setColumnsConfig([...merged, ...missing].sort((a, b) => a.order - b.order));
                } else {
                    setColumnsConfig(baseCols.sort((a, b) => a.order - b.order));
                }
            }
        } catch (err) {
            console.error("Failed to load godown stock data:", err);
            if (reqId === latestDetailsReq.current) {
                toast.error("Failed to load godown stock data");
                setDetailedStockData([]);
            }
        } finally {
            if (reqId === latestDetailsReq.current) {
                setLoadingDetails(false);
            }
        }
    };

    useEffect(() => {
        loadGodownList();
    }, [fromDate, toDate]);
    useEffect(() => {
        if (selectedGodown) {
            loadDetailedStock(selectedGodown.godown_id);
        } else {
            setDetailedStockData([]);
            setProcessApiData([]);
        }
    }, [selectedGodown, fromDate, toDate]);

    useEffect(() => {
        if (drawerOpen) {
            setTempFromDate(fromDate);
            setTempToDate(toDate);
        }
    }, [drawerOpen, fromDate, toDate]);



    // Group godown list by parent_godown_name (only including godowns with data)
    const groupedGodowns = useMemo(() => {
        const groups: Record<string, StockAbstractData4[]> = {};
        filteredGodowns.forEach(row => {
            const parent = row.parent_godown_name || "Others";
            if (!groups[parent]) {
                groups[parent] = [];
            }
            groups[parent].push(row);
        });
        return groups;
    }, [filteredGodowns]);
    // Calculate aggregated overall summary of godowns totals
    const grandTotals = useMemo(() => {
        let opening = 0;
        let stockIn = 0;
        let process = 0;
        let stockOut = 0;
        let closing = 0;

        filteredGodowns.forEach(g => {
            const ob = Number((qtyMode === "actQty" ? g.ACt_OB_Qty : g.OB_Qty) || 0);
            const sin = Number((qtyMode === "actQty" ? g.ACt_In_Qty : g.IN_Qty) || 0);
            const proc = Number((qtyMode === "actQty" ? g.Process_Act_IN_OUT_Qty : g.Process_IN_OUT_Qty) || 0);
            const sout = Number((qtyMode === "actQty" ? g.ACt_Out_Qty : g.Out_Qty) || 0);
            const cl = Number((qtyMode === "actQty" ? g.CL_ACt_QTY : g.CL_QTY) || 0);

            if (qtyMode === "bags") {
                opening += Math.round(ob / 50);
                stockIn += Math.round(sin / 50);
                process += Math.round(proc / 50);
                stockOut += Math.round(sout / 50);
                closing += Math.round(cl / 50);
            } else {
                opening += ob;
                stockIn += sin;
                process += proc;
                stockOut += sout;
                closing += cl;
            }
        });

        return { opening, stockIn, process, stockOut, closing };
    }, [filteredGodowns, qtyMode]);
    // Helper to get mapped details for a product
    const getProductDetails = useMemo(() => {
        return (item: stockWiseReport) => {
            const godownName = String(item.Godown_Name || selectedGodown?.godown_name || "").toLowerCase().trim();
            const productName = String(item.stock_item_name || item.Stock_Item || "").toLowerCase().trim();

            let records: any[] = [];
            const productIds = (item as any).Product_Ids;
            const pIdsToSearch = Array.isArray(productIds) && productIds.length > 0 ? productIds : [item.Product_Id];

            pIdsToSearch.forEach((pId) => {
                if (!pId && pId !== 0) return;
                const strId = String(pId).trim();
                const key1 = `${strId}_${godownName}`;
                let recs = mappedProcessData.mapByProductAndGodown[key1];
                if (!recs || recs.length === 0) {
                    const rawRecs = mappedProcessData.mapByProductIdOnly[strId];
                    if (rawRecs) {
                        recs = rawRecs.filter((r: any) => {
                            const rGodown = String(r.godown_name || "").toLowerCase().trim();
                            return !rGodown || rGodown === godownName;
                        });
                    }
                }
                if (recs && recs.length > 0) {
                    records = [...records, ...recs];
                }
            });

            if (records.length === 0 && productName) {
                const key2 = `${productName}_${godownName}`;
                const recs = mappedProcessData.mapByProductNameAndGodown[key2];
                if (recs && recs.length > 0) {
                    records = [...records, ...recs];
                }
            }


            if (moduleFilter !== 'ALL') {
                records = records.filter(r => {
                    const rowModule = String(r.module || r.Module || r.voucher_name || r.Voucher_Type || "").toUpperCase().trim();
                    return rowModule.includes(moduleFilter);
                });
            }

            const hasModuleTransactions = records.length > 0;

            const trips = records.filter(
                (r) =>
                    r.stock_direction?.toUpperCase() === "IN" &&
                    isTrip(r)
            );

            const returns = records.filter(
                (r) =>
                    r.stock_direction?.toUpperCase() === "IN" &&
                    !isTrip(r)
            );
            const returnQty = returns.reduce((sum, r) => sum + Number(r.quantity || 0), 0);

            const stockInQty = records
                .filter((r) => r.stock_direction?.toUpperCase() === "IN")
                .reduce((sum, r) => sum + Number(r.quantity || 0), 0);

            const procInQty = records
                .filter((r) => r.stock_direction?.toUpperCase() === "PROCESS IN")
                .reduce((sum, r) => sum + Number(r.quantity || 0), 0);

            const procOutQty = records
                .filter((r) => r.stock_direction?.toUpperCase() === "PROCESS OUT")
                .reduce((sum, r) => sum + Number(r.quantity || 0), 0);

            const outwardQty = records
                .filter((r) => r.stock_direction?.toUpperCase() === "OUT")
                .reduce((sum, r) => sum + Number(r.quantity || 0), 0);

            const outRecords = records.filter(
                (r) => r.stock_direction?.toUpperCase() === "OUT"
            );

            let takenQty = 0;
            let inplaceQty = 0;
            let takenPersonCount = 0;
            let pendingTakenQty = 0;
            let pendingDeliveryQty = 0;

            outRecords.forEach((r) => {
                const qty = Number(r.quantity || 0);

                const status = String(r.Taken_Status || r.taken_status || "").toUpperCase().trim();
                if (status === "TAKEN") {
                    if (isTrip(r)) {
                        takenQty += qty;
                        const rawTaken = getTakenName(r);
                        if (rawTaken) {
                            const persons = rawTaken.split(",").map(p => p.trim()).filter(Boolean);
                            takenPersonCount += persons.length;
                        }
                    } else {
                        inplaceQty += qty;
                    }
                } else {
                    pendingTakenQty += qty;
                }

                if (!isTrip(r)) {
                    pendingDeliveryQty += qty;
                }
            });

            return {
                trips,
                returnQty,
                stockInQty,
                procInQty,
                procOutQty,
                outwardQty,
                takenQty,
                inplaceQty,
                takenPersonCount,
                pendingTakenQty,
                pendingDeliveryQty,
                hasModuleTransactions,
                outRecords
            };
        };
    }, [mappedProcessData, selectedGodown, moduleFilter]);



    // List of unique group values for filtering chips in detailed view
    const groupChips = useMemo(() => {
        const set = new Set<string>();
        (detailedStockData || []).forEach(x => {
            const productName = String(x.stock_item_name || x.Stock_Item || "").trim();
            if (!productName || productName === "-" || productName.toLowerCase() === "undefined" || productName.toLowerCase() === "null") {
                return;
            }
            const val = x[groupByColumn];
            if (val) set.add(String(val));
        });
        return ["All", ...Array.from(set).sort()];
    }, [detailedStockData, groupByColumn]);

    // Filtered data based on search and active group value
    const filteredDetailedData = useMemo(() => {
        const filtered = (detailedStockData || []).filter((item) => {
            const productName = String(item.stock_item_name || item.Stock_Item || item.product_name || "").trim();
            if (!productName || productName === "-" || productName.toLowerCase() === "undefined" || productName.toLowerCase() === "null") {
                return false;
            }

            const brandName = item.Brand || item.Group_Name || "";
            const groupVal = String(item[groupByColumn] || "");
            const matchesSearch = productName.toLowerCase().includes(searchText.toLowerCase()) ||
                brandName.toLowerCase().includes(searchText.toLowerCase()) ||
                groupVal.toLowerCase().includes(searchText.toLowerCase());
            const matchesGroup = selectedBrand === "All" || groupVal === selectedBrand;

            if (!matchesSearch || !matchesGroup) return false;

            const { trips, returnQty, stockInQty, procInQty, procOutQty, outwardQty, outRecords, hasModuleTransactions } = getProductDetails(item);

            const hasNonZeroQty =
                Number(item.OB_Bal_Qty || 0) !== 0 ||
                Number(item.Pur_Qty || 0) !== 0 ||
                Number(item.Sal_Qty || 0) !== 0 ||
                Number(item.Bal_Qty || 0) !== 0 ||
                Number(item.OB_Act_Qty || 0) !== 0 ||
                Number(item.Pur_Act_Qty || 0) !== 0 ||
                Number(item.Sal_Act_Qty || 0) !== 0 ||
                Number(item.Bal_Act_Qty || 0) !== 0 ||
                Number(item.Act_Bal_Qty || 0) !== 0 ||
                Number(item.OB_Qty || 0) !== 0 ||
                Number(item.IN_Qty || 0) !== 0 ||
                Number(item.Out_Qty || 0) !== 0 ||
                Number(item.OUT_Qty || 0) !== 0 ||
                Number(item.CL_QTY || 0) !== 0 ||
                Number(item.ACt_OB_Qty || 0) !== 0 ||
                Number(item.ACt_In_Qty || 0) !== 0 ||
                Number(item.IN_Act_Qty || 0) !== 0 ||
                Number(item.ACt_Out_Qty || 0) !== 0 ||
                Number(item.OUT_Act_Qty || 0) !== 0 ||
                Number(item.CL_ACt_QTY || 0) !== 0 ||
                Number(item.Process_IN_OUT_Qty || 0) !== 0 ||
                Number(item.Process_Act_IN_OUT_Qty || 0) !== 0 ||
                Number(item.Proc_IN_Qty || 0) !== 0 ||
                Number(item.Proc_OUT_Qty || 0) !== 0 ||
                Number(item.Proc_IN_Act_Qty || 0) !== 0 ||
                Number(item.Proc_OUT_Act_Qty || 0) !== 0 ||
                Number(item.SOU_In_Qty || 0) !== 0 ||
                Number(item.SOU_ACt_In_Qty || 0) !== 0 ||
                Number(item.SOU_Out_Qty || 0) !== 0 ||
                Number(item.SOU_ACt_Out_Qty || 0) !== 0 ||
                Object.keys(item).some(k => /qty/i.test(k) && Number(item[k] || 0) !== 0);

            const hasProcessActivity =
                trips.length > 0 ||
                Number(returnQty || 0) !== 0 ||
                Number(stockInQty || 0) !== 0 ||
                Number(procInQty || 0) !== 0 ||
                Number(procOutQty || 0) !== 0 ||
                Number(outwardQty || 0) !== 0 ||
                outRecords.length > 0;

            if (!hasNonZeroQty && !hasProcessActivity) {
                return false;
            }

            if (moduleFilter !== 'ALL') {
                if (!hasModuleTransactions) return false;
            }

            if (inwardMode) {
                const totalStockIn = Math.max(stockInQty, Number(item[qtyKeys.in] || 0));
                if (totalStockIn <= 0) return false;
            }
            if (processMode) {
                const totalProcIn = Math.max(procInQty, Number(item[qtyKeys.procIn] || 0));
                const totalProcOut = Math.max(procOutQty, Number(item[qtyKeys.procOut] || 0));
                if (totalProcIn <= 0 && totalProcOut <= 0) return false;
            }
            if (outwardMode) {
                const totalStockOut = Math.max(outwardQty, Number(item[qtyKeys.out] || 0));
                if (totalStockOut <= 0) return false;
            }

            return true;
        });

        // Sort items so identical group values cluster together, and then by enabled columns in order
        const sortedCols = [...enabledConfigColumns].sort((a, b) => a.order - b.order);
        return filtered.sort((a, b) => {
            // First sort by groupByColumn
            const valGroupByA = String(a[groupByColumn] || "Others").toLowerCase();
            const valGroupByB = String(b[groupByColumn] || "Others").toLowerCase();
            const cmpGroupBy = valGroupByA.localeCompare(valGroupByB, undefined, { numeric: true });
            if (cmpGroupBy !== 0) return cmpGroupBy;

            // Then sort by each enabled column in order
            for (const col of sortedCols) {
                const valA = String(a[col.key] || "").toLowerCase();
                const valB = String(b[col.key] || "").toLowerCase();
                const cmp = valA.localeCompare(valB, undefined, { numeric: true });
                if (cmp !== 0) return cmp;
            }
            return 0;
        });
    }, [detailedStockData, searchText, selectedBrand, groupByColumn, inwardMode, processMode, outwardMode, getProductDetails, qtyKeys, processApiData, moduleFilter, enabledConfigColumns]);

    const filteredData = useMemo(() => {
        if (!isPivotMode) return filteredDetailedData;

        const groups: Record<string, stockWiseReport> = {};

        filteredDetailedData.forEach(item => {
            const groupKeyParts: string[] = [];

            // Group by the selected groupByColumn
            const groupVal = String(item[groupByColumn] || "Others");
            groupKeyParts.push(groupVal);

            // Add other enabled columns that are NOT product-specific identifiers
            const excludedKeys = ["stock_item_name", "Stock_Item", "Product_Id", "POS_Item_Name", "Item_Name_Modified"];
            enabledConfigColumns.forEach(col => {
                if (!excludedKeys.includes(col.key) && col.key !== groupByColumn) {
                    groupKeyParts.push(String(item[col.key] ?? ""));
                }
            });

            const key = groupKeyParts.join(" | ");

            if (!groups[key]) {
                const groupedItem: any = {
                    ...item,
                    Product_Ids: [],
                };

                // Initialize numeric fields to 0
                const numericKeys = [
                    "OB_Bal_Qty", "Pur_Qty", "Sal_Qty", "Bal_Qty",
                    "OB_Act_Qty", "Pur_Act_Qty", "Sal_Act_Qty", "Bal_Act_Qty",
                    "OB_Qty", "IN_Qty", "Out_Qty", "CL_QTY",
                    "ACt_OB_Qty", "ACt_In_Qty", "Process_Act_IN_OUT_Qty", "ACt_Out_Qty", "CL_ACt_QTY",
                    "Process_IN_OUT_Qty", "SOU_In_Qty", "SOU_ACt_In_Qty", "SOU_Out_Qty", "SOU_ACt_Out_Qty"
                ];
                numericKeys.forEach(k => {
                    groupedItem[k] = 0;
                });

                groups[key] = groupedItem;
            }

            const g = groups[key];
            if (item.Product_Id) {
                (g as any).Product_Ids.push(item.Product_Id);
            }

            // Sum numeric fields
            const numericKeys = [
                "OB_Bal_Qty", "Pur_Qty", "Sal_Qty", "Bal_Qty",
                "OB_Act_Qty", "Pur_Act_Qty", "Sal_Act_Qty", "Bal_Act_Qty",
                "OB_Qty", "IN_Qty", "Out_Qty", "CL_QTY",
                "ACt_OB_Qty", "ACt_In_Qty", "Process_Act_IN_OUT_Qty", "ACt_Out_Qty", "CL_ACt_QTY",
                "Process_IN_OUT_Qty", "SOU_In_Qty", "SOU_ACt_In_Qty", "SOU_Out_Qty", "SOU_ACt_Out_Qty"
            ];
            numericKeys.forEach(k => {
                g[k] = Number(g[k]) + Number(item[k] || 0);
            });
        });

        return Object.values(groups);
    }, [filteredDetailedData, enabledConfigColumns, isPivotMode, groupByColumn]);

    const numFilteredAndSortedRows = filteredData;

    const getTripLabel = React.useCallback((t: any): string => {
        return getTripOrTakenLabel(t, false);
    }, [getTripOrTakenLabel]);

    const getQtyForTrip = React.useCallback((tripsList: any[], label: string, itemWeight: number = 1): number => {
        if (label === "Trip In") {
            const total = tripsList.reduce((sum, t) => sum + Number(t.quantity || 0), 0);
            return qtyMode === "bags" ? Math.round(total / itemWeight) : total;
        }
        const total = tripsList
            .filter(t => getTripLabel(t) === label)
            .reduce((sum, t) => sum + Number(t.quantity || 0), 0);
        return qtyMode === "bags" ? Math.round(total / itemWeight) : total;
    }, [getTripLabel, qtyMode]);

    // Unique inward trip headers in filteredData
    const inwardTripHeaders = useMemo(() => {
        if (viewMode === "cumulative") {
            return ["Trip In"];
        }
        const set = new Set<string>();
        filteredData.forEach((item) => {
            const { trips } = getProductDetails(item);
            trips.forEach((t) => {
                set.add(getTripLabel(t));
            });
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    }, [filteredData, getProductDetails, getTripLabel, viewMode]);

    const getQtyForTaken = React.useCallback((item: stockWiseReport, label: string): { qty: number; persons: number } => {
        const { outRecords } = getProductDetails(item);

        if (label === "Taken") {
            let qty = 0;
            let personsCount = 0;
            outRecords.forEach(r => {
                const status = String(r.Taken_Status || r.taken_status || "").toUpperCase().trim();
                if (status === "TAKEN" && isTrip(r)) {
                    qty += Number(r.quantity || 0);
                    const rawTaken = getTakenName(r);
                    if (rawTaken) {
                        const names = rawTaken.split(",").map(n => n.trim()).filter(Boolean);
                        personsCount += names.length;
                    }
                }
            });
            const finalQty = qtyMode === "bags" ? Math.round(qty / getItemWeight(item)) : qty;
            return { qty: finalQty, persons: personsCount };
        } else if (label === "Inplace") {
            let qty = 0;
            outRecords.forEach(r => {
                const status = String(r.Taken_Status || r.taken_status || "").toUpperCase().trim();
                if (status === "TAKEN" && !isTrip(r)) {
                    qty += Number(r.quantity || 0);
                }
            });
            const finalQty = qtyMode === "bags" ? Math.round(qty / getItemWeight(item)) : qty;
            return { qty: finalQty, persons: 0 };
        } else if (label === "Pending Taken") {
            let qty = 0;
            outRecords.forEach(r => {
                const status = String(r.Taken_Status || r.taken_status || "").toUpperCase().trim();
                if (status !== "TAKEN") {
                    qty += Number(r.quantity || 0);
                }
            });
            const finalQty = qtyMode === "bags" ? Math.round(qty / getItemWeight(item)) : qty;
            return { qty: finalQty, persons: 0 };
        } else {
            const tripLabelToMatch = label.toLowerCase().trim();
            let qty = 0;
            outRecords.forEach(r => {
                if (isTrip(r) && getTripLabel(r).toLowerCase().trim() === tripLabelToMatch) {
                    qty += Number(r.quantity || 0);
                }
            });
            const finalQty = qtyMode === "bags" ? Math.round(qty / getItemWeight(item)) : qty;
            return { qty: finalQty, persons: 0 };
        }
    }, [getProductDetails, qtyMode, getTripLabel]);

    // Unique outward taken headers in filteredData
    const outwardTakenHeaders = useMemo(() => {
        if (viewMode === "cumulative") {
            return ["Taken", "Pending Taken", "Inplace"];
        }
        const set = new Set<string>();
        filteredData.forEach((item) => {
            const godownName = String(item.Godown_Name || selectedGodown?.godown_name || "").toLowerCase().trim();
            const productIds = (item as any).Product_Ids;
            const pIdsToSearch = Array.isArray(productIds) && productIds.length > 0 ? productIds : [item.Product_Id];
            let records: any[] = [];
            pIdsToSearch.forEach((pId) => {
                if (!pId && pId !== 0) return;
                const strId = String(pId).trim();
                const key1 = `${strId}_${godownName}`;
                let recs = mappedProcessData.mapByProductAndGodown[key1];
                if (!recs || recs.length === 0) {
                    const rawRecs = mappedProcessData.mapByProductIdOnly[strId];
                    if (rawRecs) {
                        recs = rawRecs.filter((r: any) => {
                            const rGodown = String(r.godown_name || "").toLowerCase().trim();
                            return !rGodown || rGodown === godownName;
                        });
                    }
                }
                if (recs && recs.length > 0) {
                    records = [...records, ...recs];
                }
            });

            const outRecords = records.filter(r => r.stock_direction?.toUpperCase() === "OUT");
            outRecords.forEach(r => {
                if (isTrip(r)) {
                    set.add(getTripLabel(r));
                }
            });
        });
        const sortedTrips = Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        return sortedTrips;
    }, [filteredData, selectedGodown, mappedProcessData, viewMode, getTripLabel]);


    // Available split-up options for dropdowns
    const allInwardOptions = useMemo(() => {
        return [...inwardTripHeaders, "RETURN"];
    }, [inwardTripHeaders]);

    const allProcessOptions = useMemo(() => {
        return ["PROCESS IN", "PROCESS OUT"];
    }, []);

    const allOutwardOptions = useMemo(() => {
        if (viewMode === "cumulative") {
            return ["Taken", "Pending Taken", "Inplace"];
        }
        return [...outwardTakenHeaders, "Pending Delivery"];
    }, [outwardTakenHeaders, viewMode]);

    // Currently visible columns derived for dropdown display
    const visibleInwardColumns = useMemo(() => {
        return allInwardOptions.filter(opt => !hiddenInwardColumns.includes(opt));
    }, [allInwardOptions, hiddenInwardColumns]);

    const visibleProcessColumns = useMemo(() => {
        return allProcessOptions.filter(opt => !hiddenProcessColumns.includes(opt));
    }, [allProcessOptions, hiddenProcessColumns]);

    const visibleOutwardColumns = useMemo(() => {
        return allOutwardOptions.filter(opt => !hiddenOutwardColumns.includes(opt));
    }, [allOutwardOptions, hiddenOutwardColumns]);

    // Handlers for Stock In split-up dropdown
    const handleInwardSelectChange = (event: SelectChangeEvent<string[]>) => {
        const value = event.target.value;
        const selected = typeof value === "string" ? value.split(",") : value;
        const hidden = allInwardOptions.filter(opt => !selected.includes(opt));
        setHiddenInwardColumns(hidden);
    };

    // Handlers for Process split-up dropdown
    const handleProcessSelectChange = (event: SelectChangeEvent<string[]>) => {
        const value = event.target.value;
        const selected = typeof value === "string" ? value.split(",") : value;
        const hidden = allProcessOptions.filter(opt => !selected.includes(opt));
        setHiddenProcessColumns(hidden);
    };

    // Handlers for Stock Outwards split-up dropdown
    const handleOutwardSelectChange = (event: SelectChangeEvent<string[]>) => {
        const value = event.target.value;
        const selected = typeof value === "string" ? value.split(",") : value;
        const hidden = allOutwardOptions.filter(opt => !selected.includes(opt));
        setHiddenOutwardColumns(hidden);
    };

    // Calculate total quantity for each trip in inwardMode
    const inwardTripTotals = useMemo(() => {
        const totals: Record<string, number> = {};
        inwardTripHeaders.forEach(label => {
            let sum = 0;
            filteredData.forEach(item => {
                const { trips } = getProductDetails(item);
                sum += getQtyForTrip(trips, label, getItemWeight(item));
            });
            totals[label] = sum;
        });
        return totals;
    }, [filteredData, inwardTripHeaders, getProductDetails, getQtyForTrip]);

    // Calculate total quantity for each trip in outwardMode
    const outwardTakenTotals = useMemo(() => {
        const totals: Record<string, { qty: number; persons: number }> = {};
        outwardTakenHeaders.forEach(label => {
            let sumQty = 0;
            let sumPersons = 0;
            filteredData.forEach(item => {
                const data = getQtyForTaken(item, label);
                sumQty += data.qty;
                sumPersons += data.persons;
            });
            totals[label] = { qty: sumQty, persons: sumPersons };
        });
        return totals;
    }, [filteredData, outwardTakenHeaders, getQtyForTaken]);

    // Removed duplicate getTakenByNameFromStaffInvolved helper (moved to top of file)

    const filteredPopupRows = useMemo(() => {
        return ledgerRows.filter((r) => {
            const isOB = (r.Do_Inv_No || r.Do_inv_no || r.invoice_no || r.Invoice_No) === "OB" || String(r.Particulars || r.Narration || "").toLowerCase().includes("opening balance");
            const isSJ = String(r.Narration || r.Particulars || "").toLowerCase().includes("stock journal") ||
                String(r.Voucher_Type || r.voucher_name || "").toLowerCase().includes("stock journal") ||
                String(r.module || r.Module || "").toLowerCase().includes("stock journal") ||
                r.Direction !== undefined;
            const isPending = String(r.Record_Type || "").toUpperCase() === "PENDING_DELIVERY" || String(r.Record_Type || "").toUpperCase() === "PENDING" || popupFilterType === "Pending Taken" || popupFilterType === "Pending Delivery";

            const { inQty, outQty } = getRowQuantities(r);

            if (popupFilterType === "OB") {
                return isOB;
            } if (popupFilterType === "IN") {
                return !isOB && !isPending && inQty > 0;
            }
            if (popupFilterType === "PROCESS") {
                return isSJ;
            }
            if (popupFilterType === "PROCESS_IN") {
                return isSJ && inQty > 0;
            }
            if (popupFilterType === "PROCESS_OUT") {
                return isSJ && outQty > 0;
            }

            // Lookup corresponding raw record from processApi data for trip / return / delivery filtering
            if (popupProductInfo) {
                const godownName = String(popupProductInfo.godownName || "").toLowerCase().trim();
                const productIdStr = String(popupProductInfo.productId).trim();
                const key1 = `${productIdStr}_${godownName}`;
                let recs = mappedProcessData.mapByProductAndGodown[key1] || [];
                if (recs.length === 0) {
                    const rawRecs = mappedProcessData.mapByProductIdOnly[productIdStr];
                    if (rawRecs) {
                        recs = rawRecs.filter((pr: any) => {
                            const rGodown = String(pr.godown_name || "").toLowerCase().trim();
                            return !rGodown || rGodown === godownName;
                        });
                    }
                }
                const invoiceNo = r.Do_Inv_No || r.Do_inv_no || r.invoice_no;
                const matchingRawRecord = recs.find(x => x.module_voucher_number === invoiceNo);

                const isOutwardRecord = outwardMode ||
                    popupFilterType === "OUT" ||
                    popupFilterType === "Pending Taken" ||
                    popupFilterType === "Pending Delivery" ||
                    popupFilterType === "Taken" ||
                    outwardTakenHeaders.includes(popupFilterType) ||
                    (popupFilterType === "ALL" && String(r.Direction || r.stock_direction || "").toUpperCase() === "OUT");

                const directTripInfo = getRowTripOrTakenInfo(r, isOutwardRecord);
                if (popupFilterType === "OUT") {
                    const rawTakenStatus = String(r.Taken_Status || r.taken_status || "").toUpperCase().trim();
                    const tripTakenStatus = matchingRawRecord ? String(matchingRawRecord.Taken_Status || matchingRawRecord.taken_status || "").toUpperCase().trim() : "";
                    const isTaken = (rawTakenStatus === "TAKEN") || (tripTakenStatus === "TAKEN");
                    const hasTrip = isTrip(r) || (matchingRawRecord ? isTrip(matchingRawRecord) : false);
                    const isInplace = isTaken && !hasTrip;
                    return !isPending && !isInplace && outQty > 0;
                }
                if (popupFilterType === "Trip In") {
                    if (matchingRawRecord) {
                        return matchingRawRecord.stock_direction?.toUpperCase() === "IN" && isTrip(matchingRawRecord);
                    }
                    return directTripInfo.isTrip;
                }
                if (popupFilterType === "RETURN") {
                    if (matchingRawRecord) {
                        return matchingRawRecord.stock_direction?.toUpperCase() === "IN" && !isTrip(matchingRawRecord);
                    }
                    return !isOB && !isSJ && !isPending && !directTripInfo.isTrip && Number(r.Stock_In_Qty ?? r.In_Qty ?? r.Bill_Qty ?? 0) > 0;
                }
                if (popupFilterType === "Pending Taken") {
                    const rawTakenStatus = String(r.Taken_Status || r.taken_status || "").toUpperCase().trim();
                    const tripTakenStatus = matchingRawRecord ? String(matchingRawRecord.Taken_Status || matchingRawRecord.taken_status || "").toUpperCase().trim() : "";
                    const isTaken = (rawTakenStatus === "TAKEN") || (tripTakenStatus === "TAKEN");
                    const { pendingQty } = getRowQuantities(r);
                    return !isOB && !isSJ && !isTaken && pendingQty > 0;
                }
                if (popupFilterType === "Inplace") {
                    const rawTakenStatus = String(r.Taken_Status || r.taken_status || "").toUpperCase().trim();
                    const tripTakenStatus = matchingRawRecord ? String(matchingRawRecord.Taken_Status || matchingRawRecord.taken_status || "").toUpperCase().trim() : "";
                    const isTaken = (rawTakenStatus === "TAKEN") || (tripTakenStatus === "TAKEN");
                    const hasTrip = isTrip(r) || (matchingRawRecord ? isTrip(matchingRawRecord) : false);
                    const { outQty } = getRowQuantities(r);
                    return !isOB && !isSJ && isTaken && !hasTrip && outQty > 0;
                }
                if (popupFilterType === "Pending Delivery") {
                    const { pendingQty } = getRowQuantities(r);
                    if (processApiData.length > 0) {
                        if (matchingRawRecord) {
                            return !isOB && !isSJ && !isTrip(matchingRawRecord) && pendingQty > 0;
                        }
                        return false;
                    }
                    return !isOB && !isSJ && !isTrip(r) && pendingQty > 0;
                }
                if (popupFilterType === "Taken") {
                    const rawTakenStatus = String(r.Taken_Status || r.taken_status || "").toUpperCase().trim();
                    const tripTakenStatus = matchingRawRecord ? String(matchingRawRecord.Taken_Status || matchingRawRecord.taken_status || "").toUpperCase().trim() : "";
                    const isTaken = (rawTakenStatus === "TAKEN") || (tripTakenStatus === "TAKEN");
                    const hasTrip = isTrip(r) || (matchingRawRecord ? isTrip(matchingRawRecord) : false);
                    return !isOB && !isSJ && isTaken && hasTrip;
                }
                if (popupFilterType.startsWith("Taken") && popupFilterType !== "Taken") {
                    const nameToMatch = popupFilterType.replace(/^Taken\s*-\s*/i, "").trim().toLowerCase();
                    if (processApiData.length > 0) {
                        if (matchingRawRecord) {
                            const rawTakenName = getTakenName(matchingRawRecord);
                            if (rawTakenName) {
                                const names = rawTakenName.split(",").map(n => n.trim().toLowerCase()).filter(Boolean);
                                return names.includes(nameToMatch);
                            }
                        }
                        return false;
                    }
                    const rawTakenName = getTakenName(r);
                    if (rawTakenName) {
                        const names = rawTakenName.split(",").map(n => n.trim().toLowerCase()).filter(Boolean);
                        return names.includes(nameToMatch);
                    }
                    return false;
                }
                if (popupFilterType.startsWith("Trip")) {
                    const cleanLabel = (lbl: string) => {
                        const parts = lbl.split(" - ");
                        return parts.slice(0, 2).join(" - ").trim().toLowerCase();
                    };
                    if (directTripInfo.isTrip && cleanLabel(directTripInfo.label) === cleanLabel(popupFilterType)) {
                        return true;
                    }
                    if (matchingRawRecord) {
                        return isTrip(matchingRawRecord) && cleanLabel(getTripOrTakenLabel(matchingRawRecord, isOutwardRecord)) === cleanLabel(popupFilterType);
                    }
                    return false;
                }
            }

            if ((popupFilterType === 'OUT' || (outwardMode && popupFilterType.startsWith('Taken'))) && moduleFilter !== 'ALL') {
                const rowModule = String(r.module || r.Module || r.voucher_name || r.Voucher_Type || "").toUpperCase().trim();
                return rowModule.includes(moduleFilter);
            }

            return true;
        });
    }, [ledgerRows, popupFilterType, popupProductInfo, mappedProcessData, outwardMode, moduleFilter]);

    const uniqueRoles = useMemo(() => {
        const rolesSet = new Set<string>();
        filteredPopupRows.forEach(row => {
            if (row.Staff_Involved) {
                const parts = row.Staff_Involved.split(',');
                parts.forEach((part: string) => {
                    const match = part.trim().match(/^(.*?)\s*\((.*?)\)$/);
                    if (match) {
                        rolesSet.add(match[2].trim());
                    }
                });
            }
        });
        return Array.from(rolesSet).sort();
    }, [filteredPopupRows]);

    const popupTotals = useMemo(() => {
        let totalInQty = 0;
        let totalProcessQty = 0;
        let totalOutQty = 0;
        let totalPendingQty = 0;
        let totalFilteredQty = 0;

        filteredPopupRows.forEach(r => {
            const { inQty, processQty, outQty, pendingQty } = getRowQuantities(r);
            totalInQty += inQty;
            totalProcessQty += processQty;
            totalOutQty += outQty;
            totalPendingQty += pendingQty;

            totalFilteredQty += getRowQtyForFilter(r, popupFilterType);
        });

        return {
            totalInQty,
            totalProcessQty,
            totalOutQty,
            totalPendingQty,
            totalFilteredQty
        };
    }, [filteredPopupRows, popupFilterType, popupProductInfo, mappedProcessData]);

    useEffect(() => {
        const handleResize = () => {
            if (headerRowRef.current) {
                setHeaderHeight(headerRowRef.current.offsetHeight);
            }
        };
        window.addEventListener("resize", handleResize);

        handleResize();
        const t = setTimeout(handleResize, 100);

        return () => {
            window.removeEventListener("resize", handleResize);
            clearTimeout(t);
        };
    }, [filteredData, inwardMode, outwardMode, processMode, columnsConfig, searchText, page, rowsPerPage, selectedGodown]);

    const formatISTTimeOnly = (dateString: any): string => {
        if (!dateString) return "-";
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return "-";

        const formatter = new Intl.DateTimeFormat("en-US", {
            timeZone: "Asia/Kolkata",
            hour: "numeric",
            minute: "2-digit",
            hour12: true
        });

        const parts = formatter.formatToParts(date);
        const getPart = (type: string) => parts.find(p => p.type === type)?.value || "";

        const hour = getPart("hour");
        const minute = getPart("minute");
        const dayPeriod = getPart("dayPeriod").toLowerCase();

        const ampm = dayPeriod.includes("pm") || dayPeriod.includes("p.m") ? "p.m." : "a.m.";

        return `${hour}.${minute} ${ampm}`;
    };

    // Slice data for pagination
    const paginatedData = useMemo(() => {
        return numFilteredAndSortedRows.slice((page - 1) * rowsPerPage, page * rowsPerPage);
    }, [numFilteredAndSortedRows, page, rowsPerPage]);

    // Detailed quantities helpers
    const getOpeningStock = (item: stockWiseReport) => {
        const base = Number(item[qtyKeys.opening] || 0);
        return qtyMode === "bags" ? Math.round(base / getItemWeight(item)) : base;
    };
    const getStockInTotal = (item: stockWiseReport) => {
        const base = Number(item[qtyKeys.in] || 0);
        return qtyMode === "bags" ? Math.round(base / getItemWeight(item)) : base;
    };
    const getStockOutTotal = (item: stockWiseReport) => {
        const base = Number(item[qtyKeys.out] || 0);
        return qtyMode === "bags" ? Math.round(base / getItemWeight(item)) : base;
    };

    const getProcIn = (item: stockWiseReport) => {
        const base = Number(item[qtyKeys.procIn] || 0);
        return qtyMode === "bags" ? Math.round(base / getItemWeight(item)) : base;
    };
    const getProcOut = (item: stockWiseReport) => {
        const base = Number(item[qtyKeys.procOut] || 0);
        return qtyMode === "bags" ? Math.round(base / getItemWeight(item)) : base;
    };

    const getRecalculatedStockInQty = React.useCallback((item: stockWiseReport) => {
        const rawStockIn = getStockInTotal(item);
        const visibleCount = visibleInwardColumns.length;
        if (visibleCount === allInwardOptions.length) {
            return rawStockIn;
        }
        if (visibleCount === 0) {
            return 0;
        }

        const { trips, returnQty } = getProductDetails(item);
        if (trips.length > 0 || returnQty > 0) {
            let sum = 0;
            inwardTripHeaders.forEach((tripLabel) => {
                if (!hiddenInwardColumns.includes(tripLabel)) {
                    sum += getQtyForTrip(trips, tripLabel, getItemWeight(item));
                }
            });
            if (!hiddenInwardColumns.includes("RETURN")) {
                sum += qtyMode === "bags" ? Math.round(returnQty / getItemWeight(item)) : returnQty;
            }
            return sum;
        } else {
            return (rawStockIn * visibleCount) / allInwardOptions.length;
        }
    }, [getProductDetails, inwardTripHeaders, hiddenInwardColumns, getQtyForTrip, visibleInwardColumns, allInwardOptions, getStockInTotal, qtyMode]);

    // Recalculated row-level Stock Out Quantity summing only visible columns
    const getRecalculatedStockOutQty = React.useCallback((item: stockWiseReport) => {
        const rawStockOut = getStockOutTotal(item);
        const visibleCount = visibleOutwardColumns.length;
        if (visibleCount === allOutwardOptions.length) {
            return rawStockOut;
        }
        if (visibleCount === 0) {
            return 0;
        }

        const { pendingTakenQty, pendingDeliveryQty } = getProductDetails(item);
        if (rawStockOut > 0) {
            let sum = 0;
            if (viewMode === "cumulative") {
                if (!hiddenOutwardColumns.includes("Taken")) {
                    sum += getQtyForTaken(item, "Taken").qty;
                }
                if (!hiddenOutwardColumns.includes("Pending Taken")) {
                    sum += qtyMode === "bags" ? Math.round(pendingTakenQty / getItemWeight(item)) : pendingTakenQty;
                }
                if (!hiddenOutwardColumns.includes("Inplace")) {
                    sum += getQtyForTaken(item, "Inplace").qty;
                }
            } else {
                if (!hiddenOutwardColumns.includes("Taken")) {
                    sum += getQtyForTaken(item, "Taken").qty;
                }
                if (!hiddenOutwardColumns.includes("Pending Delivery")) {
                    sum += qtyMode === "bags" ? Math.round(pendingDeliveryQty / getItemWeight(item)) : pendingDeliveryQty;
                }
                sum = Math.min(sum, rawStockOut);
            }
            return sum;
        } else {
            return (rawStockOut * visibleCount) / allOutwardOptions.length;
        }
    }, [getProductDetails, hiddenOutwardColumns, qtyMode, visibleOutwardColumns, allOutwardOptions, getStockOutTotal, getQtyForTaken, viewMode]);

    // Recalculated row-level Process Quantity summing only visible columns
    const getRecalculatedProcessQty = React.useCallback((item: stockWiseReport) => {
        const visibleCount = visibleProcessColumns.length;
        if (visibleCount === 0) {
            return 0;
        }

        const { procInQty, procOutQty } = getProductDetails(item);
        const weight = getItemWeight(item);
        const itemProcIn = qtyMode === "bags" ? Math.round(procInQty / weight) : procInQty;
        const itemProcOut = qtyMode === "bags" ? Math.round(procOutQty / weight) : procOutQty;
        const pIn = itemProcIn > 0 ? itemProcIn : getProcIn(item);
        const pOut = itemProcOut > 0 ? itemProcOut : getProcOut(item);

        let sum = 0;
        if (!hiddenProcessColumns.includes("PROCESS IN")) {
            sum += pIn;
        }
        if (!hiddenProcessColumns.includes("PROCESS OUT")) {
            sum -= pOut;
        }
        return sum;
    }, [getProductDetails, hiddenProcessColumns, getProcIn, getProcOut, qtyMode, visibleProcessColumns]);

    // Recalculated row-level Closing Stock Quantity
    const getRecalculatedClosingStock = React.useCallback((item: stockWiseReport) => {
        const opening = getOpeningStock(item);
        const inQty = getRecalculatedStockInQty(item);
        const procQty = getRecalculatedProcessQty(item);
        const outQty = getRecalculatedStockOutQty(item);

        return opening + inQty + procQty - outQty;
    }, [getOpeningStock, getRecalculatedStockInQty, getRecalculatedProcessQty, getRecalculatedStockOutQty]);

    // Calculate totals for the selected godown's filtered data
    const detailedTotals = useMemo(() => {
        let opening = 0;
        let stockIn = 0;
        let procIn = 0;
        let procOut = 0;
        let takenQtyTotal = 0;
        let returnQtyTotal = 0;
        let outTakenQtyTotal = 0;
        let deliveryQtyTotal = 0;
        let stockOutTotal = 0;
        let closing = 0;

        filteredData.forEach(item => {
            const op = getOpeningStock(item);
            const inQty = getRecalculatedStockInQty(item);
            const outQty = getRecalculatedStockOutQty(item);
            const clQty = getRecalculatedClosingStock(item);

            opening += op;
            closing += clQty;

            const { trips, returnQty, procInQty, procOutQty, takenQty, pendingTakenQty, pendingDeliveryQty } = getProductDetails(item);

            if (processApiData.length > 0) {
                const weight = getItemWeight(item);
                const itemTakenQtyBase = trips.reduce((sum, r) => sum + Number(r.quantity || 0), 0);
                const itemTakenQty = qtyMode === "bags" ? Math.round(itemTakenQtyBase / weight) : itemTakenQtyBase;

                const itemReturnQty = qtyMode === "bags" ? Math.round(returnQty / weight) : returnQty;
                const itemProcIn = qtyMode === "bags" ? Math.round(procInQty / weight) : procInQty;
                const itemProcOut = qtyMode === "bags" ? Math.round(procOutQty / weight) : procOutQty;

                const itemOutTakenQty = qtyMode === "bags" ? Math.round(takenQty / weight) : takenQty;
                const itemDeliveryQty = qtyMode === "bags"
                    ? Math.round((viewMode === "cumulative" ? pendingTakenQty : pendingDeliveryQty) / weight)
                    : (viewMode === "cumulative" ? pendingTakenQty : pendingDeliveryQty);

                takenQtyTotal += itemTakenQty;
                returnQtyTotal += itemReturnQty;
                outTakenQtyTotal += itemOutTakenQty;
                deliveryQtyTotal += itemDeliveryQty;
                procIn += itemProcIn > 0 ? itemProcIn : getProcIn(item);
                procOut += itemProcOut > 0 ? itemProcOut : getProcOut(item);
                stockIn += inQty;
                stockOutTotal += outQty;
            } else {
                const pIn = getProcIn(item);
                const pOut = getProcOut(item);
                procIn += pIn;
                procOut += pOut;
                stockIn += inQty;
                stockOutTotal += outQty;

                const t1 = Math.round(inQty * 0.5);
                const t2 = Math.round(inQty * 0.3);
                const t3 = Math.max(0, inQty - t1 - t2);
                takenQtyTotal += t1 + t2 + t3;

                const o1 = Math.round(outQty * 0.6);
                const o2 = Math.round(outQty * 0.2);
                const o3 = Math.round(outQty * 0.1);
                const del = Math.max(0, outQty - o1 - o2 - o3);
                outTakenQtyTotal += o1 + o2 + o3;
                deliveryQtyTotal += del;
            }
        });

        return {
            opening,
            stockIn,
            procIn,
            procOut,
            takenQtyTotal,
            returnQtyTotal,
            outTakenQtyTotal,
            deliveryQtyTotal,
            stockOutTotal,
            closing,
            totalInward: stockIn,
            totalOutward: stockOutTotal,
            totalProcess: procIn - procOut
        };
    }, [filteredData, qtyKeys, getProductDetails, processApiData]);

    // Memoized recalculated grand totals
    const recalculatedTotals = useMemo(() => {
        let inwardTotal = 0;
        let outwardTotal = 0;
        let processTotal = 0;

        filteredData.forEach(item => {
            inwardTotal += getRecalculatedStockInQty(item);
            outwardTotal += getRecalculatedStockOutQty(item);
            processTotal += getRecalculatedProcessQty(item);
        });

        const closingTotal = detailedTotals.opening + inwardTotal + processTotal - outwardTotal;

        return {
            inwardTotal,
            outwardTotal,
            processTotal,
            closingTotal
        };
    }, [
        filteredData,
        getRecalculatedStockInQty,
        getRecalculatedStockOutQty,
        getRecalculatedProcessQty,
        detailedTotals.opening
    ]);

    // Excel Export
    const handleExportExcel = () => {
        try {
            const excelData: any[][] = [];
            const fmt = (val: any) => {
                if (val === null || val === undefined || val === "" || val === "-") return "-";
                const num = Number(val);
                return isNaN(num) ? val : Number(num.toFixed(2));
            };
            if (selectedGodown) {
                excelData.push([`STOCK REPORT - ${selectedGodown.godown_name.toUpperCase()}`]);
                excelData.push([]);
                const configLabels = enabledConfigColumns.map(c => c.label);

                if (inwardMode) {
                    const visibleTrips = inwardTripHeaders.filter(t => !hiddenInwardColumns.includes(t));
                    const isReturnVisible = !hiddenInwardColumns.includes("RETURN");

                    const inwardHeaderRow = ["S.No", ...configLabels, ...visibleTrips];
                    if (isReturnVisible) inwardHeaderRow.push("Return");
                    inwardHeaderRow.push("Total Stock In");
                    excelData.push(inwardHeaderRow);

                    filteredData.forEach((item, idx) => {
                        const { trips, returnQty } = getProductDetails(item);
                        const row: any[] = [idx + 1];
                        enabledConfigColumns.forEach(c => row.push(item[c.key] ?? "-"));

                        visibleTrips.forEach(tripLabel => {
                            const qty = getQtyForTrip(trips, tripLabel);
                            row.push(qty === 0 ? "-" : fmt(qty));
                        });

                        if (isReturnVisible) {
                            row.push(fmt(returnQty));
                        }
                        row.push(fmt(getRecalculatedStockInQty(item)));
                        excelData.push(row);
                    });
                } else if (outwardMode) {
                    const visibleTrips = outwardTakenHeaders.filter(t => !hiddenOutwardColumns.includes(t));
                    const isPendingVisible = viewMode === "trip" && !hiddenOutwardColumns.includes("Pending Delivery");

                    const outwardHeaderRow = ["S.No", ...configLabels, ...visibleTrips];
                    if (isPendingVisible) outwardHeaderRow.push("Pending Delivery");
                    outwardHeaderRow.push("Total Outward");
                    excelData.push(outwardHeaderRow);
                    filteredData.forEach((item, idx) => {
                        const { pendingDeliveryQty } = getProductDetails(item);
                        const row: any[] = [idx + 1];
                        enabledConfigColumns.forEach(c => row.push(item[c.key] ?? "-"));

                        visibleTrips.forEach(tripLabel => {
                            const data = getQtyForTaken(item, tripLabel);
                            row.push(data.qty === 0 ? "-" : fmt(data.qty));
                        });

                        if (isPendingVisible) {
                            const pQty = qtyMode === "bags" ? Math.round(pendingDeliveryQty / getItemWeight(item)) : pendingDeliveryQty;
                            row.push(pQty === 0 ? "-" : fmt(pQty));
                        }
                        row.push(fmt(getRecalculatedStockOutQty(item)));
                        excelData.push(row);
                    });
                } else if (processMode) {
                    const isProcessInVisible = !hiddenProcessColumns.includes("PROCESS IN");
                    const isProcessOutVisible = !hiddenProcessColumns.includes("PROCESS OUT");

                    const processHeaderRow = ["S.No", ...configLabels];
                    if (isProcessInVisible) processHeaderRow.push("Process In");
                    if (isProcessOutVisible) processHeaderRow.push("Process Out");
                    processHeaderRow.push("Total Process");
                    excelData.push(processHeaderRow);
                    filteredData.forEach((item, idx) => {
                        const { procInQty, procOutQty } = getProductDetails(item);
                        const weight = getItemWeight(item);
                        const displayProcIn = qtyMode === "bags" ? Math.round(procInQty / weight) : procInQty;
                        const displayProcOut = qtyMode === "bags" ? Math.round(procOutQty / weight) : procOutQty;
                        const rowProcIn = displayProcIn > 0 ? displayProcIn : getProcIn(item);
                        const rowProcOut = displayProcOut > 0 ? displayProcOut : getProcOut(item);
                        const row: any[] = [idx + 1];
                        enabledConfigColumns.forEach(c => row.push(item[c.key] ?? "-"));

                        if (isProcessInVisible) row.push(fmt(rowProcIn));
                        if (isProcessOutVisible) row.push(fmt(rowProcOut));
                        row.push(fmt(getRecalculatedProcessQty(item)));
                        excelData.push(row);
                    });
                } else {
                    excelData.push(["S.No", ...configLabels, "Opening Stock", "Stock In", "Process", "Stock Outwards", "Closing Stock"]);
                    filteredData.forEach((item, idx) => {
                        const row: any[] = [idx + 1];
                        enabledConfigColumns.forEach(c => row.push(item[c.key] ?? "-"));
                        row.push(
                            fmt(getOpeningStock(item)),
                            fmt(getRecalculatedStockInQty(item)),
                            fmt(getRecalculatedProcessQty(item)),
                            fmt(getRecalculatedStockOutQty(item)),
                            fmt(getRecalculatedClosingStock(item))
                        );
                        excelData.push(row);
                    });
                }
            } else {
                excelData.push([`GODOWNS OVERALL SUMMARY`]);
                excelData.push([]);
                excelData.push(["S.No", "Godown Name", "OB", "Stock In", "Process", "Stock Out", "Closing"]);

                let sno = 1;
                Object.entries(groupedGodowns).forEach(([parentName, items]) => {
                    const groupOB = items.reduce((sum, r) => sum + Number((qtyMode === "actQty" ? r.ACt_OB_Qty : r.OB_Qty) || 0), 0);
                    const groupIn = items.reduce((sum, r) => sum + Number((qtyMode === "actQty" ? r.ACt_In_Qty : r.IN_Qty) || 0), 0);
                    const groupProcess = items.reduce((sum, r) => sum + Number((qtyMode === "actQty" ? r.Process_Act_IN_OUT_Qty : r.Process_IN_OUT_Qty) || 0), 0);
                    const groupOut = items.reduce((sum, r) => sum + Number((qtyMode === "actQty" ? r.ACt_Out_Qty : r.Out_Qty) || 0), 0);
                    const groupCL = items.reduce((sum, r) => sum + Number((qtyMode === "actQty" ? r.CL_ACt_QTY : r.CL_QTY) || 0), 0);

                    // Add group row
                    excelData.push(["", parentName, fmt(groupOB), fmt(groupIn), fmt(groupProcess), fmt(groupOut), fmt(groupCL)]);

                    items.forEach((row) => {
                        excelData.push([
                            sno++,
                            row.godown_name,
                            fmt(Number((qtyMode === "actQty" ? row.ACt_OB_Qty : row.OB_Qty) || 0)),
                            fmt(Number((qtyMode === "actQty" ? row.ACt_In_Qty : row.IN_Qty) || 0)),
                            fmt(Number((qtyMode === "actQty" ? row.Process_Act_IN_OUT_Qty : row.Process_IN_OUT_Qty) || 0)),
                            fmt(Number((qtyMode === "actQty" ? row.ACt_Out_Qty : row.Out_Qty) || 0)),
                            fmt(Number((qtyMode === "actQty" ? row.CL_ACt_QTY : row.CL_QTY) || 0))
                        ]);
                    });
                });

                // Add grand total row
                excelData.push([
                    "Total",
                    "",
                    fmt(grandTotals.opening),
                    fmt(grandTotals.stockIn),
                    fmt(grandTotals.process),
                    fmt(grandTotals.stockOut),
                    fmt(grandTotals.closing)
                ]);
            }
            const ws = XLSX.utils.aoa_to_sheet(excelData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Stock Report");
            XLSX.writeFile(wb, `Stock_Report_${selectedGodown ? selectedGodown.godown_name.replace(/\s+/g, '_') : 'Overall'}_${dayjs().format("YYYYMMDD_HHmmss")}.xlsx`);
            toast.success("Excel Exported Successfully ✅");
        } catch (err) {
            console.error(err);
            toast.error("Failed to export Excel ❌");
        }
    };

    // PDF Export
    const handleExportPDF = () => {
        try {
            const doc = new jsPDF("portrait", "mm", "a4");
            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");

            const title = selectedGodown ? `STOCK REPORT - ${selectedGodown.godown_name.toUpperCase()}` : "GODOWNS OVERALL SUMMARY";
            doc.text(title, 105, 12, { align: "center" });

            const body: any[][] = [];
            let headers: string[][] = [];

            const fmtStr = (val: any) => {
                if (val === null || val === undefined || val === "" || val === "-") return "-";
                const num = Number(val);
                if (isNaN(num)) return String(val);
                if (num === 0) return "-";
                return Number(num.toFixed(2)).toLocaleString();
            };

            if (selectedGodown) {
                const configLabels = enabledConfigColumns.map(c => c.label);

                if (inwardMode) {
                    const visibleTrips = inwardTripHeaders.filter(t => !hiddenInwardColumns.includes(t));
                    const isReturnVisible = !hiddenInwardColumns.includes("RETURN");

                    const inwardHeaderRow = ["S.No", ...configLabels, ...visibleTrips];
                    if (isReturnVisible) inwardHeaderRow.push("Return");
                    inwardHeaderRow.push("Total Stock In");
                    headers = [inwardHeaderRow];

                    filteredData.forEach((item, idx) => {
                        const { trips, returnQty } = getProductDetails(item);
                        const row: any[] = [idx + 1];
                        enabledConfigColumns.forEach(c => row.push(item[c.key] ?? "-"));

                        visibleTrips.forEach(tripLabel => {
                            const qty = getQtyForTrip(trips, tripLabel);
                            row.push(fmtStr(qty));
                        });

                        if (isReturnVisible) {
                            row.push(fmtStr(returnQty));
                        }
                        row.push(fmtStr(getRecalculatedStockInQty(item)));
                        body.push(row);
                    });
                } else if (outwardMode) {
                    const visibleTrips = outwardTakenHeaders.filter(t => !hiddenOutwardColumns.includes(t));
                    const isPendingVisible = viewMode === "trip" && !hiddenOutwardColumns.includes("Pending Delivery");

                    const outwardHeaderRow = ["S.No", ...configLabels, ...visibleTrips];
                    if (isPendingVisible) outwardHeaderRow.push("Pending Delivery");
                    outwardHeaderRow.push("Total Outward");
                    headers = [outwardHeaderRow];

                    filteredData.forEach((item, idx) => {
                        const { pendingDeliveryQty } = getProductDetails(item);
                        const row: any[] = [idx + 1];
                        enabledConfigColumns.forEach(c => row.push(item[c.key] ?? "-"));

                        visibleTrips.forEach(tripLabel => {
                            const data = getQtyForTaken(item, tripLabel);
                            row.push(data.qty === 0 ? "-" : fmtStr(data.qty));
                        });

                        if (isPendingVisible) {
                            const pQty = qtyMode === "bags" ? Math.round(pendingDeliveryQty / getItemWeight(item)) : pendingDeliveryQty;
                            row.push(pQty === 0 ? "-" : fmtStr(pQty));
                        }
                        row.push(fmtStr(getRecalculatedStockOutQty(item)));
                        body.push(row);
                    });
                } else if (processMode) {
                    const isProcessInVisible = !hiddenProcessColumns.includes("PROCESS IN");
                    const isProcessOutVisible = !hiddenProcessColumns.includes("PROCESS OUT");

                    const processHeaderRow = ["S.No", ...configLabels];
                    if (isProcessInVisible) processHeaderRow.push("Process In");
                    if (isProcessOutVisible) processHeaderRow.push("Process Out");
                    processHeaderRow.push("Total Process");
                    headers = [processHeaderRow];
                    filteredData.forEach((item, idx) => {
                        const row: any[] = [idx + 1];
                        enabledConfigColumns.forEach(c => row.push(item[c.key] ?? "-"));
                        const { procInQty, procOutQty } = getProductDetails(item);
                        const weight = getItemWeight(item);
                        const displayProcIn = qtyMode === "bags" ? Math.round(procInQty / weight) : procInQty;
                        const displayProcOut = qtyMode === "bags" ? Math.round(procOutQty / weight) : procOutQty;
                        const rowProcIn = displayProcIn > 0 ? displayProcIn : getProcIn(item);
                        const rowProcOut = displayProcOut > 0 ? displayProcOut : getProcOut(item);

                        if (isProcessInVisible) row.push(fmtStr(rowProcIn));
                        if (isProcessOutVisible) row.push(fmtStr(rowProcOut));
                        row.push(fmtStr(getRecalculatedProcessQty(item)));
                        body.push(row);
                    });
                } else {
                    headers = [["S.No", ...configLabels, "Opening", "Stock In", "Process", "Stock Out", "Closing"]];
                    filteredData.forEach((item, idx) => {
                        const row: any[] = [idx + 1];
                        enabledConfigColumns.forEach(c => row.push(item[c.key] ?? "-"));
                        row.push(
                            fmtStr(getOpeningStock(item)),
                            fmtStr(getRecalculatedStockInQty(item)),
                            fmtStr(getRecalculatedProcessQty(item)),
                            fmtStr(getRecalculatedStockOutQty(item)),
                            fmtStr(getRecalculatedClosingStock(item))
                        );
                        body.push(row);
                    });
                }
            } else {
                headers = [["S.No", "Godown Name", "OB", "Stock In", "Process", "Stock Out", "Closing"]];

                let sno = 1;
                Object.entries(groupedGodowns).forEach(([parentName, items]) => {
                    const groupOB = items.reduce((sum, r) => sum + Number((qtyMode === "actQty" ? r.ACt_OB_Qty : r.OB_Qty) || 0), 0);
                    const groupIn = items.reduce((sum, r) => sum + Number((qtyMode === "actQty" ? r.ACt_In_Qty : r.IN_Qty) || 0), 0);
                    const groupProcess = items.reduce((sum, r) => sum + Number((qtyMode === "actQty" ? r.Process_Act_IN_OUT_Qty : r.Process_IN_OUT_Qty) || 0), 0);
                    const groupOut = items.reduce((sum, r) => sum + Number((qtyMode === "actQty" ? r.ACt_Out_Qty : r.Out_Qty) || 0), 0);
                    const groupCL = items.reduce((sum, r) => sum + Number((qtyMode === "actQty" ? r.CL_ACt_QTY : r.CL_QTY) || 0), 0);

                    // Add group row
                    body.push(["", parentName, fmtStr(groupOB), fmtStr(groupIn), fmtStr(groupProcess), fmtStr(groupOut), fmtStr(groupCL)]);

                    items.forEach((row) => {
                        body.push([
                            sno++,
                            row.godown_name,
                            fmtStr(Number((qtyMode === "actQty" ? row.ACt_OB_Qty : row.OB_Qty) || 0)),
                            fmtStr(Number((qtyMode === "actQty" ? row.ACt_In_Qty : row.IN_Qty) || 0)),
                            fmtStr(Number((qtyMode === "actQty" ? row.Process_Act_IN_OUT_Qty : row.Process_IN_OUT_Qty) || 0)),
                            fmtStr(Number((qtyMode === "actQty" ? row.ACt_Out_Qty : row.Out_Qty) || 0)),
                            fmtStr(Number((qtyMode === "actQty" ? row.CL_ACt_QTY : row.CL_QTY) || 0))
                        ]);
                    });
                });

                // Add grand total row
                body.push([
                    "",
                    "Total",
                    fmtStr(grandTotals.opening),
                    fmtStr(grandTotals.stockIn),
                    fmtStr(grandTotals.process),
                    fmtStr(grandTotals.stockOut),
                    fmtStr(grandTotals.closing)
                ]);
            }

            autoTable(doc, {
                head: headers,
                body: body,
                startY: 18,
                theme: "grid",
                styles: { fontSize: 8 },
                headStyles: { fillColor: [30, 58, 138] },
            });

            const filename = `Stock_Report_${selectedGodown ? selectedGodown.godown_name.replace(/\s+/g, '_') : 'Overall'}_${dayjs().format("YYYYMMDD_HHmmss")}.pdf`;
            doc.save(filename);
            toast.success("PDF Exported Successfully ✅");
        } catch (err) {
            console.error(err);
            toast.error("Failed to export PDF ❌");
        }
    };


    const getTotalColumns = () => {
        const L = enabledConfigColumns.length;
        if (inwardMode) {
            const visibleTripsCount = inwardTripHeaders.filter(t => !hiddenInwardColumns.includes(t)).length;
            const isReturnVisible = !hiddenInwardColumns.includes("RETURN") ? 1 : 0;
            return L + visibleTripsCount + isReturnVisible + 2; // S.No + Config + Trip + Return + Total Stock In
        }
        if (outwardMode) {
            const visibleTripsCount = outwardTakenHeaders.filter(t => !hiddenOutwardColumns.includes(t)).length;
            const isPendingVisible = !hiddenOutwardColumns.includes("Pending Taken") ? 1 : 0;
            return L + visibleTripsCount + isPendingVisible + 2; // S.No + Config + Taken + Pending Taken + Total Outward
        }
        if (processMode) {
            const visibleIn = !hiddenProcessColumns.includes("PROCESS IN") ? 1 : 0;
            const visibleOut = !hiddenProcessColumns.includes("PROCESS OUT") ? 1 : 0;
            return L + visibleIn + visibleOut + 2; // S.No + Config + Proc In + Proc Out + Total Process
        }
        return L + 6;
    };

    const showRetailerColumn = useMemo(() => {
        return !(
            popupFilterType === 'IN' ||
            popupFilterType === 'RETURN' ||
            inwardTripHeaders.includes(popupFilterType) ||
            popupFilterType === 'PROCESS' ||
            popupFilterType === 'PROCESS_IN' ||
            popupFilterType === 'PROCESS_OUT' ||
            (inwardMode && popupFilterType.startsWith('Trip'))
        );
    }, [popupFilterType, inwardMode, inwardTripHeaders]);

    const totalColSpan = useMemo(() => {
        const baseColSpan = popupFilterType === "ALL" ? 7 : 4;
        const createdOnCol = (processMode || outwardMode || popupFilterType === "Trip In" || String(popupFilterType).startsWith("Trip")) ? 1 : 0;
        return baseColSpan + (showRetailerColumn ? 1 : 0) + createdOnCol + uniqueRoles.length;
    }, [popupFilterType, showRetailerColumn, uniqueRoles, processMode, outwardMode]);

    const showCreatedOn = processMode || outwardMode || popupFilterType === "Trip In" || String(popupFilterType).startsWith("Trip");

    return (
        <Box sx={{ width: "100%", minHeight: "100%", bgcolor: "#f8fafc", p: 2, boxSizing: "border-box" }}>
            <PageHeader
                onExportExcel={handleExportExcel}
                onExportPDF={handleExportPDF}
                showPages={true}
                settingsSlot={
                    selectedGodown && (
                        <Box display="flex" alignItems="center" gap={1}>
                            {/* Group By Selector Icon */}
                            <Tooltip title="Group By">
                                <IconButton
                                    size="small"
                                    onClick={(e) => setGroupByAnchor(e.currentTarget)}
                                    sx={{
                                        height: 24,
                                        width: 24,
                                        backgroundColor: "#fff",
                                        borderRadius: 0.5,
                                    }}
                                >
                                    <GroupWorkIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>

                            {/* Column settings icon */}
                            <Tooltip title="Table Settings">
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
                        </Box>
                    )
                }
            />

            {!selectedGodown ? (
                <>
                    {/* Summary Cards */}
                    <Box sx={{ display: "flex", gap: 3, mb: 3, mt: 2, flexWrap: "wrap" }}>
                        <Paper elevation={1} sx={{ flex: 1, minWidth: 200, p: 2.5, borderRadius: 2, borderLeft: "4px solid #1E3A8A", bgcolor: "#fff" }}>
                            <Typography variant="caption" fontWeight={600} color="textSecondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>Total OB</Typography>
                            <Typography variant="h4" fontWeight={700} sx={{ mt: 1, color: "#1e293b" }}>{grandTotals.opening.toLocaleString()}</Typography>
                        </Paper>
                        <Paper elevation={1} sx={{ flex: 1, minWidth: 200, p: 2.5, borderRadius: 2, borderLeft: "4px solid #10b981", bgcolor: "#fff" }}>
                            <Typography variant="caption" fontWeight={600} color="textSecondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>Total Stock In</Typography>
                            <Typography variant="h4" fontWeight={700} sx={{ mt: 1, color: "#1e293b" }}>{grandTotals.stockIn.toLocaleString()}</Typography>
                        </Paper>
                        <Paper elevation={1} sx={{ flex: 1, minWidth: 200, p: 2.5, borderRadius: 2, borderLeft: "4px solid #ef4444", bgcolor: "#fff" }}>
                            <Typography variant="caption" fontWeight={600} color="textSecondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>Total Stock Out</Typography>
                            <Typography variant="h4" fontWeight={700} sx={{ mt: 1, color: "#1e293b" }}>{grandTotals.stockOut.toLocaleString()}</Typography>
                        </Paper>
                        <Paper elevation={1} sx={{ flex: 1, minWidth: 200, p: 2.5, borderRadius: 2, borderLeft: "4px solid #14b8a6", bgcolor: "#fff" }}>
                            <Typography variant="caption" fontWeight={600} color="textSecondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>Total Closing</Typography>
                            <Typography variant="h4" fontWeight={700} sx={{ mt: 1, color: "#15803d" }}>{grandTotals.closing.toLocaleString()}</Typography>
                        </Paper>
                    </Box>

                    {/* Overall Summary Table */}
                    <TableContainer
                        component={Paper}
                        elevation={2}
                        sx={{
                            borderRadius: 2,
                            border: "1px solid #cbd5e1",
                            maxHeight: "calc(100vh - 260px)",
                            overflowY: "auto",
                            overflowX: "auto"
                        }}
                    >
                        <Table
                            size="small"
                            stickyHeader
                            sx={{
                                tableLayout: "fixed",
                                width: "100%",
                                "& .MuiTableCell-root": {
                                    whiteSpace: "normal",
                                    wordBreak: "break-word",
                                    lineHeight: 1.2,
                                    fontSize: "0.72rem",
                                    px: 1,
                                    py: 1
                                }
                            }}
                        >
                            <TableHead>
                                <TableRow ref={headerRowRef}>
                                    <TableCell align="center" sx={{ width: "8%", backgroundColor: "#1E3A8A", color: "#fff", fontWeight: 600, py: 1.5, borderRight: "1px solid #cbd5e1" }}>S.NO</TableCell>
                                    <TableCell
                                        sx={{
                                            width: "27%",
                                            backgroundColor: "#1E3A8A",
                                            color: "#fff",
                                            fontWeight: 600,
                                            py: 1.5,
                                            borderRight: "1px solid #cbd5e1",
                                            cursor: "pointer",
                                            userSelect: "none"
                                        }}
                                        onClick={(e) => {
                                            setGodownFilterAnchor(e.currentTarget);
                                            setGodownFilterSearch("");
                                        }}
                                    >
                                        <Box display="flex" alignItems="center" justifyContent="space-between">
                                            <span>GODOWN NAME</span>
                                        </Box>
                                    </TableCell>
                                    <TableCell align="right" sx={{ width: "13%", backgroundColor: "#1E3A8A", color: "#fff", fontWeight: 600, py: 1.5, borderRight: "1px solid #cbd5e1" }}>OB</TableCell>
                                    <TableCell align="right" sx={{ width: "13%", backgroundColor: "#1E3A8A", color: "#fff", fontWeight: 600, py: 1.5, borderRight: "1px solid #cbd5e1" }}>STOCK IN</TableCell>
                                    <TableCell align="right" sx={{ width: "13%", backgroundColor: "#1E3A8A", color: "#fff", fontWeight: 600, py: 1.5, borderRight: "1px solid #cbd5e1" }}>PROCESS</TableCell>
                                    <TableCell align="right" sx={{ width: "13%", backgroundColor: "#1E3A8A", color: "#fff", fontWeight: 600, py: 1.5, borderRight: "1px solid #cbd5e1" }}>STOCK OUT</TableCell>
                                    <TableCell align="right" sx={{ width: "13%", backgroundColor: "#1E3A8A", color: "#fff", fontWeight: 600, py: 1.5 }}>CLOSING</TableCell>
                                </TableRow>
                                <TableRow sx={{ backgroundColor: "#f1f5f9" }}>
                                    <TableCell colSpan={2} align="center" sx={{ position: "sticky", top: headerHeight, zIndex: 10, backgroundColor: "#f1f5f9", borderRight: "1px solid #cbd5e1", fontWeight: 800 }}>
                                        GRAND TOTAL
                                    </TableCell>
                                    <TableCell align="right" sx={{ position: "sticky", top: headerHeight, zIndex: 10, backgroundColor: "#f1f5f9", borderRight: "1px solid #cbd5e1", fontWeight: 800, pr: 2 }}>
                                        {grandTotals.opening.toLocaleString()}
                                    </TableCell>
                                    <TableCell align="right" sx={{ position: "sticky", top: headerHeight, zIndex: 10, backgroundColor: "#f1f5f9", borderRight: "1px solid #cbd5e1", fontWeight: 800, pr: 2 }}>
                                        {grandTotals.stockIn.toLocaleString()}
                                    </TableCell>
                                    <TableCell align="right" sx={{ position: "sticky", top: headerHeight, zIndex: 10, backgroundColor: "#f1f5f9", borderRight: "1px solid #cbd5e1", fontWeight: 800, pr: 2 }}>
                                        {grandTotals.process.toLocaleString()}
                                    </TableCell>
                                    <TableCell align="right" sx={{ position: "sticky", top: headerHeight, zIndex: 10, backgroundColor: "#f1f5f9", borderRight: "1px solid #cbd5e1", fontWeight: 800, pr: 2 }}>
                                        {grandTotals.stockOut.toLocaleString()}
                                    </TableCell>
                                    <TableCell align="right" sx={{ position: "sticky", top: headerHeight, zIndex: 10, backgroundColor: "#f1f5f9", fontWeight: 800, pr: 2, color: "#15803d" }}>
                                        {grandTotals.closing.toLocaleString()}
                                    </TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {(() => {
                                    let sno = 1;
                                    return Object.entries(groupedGodowns).map(([parentName, items]) => {

                                        const groupOBRaw = items.reduce((sum, r) => sum + Number((qtyMode === "actQty" ? r.ACt_OB_Qty : r.OB_Qty) || 0), 0);
                                        const groupInRaw = items.reduce((sum, r) => sum + Number((qtyMode === "actQty" ? r.ACt_In_Qty : r.IN_Qty) || 0), 0);
                                        const groupProcessRaw = items.reduce((sum, r) => sum + Number((qtyMode === "actQty" ? r.Process_Act_IN_OUT_Qty : r.Process_IN_OUT_Qty) || 0), 0);
                                        const groupOutRaw = items.reduce((sum, r) => sum + Number((qtyMode === "actQty" ? r.ACt_Out_Qty : r.Out_Qty) || 0), 0);
                                        const groupCLRaw = items.reduce((sum, r) => sum + Number((qtyMode === "actQty" ? r.CL_ACt_QTY : r.CL_QTY) || 0), 0);

                                        const groupOB = qtyMode === "bags" ? Math.round(groupOBRaw / 50) : groupOBRaw;
                                        const groupIn = qtyMode === "bags" ? Math.round(groupInRaw / 50) : groupInRaw;
                                        const groupProcess = qtyMode === "bags" ? Math.round(groupProcessRaw / 50) : groupProcessRaw;
                                        const groupOut = qtyMode === "bags" ? Math.round(groupOutRaw / 50) : groupOutRaw;
                                        const groupCL = qtyMode === "bags" ? Math.round(groupCLRaw / 50) : groupCLRaw;

                                        return (
                                            <React.Fragment key={parentName}>
                                                {/* Parent Group Header Row */}
                                                <TableRow sx={{ backgroundColor: "#e2e8f0" }}>
                                                    <TableCell sx={{ borderRight: "1px solid #cbd5e1" }} />
                                                    <TableCell sx={{ fontWeight: 700, color: "#1E3A8A", borderRight: "1px solid #cbd5e1" }}>
                                                        {parentName}
                                                    </TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 700, color: "#1E3A8A", borderRight: "1px solid #cbd5e1", pr: 2 }}>
                                                        {formatQtyVal(groupOB)}
                                                    </TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 700, color: "#1E3A8A", borderRight: "1px solid #cbd5e1", pr: 2 }}>
                                                        {formatQtyVal(groupIn)}
                                                    </TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 700, color: "#1E3A8A", borderRight: "1px solid #cbd5e1", pr: 2 }}>
                                                        {formatQtyVal(groupProcess)}
                                                    </TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 700, color: "#1E3A8A", borderRight: "1px solid #cbd5e1", pr: 2 }}>
                                                        {formatQtyVal(groupOut)}
                                                    </TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 700, color: "#1E3A8A", pr: 2 }}>
                                                        {formatQtyVal(groupCL)}
                                                    </TableCell>
                                                </TableRow>
                                                {/* Godown rows under this parent */}
                                                {items.map((item) => (
                                                    <TableRow key={item.godown_id} hover sx={{ "&:hover": { bgcolor: "#f8fafc" } }}>
                                                        <TableCell align="center" sx={{ borderRight: "1px solid #e2e8f0", fontWeight: 600, color: "#475569" }}>
                                                            {sno++}
                                                        </TableCell>
                                                        <TableCell
                                                            onClick={() => setSelectedGodown(item)}
                                                            sx={{
                                                                borderRight: "1px solid #e2e8f0",
                                                                fontWeight: 700,
                                                                color: "#2563eb",
                                                                cursor: "pointer",
                                                                textDecoration: "none",
                                                                "&:hover": { color: "#1d4ed8" }
                                                            }}
                                                        >
                                                            {item.godown_name}
                                                        </TableCell>
                                                        <TableCell align="right" sx={{ borderRight: "1px solid #e2e8f0", fontWeight: 600, pr: 2, color: "#475569" }}>
                                                            {formatQtyVal(qtyMode === "bags" ? Math.round(Number(item.OB_Qty || 0) / 50) : (qtyMode === "actQty" ? item.ACt_OB_Qty : item.OB_Qty))}
                                                        </TableCell>
                                                        <TableCell align="right" sx={{ borderRight: "1px solid #e2e8f0", fontWeight: 600, pr: 2, color: "#2563eb" }}>
                                                            {formatQtyVal(qtyMode === "bags" ? Math.round(Number(item.IN_Qty || 0) / 50) : (qtyMode === "actQty" ? item.ACt_In_Qty : item.IN_Qty))}
                                                        </TableCell>
                                                        <TableCell align="right" sx={{ borderRight: "1px solid #e2e8f0", fontWeight: 600, pr: 2, color: "#475569" }}>
                                                            {formatQtyVal(qtyMode === "bags" ? Math.round(Number(item.Process_IN_OUT_Qty || 0) / 50) : (qtyMode === "actQty" ? item.Process_Act_IN_OUT_Qty : item.Process_IN_OUT_Qty))}
                                                        </TableCell>
                                                        <TableCell align="right" sx={{ borderRight: "1px solid #e2e8f0", fontWeight: 600, pr: 2, color: "#ef4444" }}>
                                                            {formatQtyVal(qtyMode === "bags" ? Math.round(Number(item.Out_Qty || 0) / 50) : (qtyMode === "actQty" ? item.ACt_Out_Qty : item.Out_Qty))}
                                                        </TableCell>
                                                        <TableCell align="right" sx={{ fontWeight: 700, pr: 2, backgroundColor: "#dcfce7", color: "#15803d" }}>
                                                            {formatQtyVal(qtyMode === "bags" ? Math.round(Number(item.CL_QTY || 0) / 50) : (qtyMode === "actQty" ? item.CL_ACt_QTY : item.CL_QTY))}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </React.Fragment>
                                        );
                                    });
                                })()}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </>
            ) : (
                <>
                    {/* Navigation Back Button, Subtitle, 3 Dropdowns (In, Process, Out), and Search */}
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, mt: 2, flexWrap: "wrap", gap: 1.5 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Button
                                variant="outlined"
                                size="small"
                                onClick={() => setSelectedGodown(null)}
                                sx={{
                                    textTransform: "none",
                                    fontWeight: 600,
                                    color: "#1E3A8A",
                                    borderColor: "#cbd5e1",
                                    "&:hover": { bgcolor: "#f1f5f9", borderColor: "#1e40af" }
                                }}
                            >
                                ← Back to Godown Summary
                            </Button>
                            <Typography variant="subtitle1" fontWeight={700} color="#475569">
                                / {selectedGodown.godown_name}
                            </Typography>
                        </Box>

                        {/* Inline Split-up Dropdowns: In, Process, Out */}
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                            {/* In Dropdown */}
                            <FormControl size="small" sx={{ width: 105 }}>
                                <InputLabel id="in-dropdown-label" sx={{ fontSize: "0.82rem", fontWeight: 600, color: "#1e40af" }}>
                                    In
                                </InputLabel>
                                <Select
                                    labelId="in-dropdown-label"
                                    id="in-dropdown-select"
                                    multiple
                                    value={visibleInwardColumns}
                                    onChange={handleInwardSelectChange}
                                    input={<OutlinedInput label="In" />}
                                    renderValue={(selected) => `${selected.length} / ${allInwardOptions.length}`}
                                    sx={{ bgcolor: "#fff", borderRadius: 1, fontSize: "0.8rem", height: 36 }}
                                >
                                    {allInwardOptions.map((opt) => (
                                        <MenuItem key={opt} value={opt} sx={{ py: 0.5 }}>
                                            <Checkbox checked={visibleInwardColumns.includes(opt)} size="small" />
                                            <ListItemText primary={opt} primaryTypographyProps={{ fontSize: "0.8rem", fontWeight: 600 }} />
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            {/* Process Dropdown */}
                            <FormControl size="small" sx={{ width: 115 }}>
                                <InputLabel id="process-dropdown-label" sx={{ fontSize: "0.82rem", fontWeight: 600, color: "#166534" }}>
                                    Process
                                </InputLabel>
                                <Select
                                    labelId="process-dropdown-label"
                                    id="process-dropdown-select"
                                    multiple
                                    value={visibleProcessColumns}
                                    onChange={handleProcessSelectChange}
                                    input={<OutlinedInput label="Process" />}
                                    renderValue={(selected) => `${selected.length} / ${allProcessOptions.length}`}
                                    sx={{ bgcolor: "#fff", borderRadius: 1, fontSize: "0.8rem", height: 36 }}
                                >
                                    {allProcessOptions.map((opt) => (
                                        <MenuItem key={opt} value={opt} sx={{ py: 0.5 }}>
                                            <Checkbox checked={visibleProcessColumns.includes(opt)} size="small" />
                                            <ListItemText primary={opt} primaryTypographyProps={{ fontSize: "0.8rem", fontWeight: 600 }} />
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            {/* Out Dropdown */}
                            <FormControl size="small" sx={{ width: 105 }}>
                                <InputLabel id="out-dropdown-label" sx={{ fontSize: "0.82rem", fontWeight: 600, color: "#991b1b" }}>
                                    Out
                                </InputLabel>
                                <Select
                                    labelId="out-dropdown-label"
                                    id="out-dropdown-select"
                                    multiple
                                    value={visibleOutwardColumns}
                                    onChange={handleOutwardSelectChange}
                                    input={<OutlinedInput label="Out" />}
                                    renderValue={(selected) => `${selected.length} / ${allOutwardOptions.length}`}
                                    sx={{ bgcolor: "#fff", borderRadius: 1, fontSize: "0.8rem", height: 36 }}
                                >
                                    {allOutwardOptions.map((opt) => (
                                        <MenuItem key={opt} value={opt} sx={{ py: 0.5 }}>
                                            <Checkbox checked={visibleOutwardColumns.includes(opt)} size="small" />
                                            <ListItemText primary={opt} primaryTypographyProps={{ fontSize: "0.8rem", fontWeight: 600 }} />
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Box>

                        {outwardMode && (
                            <FormControl size="small" sx={{ minWidth: 150 }}>
                                <InputLabel id="main-module-dropdown-label" sx={{ fontSize: "0.82rem", fontWeight: 600, color: "#475569" }}>
                                    Filter by Module
                                </InputLabel>
                                <Select
                                    labelId="main-module-dropdown-label"
                                    id="main-module-dropdown-select"
                                    value={moduleFilter}
                                    onChange={(e) => setModuleFilter(e.target.value)}
                                    input={<OutlinedInput label="Filter by Module" />}
                                    sx={{ bgcolor: "#fff", borderRadius: 1, fontSize: "0.8rem", height: 36 }}
                                >
                                    <MenuItem value="ALL" sx={{ fontSize: "0.8rem", fontWeight: 600 }}>All</MenuItem>
                                    <MenuItem value="SALES" sx={{ fontSize: "0.8rem", fontWeight: 600 }}>Sales</MenuItem>
                                    <MenuItem value="GODOWN TRANSFER" sx={{ fontSize: "0.8rem", fontWeight: 600 }}>Godown Transfer</MenuItem>
                                </Select>
                            </FormControl>
                        )}

                        {(inwardMode || outwardMode) && (
                            <FormControl size="small" sx={{ minWidth: 130 }}>
                                <InputLabel id="view-mode-dropdown-label" sx={{ fontSize: "0.82rem", fontWeight: 600, color: "#1E3A8A" }}>
                                    View Mode
                                </InputLabel>
                                <Select
                                    labelId="view-mode-dropdown-label"
                                    id="view-mode-dropdown-select"
                                    value={viewMode}
                                    onChange={(e) => {
                                        setViewMode(e.target.value as "cumulative" | "trip");
                                        setHiddenInwardColumns([]);
                                        setHiddenOutwardColumns([]);
                                    }}
                                    input={<OutlinedInput label="View Mode" />}
                                    sx={{ bgcolor: "#fff", borderRadius: 1, fontSize: "0.8rem", height: 36 }}
                                >
                                    <MenuItem value="cumulative" sx={{ fontSize: "0.8rem", fontWeight: 600 }}>{outwardMode ? "Taken" : "Cumulative"}</MenuItem>
                                    <MenuItem value="trip" sx={{ fontSize: "0.8rem", fontWeight: 600 }}>{outwardMode ? "Tripwise" : "Trip Wise"}</MenuItem>
                                </Select>
                            </FormControl>
                        )}

                        <TextField
                            size="small"
                            placeholder="Search product..."
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            sx={{ width: 220, bgcolor: "#fff", borderRadius: 1 }}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon fontSize="small" sx={{ color: "#94a3b8" }} />
                                    </InputAdornment>
                                )
                            }}
                        />
                    </Box>

                    {/* Filters and Brand Chips */}
                    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
                        {groupChips.map((b) => (
                            <Chip
                                key={b}
                                label={b}
                                clickable
                                size="small"
                                color={selectedBrand === b ? "primary" : "default"}
                                onClick={() => setSelectedBrand(b)}
                                sx={{
                                    fontWeight: 600,
                                    px: 0.8,
                                    fontSize: "0.72rem",
                                    height: 26,
                                    bgcolor: selectedBrand === b ? "#1E3A8A" : "#fff",
                                    border: "1px solid #e2e8f0",
                                    "&:hover": { bgcolor: selectedBrand === b ? "#1e40af" : "#f1f5f9" }
                                }}
                            />
                        ))}
                    </Box>

                    {/* Hidden Columns Bar */}
                    {inwardMode && hiddenInwardColumns.length > 0 && (
                        <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 2, flexWrap: "wrap", p: 1.2, bgcolor: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 1.5 }}>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: "#1e40af", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: 0.5 }}>
                                Hidden Columns (Click to Restore):
                            </Typography>
                            {hiddenInwardColumns.map((col) => (
                                <Chip
                                    key={col}
                                    label={col}
                                    size="small"
                                    onClick={() => handleShowInwardColumn(col)}
                                    color="primary"
                                    icon={<AddIcon fontSize="small" />}
                                    sx={{ fontWeight: 600, fontSize: "0.7rem", height: 22, bgcolor: "#1e40af", color: "#fff", "& .MuiChip-icon": { color: "#fff" } }}
                                />
                            ))}
                        </Box>
                    )}

                    {outwardMode && hiddenOutwardColumns.length > 0 && (
                        <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 2, flexWrap: "wrap", p: 1.2, bgcolor: "#fef2f2", border: "1px solid #fecaca", borderRadius: 1.5 }}>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: "#991b1b", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: 0.5 }}>
                                Hidden Columns (Click to Restore):
                            </Typography>
                            {hiddenOutwardColumns.map((col) => (
                                <Chip
                                    key={col}
                                    label={col}
                                    size="small"
                                    onClick={() => handleShowOutwardColumn(col)}
                                    color="error"
                                    icon={<AddIcon fontSize="small" />}
                                    sx={{ fontWeight: 600, fontSize: "0.7rem", height: 22, bgcolor: "#b91c1c", color: "#fff", "& .MuiChip-icon": { color: "#fff" } }}
                                />
                            ))}
                        </Box>
                    )}

                    {processMode && hiddenProcessColumns.length > 0 && (
                        <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 2, flexWrap: "wrap", p: 1.2, bgcolor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 1.5 }}>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: "#166534", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: 0.5 }}>
                                Hidden Columns (Click to Restore):
                            </Typography>
                            {hiddenProcessColumns.map((col) => (
                                <Chip
                                    key={col}
                                    label={col}
                                    size="small"
                                    onClick={() => handleShowProcessColumn(col)}
                                    color="success"
                                    icon={<AddIcon fontSize="small" />}
                                    sx={{ fontWeight: 600, fontSize: "0.7rem", height: 22, bgcolor: "#15803d", color: "#fff", "& .MuiChip-icon": { color: "#fff" } }}
                                />
                            ))}
                        </Box>
                    )}

                    {/* Detailed Stock Table Container */}
                    <TableContainer
                        component={Paper}
                        elevation={2}
                        sx={{
                            borderRadius: 2,
                            border: "1px solid #cbd5e1",
                            maxHeight: "calc(100vh - 250px)",
                            overflowY: "auto",
                            overflowX: "auto"
                        }}
                    >
                        <Table
                            size="small"
                            stickyHeader
                            sx={{
                                tableLayout: (inwardMode || outwardMode) ? "auto" : "fixed",
                                width: "100%",
                                "& .MuiTableCell-root": {
                                    whiteSpace: "normal",
                                    wordBreak: "break-word",
                                    lineHeight: 1.2,
                                    fontSize: "0.72rem",
                                    px: 0.8,
                                    py: 0.8
                                }
                            }}
                        >
                            <TableHead>
                                <TableRow ref={headerRowRef}>
                                    <TableCell align="center" sx={{ width: 60, minWidth: 60, backgroundColor: "#1E3A8A", color: "#fff", fontWeight: 600, py: 1.5, borderRight: "1px solid #cbd5e1" }}>S.NO</TableCell>
                                    {enabledConfigColumns.map((col) => {
                                        const isProduct = col.key === "stock_item_name" || col.key === "Stock_Item";
                                        const w = isProduct ? 280 : 150;
                                        return (
                                            <TableCell
                                                key={col.key}
                                                sx={{
                                                    width: w,
                                                    minWidth: w,
                                                    backgroundColor: "#1E3A8A",
                                                    color: "#fff",
                                                    fontWeight: 600,
                                                    py: 1.5,
                                                    borderRight: "1px solid #cbd5e1"
                                                }}
                                            >
                                                {col.label.toUpperCase()}
                                            </TableCell>
                                        );
                                    })}
                                    {!inwardMode && !outwardMode && !processMode && (
                                        <TableCell align="right" sx={{ width: 120, minWidth: 120, backgroundColor: "#1E3A8A", color: "#fff", fontWeight: 600, py: 1.5, borderRight: "1px solid #cbd5e1" }}>
                                            OPENING STOCK
                                        </TableCell>
                                    )}

                                    {/* Stock In Header - Clicking toggles inwardMode. Shown only in Normal Mode */}
                                    {!inwardMode && !outwardMode && !processMode && (
                                        <TableCell
                                            align="right"
                                            onClick={() => {
                                                handleSetInwardMode(true);
                                            }}
                                            sx={{
                                                width: 120,
                                                minWidth: 120,
                                                backgroundColor: "#1E3A8A",
                                                color: "#fff",
                                                fontWeight: 600,
                                                py: 1.5,
                                                borderRight: "1px solid #cbd5e1",
                                                cursor: "pointer",
                                                userSelect: "none",
                                                textDecoration: "none",
                                                transition: "background-color 0.2s",
                                                "&:hover": {
                                                    backgroundColor: "#1e40af"
                                                }
                                            }}
                                        >
                                            <Box display="flex" alignItems="center" justifyContent="flex-end" gap={0.5}>
                                                STOCK IN <KeyboardArrowDownIcon fontSize="small" />
                                            </Box>
                                        </TableCell>
                                    )}

                                    {/* Show TRIP DETAILS, RETURN, and TOTAL STOCK IN columns when inwardMode is active */}
                                    {inwardMode && (
                                        <>
                                            {inwardTripHeaders.map((tripLabel) => {
                                                if (hiddenInwardColumns.includes(tripLabel)) return null;
                                                return (
                                                    <TableCell
                                                        key={tripLabel}
                                                        align="right"
                                                        sx={{
                                                            width: viewMode === "cumulative" ? 120 : 200,
                                                            minWidth: viewMode === "cumulative" ? 120 : 200,
                                                            backgroundColor: "#1E3A8A",
                                                            color: "#fff",
                                                            fontWeight: 600,
                                                            py: 0.5,
                                                            borderRight: "1px solid #cbd5e1"
                                                        }}
                                                    >
                                                        <Box display="flex" alignItems="center" justifyContent="flex-end" gap={0.5}>
                                                            {tripLabel.toUpperCase()}
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => handleHideInwardColumn(tripLabel)}
                                                                sx={{ color: "rgba(255,255,255,0.7)", p: 0.2, "&:hover": { color: "#fff" } }}
                                                            >
                                                                <CloseIcon fontSize="inherit" sx={{ fontSize: 14 }} />
                                                            </IconButton>
                                                        </Box>
                                                    </TableCell>
                                                );
                                            })}
                                            {!hiddenInwardColumns.includes("RETURN") && (
                                                <TableCell
                                                    align="right"
                                                    sx={{
                                                        width: 120,
                                                        minWidth: 120,
                                                        backgroundColor: "#1E3A8A",
                                                        color: "#fff",
                                                        fontWeight: 600,
                                                        py: 0.5,
                                                        borderRight: "1px solid #cbd5e1"
                                                    }}
                                                >
                                                    <Box display="flex" alignItems="center" justifyContent="flex-end" gap={0.5}>
                                                        RETURN
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleHideInwardColumn("RETURN")}
                                                            sx={{ color: "rgba(255,255,255,0.7)", p: 0.2, "&:hover": { color: "#fff" } }}
                                                        >
                                                            <CloseIcon fontSize="inherit" sx={{ fontSize: 14 }} />
                                                        </IconButton>
                                                    </Box>
                                                </TableCell>
                                            )}
                                            <TableCell
                                                align="right"
                                                onClick={() => handleSetInwardMode(false)}
                                                sx={{
                                                    width: 140,
                                                    minWidth: 140,
                                                    backgroundColor: "#111827",
                                                    color: "#fff",
                                                    fontWeight: 700,
                                                    py: 1.5,
                                                    cursor: "pointer",
                                                    userSelect: "none",
                                                    textDecoration: "none",
                                                    "&:hover": {
                                                        backgroundColor: "#1f2937"
                                                    }
                                                }}
                                            >
                                                <Box display="flex" alignItems="center" justifyContent="flex-end" gap={0.5}>
                                                    TOTAL STOCK IN <KeyboardArrowUpIcon fontSize="small" />
                                                </Box>
                                            </TableCell>
                                        </>
                                    )}

                                    {/* PROCESS Header - Clicking toggles processMode. Shown only in Normal Mode */}
                                    {!inwardMode && !outwardMode && !processMode && (
                                        <TableCell
                                            align="right"
                                            onClick={() => handleSetProcessMode(true)}
                                            sx={{
                                                width: 120,
                                                minWidth: 120,
                                                backgroundColor: "#1E3A8A",
                                                color: "#fff",
                                                fontWeight: 600,
                                                py: 1.5,
                                                borderRight: "1px solid #cbd5e1",
                                                cursor: "pointer",
                                                userSelect: "none",
                                                textDecoration: "none",
                                                transition: "background-color 0.2s",
                                                "&:hover": {
                                                    backgroundColor: "#1e40af"
                                                }
                                            }}
                                        >
                                            <Box display="flex" alignItems="center" justifyContent="flex-end" gap={0.5}>
                                                PROCESS <KeyboardArrowDownIcon fontSize="small" />
                                            </Box>
                                        </TableCell>
                                    )}

                                    {/* Show PROCESS IN, PROCESS OUT, and TOTAL PROCESS columns when processMode is active */}
                                    {processMode && (
                                        <>
                                            {!hiddenProcessColumns.includes("PROCESS IN") && (
                                                <TableCell
                                                    align="right"
                                                    sx={{
                                                        width: 120,
                                                        minWidth: 120,
                                                        backgroundColor: "#1E3A8A",
                                                        color: "#fff",
                                                        fontWeight: 600,
                                                        py: 0.5,
                                                        borderRight: "1px solid #cbd5e1"
                                                    }}
                                                >
                                                    <Box display="flex" alignItems="center" justifyContent="flex-end" gap={0.5}>
                                                        PROCESS IN
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleHideProcessColumn("PROCESS IN")}
                                                            sx={{ color: "rgba(255,255,255,0.7)", p: 0.2, "&:hover": { color: "#fff" } }}
                                                        >
                                                            <CloseIcon fontSize="inherit" sx={{ fontSize: 14 }} />
                                                        </IconButton>
                                                    </Box>
                                                </TableCell>
                                            )}
                                            {!hiddenProcessColumns.includes("PROCESS OUT") && (
                                                <TableCell
                                                    align="right"
                                                    sx={{
                                                        width: 120,
                                                        minWidth: 120,
                                                        backgroundColor: "#1E3A8A",
                                                        color: "#fff",
                                                        fontWeight: 600,
                                                        py: 0.5,
                                                        borderRight: "1px solid #cbd5e1"
                                                    }}
                                                >
                                                    <Box display="flex" alignItems="center" justifyContent="flex-end" gap={0.5}>
                                                        PROCESS OUT
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleHideProcessColumn("PROCESS OUT")}
                                                            sx={{ color: "rgba(255,255,255,0.7)", p: 0.2, "&:hover": { color: "#fff" } }}
                                                        >
                                                            <CloseIcon fontSize="inherit" sx={{ fontSize: 14 }} />
                                                        </IconButton>
                                                    </Box>
                                                </TableCell>
                                            )}
                                            <TableCell
                                                align="right"
                                                onClick={() => handleSetProcessMode(false)}
                                                sx={{
                                                    width: 140,
                                                    minWidth: 140,
                                                    backgroundColor: "#111827",
                                                    color: "#fff",
                                                    fontWeight: 700,
                                                    py: 1.5,
                                                    cursor: "pointer",
                                                    userSelect: "none",
                                                    textDecoration: "none",
                                                    "&:hover": {
                                                        backgroundColor: "#1f2937"
                                                    }
                                                }}
                                            >
                                                <Box display="flex" alignItems="center" justifyContent="flex-end" gap={0.5}>
                                                    TOTAL PROCESS <KeyboardArrowUpIcon fontSize="small" />
                                                </Box>
                                            </TableCell>
                                        </>
                                    )}

                                    {/* Stock Outwards Header - Clicking toggles outwardMode. Shown only in Normal Mode */}
                                    {!inwardMode && !outwardMode && !processMode && (
                                        <TableCell
                                            align="right"
                                            onClick={() => {
                                                handleSetOutwardMode(true);
                                            }}
                                            sx={{
                                                width: 120,
                                                minWidth: 120,
                                                backgroundColor: "#1E3A8A",
                                                color: "#fff",
                                                fontWeight: 600,
                                                py: 1.5,
                                                borderRight: "1px solid #cbd5e1",
                                                cursor: "pointer",
                                                userSelect: "none",
                                                textDecoration: "none",
                                                transition: "background-color 0.2s",
                                                "&:hover": {
                                                    backgroundColor: "#1e40af"
                                                }
                                            }}
                                        >
                                            <Box display="flex" alignItems="center" justifyContent="flex-end" gap={0.5}>
                                                STOCK OUTWARDS <KeyboardArrowDownIcon fontSize="small" />
                                            </Box>
                                        </TableCell>
                                    )}

                                    {/* Show splits for Stock Outwards when outwardMode is active */}
                                    {outwardMode && (
                                        <>
                                            {outwardTakenHeaders.map((tripLabel) => {
                                                if (hiddenOutwardColumns.includes(tripLabel)) return null;
                                                return (
                                                    <TableCell
                                                        key={tripLabel}
                                                        align="right"
                                                        sx={{
                                                            width: viewMode === "cumulative" ? 120 : 200,
                                                            minWidth: viewMode === "cumulative" ? 120 : 200,
                                                            backgroundColor: "#1E3A8A",
                                                            color: "#fff",
                                                            fontWeight: 600,
                                                            py: 0.5,
                                                            borderRight: "1px solid #cbd5e1"
                                                        }}
                                                    >
                                                        <Box display="flex" alignItems="center" justifyContent="flex-end" gap={0.5}>
                                                            {tripLabel.toUpperCase()}
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => handleHideOutwardColumn(tripLabel)}
                                                                sx={{ color: "rgba(255,255,255,0.7)", p: 0.2, "&:hover": { color: "#fff" } }}
                                                            >
                                                                <CloseIcon fontSize="inherit" sx={{ fontSize: 14 }} />
                                                            </IconButton>
                                                        </Box>
                                                    </TableCell>
                                                );
                                            })}
                                            {viewMode === "trip" && !hiddenOutwardColumns.includes("Pending Delivery") && (
                                                <TableCell
                                                    align="right"
                                                    sx={{
                                                        width: 130,
                                                        minWidth: 130,
                                                        backgroundColor: "#1E3A8A",
                                                        color: "#fff",
                                                        fontWeight: 600,
                                                        py: 0.5,
                                                        borderRight: "1px solid #cbd5e1"
                                                    }}
                                                >
                                                    <Box display="flex" alignItems="center" justifyContent="flex-end" gap={0.5}>
                                                        PENDING DELIVERY
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleHideOutwardColumn("Pending Delivery")}
                                                            sx={{ color: "rgba(255,255,255,0.7)", p: 0.2, "&:hover": { color: "#fff" } }}
                                                        >
                                                            <CloseIcon fontSize="inherit" sx={{ fontSize: 14 }} />
                                                        </IconButton>
                                                    </Box>
                                                </TableCell>
                                            )}
                                            <TableCell
                                                align="right"
                                                onClick={() => handleSetOutwardMode(false)}
                                                sx={{
                                                    width: 140,
                                                    minWidth: 140,
                                                    backgroundColor: "#111827",
                                                    color: "#fff",
                                                    fontWeight: 700,
                                                    py: 1.5,
                                                    cursor: "pointer",
                                                    userSelect: "none",
                                                    textDecoration: "none",
                                                    "&:hover": {
                                                        backgroundColor: "#1f2937"
                                                    }
                                                }}
                                            >
                                                <Box display="flex" alignItems="center" justifyContent="flex-end" gap={0.5}>
                                                    TOTAL OUTWARD <KeyboardArrowUpIcon fontSize="small" />
                                                </Box>
                                            </TableCell>
                                        </>
                                    )}

                                    {/* Closing Stock is shown in Normal Mode */}
                                    {!inwardMode && !outwardMode && !processMode && (
                                        <TableCell align="right" sx={{ width: 120, minWidth: 120, backgroundColor: "#1E3A8A", color: "#fff", fontWeight: 600, py: 1.5 }}>
                                            CLOSING STOCK
                                        </TableCell>
                                    )}
                                </TableRow>
                                {paginatedData.length > 0 && (
                                    <TableRow sx={{ backgroundColor: "#f1f5f9" }}>
                                        <TableCell colSpan={1 + enabledConfigColumns.length} align="center" sx={{ position: "sticky", top: headerHeight, zIndex: 10, backgroundColor: "#f1f5f9", borderRight: "1px solid #cbd5e1", fontWeight: 800 }}>
                                            GRAND TOTAL
                                        </TableCell>
                                        {!inwardMode && !outwardMode && !processMode && (
                                            <TableCell align="right" sx={{ position: "sticky", top: headerHeight, zIndex: 10, backgroundColor: "#f1f5f9", borderRight: "1px solid #cbd5e1", fontWeight: 800, pr: 2, width: 120, minWidth: 120 }}>
                                                {formatQtyVal(detailedTotals.opening)}
                                            </TableCell>
                                        )}

                                        {/* Normal Mode: Stock In */}
                                        {!inwardMode && !outwardMode && !processMode && (
                                            <TableCell align="right" sx={{ position: "sticky", top: headerHeight, zIndex: 10, backgroundColor: "#f1f5f9", borderRight: "1px solid #cbd5e1", fontWeight: 800, pr: 2, width: 120, minWidth: 120 }}>
                                                {formatQtyVal(recalculatedTotals.inwardTotal)}
                                            </TableCell>
                                        )}

                                        {/* Inward Mode: Trip Details & Returns & Total Stock In */}
                                        {inwardMode && (
                                            <>
                                                {inwardTripHeaders.map((tripLabel) => {
                                                    if (hiddenInwardColumns.includes(tripLabel)) return null;
                                                    return (
                                                        <TableCell key={tripLabel} align="right" sx={{ position: "sticky", top: headerHeight, zIndex: 10, backgroundColor: "#f1f5f9", borderRight: "1px solid #cbd5e1", fontWeight: 800, pr: 2, width: viewMode === "cumulative" ? 120 : 200, minWidth: viewMode === "cumulative" ? 120 : 200 }}>
                                                            {formatQtyVal(inwardTripTotals[tripLabel])}
                                                        </TableCell>
                                                    );
                                                })}
                                                {!hiddenInwardColumns.includes("RETURN") && (
                                                    <TableCell align="right" sx={{ position: "sticky", top: headerHeight, zIndex: 10, backgroundColor: "#f1f5f9", borderRight: "1px solid #cbd5e1", fontWeight: 800, pr: 2, width: 120, minWidth: 120 }}>
                                                        {formatQtyVal(detailedTotals.returnQtyTotal)}
                                                    </TableCell>
                                                )}
                                                <TableCell align="right" sx={{ position: "sticky", top: headerHeight, zIndex: 10, backgroundColor: "#f1f5f9", fontWeight: 800, pr: 2, color: "#1e40af", width: 140, minWidth: 140 }}>
                                                    {formatQtyVal(recalculatedTotals.inwardTotal)}
                                                </TableCell>
                                            </>
                                        )}

                                        {/* Normal Mode: Process */}
                                        {!inwardMode && !outwardMode && !processMode && (
                                            <TableCell align="right" sx={{ position: "sticky", top: headerHeight, zIndex: 10, backgroundColor: "#f1f5f9", borderRight: "1px solid #cbd5e1", fontWeight: 800, pr: 2, width: 120, minWidth: 120 }}>
                                                {recalculatedTotals.processTotal === 0 ? "0" : formatQtyVal(recalculatedTotals.processTotal)}
                                            </TableCell>
                                        )}

                                        {/* Process Mode: PROCESS IN, PROCESS OUT, TOTAL PROCESS */}
                                        {processMode && (
                                            <>
                                                {!hiddenProcessColumns.includes("PROCESS IN") && (
                                                    <TableCell align="right" sx={{ position: "sticky", top: headerHeight, zIndex: 10, backgroundColor: "#f1f5f9", borderRight: "1px solid #cbd5e1", fontWeight: 800, pr: 2, width: 120, minWidth: 120 }}>
                                                        {formatQtyVal(detailedTotals.procIn)}
                                                    </TableCell>
                                                )}
                                                {!hiddenProcessColumns.includes("PROCESS OUT") && (
                                                    <TableCell align="right" sx={{ position: "sticky", top: headerHeight, zIndex: 10, backgroundColor: "#f1f5f9", borderRight: "1px solid #cbd5e1", fontWeight: 800, pr: 2, width: 120, minWidth: 120 }}>
                                                        {formatQtyVal(detailedTotals.procOut)}
                                                    </TableCell>
                                                )}
                                                <TableCell align="right" sx={{ position: "sticky", top: headerHeight, zIndex: 10, backgroundColor: "#f1f5f9", fontWeight: 800, pr: 2, color: "#1e40af", width: 140, minWidth: 140 }}>
                                                    {recalculatedTotals.processTotal === 0 ? "0" : formatQtyVal(recalculatedTotals.processTotal)}
                                                </TableCell>
                                            </>
                                        )}

                                        {/* Normal Mode: Stock Outwards */}
                                        {!inwardMode && !outwardMode && !processMode && (
                                            <TableCell align="right" sx={{ position: "sticky", top: headerHeight, zIndex: 10, backgroundColor: "#f1f5f9", borderRight: "1px solid #cbd5e1", fontWeight: 800, pr: 2, width: 120, minWidth: 120 }}>
                                                {formatQtyVal(recalculatedTotals.outwardTotal)}
                                            </TableCell>
                                        )}

                                        {/* Outward Mode: Out Details & Delivery & Total Outward */}
                                        {outwardMode && (
                                            <>
                                                {outwardTakenHeaders.map((tripLabel) => {
                                                    if (hiddenOutwardColumns.includes(tripLabel)) return null;
                                                    return (
                                                        <TableCell key={tripLabel} align="right" sx={{ position: "sticky", top: headerHeight, zIndex: 10, backgroundColor: "#f1f5f9", borderRight: "1px solid #cbd5e1", fontWeight: 800, pr: 2, width: viewMode === "cumulative" ? 120 : 200, minWidth: viewMode === "cumulative" ? 120 : 200 }}>
                                                            {(() => {
                                                                const data = outwardTakenTotals[tripLabel];
                                                                if (!data) return "-";
                                                                if (data.qty === 0) return "-";
                                                                return formatQtyVal(data.qty);
                                                            })()}
                                                        </TableCell>
                                                    );
                                                })}
                                                {viewMode === "trip" && !hiddenOutwardColumns.includes("Pending Delivery") && (
                                                    <TableCell align="right" sx={{ position: "sticky", top: headerHeight, zIndex: 10, backgroundColor: "#f1f5f9", borderRight: "1px solid #cbd5e1", fontWeight: 800, pr: 2, width: 130, minWidth: 130 }}>
                                                        {formatQtyVal(detailedTotals.deliveryQtyTotal)}
                                                    </TableCell>
                                                )}
                                                <TableCell align="right" sx={{ position: "sticky", top: headerHeight, zIndex: 10, backgroundColor: "#f1f5f9", fontWeight: 800, pr: 2, color: "#b91c1c", width: 140, minWidth: 140 }}>
                                                    {formatQtyVal(recalculatedTotals.outwardTotal)}
                                                </TableCell>
                                            </>
                                        )}

                                        {/* Normal Mode: Closing */}
                                        {!inwardMode && !outwardMode && !processMode && (
                                            <TableCell align="right" sx={{ position: "sticky", top: headerHeight, zIndex: 10, backgroundColor: "#f1f5f9", fontWeight: 800, pr: 2, color: recalculatedTotals.closingTotal > 0 ? "#15803d" : "#1e293b", width: 120, minWidth: 120 }}>
                                                {formatQtyVal(recalculatedTotals.closingTotal)}
                                            </TableCell>
                                        )}
                                    </TableRow>
                                )}
                            </TableHead>
                            <TableBody>
                                {paginatedData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={getTotalColumns()} align="center" sx={{ py: 6, color: "#94a3b8" }}>
                                            No stock items match your search/filter filters.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedData.map((item, idx) => {
                                        const currentGroupVal = String(item[groupByColumn] || "Others");
                                        const prevGroupVal = idx > 0 ? String(paginatedData[idx - 1][groupByColumn] || "Others") : null;
                                        const showGroupHeader = idx === 0 || currentGroupVal !== prevGroupVal;

                                        const sNo = (page - 1) * rowsPerPage + idx + 1;
                                        const openingStock = getOpeningStock(item);
                                        const { trips, returnQty, procInQty, procOutQty } = getProductDetails(item);
                                        const weight = getItemWeight(item);
                                        const itemProcIn = qtyMode === "bags" ? Math.round(procInQty / weight) : procInQty;
                                        const itemProcOut = qtyMode === "bags" ? Math.round(procOutQty / weight) : procOutQty;
                                        const rowProcIn = itemProcIn > 0 ? itemProcIn : getProcIn(item);
                                        const rowProcOut = itemProcOut > 0 ? itemProcOut : getProcOut(item);

                                        return (
                                            <React.Fragment key={idx}>
                                                {/* Group Separator */}
                                                {showGroupHeader && (
                                                    <TableRow sx={{ backgroundColor: "#f1f5f9" }}>
                                                        <TableCell
                                                            colSpan={getTotalColumns()}
                                                            sx={{
                                                                color: "#1E3A8A",
                                                                fontWeight: 800,
                                                                py: 1,
                                                                px: 2,
                                                                fontSize: "0.76rem",
                                                                letterSpacing: 0.5,
                                                                textAlign: "left"
                                                            }}
                                                        >
                                                            {currentGroupVal.toUpperCase()}
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                                {/* Data Row */}
                                                <TableRow hover sx={{ "&:hover": { bgcolor: "#f8fafc" } }}>
                                                    <TableCell align="center" sx={{ borderRight: "1px solid #e2e8f0", fontWeight: 600, color: "#475569", width: 60, minWidth: 60 }}>
                                                        {sNo}
                                                    </TableCell>
                                                    {enabledConfigColumns.map((col) => {
                                                        const val = item[col.key] ?? "-";
                                                        const isProduct = col.key === "stock_item_name" || col.key === "Stock_Item";
                                                        const w = isProduct ? 280 : 150;
                                                        const pId = item.Product_Id || (item as any).Product_Ids?.[0];
                                                        return (
                                                            <TableCell
                                                                key={col.key}
                                                                onClick={() => {
                                                                    if (isProduct && pId) {
                                                                        handleQuantityClick(pId, String(item.stock_item_name || item.Stock_Item || val), inwardMode ? 'IN' : processMode ? 'PROCESS' : outwardMode ? 'OUT' : 'ALL');
                                                                    }
                                                                }}
                                                                sx={{
                                                                    borderRight: "1px solid #e2e8f0",
                                                                    fontWeight: isProduct ? 700 : 600,
                                                                    color: isProduct ? "#2563eb" : "#475569",
                                                                    cursor: (isProduct && pId) ? "pointer" : "default",
                                                                    textDecoration: (isProduct && pId) ? "underline" : "none",
                                                                    wordBreak: "break-word",
                                                                    whiteSpace: "normal",
                                                                    width: w,
                                                                    minWidth: w,
                                                                    "&:hover": (isProduct && pId) ? { color: "#1d4ed8" } : {}
                                                                }}
                                                            >
                                                                {val}
                                                            </TableCell>
                                                        );
                                                    })}
                                                    {!inwardMode && !outwardMode && !processMode && (
                                                        <TableCell
                                                            align="right"
                                                            sx={{
                                                                borderRight: "1px solid #e2e8f0",
                                                                fontWeight: 600,
                                                                pr: 2,
                                                                color: "#475569",
                                                                width: 120,
                                                                minWidth: 120
                                                            }}
                                                        >
                                                            {formatQtyVal(openingStock)}
                                                        </TableCell>
                                                    )}

                                                    {/* Inward Mode or Normal Mode: Render Stock In */}
                                                    {!inwardMode && !outwardMode && !processMode && (
                                                        <TableCell
                                                            align="right"
                                                            onClick={() => {
                                                                const qtyVal = getRecalculatedStockInQty(item);
                                                                if (qtyVal !== 0) {
                                                                    handleQuantityClick(item.Product_Id || (item as any).Product_Ids?.[0], item.stock_item_name || item.Stock_Item, 'IN');
                                                                }
                                                            }}
                                                            sx={{
                                                                borderRight: "1px solid #e2e8f0",
                                                                fontWeight: 600,
                                                                pr: 2,
                                                                color: getRecalculatedStockInQty(item) > 0 ? "#2563eb" : "#475569",
                                                                cursor: getRecalculatedStockInQty(item) !== 0 ? "pointer" : "default",
                                                                textDecoration: getRecalculatedStockInQty(item) !== 0 ? "underline" : "none",
                                                                width: 120,
                                                                minWidth: 120,
                                                                "&:hover": getRecalculatedStockInQty(item) !== 0 ? { color: "#1d4ed8" } : {}
                                                            }}
                                                        >
                                                            {formatQtyVal(getRecalculatedStockInQty(item))}
                                                        </TableCell>
                                                    )}

                                                    {/* Inward Mode: Render dynamic TRIP columns, RETURN and TOTAL STOCK IN */}
                                                    {inwardMode && (
                                                        <>
                                                            {inwardTripHeaders.map((tripLabel) => {
                                                                if (hiddenInwardColumns.includes(tripLabel)) return null;
                                                                const qty = getQtyForTrip(trips, tripLabel, getItemWeight(item));
                                                                return (
                                                                    <TableCell
                                                                        key={tripLabel}
                                                                        align="right"
                                                                        onClick={() => {
                                                                            if (qty !== 0) {
                                                                                const tripNo = viewMode !== "cumulative"
                                                                                    ? (() => {
                                                                                        const matchingTripRecord = trips.find(t => getTripLabel(t) === tripLabel);
                                                                                        return matchingTripRecord?.Trip_No || matchingTripRecord?.trip_no || matchingTripRecord?.Trip_Voucher_Number;
                                                                                    })()
                                                                                    : undefined;
                                                                                handleQuantityClick(item.Product_Id || (item as any).Product_Ids?.[0], item.stock_item_name || item.Stock_Item, tripLabel, tripNo);
                                                                            }
                                                                        }}
                                                                        sx={{
                                                                            borderRight: "1px solid #e2e8f0",
                                                                            fontWeight: 600,
                                                                            pr: 2,
                                                                            color: qty > 0 ? "#2563eb" : "#94a3b8",
                                                                            cursor: qty !== 0 ? "pointer" : "default",
                                                                            textDecoration: qty !== 0 ? "underline" : "none",
                                                                            width: viewMode === "cumulative" ? 120 : 200,
                                                                            minWidth: viewMode === "cumulative" ? 120 : 200,
                                                                            "&:hover": qty !== 0 ? { color: "#1d4ed8" } : {}
                                                                        }}
                                                                    >
                                                                        {formatQtyVal(qty)}
                                                                    </TableCell>
                                                                );
                                                            })}
                                                            {!hiddenInwardColumns.includes("RETURN") && (
                                                                <TableCell
                                                                    align="right"
                                                                    onClick={() => {
                                                                        if (returnQty !== 0) {
                                                                            handleQuantityClick(item.Product_Id || (item as any).Product_Ids?.[0], item.stock_item_name || item.Stock_Item, 'RETURN');
                                                                        }
                                                                    }}
                                                                    sx={{
                                                                        borderRight: "1px solid #e2e8f0",
                                                                        fontWeight: 600,
                                                                        pr: 2,
                                                                        color: returnQty > 0 ? "#2563eb" : "#475569",
                                                                        cursor: returnQty !== 0 ? "pointer" : "default",
                                                                        textDecoration: returnQty !== 0 ? "underline" : "none",
                                                                        width: 120,
                                                                        minWidth: 120,
                                                                        "&:hover": returnQty !== 0 ? { color: "#1d4ed8" } : {}
                                                                    }}
                                                                >
                                                                    {formatQtyVal(returnQty)}
                                                                </TableCell>
                                                            )}
                                                            <TableCell
                                                                align="right"
                                                                onClick={() => {
                                                                    const qtyVal = getRecalculatedStockInQty(item);
                                                                    if (qtyVal !== 0) {
                                                                        handleQuantityClick(item.Product_Id || (item as any).Product_Ids?.[0], item.stock_item_name || item.Stock_Item, 'IN');
                                                                    }
                                                                }}
                                                                sx={{
                                                                    fontWeight: 700,
                                                                    pr: 2,
                                                                    backgroundColor: "#eff6ff",
                                                                    color: getRecalculatedStockInQty(item) > 0 ? "#2563eb" : "#1e40af",
                                                                    cursor: getRecalculatedStockInQty(item) !== 0 ? "pointer" : "default",
                                                                    textDecoration: getRecalculatedStockInQty(item) !== 0 ? "underline" : "none",
                                                                    width: 140,
                                                                    minWidth: 140,
                                                                    "&:hover": getRecalculatedStockInQty(item) !== 0 ? { color: "#1d4ed8" } : {}
                                                                }}
                                                            >
                                                                {formatQtyVal(getRecalculatedStockInQty(item))}
                                                            </TableCell>
                                                        </>
                                                    )}

                                                    {/* Normal Mode: Render Process */}
                                                    {!inwardMode && !outwardMode && !processMode && (
                                                        <TableCell
                                                            align="right"
                                                            onClick={() => {
                                                                const qtyVal = getRecalculatedProcessQty(item);
                                                                if (qtyVal !== 0) {
                                                                    handleQuantityClick(item.Product_Id || (item as any).Product_Ids?.[0], item.stock_item_name || item.Stock_Item, 'PROCESS');
                                                                }
                                                            }}
                                                            sx={{
                                                                borderRight: "1px solid #e2e8f0",
                                                                fontWeight: 600,
                                                                pr: 2,
                                                                color: getRecalculatedProcessQty(item) !== 0 ? "#2563eb" : "#475569",
                                                                cursor: getRecalculatedProcessQty(item) !== 0 ? "pointer" : "default",
                                                                textDecoration: getRecalculatedProcessQty(item) !== 0 ? "underline" : "none",
                                                                width: 120,
                                                                minWidth: 120,
                                                                "&:hover": getRecalculatedProcessQty(item) !== 0 ? { color: "#1d4ed8" } : {}
                                                            }}
                                                        >
                                                            {formatQtyVal(getRecalculatedProcessQty(item))}
                                                        </TableCell>
                                                    )}

                                                    {/* Process Mode: Render PROCESS IN, PROCESS OUT, and TOTAL PROCESS */}
                                                    {processMode && (
                                                        <>
                                                            {!hiddenProcessColumns.includes("PROCESS IN") && (
                                                                <TableCell
                                                                    align="right"
                                                                    onClick={() => {
                                                                        if (rowProcIn !== 0) {
                                                                            handleQuantityClick(item.Product_Id || (item as any).Product_Ids?.[0], item.stock_item_name || item.Stock_Item, 'PROCESS_IN');
                                                                        }
                                                                    }}
                                                                    sx={{
                                                                        borderRight: "1px solid #e2e8f0",
                                                                        fontWeight: 600,
                                                                        pr: 2,
                                                                        color: rowProcIn > 0 ? "#2563eb" : "#475569",
                                                                        cursor: rowProcIn !== 0 ? "pointer" : "default",
                                                                        textDecoration: rowProcIn !== 0 ? "underline" : "none",
                                                                        width: 120,
                                                                        minWidth: 120,
                                                                        "&:hover": rowProcIn !== 0 ? { color: "#1d4ed8" } : {}
                                                                    }}
                                                                >
                                                                    {formatQtyVal(rowProcIn)}
                                                                </TableCell>
                                                            )}
                                                            {!hiddenProcessColumns.includes("PROCESS OUT") && (
                                                                <TableCell
                                                                    align="right"
                                                                    onClick={() => {
                                                                        if (rowProcOut !== 0) {
                                                                            handleQuantityClick(item.Product_Id || (item as any).Product_Ids?.[0], item.stock_item_name || item.Stock_Item, 'PROCESS_OUT');
                                                                        }
                                                                    }}
                                                                    sx={{
                                                                        borderRight: "1px solid #e2e8f0",
                                                                        fontWeight: 600,
                                                                        pr: 2,
                                                                        color: rowProcOut > 0 ? "#2563eb" : "#475569",
                                                                        cursor: rowProcOut !== 0 ? "pointer" : "default",
                                                                        textDecoration: rowProcOut !== 0 ? "underline" : "none",
                                                                        width: 120,
                                                                        minWidth: 120,
                                                                        "&:hover": rowProcOut !== 0 ? { color: "#1d4ed8" } : {}
                                                                    }}
                                                                >
                                                                    {formatQtyVal(rowProcOut)}
                                                                </TableCell>
                                                            )}                                                            <TableCell
                                                                align="right"
                                                                onClick={() => {
                                                                    const qtyVal = getRecalculatedProcessQty(item);
                                                                    if (qtyVal !== 0) {
                                                                        handleQuantityClick(item.Product_Id || (item as any).Product_Ids?.[0], item.stock_item_name || item.Stock_Item, 'PROCESS');
                                                                    }
                                                                }}
                                                                sx={{
                                                                    fontWeight: 700,
                                                                    pr: 2,
                                                                    backgroundColor: "#eff6ff",
                                                                    color: getRecalculatedProcessQty(item) !== 0 ? "#2563eb" : "#1e40af",
                                                                    cursor: getRecalculatedProcessQty(item) !== 0 ? "pointer" : "default",
                                                                    textDecoration: getRecalculatedProcessQty(item) !== 0 ? "underline" : "none",
                                                                    width: 140,
                                                                    minWidth: 140,
                                                                    "&:hover": getRecalculatedProcessQty(item) !== 0 ? { color: "#1d4ed8" } : {}
                                                                }}
                                                            >
                                                                {formatQtyVal(getRecalculatedProcessQty(item))}
                                                            </TableCell>
                                                        </>
                                                    )}

                                                    {/* Normal Mode: Render STOCK OUTWARDS */}
                                                    {!inwardMode && !outwardMode && !processMode && (
                                                        <TableCell
                                                            align="right"
                                                            onClick={() => {
                                                                const qtyVal = getRecalculatedStockOutQty(item);
                                                                if (qtyVal !== 0) {
                                                                    handleQuantityClick(item.Product_Id || (item as any).Product_Ids?.[0], item.stock_item_name || item.Stock_Item, 'OUT');
                                                                }
                                                            }}
                                                            sx={{
                                                                borderRight: "1px solid #e2e8f0",
                                                                fontWeight: 600,
                                                                pr: 2,
                                                                color: getRecalculatedStockOutQty(item) > 0 ? "#2563eb" : "#475569",
                                                                cursor: getRecalculatedStockOutQty(item) !== 0 ? "pointer" : "default",
                                                                textDecoration: getRecalculatedStockOutQty(item) !== 0 ? "underline" : "none",
                                                                width: 120,
                                                                minWidth: 120,
                                                                "&:hover": getRecalculatedStockOutQty(item) !== 0 ? { color: "#1d4ed8" } : {}
                                                            }}
                                                        >
                                                            {formatQtyVal(getRecalculatedStockOutQty(item))}
                                                        </TableCell>
                                                    )}
                                                    {/* Outward Mode: Render dynamic TAKEN columns, PENDING TAKEN, and TOTAL OUTWARD */}
                                                    {outwardMode && (
                                                        <>
                                                            {(() => {
                                                                const { pendingDeliveryQty } = getProductDetails(item);
                                                                return (
                                                                    <>
                                                                        {outwardTakenHeaders.map((tripLabel) => {
                                                                            if (hiddenOutwardColumns.includes(tripLabel)) return null;
                                                                            const data = getQtyForTaken(item, tripLabel);
                                                                            const qty = data.qty;
                                                                            return (
                                                                                <TableCell
                                                                                    key={tripLabel}
                                                                                    align="right"
                                                                                    onClick={() => {
                                                                                        if (qty !== 0) {
                                                                                            handleQuantityClick(item.Product_Id || (item as any).Product_Ids?.[0], item.stock_item_name || item.Stock_Item, tripLabel);
                                                                                        }
                                                                                    }}
                                                                                    sx={{
                                                                                        borderRight: "1px solid #e2e8f0",
                                                                                        fontWeight: 600,
                                                                                        pr: 2,
                                                                                        color: qty > 0 ? "#2563eb" : "#94a3b8",
                                                                                        cursor: qty !== 0 ? "pointer" : "default",
                                                                                        textDecoration: qty !== 0 ? "underline" : "none",
                                                                                        width: viewMode === "cumulative" ? 120 : 200,
                                                                                        minWidth: viewMode === "cumulative" ? 120 : 200,
                                                                                        "&:hover": qty !== 0 ? { color: "#1d4ed8" } : {}
                                                                                    }}
                                                                                >
                                                                                    {qty === 0 ? "-" : formatQtyVal(qty)}
                                                                                </TableCell>
                                                                            );
                                                                        })}
                                                                        {viewMode === "trip" && !hiddenOutwardColumns.includes("Pending Delivery") && (
                                                                            <TableCell
                                                                                align="right"
                                                                                onClick={() => {
                                                                                    const pQty = qtyMode === "bags" ? Math.round(pendingDeliveryQty / getItemWeight(item)) : pendingDeliveryQty;
                                                                                    if (pQty !== 0) {
                                                                                        handleQuantityClick(item.Product_Id || (item as any).Product_Ids?.[0], item.stock_item_name || item.Stock_Item, 'Pending Delivery');
                                                                                    }
                                                                                }}
                                                                                sx={{
                                                                                    borderRight: "1px solid #e2e8f0",
                                                                                    fontWeight: 600,
                                                                                    pr: 2,
                                                                                    color: pendingDeliveryQty > 0 ? "#2563eb" : "#475569",
                                                                                    cursor: pendingDeliveryQty !== 0 ? "pointer" : "default",
                                                                                    textDecoration: pendingDeliveryQty !== 0 ? "underline" : "none",
                                                                                    width: 130,
                                                                                    minWidth: 130,
                                                                                    "&:hover": pendingDeliveryQty !== 0 ? { color: "#1d4ed8" } : {}
                                                                                }}
                                                                            >
                                                                                {pendingDeliveryQty === 0 ? "-" : formatQtyVal(qtyMode === "bags" ? Math.round(pendingDeliveryQty / getItemWeight(item)) : pendingDeliveryQty)}
                                                                            </TableCell>
                                                                        )}
                                                                    </>
                                                                );
                                                            })()}
                                                            <TableCell
                                                                align="right"
                                                                onClick={() => {
                                                                    const qtyVal = getRecalculatedStockOutQty(item);
                                                                    if (qtyVal !== 0) {
                                                                        handleQuantityClick(item.Product_Id || (item as any).Product_Ids?.[0], item.stock_item_name || item.Stock_Item, 'OUT');
                                                                    }
                                                                }}
                                                                sx={{
                                                                    fontWeight: 700,
                                                                    pr: 2,
                                                                    backgroundColor: "#fef2f2",
                                                                    color: getRecalculatedStockOutQty(item) > 0 ? "#2563eb" : "#b91c1c",
                                                                    cursor: getRecalculatedStockOutQty(item) !== 0 ? "pointer" : "default",
                                                                    textDecoration: getRecalculatedStockOutQty(item) !== 0 ? "underline" : "none",
                                                                    width: 140,
                                                                    minWidth: 140,
                                                                    "&:hover": getRecalculatedStockOutQty(item) !== 0 ? { color: "#1d4ed8" } : {}
                                                                }}
                                                            >
                                                                {formatQtyVal(getRecalculatedStockOutQty(item))}
                                                            </TableCell>
                                                        </>
                                                    )}

                                                    {/* Normal Mode: Render CLOSING STOCK */}
                                                    {!inwardMode && !outwardMode && !processMode && (
                                                        <TableCell
                                                            align="right"
                                                            sx={{
                                                                fontWeight: 700,
                                                                pr: 2,
                                                                backgroundColor: getRecalculatedClosingStock(item) > 0 ? "#dcfce7" : "transparent",
                                                                color: getRecalculatedClosingStock(item) > 0 ? "#15803d" : "#475569",
                                                                width: 120,
                                                                minWidth: 120
                                                            }}
                                                        >
                                                            {formatQtyVal(getRecalculatedClosingStock(item))}
                                                        </TableCell>
                                                    )}
                                                </TableRow>
                                            </React.Fragment>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    <CommonPagination
                        totalRows={numFilteredAndSortedRows.length}
                        page={page}
                        rowsPerPage={rowsPerPage}
                        onPageChange={setPage}
                        onRowsPerPageChange={setRowsPerPage}
                    />
                </>
            )}

            <ReportFilterDrawer
                open={drawerOpen}
                onToggle={() => {
                    if (drawerOpen) {
                        setTempFromDate(fromDate);
                        setTempToDate(toDate);
                    }
                    setDrawerOpen(!drawerOpen);
                }}
                onClose={() => {
                    setDrawerOpen(false);
                    setTempFromDate(fromDate);
                    setTempToDate(toDate);
                }}
                fromDate={tempFromDate}
                toDate={tempToDate}
                onFromDateChange={setTempFromDate}
                onToDateChange={setTempToDate}
                showQtyModeFilter={true}
                qtyModeValue={qtyMode}
                onQtyModeChange={setQtyMode}
                onApply={() => {
                    setDrawerOpen(false);
                    if (tempFromDate === fromDate && tempToDate === toDate) {
                        loadGodownList();
                        if (selectedGodown) {
                            loadDetailedStock(selectedGodown.godown_id);
                        }
                    } else {
                        setFromDate(tempFromDate);
                        setToDate(tempToDate);
                    }
                }}
            />

            {/* ===== GROUP BY POPUP MENU ===== */}
            <Menu
                anchorEl={groupByAnchor}
                open={Boolean(groupByAnchor)}
                onClose={() => setGroupByAnchor(null)}
            >
                {GROUPBY_OPTIONS.map((opt) => (
                    <MenuItem
                        key={opt.key}
                        selected={groupByColumn === opt.key}
                        onClick={() => {
                            setGroupByColumn(opt.key);
                            setSelectedBrand("All"); // Reset chip filter
                            setGroupByAnchor(null);
                        }}
                        sx={{ fontSize: "0.85rem", py: 1 }}
                    >
                        {opt.label}
                    </MenuItem>
                ))}
            </Menu>

            {/* ===== COLUMN SETTINGS POPUP MENU ===== */}
            <Menu
                anchorEl={settingsAnchor}
                open={Boolean(settingsAnchor)}
                onClose={() => setSettingsAnchor(null)}
            >
                <Box p={2} minWidth={300}>
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5} pb={1} borderBottom="1px solid #e2e8f0">
                        <Typography variant="subtitle2" fontWeight={700} color="#1E3A8A">
                            Column Settings
                        </Typography>
                        <Button
                            size="small"
                            variant="text"
                            onClick={() => setColumnsConfig(DEFAULT_CONFIGURABLE_COLUMNS)}
                            sx={{ textTransform: "none", fontWeight: 600, minWidth: 0, p: 0 }}
                        >
                            Reset
                        </Button>
                    </Box>

                    <Typography fontWeight={600} fontSize={12} mb={1}>
                        Enabled Columns
                    </Typography>

                    <DndContext
                        collisionDetection={closestCenter}
                        onDragEnd={(event) => {
                            const { active, over } = event;
                            if (!over || active.id === over.id) return;
                            const enabledCols = columnsConfig
                                .filter(c => c.enabled)
                                .sort((a, b) => a.order - b.order);
                            const oldIndex = enabledCols.findIndex(c => c.key === active.id);
                            const newIndex = enabledCols.findIndex(c => c.key === over.id);
                            const reordered = arrayMove(enabledCols, oldIndex, newIndex);
                            const newColumns = columnsConfig.map(col => {
                                const found = reordered.findIndex(r => r.key === col.key);
                                if (found !== -1) {
                                    return { ...col, order: found };
                                }
                                return col;
                            });
                            setColumnsConfig(newColumns);
                        }}
                    >
                        <SortableContext
                            items={columnsConfig.filter(c => c.enabled).map(c => c.key)}
                            strategy={verticalListSortingStrategy}
                        >
                            <Box sx={{ maxHeight: 200, overflowY: "auto", mb: 2 }}>
                                {columnsConfig
                                    .filter(c => c.enabled)
                                    .sort((a, b) => a.order - b.order)
                                    .map(col => (
                                        <SortableColumn
                                            key={col.key}
                                            column={col}
                                            toggle={(key) =>
                                                setColumnsConfig(prev =>
                                                    prev.map(c =>
                                                        c.key === key ? { ...c, enabled: false } : c
                                                    )
                                                )
                                            }
                                        />
                                    ))}
                            </Box>
                        </SortableContext>
                    </DndContext>

                    <Box mt={2}>
                        <Typography fontWeight={600} fontSize={12} mb={1}>
                            Disabled Columns
                        </Typography>

                        <Box sx={{ maxHeight: 200, overflowY: "auto" }}>
                            {columnsConfig
                                .filter(c => !c.enabled)
                                .map(col => (
                                    <Box
                                        key={col.key}
                                        display="flex"
                                        justifyContent="space-between"
                                        alignItems="center"
                                        py={0.5}
                                        px={1}
                                        sx={{ borderBottom: "1px solid #eee" }}
                                    >
                                        <Typography fontSize={12}>{col.label}</Typography>
                                        <Switch
                                            size="medium"
                                            checked={false}
                                            onChange={() =>
                                                setColumnsConfig(prev =>
                                                    prev.map(c =>
                                                        c.key === col.key ? { ...c, enabled: true } : c
                                                    )
                                                )
                                            }
                                        />
                                    </Box>
                                ))}
                        </Box>
                    </Box>
                </Box>
            </Menu>

            {/* ===== DETAILED TRANSACTIONS POPUP ===== */}
            <Dialog
                open={popupOpen}
                onClose={() => setPopupOpen(false)}
                maxWidth="lg"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: 3,
                        boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)"
                    }
                }}
            >
                <DialogTitle sx={{ m: 0, p: 2.5, display: "flex", justifyContent: "space-between", alignItems: "center", bgcolor: "#1E3A8A", color: "#fff" }}>
                    <Box>
                        <Typography variant="h6" component="div" fontWeight={700}>
                            {popupProductInfo?.productName}
                        </Typography>
                        <Typography variant="caption" sx={{ opacity: 0.85, fontWeight: 500 }}>
                            Godown: {popupProductInfo?.godownName} | Period: {dayjs(fromDate).format("DD/MM/YYYY")} - {dayjs(toDate).format("DD/MM/YYYY")}
                            {popupFilterType !== 'ALL' && ` | View: ${popupFilterType === 'OB' ? 'Opening Stock' : popupFilterType === 'IN' ? 'In Qty' : popupFilterType === 'OUT' ? 'Out Qty' : popupFilterType === 'PROCESS' ? 'Process' : popupFilterType === 'PROCESS_IN' ? 'Process In' : popupFilterType === 'PROCESS_OUT' ? 'Process Out' : popupFilterType}`}
                        </Typography>
                    </Box>
                    <IconButton
                        aria-label="close"
                        onClick={() => setPopupOpen(false)}
                        sx={{
                            color: "#fff",
                            "&:hover": { bgcolor: "rgba(255,255,255,0.15)" }
                        }}
                    >
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent dividers sx={{ p: 2.5, bgcolor: "#f8fafc" }}>
                    {popupLoading ? (
                        <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
                            <CircularProgress color="primary" />
                        </Box>
                    ) : (
                        <TableContainer component={Paper} elevation={0} sx={{ border: "1px solid #cbd5e1", borderRadius: 2, maxHeight: 350 }}>
                            <Table size="small" stickyHeader sx={{ "& .MuiTableCell-root": { py: 0.6, fontSize: "0.72rem" } }}>
                                <TableHead>
                                    <TableRow>
                                        <TableCell align="center" sx={{ backgroundColor: "#1e293b", color: "#fff", fontWeight: 600 }}>S.NO</TableCell>
                                        <TableCell sx={{ backgroundColor: "#1e293b", color: "#fff", fontWeight: 600 }}>VOUCHER TYPE</TableCell>
                                        <TableCell sx={{ backgroundColor: "#1e293b", color: "#fff", fontWeight: 600 }}>INV NO</TableCell>

                                        {showCreatedOn && (
                                            <TableCell sx={{ backgroundColor: "#1e293b", color: "#fff", fontWeight: 600 }}>CREATED ON</TableCell>
                                        )}
                                        {showRetailerColumn && (
                                            <TableCell sx={{ backgroundColor: "#1e293b", color: "#fff", fontWeight: 600 }}>RETAILER NAME</TableCell>
                                        )}                                        {popupFilterType === "ALL" ? (
                                            <>
                                                <TableCell align="right" sx={{ backgroundColor: "#1e293b", color: "#fff", fontWeight: 600 }}>IN QTY</TableCell>
                                                <TableCell align="right" sx={{ backgroundColor: "#1e293b", color: "#fff", fontWeight: 600 }}>PROCES QTY</TableCell>
                                                <TableCell align="right" sx={{ backgroundColor: "#1e293b", color: "#fff", fontWeight: 600 }}>OUT QTY</TableCell>
                                                <TableCell align="right" sx={{ backgroundColor: "#1e293b", color: "#fff", fontWeight: 600 }}>PENDING QTY</TableCell>
                                            </>
                                        ) : (
                                            <TableCell align="right" sx={{ backgroundColor: "#1e293b", color: "#fff", fontWeight: 600 }}>
                                                {getDynamicQtyHeader()}
                                            </TableCell>
                                        )}
                                        {uniqueRoles.map((role) => (
                                            <TableCell key={role} sx={{ backgroundColor: "#1e293b", color: "#fff", fontWeight: 600 }}>{role.toUpperCase()}</TableCell>
                                        ))}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {filteredPopupRows.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={totalColSpan} align="center" sx={{ py: 4, color: "#64748b" }}>
                                                No transactions found.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        <>
                                            {/* Total Row */}
                                            <TableRow sx={{ bgcolor: "#eff6ff", "& .MuiTableCell-root": { fontWeight: 700, color: "#1e40af", borderBottom: "2px solid #cbd5e1" } }}>
                                                <TableCell align="center">-</TableCell>
                                                <TableCell>TOTAL</TableCell>
                                                <TableCell></TableCell>
                                                {showCreatedOn && <TableCell></TableCell>}
                                                {showRetailerColumn && <TableCell></TableCell>}
                                                {popupFilterType === "ALL" ? (
                                                    <>
                                                        <TableCell align="right">
                                                            {popupTotals.totalInQty === 0 ? "-" : popupTotals.totalInQty.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                                        </TableCell>
                                                        <TableCell align="right">
                                                            {popupTotals.totalProcessQty === 0 ? "-" : popupTotals.totalProcessQty.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                                        </TableCell>
                                                        <TableCell align="right">
                                                            {popupTotals.totalOutQty === 0 ? "-" : popupTotals.totalOutQty.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                                        </TableCell>
                                                        <TableCell align="right">
                                                            {popupTotals.totalPendingQty === 0 ? "-" : popupTotals.totalPendingQty.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                                        </TableCell>
                                                    </>
                                                ) : (
                                                    <TableCell align="right">
                                                        {popupTotals.totalFilteredQty === 0 ? "-" : popupTotals.totalFilteredQty.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                                    </TableCell>
                                                )}
                                                {uniqueRoles.map((role) => (
                                                    <TableCell key={role}></TableCell>
                                                ))}
                                            </TableRow>
                                            {(() => {
                                                let prevDateStr: string | null = null;
                                                let sno = 1;
                                                return filteredPopupRows.map((r, i) => {
                                                    const currentDateStr = dayjs(r.Do_Date || r.Ledger_Date || r.Stock_Ledger_Date || r.Process_Date).format("DD-MM-YYYY");
                                                    const showDateHeader = currentDateStr !== prevDateStr;
                                                    prevDateStr = currentDateStr;

                                                    const staffMap = parseStaffInvolved(r.Staff_Involved || "");
                                                    const { inQty, processQty, outQty, pendingQty } = getRowQuantities(r);
                                                    const filteredQty = getRowQtyForFilter(r, popupFilterType);

                                                    const formatVal = (val: number) => {
                                                        if (val === 0) return "-";
                                                        return val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
                                                    };

                                                    return (
                                                        <React.Fragment key={i}>
                                                            {showDateHeader && (
                                                                <TableRow sx={{ backgroundColor: "#e2e8f0" }}>
                                                                    <TableCell
                                                                        colSpan={totalColSpan}
                                                                        sx={{ fontWeight: 800, color: "#1e293b", py: 0.8 }}
                                                                    >
                                                                        DATE: {currentDateStr}
                                                                    </TableCell>
                                                                </TableRow>
                                                            )}
                                                            <TableRow hover sx={{ "&:hover": { bgcolor: "#f1f5f9" } }}>
                                                                <TableCell align="center" sx={{ fontWeight: 600, color: "#64748b" }}>{sno++}</TableCell>
                                                                <TableCell>{r.Voucher_Type || r.voucher_name || r.Stock_Voucher_Name || r.module || r.Module || "-"}</TableCell>
                                                                <TableCell>{getRowInvNoDisplay(r)}</TableCell>
                                                                {showCreatedOn && (
                                                                    <TableCell>{formatISTTimeOnly(r.Created_At || r.Created_on)}</TableCell>
                                                                )}
                                                                {showRetailerColumn && <TableCell>{r.Retailer_Name || "-"}</TableCell>}
                                                                {popupFilterType === "ALL" ? (
                                                                    <>
                                                                        <TableCell align="right" sx={{ fontWeight: 600, color: inQty > 0 ? "#15803d" : "#475569" }}>
                                                                            {formatVal(inQty)}
                                                                        </TableCell>
                                                                        <TableCell align="right" sx={{ fontWeight: 600, color: processQty !== 0 ? "#2563eb" : "#475569" }}>
                                                                            {formatVal(processQty)}
                                                                        </TableCell>
                                                                        <TableCell align="right" sx={{ fontWeight: 600, color: outQty > 0 ? "#b91c1c" : "#475569" }}>
                                                                            {formatVal(outQty)}
                                                                        </TableCell>
                                                                        <TableCell align="right" sx={{ fontWeight: 600, color: pendingQty > 0 ? "#d97706" : "#475569" }}>
                                                                            {formatVal(pendingQty)}
                                                                        </TableCell>
                                                                    </>
                                                                ) : (
                                                                    <TableCell align="right" sx={{ fontWeight: 600, color: "#1e293b" }}>
                                                                        {formatVal(filteredQty)}
                                                                    </TableCell>
                                                                )}
                                                                {uniqueRoles.map((role) => (
                                                                    <TableCell key={role}>{staffMap[role] || "-"}</TableCell>
                                                                ))}
                                                            </TableRow>
                                                        </React.Fragment>
                                                    );
                                                });
                                            })()}
                                        </>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </DialogContent>
            </Dialog>

            {/* ===== GODOWN NAME COLUMN HEADER FILTER MENU ===== */}
            <Menu
                anchorEl={godownFilterAnchor}
                open={Boolean(godownFilterAnchor)}
                onClose={() => setGodownFilterAnchor(null)}
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
                <Box p={2} sx={{ minWidth: 220, maxWidth: 300 }}>
                    <TextField
                        size="small"
                        fullWidth
                        placeholder="Search Godown..."
                        value={godownFilterSearch}
                        onChange={e => setGodownFilterSearch(e.target.value)}
                        sx={{ mb: 1 }}
                    />

                    <MenuItem
                        dense
                        onClick={() => {
                            setSelectedGodowns([]);
                            setGodownFilterAnchor(null);
                        }}
                    >
                        <Checkbox checked={selectedGodowns.length === 0} size="small" />
                        <ListItemText primary="All" primaryTypographyProps={{ fontSize: "0.85rem", fontWeight: 600 }} />
                    </MenuItem>

                    <Box sx={{ maxHeight: 200, overflowY: "auto" }}>
                        {uniqueGodownNames
                            .filter(name =>
                                name.toLowerCase().includes(godownFilterSearch.toLowerCase())
                            )
                            .map(name => {
                                const isChecked = selectedGodowns.includes(name);
                                return (
                                    <MenuItem
                                        key={name}
                                        dense
                                        onClick={() => {
                                            if (isChecked) {
                                                setSelectedGodowns(prev => prev.filter(x => x !== name));
                                            } else {
                                                setSelectedGodowns(prev => [...prev, name]);
                                            }
                                        }}
                                    >
                                        <Checkbox checked={isChecked} size="small" />
                                        <ListItemText primary={name} primaryTypographyProps={{ fontSize: "0.85rem", fontWeight: 600 }} />
                                    </MenuItem>
                                );
                            })}
                    </Box>
                </Box>
            </Menu>

            {loading && (
                <Box sx={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    bgcolor: "rgba(255,255,255,0.6)",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    zIndex: 9999
                }}>
                    <CircularProgress color="primary" />
                </Box>
            )}
        </Box>
    );
};

export default InStockReport;