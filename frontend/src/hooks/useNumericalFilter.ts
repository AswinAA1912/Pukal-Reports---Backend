import { useState, useMemo } from "react";

export interface SortConfig {
  key: string;
  direction: "asc" | "desc";
}

export function useNumericalFilter<T>(
  rawData: T[],
  numericKeys: string[]
) {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [rangeFilter, setRangeFilter] = useState<Record<string, [number, number]>>({});
  const [filterAnchor, setFilterAnchor] = useState<null | HTMLElement>(null);
  const [activeHeader, setActiveHeader] = useState<string | null>(null);

  const isNumericColumn = (key: string) => {
    return numericKeys.includes(key);
  };

  const getMinMax = (key: string) => {
    const nums = rawData
      .map((r) => Number(r[key as keyof T]))
      .filter((v) => !isNaN(v) && v !== null && v !== undefined);
    if (nums.length === 0) return { min: 0, max: 100 };
    const minVal = Math.min(...nums);
    const maxVal = Math.max(...nums);
    return {
      min: minVal,
      max: minVal === maxVal ? minVal + 1 : maxVal,
    };
  };

  const handleSort = (columnKey: string) => {
    setSortConfig((prev) => {
      if (prev && prev.key === columnKey) {
        return {
          key: columnKey,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      return {
        key: columnKey,
        direction: "asc",
      };
    });
  };

  const openFilter = (e: React.MouseEvent<any>, columnKey: string) => {
    setActiveHeader(columnKey);
    setFilterAnchor(e.currentTarget);
  };

  const filteredAndSortedData = useMemo(() => {
    let rows = [...rawData];

    // Apply Range Filter
    if (rangeFilter) {
      for (const [key, range] of Object.entries(rangeFilter)) {
        rows = rows.filter((r) => {
          const val = Number(r[key as keyof T]);
          return isNaN(val) || (val >= range[0] && val <= range[1]);
        });
      }
    }

    // Apply Sorting
    if (sortConfig) {
      const { key, direction } = sortConfig;
      rows.sort((a, b) => {
        const valA = Number(a[key as keyof T]) || 0;
        const valB = Number(b[key as keyof T]) || 0;
        return direction === "asc" ? valA - valB : valB - valA;
      });
    }

    return rows;
  }, [rawData, sortConfig, rangeFilter]);

  const clearRangeFilter = (key: string) => {
    setRangeFilter((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  return {
    sortConfig,
    setSortConfig,
    rangeFilter,
    setRangeFilter,
    filterAnchor,
    setFilterAnchor,
    activeHeader,
    setActiveHeader,
    isNumericColumn,
    getMinMax,
    handleSort,
    openFilter,
    filteredAndSortedData,
    clearRangeFilter,
  };
}
