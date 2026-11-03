import React, { useState, useMemo } from "react";
import {
  Paper,
  Box,
  Table,
  TableContainer,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TablePagination,
  TableSortLabel,
  TextField,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  Button,
  IconButton,
  Collapse,
  Autocomplete,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import {
  KeyboardArrowDown,
  KeyboardArrowUp,
  Settings,
} from "@mui/icons-material";

type SortDirection = "asc" | "desc";
interface SortRule<T> {
  field: keyof T;
  dir: SortDirection;
}

interface ColumnConfig<T> {
  key: keyof T;
  label: string;
  type?: "string" | "number" | "date" | "time" | "datetime" | "custom";
  sortable?: boolean;
  searchable?: boolean;
  render?: (row: T) => React.ReactNode;
  groupable?: boolean;
  aggregate?: "sum" | "avg" | "min" | "max" | "count" | null;
  visible?: boolean;
}

interface AdvancedDataTableProps<T extends object> {
  title?: string;
  data: T[];
  columns: ColumnConfig<T>[];
  fontSize?: number | "small" | "medium" | "large";
  hoverColor?: string;
  striped?: boolean;
  pagination?: boolean;
  pageSizeOptions?: number[];
  defaultPageSize?: number;
  globalSearch?: boolean;
  expandableRows?: boolean;
  renderExpandedRow?: (row: T) => React.ReactNode;
  themeMode?: "light" | "dark";
  fixedHeader?: boolean;
  minHeight?: number;
  maxHeight?: number;
  onSettingsChange?: (settings: any) => void;
  renderHeaderContent?: React.ReactNode;
  renderFooterContent?: React.ReactNode;
}

export default function TableComponent<T extends object>(
  props: AdvancedDataTableProps<T>
) {
  const {
    title,
    data,
    columns: columnsProp,
    fontSize = "medium",
    hoverColor,
    striped = false,
    pagination = false,
    pageSizeOptions = [5, 10, 25, 50],
    defaultPageSize = 10,
    globalSearch = false,
    expandableRows = false,
    renderExpandedRow,
    themeMode,
    fixedHeader = false,
    minHeight,
    maxHeight,
    onSettingsChange,
    renderHeaderContent,
    renderFooterContent,
  } = props;

  const [columns, setColumns] = useState<ColumnConfig<T>[]>(() =>
    columnsProp.map((col) => ({ ...col, visible: col.visible !== false }))
  );
  const [sortModel, setSortModel] = useState<SortRule<T>[]>([]);
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [globalFilter, setGlobalFilter] = useState<string>("");
  const [expandedRows, setExpandedRows] = useState<Set<number | string>>(
    new Set()
  );
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [groupBy, setGroupBy] = useState<Array<keyof T>>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const theme = useTheme();

  const sortedData = useMemo(() => {
    if (sortModel.length === 0) return data;
    const dataCopy = [...data];
    dataCopy.sort((a, b) => {
      for (let rule of sortModel) {
        const { field, dir } = rule;
        let av = a[field],
          bv = b[field];
        if (av === undefined || av === null) {
          return 1;
        }
        if (bv === undefined || bv === null) {
          return -1;
        }
        if (typeof av === "number" && typeof bv === "number") {
          if (av < bv) return dir === "asc" ? -1 : 1;
          if (av > bv) return dir === "asc" ? 1 : -1;
        } else if (av instanceof Date && bv instanceof Date) {
          if (av.getTime() < bv.getTime()) return dir === "asc" ? -1 : 1;
          if (av.getTime() > bv.getTime()) return dir === "asc" ? 1 : -1;
        } else {
          const aStr = String(av).toLowerCase();
          const bStr = String(bv).toLowerCase();
          if (aStr < bStr) return dir === "asc" ? -1 : 1;
          if (aStr > bStr) return dir === "asc" ? 1 : -1;
        }
      }
      return 0;
    });
    return dataCopy;
  }, [data, sortModel]);

  const filteredData = useMemo(() => {
    let result = sortedData;
    // Column-specific filters
    for (const col of columns) {
      if (!col.visible || !col.searchable) continue;
      const colKey = col.key as string;
      const filterVal = filters[colKey];
      if (filterVal == null) continue;
      result = result.filter((row) => {
        const cellVal = row[col.key];
        if (col.type === "number") {
          if (
            typeof filterVal.min === "number" &&
            (row[col.key] as any) < filterVal.min
          )
            return false;
          if (
            typeof filterVal.max === "number" &&
            (row[col.key] as any) > filterVal.max
          )
            return false;
          return true;
        } else if (col.type === "date" || col.type === "datetime") {
          const cellDate =
            cellVal instanceof Date
              ? cellVal
              : new Date(cellVal as unknown as string | number | Date);
          if (filterVal.from && cellDate < new Date(filterVal.from))
            return false;
          if (filterVal.to && cellDate > new Date(filterVal.to)) return false;
          return true;
        } else if (col.type === "time") {
          const cellTime = cellVal ? String(cellVal) : "";
          if (filterVal.from && cellTime < filterVal.from) return false;
          if (filterVal.to && cellTime > filterVal.to) return false;
          return true;
        } else {
          if (!filterVal) return true;
          return cellVal === filterVal;
        }
      });
    }
    if (globalFilter) {
      const query = globalFilter.toLowerCase();
      result = result.filter((row) => {
        return columns.some((col) => {
          if (!col.visible) return false;
          const cellVal = row[col.key];
          if (cellVal === null || cellVal === undefined) return false;
          return String(cellVal).toLowerCase().includes(query);
        });
      });
    }
    return result;
  }, [sortedData, filters, globalFilter, columns]);

  const groupedData = useMemo(() => {
    if (groupBy.length === 0) return filteredData;
    const groupRecursively = (rows: T[], level: number): any[] => {
      if (level >= groupBy.length) return rows;
      const key = groupBy[level];
      const groupsMap = new Map<any, T[]>();
      rows.forEach((row) => {
        const keyVal = row[key];
        if (!groupsMap.has(keyVal)) groupsMap.set(keyVal, []);
        groupsMap.get(keyVal)!.push(row);
      });
      const groupedResults: any[] = [];
      for (let [val, groupRows] of groupsMap) {
        const groupId = `${String(key)}=${String(val)}`;
        const groupObj: any = {
          __group: true,
          level,
          key: key,
          value: val,
          id: groupId,
        };
        columns.forEach((col) => {
          if (!col.aggregate) return;
          let aggValue: any;
          const vals = groupRows.map((r) => r[col.key]);
          switch (col.aggregate) {
            case "count":
              aggValue = groupRows.length;
              break;
            case "sum": {
              const sum = vals.reduce(
                (acc: number, v: any) => acc + (parseFloat(v) || 0),
                0
              );
              aggValue = sum;
              break;
            }
            case "avg": {
              const sum = vals.reduce(
                (acc: number, v: any) => acc + (parseFloat(v) || 0),
                0
              );
              aggValue = groupRows.length ? sum / groupRows.length : 0;
              break;
            }
            case "min": {
              aggValue = vals.reduce(
                (min: any, v: any) => (v < min ? v : min),
                vals[0]
              );
              break;
            }
            case "max": {
              aggValue = vals.reduce(
                (max: any, v: any) => (v > max ? v : max),
                vals[0]
              );
              break;
            }
            default:
              aggValue = null;
          }
          groupObj[col.key] = aggValue;
        });
        groupedResults.push(groupObj);
        const children = groupRecursively(groupRows, level + 1);
        groupedResults.push(...children);
      }
      return groupedResults;
    };
    return groupRecursively(filteredData, 0);
  }, [filteredData, groupBy, columns]);

  const displayData = groupedData;

  // const pageCount = pagination ? Math.ceil(displayData.length / pageSize) : 1;
  const pagedData = useMemo(() => {
    if (!pagination) return displayData;
    const start = page * pageSize;
    return displayData.slice(start, start + pageSize);
  }, [displayData, pagination, page, pageSize]);

  const uniqueColumnValues = useMemo(() => {
    const map: Record<string, any[]> = {};
    columns.forEach((col) => {
      if (col.searchable && col.type === "string") {
        const vals = new Set<any>();
        data.forEach((row) => {
          vals.add(row[col.key]);
        });
        map[col.key as string] = Array.from(vals);
      }
    });
    return map;
  }, [data, columns]);

  const handleSortClick = (col: ColumnConfig<T>) => {
    if (!col.sortable) return;
    setPage(0);
    setSortModel((prev) => {
      const existingIndex = prev.findIndex((r) => r.field === col.key);
      if (existingIndex >= 0) {
        const existingRule = prev[existingIndex];
        if (existingRule.dir === "asc") {
          const newRules = [...prev];
          newRules[existingIndex] = { field: col.key, dir: "desc" };
          return newRules;
        } else {
          const newRules = prev.filter((r) => r.field !== col.key);
          return newRules;
        }
      } else {
        return [...prev, { field: col.key, dir: "asc" }];
      }
    });
  };

  const handleFilterChange = (col: ColumnConfig<T>, value: any) => {
    const colKey = col.key as string;
    setPage(0);
    setFilters((prev) => ({ ...prev, [colKey]: value }));
  };

  const handleGlobalSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPage(0);
    setGlobalFilter(e.target.value);
  };

  const toggleRowExpanded = (rowId: number | string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(rowId)) newSet.delete(rowId);
      else newSet.add(rowId);
      return newSet;
    });
  };

  const toggleGroupExpanded = (groupId: string) => {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) newSet.delete(groupId);
      else newSet.add(groupId);
      return newSet;
    });
  };

  const handleChangePage = (_: any, newPage: number) => {
    setPage(newPage);
  };

  const handleChangePageSize = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSize = parseInt(e.target.value, 10);
    setPageSize(newSize);
    setPage(0);
  };

  const handleToggleColumnVisibility = (colKey: keyof T) => {
    setColumns((prevCols) =>
      prevCols.map((c) =>
        c.key === colKey ? { ...c, visible: !c.visible } : c
      )
    );
  };

  const handleApplySettings = () => {
    onSettingsChange?.({
      pageSize,
      sortModel,
      filters,
      globalFilter,
      hiddenColumns: columns.filter((c) => !c.visible).map((c) => c.key),
      themeMode: themeMode,
      fixedHeader,
      groupBy,
    });
    setSettingsOpen(false);
  };

  const visibleCols = columns.filter((c) => c.visible);
  const colCount = visibleCols.length + (expandableRows ? 1 : 0);

  const fontSizePx =
    typeof fontSize === "number"
      ? fontSize
      : fontSize === "small"
      ? 12
      : fontSize === "large"
      ? 18
      : 14;

  return (
    <Paper sx={{ width: "100%", overflowX: "auto", typography: "body2" }}>
      {(title || renderHeaderContent || globalSearch) && (
        <Box
          sx={{
            p: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography variant="h6">{title}</Typography>
          <Box>
            {globalSearch && (
              <TextField
                placeholder="Search..."
                value={globalFilter}
                onChange={handleGlobalSearch}
                size="small"
                sx={{ mr: 2 }}
              />
            )}
            {renderHeaderContent}
            <IconButton onClick={() => setSettingsOpen(true)}>
              <Settings />
            </IconButton>
          </Box>
        </Box>
      )}

      <TableContainer
        sx={{
          maxHeight: fixedHeader ? maxHeight || 400 : undefined,
          minHeight: minHeight || undefined,
        }}
      >
        <Table
          stickyHeader={fixedHeader}
          size="small"
          sx={{ fontSize: fontSizePx }}
        >
          <TableHead>
            <TableRow>
              {expandableRows && <TableCell />}
              {visibleCols.map((col) => (
                <TableCell
                  key={String(col.key)}
                  sortDirection={
                    sortModel.find((r) => r.field === col.key)?.dir || false
                  }
                >
                  {col.sortable ? (
                    <TableSortLabel
                      active={!!sortModel.find((r) => r.field === col.key)}
                      direction={
                        sortModel.find((r) => r.field === col.key)?.dir || "asc"
                      }
                      onClick={() => handleSortClick(col)}
                    >
                      {col.label}
                      {sortModel.findIndex((r) => r.field === col.key) >= 0 &&
                        sortModel.length > 1 && (
                          <sup>
                            {sortModel.findIndex((r) => r.field === col.key) +
                              1}
                          </sup>
                        )}
                    </TableSortLabel>
                  ) : (
                    col.label
                  )}
                </TableCell>
              ))}
            </TableRow>

            <TableRow>
              {expandableRows && <TableCell />}
              {visibleCols.map((col) => (
                <TableCell key={String(col.key)}>
                  {col.searchable
                    ? (() => {
                        const colKey = col.key as string;
                        if (col.type === "string") {
                          const options = uniqueColumnValues[colKey] || [];
                          return (
                            <Autocomplete
                              options={options}
                              value={filters[colKey] || null}
                              onChange={(_, newVal) =>
                                handleFilterChange(col, newVal)
                              }
                              renderInput={(params) => (
                                <TextField
                                  {...params}
                                  placeholder="Filter"
                                  size="small"
                                />
                              )}
                              sx={{ width: 120 }}
                            />
                          );
                        } else if (col.type === "number") {
                          return (
                            <Box
                              sx={{ display: "flex", flexDirection: "column" }}
                            >
                              <TextField
                                type="number"
                                size="small"
                                placeholder="Min"
                                value={filters[colKey]?.min ?? ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  handleFilterChange(col, {
                                    min: val === "" ? undefined : Number(val),
                                    max: filters[colKey]?.max,
                                  });
                                }}
                                sx={{ mb: 0.5 }}
                              />
                              <TextField
                                type="number"
                                size="small"
                                placeholder="Max"
                                value={filters[colKey]?.max ?? ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  handleFilterChange(col, {
                                    min: filters[colKey]?.min,
                                    max: val === "" ? undefined : Number(val),
                                  });
                                }}
                              />
                            </Box>
                          );
                        } else if (
                          col.type === "date" ||
                          col.type === "datetime"
                        ) {
                          return (
                            <Box
                              sx={{ display: "flex", flexDirection: "column" }}
                            >
                              <TextField
                                type="date"
                                size="small"
                                value={filters[colKey]?.from || ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  handleFilterChange(col, {
                                    from: val,
                                    to: filters[colKey]?.to,
                                  });
                                }}
                                sx={{ mb: 0.5 }}
                              />
                              <TextField
                                type="date"
                                size="small"
                                value={filters[colKey]?.to || ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  handleFilterChange(col, {
                                    from: filters[colKey]?.from,
                                    to: val,
                                  });
                                }}
                              />
                            </Box>
                          );
                        } else if (col.type === "time") {
                          return (
                            <Box
                              sx={{ display: "flex", flexDirection: "column" }}
                            >
                              <TextField
                                type="time"
                                size="small"
                                value={filters[colKey]?.from || ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  handleFilterChange(col, {
                                    from: val,
                                    to: filters[colKey]?.to,
                                  });
                                }}
                                sx={{ mb: 0.5 }}
                              />
                              <TextField
                                type="time"
                                size="small"
                                value={filters[colKey]?.to || ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  handleFilterChange(col, {
                                    from: filters[colKey]?.from,
                                    to: val,
                                  });
                                }}
                              />
                            </Box>
                          );
                        } else {
                          return (
                            <TextField
                              size="small"
                              placeholder="Search"
                              value={filters[colKey] || ""}
                              onChange={(e) =>
                                handleFilterChange(col, e.target.value)
                              }
                            />
                          );
                        }
                      })()
                    : null}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {pagedData.map((row, index) => {
              if ((row as any).__group) {
                const group = row as any;
                const level = group.level || 0;
                const indent = level * 2;
                const isExpanded = expandedGroups.has(group.id);
                return (
                  <React.Fragment key={group.id}>
                    <TableRow sx={{ backgroundColor: "#f0f0f0" }}>
                      {expandableRows && <TableCell />}
                      <TableCell
                        colSpan={colCount}
                        sx={{ fontWeight: "bold", pl: indent }}
                      >
                        {groupBy.length - 1 === level ? null : (
                          <IconButton
                            size="small"
                            onClick={() => toggleGroupExpanded(group.id)}
                          >
                            {isExpanded ? (
                              <KeyboardArrowUp fontSize="small" />
                            ) : (
                              <KeyboardArrowDown fontSize="small" />
                            )}
                          </IconButton>
                        )}
                        {String(group.key)}:{" "}
                        <strong>{String(group.value)}</strong>
                        <em>
                          {" "}
                          (
                          {group.count !== undefined
                            ? group.count
                            : group.rows?.length || 0}{" "}
                          items)
                        </em>
                        {columns
                          .filter((c) => c.aggregate && c.key !== group.key)
                          .map((c) => {
                            const aggVal = group[c.key];
                            if (aggVal === undefined) return null;
                            return (
                              <span
                                key={String(c.key)}
                                style={{ marginLeft: 16 }}
                              >
                                {c.label} {c.aggregate}: <b>{String(aggVal)}</b>
                              </span>
                            );
                          })}
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                );
              } else {
                const rowId = (row as any).id ?? index;
                const isRowExpanded = expandedRows.has(rowId);
                return (
                  <React.Fragment key={rowId}>
                    <TableRow
                      sx={{
                        "&:hover": hoverColor
                          ? { backgroundColor: hoverColor }
                          : {},
                        backgroundColor:
                          striped && index % 2 === 1
                            ? theme.palette.action.hover
                            : "inherit",
                      }}
                    >
                      {expandableRows && (
                        <TableCell>
                          {renderExpandedRow && (
                            <IconButton
                              size="small"
                              onClick={() => toggleRowExpanded(rowId)}
                            >
                              {isRowExpanded ? (
                                <KeyboardArrowUp />
                              ) : (
                                <KeyboardArrowDown />
                              )}
                            </IconButton>
                          )}
                        </TableCell>
                      )}
                      {visibleCols.map((col) => (
                        <TableCell key={String(col.key)}>
                          {col.render
                            ? col.render(row)
                            : (() => {
                                if (
                                  groupBy.includes(col.key) &&
                                  groupBy[0] === col.key
                                ) {
                                  return "";
                                }
                                let value = row[col.key];
                                if (col.type === "number") {
                                  value =
                                    value == null
                                      ? ""
                                      : new Intl.NumberFormat("en-IN").format(
                                          value as any
                                        );
                                } else if (col.type === "date") {
                                  value = value
                                    ? new Date(value as any).toLocaleDateString(
                                        "en-GB"
                                      )
                                    : "";
                                } else if (col.type === "datetime") {
                                  const dt = new Date(value as any);
                                  value = value
                                    ? dt.toLocaleDateString("en-GB") +
                                      " " +
                                      dt.toLocaleTimeString("en-GB")
                                    : "";
                                } else if (col.type === "time") {
                                  if (value instanceof Date) {
                                    value = (value as Date).toLocaleTimeString(
                                      "en-US"
                                    );
                                  }
                                }
                                return value;
                              })()}
                        </TableCell>
                      ))}
                    </TableRow>
                    {expandableRows && renderExpandedRow && isRowExpanded && (
                      <TableRow>
                        <TableCell colSpan={colCount} sx={{ p: 0 }}>
                          <Collapse
                            in={isRowExpanded}
                            timeout="auto"
                            unmountOnExit
                          >
                            <Box sx={{ m: 1 }}>{renderExpandedRow(row)}</Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              }
            })}
            {pagedData.length === 0 && (
              <TableRow>
                <TableCell colSpan={colCount} align="center">
                  No records found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {(pagination || renderFooterContent) && (
        <Box
          sx={{
            p: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Box>{renderFooterContent}</Box>
          {pagination && (
            <TablePagination
              component="div"
              count={displayData.length}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={pageSize}
              onRowsPerPageChange={handleChangePageSize}
              rowsPerPageOptions={pageSizeOptions}
            />
          )}
        </Box>
      )}

      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <DialogTitle>Table Options</DialogTitle>
        <DialogContent dividers>
          <FormControlLabel
            control={
              <Switch
                checked={themeMode === "dark"}
                onChange={() =>
                  props.onSettingsChange?.({
                    themeMode: themeMode === "dark" ? "light" : "dark",
                  })
                }
              />
            }
            label="Dark Mode"
          />
          <br />
          <FormControlLabel
            control={
              <Switch
                checked={fixedHeader}
                // onChange={e => { /* We'll handle via onSettingsChange or local state if needed */ }}
              />
            }
            label="Fixed Header"
          />
          <br />
          {pagination && (
            <>
              <Typography gutterBottom>Page Size:</Typography>
              <Select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                size="small"
              >
                {pageSizeOptions.map((size) => (
                  <MenuItem key={size} value={size}>
                    {size}
                  </MenuItem>
                ))}
              </Select>
            </>
          )}
          <br />
          <Typography gutterBottom>Table Height (px):</Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
            <TextField
              label="Min Height"
              type="number"
              size="small"
              value={minHeight || ""}
              // onChange={e => {/* update via onSettingsChange or local state */ }}
            />
            <TextField
              label="Max Height"
              type="number"
              size="small"
              value={maxHeight || ""}
              // onChange={e => {/* update via onSettingsChange or local state */ }}
            />
          </Box>
          <Typography gutterBottom>Columns:</Typography>
          {columns.map((col) => (
            <FormControlLabel
              key={String(col.key)}
              control={
                <Checkbox
                  checked={col.visible ?? true}
                  onChange={() => handleToggleColumnVisibility(col.key)}
                />
              }
              label={col.label}
            />
          ))}
          {columns.some((col) => col.groupable) && (
            <>
              <Typography gutterBottom>Group By:</Typography>
              <Select
                multiple
                value={groupBy.map((k) => String(k))}
                onChange={(e) => {
                  const vals = Array.from(e.target.value as string[]);
                  setGroupBy(
                    vals.map(
                      (v) =>
                        columns.find((col) => col.label === v)?.key as keyof T
                    )
                  );
                }}
                size="small"
                renderValue={(selected) => selected.join(", ")}
              >
                {columns
                  .filter((c) => c.groupable)
                  .map((c) => (
                    <MenuItem key={String(c.key)} value={c.label}>
                      <Checkbox checked={groupBy.includes(c.key)} />
                      {c.label}
                    </MenuItem>
                  ))}
              </Select>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>Cancel</Button>
          <Button onClick={handleApplySettings} variant="contained">
            Apply
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
