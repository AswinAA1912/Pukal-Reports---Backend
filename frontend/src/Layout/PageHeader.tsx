import React, { useState, useMemo, useEffect } from "react";
import {
  AppBar,
  Toolbar,
  Box,
  Select,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  IconButton,
  Menu,
  Tooltip,
  Button,
  alpha,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import MenuIcon from "@mui/icons-material/Menu";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import PowerSettingsNewIcon from "@mui/icons-material/PowerSettingsNew";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import logo from "../assets/logo.png";
import { SettingsService } from "../services/reportSettings.services";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth, Company } from "../auth/authContext";
import { MenuService } from "../services/menus.service";
import { UserRightsService } from "../services/userRights.service";
import { handleExternalOrMenuNavigation } from "../utils/navigation";

export type ToggleMode = "Abstract" | "Expanded";

export type Menus = {
  id: number;
  name: string;
  rUrl: string;
  is_active: number;
};

export interface Page {
  label: string;
  path: string;
  id?: number;
}

interface PageHeaderProps {
  /** OPTIONAL TOGGLE */
  toggleMode?: ToggleMode;
  onToggleChange?: (mode: ToggleMode) => void;
  abstractLabel?: string;
  expandedLabel?: string;

  /** OPTIONAL EXPORT */
  onExportPDF?: () => void;
  onExportExcel?: () => void;

  /** ✅ OPTIONAL SETTINGS SLOT */
  settingsSlot?: React.ReactNode;
  infoSlot?: React.ReactNode;
  showPages?: boolean;
  onReportChange?: (report: any) => void;
  onQuickSave?: (parentName: string) => void;
  parentReportName?: string;
}

export const PAGE_HEADER_HEIGHT = 40;
export const PAGE_HEADER_HEIGHT_MOBILE = 72;

const PageHeader: React.FC<PageHeaderProps> = ({
  toggleMode,
  onToggleChange,
  abstractLabel,
  expandedLabel,
  onExportPDF,
  onExportExcel,
  settingsSlot,
  infoSlot,
  showPages = true,
  onReportChange,
  onQuickSave,
  parentReportName
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const { user, token, companies, switchCompany, logout, isAutoLogin } = useAuth();
  const [anchorElCompany, setAnchorElCompany] = useState<null | HTMLElement>(null);
  const openCompanyMenu = Boolean(anchorElCompany);
  const [pages, setPages] = useState<Page[]>([]);
  const [routeMap, setRouteMap] = useState<Record<string, string>>({});
  const [anchorElExport, setAnchorElExport] = useState<null | HTMLElement>(null);
  const openExportMenu = Boolean(anchorElExport);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | number>("");
  const [userAllowedMenuIds, setUserAllowedMenuIds] = useState<number[]>([]);

  const isDevOrAdmin = useMemo(() => {
    return user ? (String(user.UserTypeId) === "0" || String(user.UserTypeId) === "1") : false;
  }, [user]);

  const selectedPath = useMemo(() => {
    return routeMap[location.pathname] || location.pathname;
  }, [routeMap, location.pathname]);

  const currentPageLabel = useMemo(() => {
    return (
      parentReportName ||
      pages.find((p) => p.path === selectedPath)?.label ||
      location.pathname.replace("/", "").replace(/-/g, " ").toUpperCase()
    );
  }, [parentReportName, pages, selectedPath, location.pathname]);

  const currentPage = useMemo(() => {
    return pages.find((p) => p.label.toUpperCase() === currentPageLabel.toUpperCase() || p.path === selectedPath);
  }, [pages, currentPageLabel, selectedPath]);

  const hasBaseMenuAccess = useMemo(() => {
    return isDevOrAdmin || !!(currentPage?.id && userAllowedMenuIds.includes(currentPage.id));
  }, [isDevOrAdmin, currentPage, userAllowedMenuIds]);

  const effectiveSelectedPath = useMemo(() => {
    if (pages.some((p) => p.path === selectedPath)) {
      return selectedPath;
    }
    const caseMatch = pages.find(
      (p) => p.path.toLowerCase() === selectedPath.toLowerCase()
    );
    if (caseMatch) {
      return caseMatch.path;
    }
    if (parentReportName) {
      const labelMatch = pages.find(
        (p) => p.label.trim().toUpperCase() === parentReportName.trim().toUpperCase()
      );
      if (labelMatch) {
        return labelMatch.path;
      }
    }
    return selectedPath;
  }, [pages, selectedPath, parentReportName]);

  const displayPages = useMemo(() => {
    if (pages.length === 0) return [];
    const hasCurrent = pages.some(
      (p) =>
        p.path.toLowerCase() === selectedPath.toLowerCase() ||
        (parentReportName && p.label.trim().toUpperCase() === parentReportName.trim().toUpperCase())
    );
    if (!hasCurrent && currentPageLabel) {
      return [
        ...pages,
        {
          label: currentPageLabel,
          path: selectedPath,
        },
      ];
    }
    return pages;
  }, [pages, selectedPath, currentPageLabel, parentReportName]);


  // Company name for display
  const companyName = useMemo(() => user?.Company_Name || "", [user]);

  useEffect(() => {
    const fetchMenus = async () => {
      if (!user) return;
      try {

        let allowedMenuIds: number[] = [];
        const allowedParentReports = new Set<string>();
        if (!isDevOrAdmin) {
          try {
            const rightsRes = await UserRightsService.getUserRights(user.id);
            if (rightsRes.data?.success) {
              const ids = (rightsRes.data.data || []).map((r: any) =>
                Number(r.menu_id)
              );
              allowedMenuIds = ids;
              setUserAllowedMenuIds(ids);

              // Match template IDs to parent report labels so we allow the parent report page
              try {
                const templatesRes = await SettingsService.getReportList();
                const templatesData = templatesRes.data?.data || {};
                Object.entries(templatesData).forEach(([parentReport, items]: [string, any]) => {
                  if (Array.isArray(items)) {
                    items.forEach((reportObj: any) => {
                      if (ids.includes(Number(reportObj.Report_Id))) {
                        allowedParentReports.add(parentReport.toUpperCase());
                      }
                    });
                  }
                });
              } catch (tempErr) {
                console.error("Failed to load templates in PageHeader rights fetch:", tempErr);
              }
            }
          } catch (rightsErr) {
            console.error("Error loading user rights in PageHeader:", rightsErr);
          }
        }

        const res = await MenuService.getMenus();
        const menus = res.data.data;

        const parentPages: Page[] = [];
        const subRouteMap: Record<string, string> = {};

        menus.forEach((menu: any) => {
          if (
            menu.menu_type === 1 &&
            menu.is_active === 3 &&
            menu.SubMenu?.length
          ) {
            menu.SubMenu.forEach((sub: any) => {
              if (sub.is_active === 3) {
                // Filter by rights if not Dev/Admin
                if (
                  !isDevOrAdmin &&
                  !allowedMenuIds.includes(sub.id) &&
                  !allowedParentReports.has(sub.name.toUpperCase())
                ) {
                  return;
                }

                parentPages.push({
                  label: sub.name,
                  path: sub.rUrl,
                  id: sub.id,
                });

                if (sub.SubRoutes?.length) {
                  sub.SubRoutes.forEach((route: any) => {
                    if (route.is_active === 3) {
                      subRouteMap[route.rUrl] = sub.rUrl;
                    }
                  });
                }
              }
            });
          }
        });

        // Append User Rights screen if Developer or Admin
        if (isDevOrAdmin) {
          const hasUserRightsMenu = parentPages.some(
            (p) => p.path === "/userRights"
          );
          if (!hasUserRightsMenu) {
            parentPages.push({
              label: "USER RIGHTS",
              path: "/userRights",
            });
          }
        }

        setPages(parentPages);
        setRouteMap(subRouteMap);
      } catch (err) {
        console.error("Menu fetch error", err);
      }
    };

    fetchMenus();
  }, [user]);

  // Handle company menu
  const handleCompanyClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorElCompany(event.currentTarget);
  };

  const handleCompanyClose = async (company?: Company) => {
    setAnchorElCompany(null);
    if (company) {
      try {
        await switchCompany(company);
        window.location.reload();
      } catch (e) {
        // Switch failed, do not reload
      }
    }
  };

  useEffect(() => {
    if (!currentPageLabel) return;

    const loadTemplates = async () => {
      try {
        const res = await SettingsService.getReportsByParent(currentPageLabel);

        if (res.data.success) {
          const templatesList = res.data.data || [];

          // For regular users (non-Dev/Admin), only include templates explicitly allowed in user rights
          let filteredTemplates = templatesList;
          if (!isDevOrAdmin) {
            filteredTemplates = templatesList.filter((t: any) =>
              userAllowedMenuIds.includes(Number(t.Report_Id))
            );
          }
          setTemplates(filteredTemplates);

          // If user only has template-level access (no Default View), auto-select their template
          if (!isDevOrAdmin && !hasBaseMenuAccess) {
            const assignedTemplate = filteredTemplates.find((t: any) =>
              userAllowedMenuIds.includes(Number(t.Report_Id))
            );
            if (assignedTemplate) {
              setSelectedTemplate(Number(assignedTemplate.Report_Id));
              onReportChange?.(assignedTemplate);
            }
          } else {
            // Default View enabled (or Dev/Admin) -> start on initial screen alone
            setSelectedTemplate("");
            onReportChange?.(null);
          }
        }
      } catch (err) {
        console.error("Template load error", err);
      }
    };

    loadTemplates();
  }, [currentPageLabel, userAllowedMenuIds, isDevOrAdmin, hasBaseMenuAccess]);

  return (
    <>
      <AppBar
        position="fixed"
        elevation={1}
        sx={{
          background: "#1E3A8A",
          height: isMobile ? PAGE_HEADER_HEIGHT_MOBILE : PAGE_HEADER_HEIGHT,
          top: 0,
          zIndex: (theme) => theme.zIndex.appBar,
        }}
      >
        <Toolbar
          disableGutters
          sx={{
            minHeight: `${PAGE_HEADER_HEIGHT}px !important`,
            height: PAGE_HEADER_HEIGHT,
            px: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            overflowX: "auto",
            whiteSpace: "nowrap",
          }}
        >

          {/* LEFT SECTION */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              flexShrink: 0,
            }}
          >
            {!isAutoLogin && (
              <Box
                onClick={() => navigate("/")}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  cursor: "pointer",
                }}
              >
                <img
                  src={logo}
                  alt="Pukal Reports"
                  style={{
                    height: 28,
                    objectFit: "contain",
                  }}
                />
              </Box>
            )}

            {showPages &&
              (isAutoLogin ? (
                <Box
                  sx={{
                    minWidth: 160,
                    height: 24,
                    fontSize: "0.75rem",
                    backgroundColor: "#fff",
                    color: "#000000",
                    borderRadius: 0.5,
                    display: "flex",
                    alignItems: "center",
                    px: 1,
                    fontWeight: 600,
                  }}
                >
                  {currentPageLabel}
                </Box>
              ) : (
                <Select
                  size="small"
                  value={effectiveSelectedPath}
                  onChange={(e) => {
                    const nextPath = e.target.value as string;
                    const item = displayPages.find((p) => p.path === nextPath);
                    if (item) {
                      handleExternalOrMenuNavigation(item.path, item.label, navigate, token, user);
                    }
                  }}
                  sx={{
                    minWidth: isMobile ? 140 : 180,
                    height: 24,
                    fontSize: "0.7rem",
                    backgroundColor: "#fff",
                    borderRadius: 0.5,
                    "& .MuiSelect-select": {
                      py: 0,
                      display: "flex",
                      alignItems: "center",
                    },
                  }}
                >
                  {displayPages.map((p) => (
                    <MenuItem
                      key={p.path}
                      value={p.path}
                      sx={{ fontSize: "0.7rem" }}
                      onClick={() => handleExternalOrMenuNavigation(p.path, p.label, navigate, token, user)}
                    >
                      {p.label}
                    </MenuItem>
                  ))}
                </Select>
              ))}

            {templates.length > 0 && (
              <Select
                size="small"
                disabled={!hasBaseMenuAccess && templates.length <= 1}
                value={selectedTemplate === "" ? "" : Number(selectedTemplate)}
                onChange={(e) => {
                  const reportId = e.target.value === "" ? "" : Number(e.target.value);
                  setSelectedTemplate(reportId);

                  if (reportId === "") {
                    onReportChange?.(null);
                    return;
                  }
                  const selected = templates.find(
                    (t) => Number(t.Report_Id) === Number(reportId)
                  );

                  if (selected) {
                    onReportChange?.(selected);
                  }
                }}
                displayEmpty
                sx={{
                  minWidth: isMobile ? 130 : 170,
                  height: 24,
                  fontSize: "0.7rem",
                  backgroundColor: "#fff",
                  borderRadius: 0.5,
                  "& .MuiSelect-select": {
                    py: 0,
                    display: "flex",
                    alignItems: "center",
                  },
                }}
              >
                {hasBaseMenuAccess ? (
                  <MenuItem value="">Select Template</MenuItem>
                ) : (
                  selectedTemplate === "" && <MenuItem value="" disabled>Loading template...</MenuItem>
                )}

                {templates.map((t) => (
                  <MenuItem key={t.Report_Id} value={Number(t.Report_Id)}>
                    {t.Report_Name}
                  </MenuItem>
                ))}
              </Select>
            )}
          </Box>

          {/* DESKTOP COMPANY SWITCH */}
          {!isMobile && user && companies && companies.length > 1 && (
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <Button
                color="inherit"
                endIcon={<ArrowDropDownIcon />}
                onClick={handleCompanyClick}
                sx={{
                  color: "#fff",
                  textTransform: "none",
                  fontWeight: 700,
                }}
              >
                {companyName || "Select Company"}
              </Button>

              <Menu
                anchorEl={anchorElCompany}
                open={openCompanyMenu}
                onClose={() => handleCompanyClose()}
                PaperProps={{ sx: { minWidth: 200 } }}
              >
                {companies.map((company) => {
                  const isSelected = company.id === user?.companyId;

                  return (
                    <MenuItem
                      key={company.id}
                      onClick={() => handleCompanyClose(company)}
                      sx={{
                        fontSize: "0.85rem",
                        fontWeight: isSelected ? 700 : 500,
                        backgroundColor: isSelected
                          ? alpha("#1E3A8A", 0.1)
                          : "inherit",
                      }}
                    >
                      {company.name}
                    </MenuItem>
                  );
                })}
              </Menu>
            </Box>
          )}

          {/* RIGHT SECTION */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.75,
              flexShrink: 0,
            }}
          >
            {infoSlot}

            {onQuickSave && (
              <Tooltip title="Save Template">
                <IconButton
                  size="small"
                  onClick={() => onQuickSave(currentPageLabel)}
                  sx={{
                    height: 24,
                    width: 24,
                    backgroundColor: "#fff",
                    borderRadius: 0.5,
                  }}
                >
                  +
                </IconButton>
              </Tooltip>
            )}

            {toggleMode && onToggleChange && (
              <ToggleButtonGroup
                exclusive
                size="small"
                value={toggleMode}
                onChange={(_, val) => val && onToggleChange(val)}
                sx={{
                  height: 26,
                  backgroundColor: "#f5f5f5",
                  borderRadius: 1,
                  p: 0.25,

                  "& .MuiToggleButton-root": {
                    fontSize: "0.6rem",
                    px: isMobile ? 0.8 : 1.2,
                    py: 0,
                    border: "none",
                    color: "#444",
                    textTransform: "uppercase",
                  },

                  "& .MuiToggleButton-root.Mui-selected": {
                    backgroundColor: "#1e3a8a",
                    color: "#fff",
                    fontWeight: 700,
                    boxShadow: "0 2px 4px rgba(0,0,0,0.25)",
                  },

                  "& .MuiToggleButton-root.Mui-selected:hover": {
                    backgroundColor: "#1e40af",
                  },
                }}
              >
                <ToggleButton value="Abstract">{abstractLabel || "Abstract"}</ToggleButton>
                <ToggleButton value="Expanded">{expandedLabel || "Expanded"}</ToggleButton>
              </ToggleButtonGroup>
            )}

            {(onExportPDF || onExportExcel) && (
              <>
                <Tooltip title="Export">
                  <IconButton
                    size="small"
                    onClick={(e) => setAnchorElExport(e.currentTarget)}
                    sx={{
                      height: 24,
                      width: 24,
                      backgroundColor: "#fff",
                      borderRadius: 0.5,
                    }}
                  >
                    <FileDownloadIcon fontSize="small" />
                  </IconButton>
                </Tooltip>

                <Menu
                  anchorEl={anchorElExport}
                  open={openExportMenu}
                  onClose={() => setAnchorElExport(null)}
                >
                  {onExportPDF && (
                    <MenuItem
                      onClick={() => {
                        setAnchorElExport(null);
                        onExportPDF();
                      }}
                    >
                      Export as PDF
                    </MenuItem>
                  )}

                  {onExportExcel && (
                    <MenuItem
                      onClick={() => {
                        setAnchorElExport(null);
                        onExportExcel();
                      }}
                    >
                      Export as Excel
                    </MenuItem>
                  )}
                </Menu>
              </>
            )}

            {settingsSlot}

            {/* MOBILE COMPANY SWITCH */}
            {isMobile && user && companies && companies.length > 1 && (
              <>
                <IconButton
                  size="small"
                  onClick={handleCompanyClick}
                  sx={{ backgroundColor: "#fff" }}
                >
                  <MenuIcon fontSize="small" />
                </IconButton>

                <Menu
                  anchorEl={anchorElCompany}
                  open={openCompanyMenu}
                  onClose={() => handleCompanyClose()}
                  PaperProps={{ sx: { minWidth: 200 } }}
                >
                  {companies.map((company) => {
                    const isSelected = company.id === user?.companyId;

                    return (
                      <MenuItem
                        key={company.id}
                        onClick={() => handleCompanyClose(company)}
                        sx={{
                          fontSize: "0.85rem",
                          fontWeight: isSelected ? 700 : 500,
                        }}
                      >
                        {company.name}
                      </MenuItem>
                    );
                  })}
                </Menu>
              </>
            )}

            {/* LOGOUT */}
            <Tooltip title="Logout">
              <IconButton
                size="small"
                onClick={logout}
                sx={{
                  ml: 0.5,
                  backgroundColor: "#c02222",
                  color: "#fff",
                  width: 28,
                  height: 28,
                  "&:hover": { backgroundColor: "#a61c1c" },
                }}
              >
                <PowerSettingsNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

        </Toolbar>
      </AppBar>

      <Box sx={{ height: isMobile ? PAGE_HEADER_HEIGHT_MOBILE : PAGE_HEADER_HEIGHT }} />
    </>
  )
};

export default PageHeader;