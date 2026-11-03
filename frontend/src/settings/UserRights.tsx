import React, { useEffect, useState, useMemo } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Autocomplete,
  TextField,
  Button,
  Checkbox,
  Grid,
  CircularProgress,
  IconButton,
  Paper,
  InputAdornment,
  Collapse,
  Select,
  MenuItem,
  ListItemText,
  Chip,
  Tooltip,
} from "@mui/material";
import {
  Save as SaveIcon,
  Security as SecurityIcon,
  Search as SearchIcon,
  CheckCircleOutline as CheckCircleIcon,
  HighlightOff as ClearIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  Group as GroupIcon,
  DashboardCustomize as DashboardCustomizeIcon,
  ViewAgendaOutlined as ViewAgendaIcon,
  Layers as LayersIcon,
  Badge as BadgeIcon,
  Person as PersonIcon,
} from "@mui/icons-material";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import PageHeader from "../Layout/PageHeader";
import { MenuService } from "../services/menus.service";
import { UserRightsService, UserDropdownItem, UserTypeItem } from "../services/userRights.service";
import { SettingsService } from "../services/reportSettings.services";

interface MenuFlatItem {
  id: number;
  name: string;
  parentName: string;
  parentId: number | null;
  rUrl: string;
}

const UserRights: React.FC = () => {
  // User Types state
  const [userTypes, setUserTypes] = useState<UserTypeItem[]>([]);
  const [selectedUserType, setSelectedUserType] = useState<UserTypeItem | null>(null);

  // Users state
  const [users, setUsers] = useState<UserDropdownItem[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserDropdownItem | null>(null);
  const [selectedGroupUsers, setSelectedGroupUsers] = useState<UserDropdownItem[]>([]);

  // Flat list of menus for searching/checkboxes
  const [flatMenus, setFlatMenus] = useState<MenuFlatItem[]>([]);
  // Menu rights list for selected user or group
  const [userRightsIds, setUserRightsIds] = useState<number[]>([]);

  // UI states
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingRights, setLoadingRights] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingStatusText, setSavingStatusText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Collapse/Expand state for main categories
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [templatesData, setTemplatesData] = useState<Record<string, any>>({});

  // 1. Fetch Users, User Types and Menus on load
  useEffect(() => {
    // Clear any lingering toasts from previous pages (e.g. Login successful)
    toast.dismiss();

    const initData = async () => {
      setLoadingUsers(true);
      try {
        // Fetch all user types for the UserType dropdown
        try {
          const utRes = await UserRightsService.getUserTypes();
          if (utRes.data?.success) {
            setUserTypes(utRes.data.data || []);
          }
        } catch (utErr) {
          console.error("Error loading user types in UserRights:", utErr);
        }

        // Fetch all users for the dropdown
        const userRes = await UserRightsService.getUserDropdown();
        if (userRes.data?.success) {
          setUsers(userRes.data.data || []);
        } else {
          toast.error("Failed to load users list");
        }

        // Fetch all templates
        let templatesObj = {};
        try {
          const templatesRes = await SettingsService.getReportList();
          if (templatesRes.data?.success) {
            templatesObj = templatesRes.data.data || {};
          }
        } catch (tErr) {
          console.error("Error loading templates in UserRights:", tErr);
        }
        setTemplatesData(templatesObj);

        // Fetch all available menus
        const menuRes = await MenuService.getMenus();
        const menusData = menuRes.data?.data || [];

        // Flatten menus (Main Menu -> SubMenu -> ChildMenu)
        const flat: MenuFlatItem[] = [];
        const initialExpanded: Record<string, boolean> = {};

        menusData.forEach((mainMenu: any) => {
          if (mainMenu.is_active === 3) {
            initialExpanded[mainMenu.name] = true;

            if (mainMenu.SubMenu && mainMenu.SubMenu.length > 0) {
              mainMenu.SubMenu.forEach((sub: any) => {
                if (sub.is_active === 3) {
                  flat.push({
                    id: sub.id,
                    name: sub.name,
                    parentName: mainMenu.name,
                    parentId: mainMenu.id,
                    rUrl: sub.rUrl,
                  });

                  // ChildMenus if any
                  if (sub.ChildMenu && sub.ChildMenu.length > 0) {
                    sub.ChildMenu.forEach((child: any) => {
                      if (child.is_active === 3) {
                        flat.push({
                          id: child.id,
                          name: `${sub.name} ➔ ${child.name}`,
                          parentName: mainMenu.name,
                          parentId: sub.id,
                          rUrl: child.rUrl,
                        });
                      }
                    });
                  }
                }
              });
            }
          }
        });

        setFlatMenus(flat);
        setExpandedCategories(initialExpanded);
      } catch (err: any) {
        console.error("Error loading initial data:", err);
        toast.error("Failed to initialize screen data");
      } finally {
        setLoadingUsers(false);
      }
    };

    initData();
  }, []);

  // Helper to match user with selected UserType (by UserTypeId or UserType string)
  const isUserMatched = (u: UserDropdownItem, type: UserTypeItem) => {
    if (u.UserTypeId !== undefined && u.UserTypeId !== null && type.Id !== undefined && type.Id !== null) {
      if (String(u.UserTypeId).trim() === String(type.Id).trim()) {
        return true;
      }
    }
    if (u.UserType && type.UserType) {
      if (u.UserType.trim().toUpperCase() === type.UserType.trim().toUpperCase()) {
        return true;
      }
    }
    return false;
  };

  // Filtered users when a UserType is selected
  const filteredUsersForDropdown = useMemo(() => {
    if (!selectedUserType) return users;
    return users.filter((u) => isUserMatched(u, selectedUserType));
  }, [users, selectedUserType]);

  // Target selection check (either single user selected, or UserType selected with group users)
  const hasTargetSelection = Boolean(
    (!selectedUserType && selectedUser) ||
    (selectedUserType && selectedGroupUsers.length > 0)
  );

  // Handle UserType Selection / Change
  const handleUserTypeChange = async (newType: UserTypeItem | null) => {
    setSelectedUserType(newType);
    setSelectedUser(null);

    if (!newType) {
      // Revert to Single User Mode
      setSelectedGroupUsers([]);
      setUserRightsIds([]);
      return;
    }

    // Collective Mode: Auto-select all matching users for this UserType
    const matched = users.filter((u) => isUserMatched(u, newType));
    setSelectedGroupUsers(matched);

    if (matched.length === 0) {
      setUserRightsIds([]);
      toast.info(`No users found with User Type "${newType.UserType}"`);
      return;
    }

    toast.info(`Selected ${matched.length} user${matched.length > 1 ? "s" : ""} in "${newType.UserType}"`);

    // Load rights from the UserType template, or fallback to the first user in the group that has rights assigned
    setLoadingRights(true);
    try {
      let foundRights = false;
      try {
        const utRightsRes = await UserRightsService.getUserTypeRights(newType.Id);
        if (utRightsRes.data?.success && utRightsRes.data.data && utRightsRes.data.data.length > 0) {
          setUserRightsIds(utRightsRes.data.data.map((r: any) => Number(r.menu_id)));
          foundRights = true;
        }
      } catch {
        // continue checking users
      }

      if (!foundRights) {
        for (const u of matched) {
          try {
            const rightsRes = await UserRightsService.getUserRights(u.UserId);
            if (rightsRes.data?.success && rightsRes.data.data && rightsRes.data.data.length > 0) {
              setUserRightsIds(rightsRes.data.data.map((r: any) => Number(r.menu_id)));
              foundRights = true;
              break;
            }
          } catch {
            // continue checking other users
          }
        }
      }

      if (!foundRights) {
        setUserRightsIds([]);
      }
    } catch (err) {
      console.error("Error loading group rights:", err);
      setUserRightsIds([]);
    } finally {
      setLoadingRights(false);
    }
  };

  // 2. Fetch single user rights when selectedUser changes (in Single User Mode)
  useEffect(() => {
    if (selectedUserType) return; // Group mode manages rights via handleUserTypeChange

    if (!selectedUser) {
      setUserRightsIds([]);
      return;
    }

    const loadUserRights = async () => {
      setLoadingRights(true);
      try {
        const rightsRes = await UserRightsService.getUserRights(selectedUser.UserId);
        if (rightsRes.data?.success) {
          const rightsData = rightsRes.data.data || [];
          const activeIds = rightsData.map((r: any) => Number(r.menu_id));
          setUserRightsIds(activeIds);
        } else {
          setUserRightsIds([]);
        }
      } catch (err: any) {
        console.error("Error loading user rights:", err);
        setUserRightsIds([]);
      } finally {
        setLoadingRights(false);
      }
    };

    loadUserRights();
  }, [selectedUser, selectedUserType]);



  // Group flat menus by category
  const groupedMenus = useMemo(() => {
    const groups: Record<string, MenuFlatItem[]> = {};
    flatMenus.forEach((item) => {
      if (!groups[item.parentName]) {
        groups[item.parentName] = [];
      }
      groups[item.parentName].push(item);
    });
    return groups;
  }, [flatMenus]);

  // Filtered menus based on search query
  const filteredGroupedMenus = useMemo(() => {
    if (!searchQuery.trim()) return groupedMenus;
    const query = searchQuery.toLowerCase();
    const result: Record<string, MenuFlatItem[]> = {};

    Object.entries(groupedMenus).forEach(([catName, items]) => {
      const matchedItems = items.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.parentName.toLowerCase().includes(query)
      );
      if (matchedItems.length > 0) {
        result[catName] = matchedItems;
      }
    });

    return result;
  }, [groupedMenus, searchQuery]);

  // Compute detailed active menu list for display in the sidebar
  const activeMenuDetails = useMemo(() => {
    const list: {
      id: number;
      name: string;
      parentName: string;
      tags: string[];
      templateIds: number[];
    }[] = [];

    flatMenus.forEach((item) => {
      const templateKey = Object.keys(templatesData).find(
        (k) => k.toUpperCase() === item.name.toUpperCase()
      );
      const itemTemplates = templateKey ? templatesData[templateKey] : [];
      const hasBaseAccess = userRightsIds.includes(Number(item.id));
      const activeTemplates = itemTemplates.filter((t: any) =>
        userRightsIds.includes(Number(t.Report_Id))
      );

      if (hasBaseAccess || activeTemplates.length > 0) {
        const tags: string[] = [];
        if (itemTemplates.length > 0) {
          if (hasBaseAccess) tags.push("Default");
          activeTemplates.forEach((t: any) => tags.push(t.Report_Name));
        }
        list.push({
          id: Number(item.id),
          name: item.name,
          parentName: item.parentName || "Reports",
          tags,
          templateIds: itemTemplates.map((t: any) => Number(t.Report_Id)),
        });
      }
    });

    return list;
  }, [flatMenus, templatesData, userRightsIds]);

  const [showUserChips, setShowUserChips] = useState(false);

  // Remove a report's access right directly from the left sidebar
  const handleRemoveReportAccess = (menuId: number, templateIds: number[]) => {
    const idsToRemove = new Set<number>([menuId, ...templateIds]);
    setUserRightsIds((prev) => prev.filter((id) => !idsToRemove.has(id)));
    toast.info("Removed report access");
  };

  // Category Toggle
  const toggleCategory = (catName: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [catName]: !prev[catName],
    }));
  };

  // Select all matching menus
  const handleSelectAll = () => {
    const allMatchingIds: number[] = [];
    Object.values(filteredGroupedMenus).forEach((items) => {
      items.forEach((item) => {
        allMatchingIds.push(Number(item.id));
      });
    });

    setUserRightsIds((prev) => {
      const combined = new Set([...prev, ...allMatchingIds]);
      return Array.from(combined);
    });
    toast.info("Selected all matching menus");
  };

  // Clear all matching menus
  const handleClearAll = () => {
    const matchingIdsToRemove = new Set<number>();
    Object.values(filteredGroupedMenus).forEach((items) => {
      items.forEach((item) => {
        matchingIdsToRemove.add(Number(item.id));
        const templateKey = Object.keys(templatesData).find(
          (k) => k.toUpperCase() === item.name.toUpperCase()
        );
        const itemTemplates = templateKey ? templatesData[templateKey] : [];
        itemTemplates.forEach((t: any) => {
          matchingIdsToRemove.add(Number(t.Report_Id));
        });
      });
    });

    setUserRightsIds((prev) => prev.filter((id) => !matchingIdsToRemove.has(id)));
    toast.info("Cleared rights for matching menus");
  };

  // 3. Save Rights (Supports both Collective Group mode and Single User mode)
  const handleSaveRights = async () => {
    // A. Collective / Group Mode (UserType is selected)
    if (selectedUserType) {
      if (selectedGroupUsers.length === 0) {
        toast.warning(`No users selected in "${selectedUserType.UserType}". Please select at least one user.`);
        return;
      }

      setSaving(true);
      setSavingStatusText(`Saving rights for ${selectedUserType.UserType}...`);

      try {
        // Save to tbl_reports_usertype_rights and update all matching users in one backend transaction
        const targetUserIds = selectedGroupUsers.map((u) => Number(u.UserId));
        const res = await UserRightsService.saveUserTypeRights(
          selectedUserType.Id,
          userRightsIds,
          targetUserIds
        );

        if (res.data?.success) {
          toast.success(
            `Rights saved for "${selectedUserType.UserType}"! All current and future users of this User Type will have access.`
          );
        } else {
          toast.error(res.data?.message || "Failed to save user type rights");
        }
      } catch (err: any) {
        console.error("Error in collective save:", err);
        toast.error("An error occurred while saving rights collectively");
      } finally {
        setSaving(false);
        setSavingStatusText("");
      }
      return;
    }

    // B. Single User Mode (UserType not selected)
    if (!selectedUser) {
      toast.warning("Please select an employee first");
      return;
    }

    setSaving(true);
    try {
      const res = await UserRightsService.saveUserRights(
        selectedUser.UserId,
        userRightsIds,
        selectedUser.UserTypeId
      );
      if (res.data?.success) {
        toast.success(`Rights updated successfully for ${selectedUser.Name}`);
      } else {
        toast.error(res.data?.message || "Failed to save user rights");
      }
    } catch (err: any) {
      console.error("Error saving user rights:", err);
      toast.error(err.response?.data?.message || "Failed to update user rights");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader showPages={false} />

      <Box
        sx={{
          height: "calc(100vh - 40px)",
          mt: "5px",
          background: "linear-gradient(to bottom, #f0f6fa, #e1ecf5)",
          p: 1.5,
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        <Box sx={{ width: "100%", height: "100%", minHeight: 0, display: "flex", flexDirection: "column", gap: 1.5 }}>
          {/* Header Card */}
          <Paper
            elevation={2}
            sx={{
              p: 1,
              px: 2,
              borderRadius: 2,
              background: "linear-gradient(135deg, #1e3a8a, #3b82f6)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              gap: 2,
              boxShadow: "0 4px 12px rgba(30, 58, 138, 0.15)",
              flexShrink: 0,
            }}
          >
            <Box
              sx={{
                p: 0.75,
                borderRadius: "50%",
                background: "rgba(255, 255, 255, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <SecurityIcon sx={{ fontSize: 22 }} />
            </Box>
            <Box>
              <Typography variant="subtitle1" fontWeight={700} sx={{ lineHeight: 1.2 }}>
                User Rights Management
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                Assign report and menu access to employees, salespersons, and distributors.
              </Typography>
            </Box>
          </Paper>

          {/* Main 2-Panel Layout Container */}
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              height: "100%",
              display: "flex",
              flexDirection: { xs: "column", md: "row" },
              gap: 2,
            }}
          >
            {/* Left Control Panel */}
            <Box
              sx={{
                width: { xs: "100%", md: "340px", lg: "370px" },
                height: "100%",
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                flexShrink: 0,
              }}
            >
              <Card
                elevation={3}
                sx={{
                  borderRadius: 2.5,
                  height: "100%",
                  minHeight: 0,
                  border: "1px solid rgba(226, 232, 240, 0.8)",
                  boxShadow: "0 2px 10px rgba(0, 0, 0, 0.03)",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }}
              >
                <CardContent
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 1.25,
                    p: 1.75,
                    height: "100%",
                    minHeight: 0,
                    boxSizing: "border-box",
                    overflow: "hidden",
                    "&:last-child": { pb: 1.75 },
                  }}
                >
                  {/* 1. User Type Dropdown (Compact) */}
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Box display="flex" alignItems="center" gap={0.75}>
                      <BadgeIcon color="primary" sx={{ fontSize: 18 }} />
                      <Typography variant="subtitle2" fontWeight={700} color="text.primary" sx={{ fontSize: "0.8rem" }}>
                        User Type
                      </Typography>
                    </Box>
                    {selectedUserType ? (
                      <Chip
                        label="Collective Mode"
                        size="small"
                        color="secondary"
                        sx={{ height: 19, fontSize: "0.65rem", fontWeight: 700 }}
                      />
                    ) : (
                      <Chip
                        label="Single User Mode"
                        size="small"
                        variant="outlined"
                        sx={{ height: 19, fontSize: "0.65rem", fontWeight: 600, color: "text.secondary" }}
                      />
                    )}
                  </Box>

                  <Autocomplete
                    options={userTypes}
                    getOptionLabel={(option) => (typeof option === "string" ? option : option?.UserType || "")}
                    isOptionEqualToValue={(option, value) => !value || String(option?.Id) === String(value?.Id)}
                    value={selectedUserType}
                    onChange={(_, newValue) => handleUserTypeChange(newValue)}
                    size="small"
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="User Type (Optional)"
                        placeholder="Leave empty for single user"
                        variant="outlined"
                        fullWidth
                        sx={{
                          "& .MuiOutlinedInput-root": {
                            borderRadius: 1.5,
                            fontSize: "0.78rem",
                          },
                        }}
                      />
                    )}
                  />

                  {/* 2. Target User Dropdown */}
                  {selectedUserType ? (
                    <>
                      <Box display="flex" alignItems="center" justifyContent="space-between">
                        <Box display="flex" alignItems="center" gap={0.75}>
                          <GroupIcon color="primary" sx={{ fontSize: 18 }} />
                          <Typography variant="subtitle2" fontWeight={700} color="text.primary" sx={{ fontSize: "0.8rem" }}>
                            Target Users ({selectedGroupUsers.length})
                          </Typography>
                        </Box>
                        <Box display="flex" gap={0.5}>
                          <Button
                            size="small"
                            sx={{ fontSize: "0.65rem", py: "1px", px: "6px", minWidth: 0, textTransform: "none", fontWeight: 600 }}
                            onClick={() => setSelectedGroupUsers(filteredUsersForDropdown)}
                          >
                            Select All
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            sx={{ fontSize: "0.65rem", py: "1px", px: "6px", minWidth: 0, textTransform: "none", fontWeight: 600 }}
                            onClick={() => setSelectedGroupUsers([])}
                          >
                            Clear
                          </Button>
                        </Box>
                      </Box>

                      <Autocomplete
                        multiple
                        options={filteredUsersForDropdown}
                        disableCloseOnSelect
                        getOptionLabel={(option) => option.Name}
                        isOptionEqualToValue={(option, value) => String(option.UserId) === String(value.UserId)}
                        value={selectedGroupUsers}
                        onChange={(_, newValue) => setSelectedGroupUsers(newValue)}
                        size="small"
                        limitTags={2}
                        renderOption={(props, option, { selected }) => (
                          <li {...props} key={option.UserId}>
                            <Checkbox
                              size="small"
                              checked={selected}
                              sx={{ mr: 1, p: 0.25 }}
                            />
                            <Typography variant="body2" sx={{ fontSize: "0.8rem" }}>
                              {option.Name}
                            </Typography>
                          </li>
                        )}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label={`Users in ${selectedUserType.UserType}`}
                            placeholder="Select users..."
                            variant="outlined"
                            fullWidth
                            sx={{
                              "& .MuiOutlinedInput-root": {
                                borderRadius: 1.5,
                                fontSize: "0.78rem",
                              },
                            }}
                          />
                        )}
                      />

                      {/* Compact Collapsible Target Users Bar */}
                      <Box
                        sx={{
                          p: 0.75,
                          px: 1,
                          bgcolor: "#f0fdf4",
                          border: "1px solid #bbf7d0",
                          borderRadius: 1.5,
                          display: "flex",
                          flexDirection: "column",
                          gap: 0.5,
                          flexShrink: 0,
                        }}
                      >
                        <Box display="flex" alignItems="center" justifyContent="space-between">
                          <Box display="flex" alignItems="center" gap={0.5}>
                            <GroupIcon sx={{ fontSize: 15, color: "#15803d" }} />
                            <Typography variant="caption" sx={{ fontWeight: 700, color: "#166534", fontSize: "0.72rem" }}>
                              {selectedGroupUsers.length} Users ({selectedUserType.UserType})
                            </Typography>
                          </Box>
                          <Button
                            size="small"
                            onClick={() => setShowUserChips((prev) => !prev)}
                            sx={{
                              p: "0px 6px",
                              minWidth: 0,
                              fontSize: "0.65rem",
                              textTransform: "none",
                              fontWeight: 600,
                              color: "#15803d",
                              bgcolor: "#dcfce7",
                              "&:hover": { bgcolor: "#bbf7d0" },
                            }}
                          >
                            {showUserChips ? "Hide Users" : "Show Users"}
                          </Button>
                        </Box>

                        {showUserChips && (
                          <Box
                            sx={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 0.5,
                              maxHeight: 75,
                              overflowY: "auto",
                              pt: 0.5,
                              borderTop: "1px dashed #bbf7d0",
                            }}
                          >
                            {selectedGroupUsers.map((u) => (
                              <Chip
                                key={u.UserId}
                                label={u.Name}
                                size="small"
                                onDelete={() =>
                                  setSelectedGroupUsers((prev) =>
                                    prev.filter((item) => String(item.UserId) !== String(u.UserId))
                                  )
                                }
                                sx={{
                                  height: 19,
                                  fontSize: "0.65rem",
                                  fontWeight: 600,
                                  bgcolor: "#ffffff",
                                  color: "#166534",
                                  border: "1px solid #bbf7d0",
                                  "& .MuiChip-deleteIcon": {
                                    fontSize: 13,
                                    color: "#166534",
                                    "&:hover": { color: "#b91c1c" },
                                  },
                                }}
                              />
                            ))}
                          </Box>
                        )}
                      </Box>
                    </>
                  ) : (
                    <>
                      <Box display="flex" alignItems="center" gap={0.75}>
                        <PersonIcon color="primary" sx={{ fontSize: 18 }} />
                        <Typography variant="subtitle2" fontWeight={700} color="text.primary" sx={{ fontSize: "0.8rem" }}>
                          Select Employee
                        </Typography>
                      </Box>

                      {loadingUsers ? (
                        <Box display="flex" justifyContent="center" py={1}>
                          <CircularProgress size={22} />
                        </Box>
                      ) : (
                        <Autocomplete
                          options={users}
                          getOptionLabel={(option) => option.Name}
                          isOptionEqualToValue={(option, value) => String(option.UserId) === String(value.UserId)}
                          value={selectedUser}
                          onChange={(_, newValue) => setSelectedUser(newValue)}
                          size="small"
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="Search / Select Employee"
                              variant="outlined"
                              fullWidth
                              sx={{
                                "& .MuiOutlinedInput-root": {
                                  borderRadius: 1.5,
                                  fontSize: "0.78rem",
                                },
                              }}
                            />
                          )}
                        />
                      )}

                      {selectedUser && (
                        <Box
                          sx={{
                            p: 0.75,
                            px: 1,
                            bgcolor: "#eff6ff",
                            border: "1px solid #bfdbfe",
                            borderRadius: 1.5,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flexShrink: 0,
                          }}
                        >
                          <Box display="flex" alignItems="center" gap={0.75} sx={{ minWidth: 0, flex: 1 }}>
                            <PersonIcon sx={{ fontSize: 16, color: "#1d4ed8" }} />
                            <Typography
                              variant="caption"
                              sx={{
                                fontWeight: 700,
                                color: "#1e40af",
                                fontSize: "0.74rem",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {selectedUser.Name}
                              <Typography component="span" sx={{ color: "#64748b", fontWeight: 500, fontSize: "0.68rem", ml: 0.5 }}>
                                (ID: {selectedUser.UserId}{selectedUser.UserType ? ` • ${selectedUser.UserType}` : ""})
                              </Typography>
                            </Typography>
                          </Box>
                          <Chip
                            label="Active"
                            size="small"
                            color="primary"
                            sx={{ height: 18, fontSize: "0.65rem", fontWeight: 700 }}
                          />
                        </Box>
                      )}
                    </>
                  )}

                  {/* 3. PROMINENT SELECTED REPORTS & MENUS PANEL */}
                  {hasTargetSelection ? (
                    <Box
                      sx={{
                        flex: "1 1 0px",
                        height: 0,
                        minHeight: 0,
                        display: "flex",
                        flexDirection: "column",
                        bgcolor: "#ffffff",
                        borderRadius: 2,
                        border: "1px solid #cbd5e1",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                        overflow: "hidden",
                      }}
                    >
                      {/* Panel Header */}
                      <Box
                        sx={{
                          p: 1,
                          px: 1.25,
                          bgcolor: "#f1f5f9",
                          borderBottom: "1px solid #e2e8f0",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          flexShrink: 0,
                        }}
                      >
                        <Box display="flex" alignItems="center" gap={0.75}>
                          <SecurityIcon sx={{ fontSize: 16, color: "#1e3a8a" }} />
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: "0.76rem", color: "#1e293b" }}>
                            Selected Reports & Menus
                          </Typography>
                          <Chip
                            size="small"
                            label={`${activeMenuDetails.length}`}
                            color="success"
                            sx={{
                              height: 18,
                              fontSize: "0.68rem",
                              fontWeight: 700,
                              bgcolor: "#15803d",
                              color: "#ffffff",
                            }}
                          />
                        </Box>

                        {activeMenuDetails.length > 0 && (
                          <Tooltip title="Clear all assigned rights">
                            <Button
                              size="small"
                              color="error"
                              onClick={() => setUserRightsIds([])}
                              sx={{
                                p: "1px 6px",
                                minWidth: 0,
                                fontSize: "0.68rem",
                                textTransform: "none",
                                fontWeight: 600,
                                height: 20,
                              }}
                            >
                              Clear All
                            </Button>
                          </Tooltip>
                        )}
                      </Box>

                      {/* Dedicated Scrollable List of Reports */}
                      <Box
                        sx={{
                          flex: "1 1 0px",
                          height: 0,
                          minHeight: 0,
                          overflowY: "auto",
                          overscrollBehavior: "contain",
                          p: 0.75,
                          display: "flex",
                          flexDirection: "column",
                          gap: 0.6,
                        }}
                      >
                        {activeMenuDetails.length > 0 ? (
                          activeMenuDetails.map((menu) => (
                            <Box
                              key={menu.id}
                              sx={{
                                p: 0.75,
                                px: 1,
                                borderRadius: 1.5,
                                bgcolor: "#f8fafc",
                                border: "1px solid #e2e8f0",
                                borderLeft: "3px solid #16a34a",
                                display: "flex",
                                flexDirection: "column",
                                gap: 0.35,
                                transition: "all 0.15s ease",
                                flexShrink: 0,
                                "&:hover": {
                                  bgcolor: "#ffffff",
                                  boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                                  borderColor: "#cbd5e1",
                                  borderLeftColor: "#15803d",
                                },
                              }}
                            >
                              <Box display="flex" alignItems="center" justifyContent="space-between" gap={0.5}>
                                <Box display="flex" alignItems="center" gap={0.6} sx={{ minWidth: 0, flex: 1 }}>
                                  <CheckCircleIcon sx={{ fontSize: 14, color: "#16a34a", flexShrink: 0 }} />
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      fontWeight: 700,
                                      fontSize: "0.73rem",
                                      color: "#1e293b",
                                      lineHeight: 1.25,
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                    title={menu.name}
                                  >
                                    {menu.name}
                                  </Typography>
                                </Box>
                                <Tooltip title="Remove this report">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleRemoveReportAccess(menu.id, menu.templateIds)}
                                    sx={{
                                      p: 0.2,
                                      color: "text.disabled",
                                      "&:hover": { color: "#dc2626", bgcolor: "#fee2e2" },
                                    }}
                                  >
                                    <ClearIcon sx={{ fontSize: 14 }} />
                                  </IconButton>
                                </Tooltip>
                              </Box>

                              {/* Tags / Category Badges */}
                              <Box display="flex" alignItems="center" flexWrap="wrap" gap={0.4} pl={2.25}>
                                <Chip
                                  label={menu.parentName}
                                  size="small"
                                  sx={{
                                    height: 16,
                                    fontSize: "0.62rem",
                                    fontWeight: 600,
                                    bgcolor: "#e2e8f0",
                                    color: "#334155",
                                  }}
                                />
                                {menu.tags.map((tag) => (
                                  <Chip
                                    key={tag}
                                    label={tag}
                                    size="small"
                                    sx={{
                                      height: 16,
                                      fontSize: "0.62rem",
                                      fontWeight: 600,
                                      bgcolor: "#dcfce7",
                                      color: "#15803d",
                                      border: "1px solid #86efac",
                                    }}
                                  />
                                ))}
                              </Box>
                            </Box>
                          ))
                        ) : (
                          <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" sx={{ flex: 1, py: 3, color: "text.disabled" }}>
                            <LayersIcon sx={{ fontSize: 28, mb: 0.5, opacity: 0.5 }} />
                            <Typography variant="caption" align="center" sx={{ fontWeight: 600, color: "#64748b" }}>
                              No reports selected yet
                            </Typography>
                            <Typography variant="caption" align="center" sx={{ fontSize: "0.68rem", opacity: 0.8, mt: 0.25 }}>
                              Select menus or templates on the right to add them here.
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </Box>
                  ) : (
                    <Box
                      display="flex"
                      flexDirection="column"
                      alignItems="center"
                      justifyContent="center"
                      sx={{
                        flex: 1,
                        color: "text.disabled",
                        textAlign: "center",
                        p: 2,
                        bgcolor: "#f8fafc",
                        borderRadius: 2,
                        border: "1px dashed #cbd5e1",
                      }}
                    >
                      <SecurityIcon sx={{ fontSize: 36, mb: 1, opacity: 0.4 }} />
                      <Typography variant="body2" sx={{ fontWeight: 600, color: "#64748b", fontSize: "0.75rem" }}>
                        No Target Selected
                      </Typography>
                      <Typography variant="caption" sx={{ mt: 0.5, maxWidth: 220 }}>
                        Select an employee above, or pick a User Type to assign rights collectively.
                      </Typography>
                    </Box>
                  )}

                  {/* 4. Save Button (Pinned at Bottom) */}
                  <Button
                    variant="contained"
                    color="success"
                    size="medium"
                    startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
                    onClick={handleSaveRights}
                    disabled={
                      saving ||
                      !hasTargetSelection ||
                      (selectedUserType ? selectedGroupUsers.length === 0 : !selectedUser)
                    }
                    sx={{
                      py: 1,
                      borderRadius: 1.5,
                      fontWeight: 700,
                      textTransform: "none",
                      boxShadow: "0 4px 10px rgba(46, 125, 50, 0.15)",
                      transition: "all 0.2s",
                      flexShrink: 0,
                      "&:hover": {
                        backgroundColor: "#1b5e20",
                      },
                    }}
                  >
                    {saving
                      ? savingStatusText || "Saving..."
                      : selectedUserType
                        ? `Save Rights for ${selectedGroupUsers.length} Users`
                        : selectedUser
                          ? `Save Rights for ${selectedUser.Name}`
                          : "Save Rights"}
                  </Button>
                </CardContent>
              </Card>
            </Box>

            {/* Right Menus Selection list */}
            <Box
              sx={{
                flex: 1,
                minWidth: 0,
                height: "100%",
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Card
                elevation={3}
                sx={{
                  borderRadius: 2.5,
                  height: "100%",
                  minHeight: 0,
                  border: "1px solid rgba(226, 232, 240, 0.8)",
                  boxShadow: "0 2px 10px rgba(0, 0, 0, 0.03)",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }}
              >
                <CardContent
                  sx={{
                    p: 2,
                    height: "100%",
                    minHeight: 0,
                    display: "flex",
                    flexDirection: "column",
                    boxSizing: "border-box",
                    overflow: "hidden",
                    "&:last-child": { pb: 2 },
                  }}
                >
                  <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                    mb={1.5}
                    flexShrink={0}
                  >
                    <Typography variant="subtitle2" fontWeight={700}>
                      Available Menus & Reports
                    </Typography>

                    {hasTargetSelection && (
                      <Box display="flex" gap={1}>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<CheckCircleIcon />}
                          onClick={handleSelectAll}
                          sx={{ textTransform: "none", borderRadius: 1, py: 0.2, fontSize: "0.75rem" }}
                        >
                          Select All
                        </Button>
                        <Button
                          variant="outlined"
                          color="error"
                          size="small"
                          startIcon={<ClearIcon />}
                          onClick={handleClearAll}
                          sx={{ textTransform: "none", borderRadius: 1, py: 0.2, fontSize: "0.75rem" }}
                        >
                          Clear All
                        </Button>
                      </Box>
                    )}
                  </Box>

                  {/* Search box */}
                  <TextField
                    placeholder="Search menu or report..."
                    variant="outlined"
                    size="small"
                    fullWidth
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    sx={{
                      mb: 1.5,
                      flexShrink: 0,
                      "& .MuiOutlinedInput-root": {
                        borderRadius: 2,
                        backgroundColor: "#f8fafc",
                      },
                    }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon color="action" fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                  />

                  {!hasTargetSelection ? (
                    <Box
                      display="flex"
                      flexDirection="column"
                      alignItems="center"
                      justifyContent="center"
                      sx={{ flex: 1, color: "text.secondary", py: 4 }}
                    >
                      <SecurityIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1.5 }} />
                      <Typography variant="body2" fontWeight={600} align="center">
                        Please select an employee or a User Type
                      </Typography>
                      <Typography variant="caption" color="text.disabled" align="center" sx={{ mt: 0.5 }}>
                        Select a single employee or select a User Type to configure menu privileges collectively.
                      </Typography>
                    </Box>
                  ) : loadingRights ? (
                    <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" sx={{ flex: 1, py: 4 }}>
                      <CircularProgress size={30} sx={{ mb: 1.5 }} />
                      <Typography variant="caption" color="text.secondary">
                        Loading permissions list...
                      </Typography>
                    </Box>
                  ) : Object.keys(filteredGroupedMenus).length === 0 ? (
                    <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" sx={{ flex: 1, py: 4 }}>
                      <ClearIcon sx={{ fontSize: 36, color: "text.disabled", mb: 1 }} />
                      <Typography variant="caption" color="text.secondary">
                        No menus found matching "{searchQuery}"
                      </Typography>
                    </Box>
                  ) : (
                    <Box
                      sx={{
                        flex: "1 1 0px",
                        height: 0,
                        minHeight: 0,
                        overflowY: "auto",
                        overscrollBehavior: "contain",
                        pr: 1,
                        display: "flex",
                        flexDirection: "column",
                        gap: 1.5,
                      }}
                    >
                      {Object.entries(filteredGroupedMenus).map(([category, items]) => {
                        const isExpanded = expandedCategories[category] !== false;

                        // Count how many items in this category are active
                        const categoryActiveCount = items.filter((item) => {
                          const templateKey = Object.keys(templatesData).find(
                            (k) => k.toUpperCase() === item.name.toUpperCase()
                          );
                          const itemTemplates = templateKey ? templatesData[templateKey] : [];
                          const activeTemplate = itemTemplates.find((t: any) =>
                            userRightsIds.includes(Number(t.Report_Id))
                          );
                          return userRightsIds.includes(Number(item.id)) || !!activeTemplate;
                        }).length;

                        return (
                          <Paper
                            key={category}
                            variant="outlined"
                            sx={{
                              borderRadius: 2,
                              border: "1px solid #e2e8f0",
                              flexShrink: 0,
                              transition: "box-shadow 0.2s",
                              "&:hover": {
                                boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                              },
                            }}
                          >
                            {/* Category Header */}
                            <Box
                              onClick={() => toggleCategory(category)}
                              sx={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                px: 2,
                                py: 1,
                                backgroundColor: "#f8fafc",
                                borderBottom: isExpanded ? "1px solid #e2e8f0" : "none",
                                cursor: "pointer",
                                userSelect: "none",
                              }}
                            >
                              <Box display="flex" alignItems="center" gap={1}>
                                {isExpanded ? (
                                  <ExpandMoreIcon color="action" fontSize="small" />
                                ) : (
                                  <ChevronRightIcon color="action" fontSize="small" />
                                )}
                                <Typography variant="subtitle2" fontWeight={700} color="text.primary" sx={{ fontSize: "0.8rem" }}>
                                  {category.toUpperCase()}
                                </Typography>
                              </Box>

                              <Box
                                sx={{
                                  px: 1,
                                  py: 0.2,
                                  borderRadius: 4,
                                  backgroundColor: categoryActiveCount > 0 ? "rgba(46, 125, 50, 0.1)" : "#f1f5f9",
                                  color: categoryActiveCount > 0 ? "success.main" : "text.secondary",
                                  fontSize: "0.7rem",
                                  fontWeight: 700,
                                }}
                              >
                                {categoryActiveCount} / {items.length} Enabled
                              </Box>
                            </Box>

                            {/* Category Items list */}
                            <Collapse in={isExpanded}>
                              <Box sx={{
                                px: 2,
                                py: 1.5,
                                backgroundColor: "#f8fafc",
                              }}>
                                <Grid container spacing={1.5}>
                                  {items.map((item) => {
                                    const templateKey = Object.keys(templatesData).find(
                                      (k) => k.toUpperCase() === item.name.toUpperCase()
                                    );
                                    const itemTemplates = templateKey ? templatesData[templateKey] : [];
                                    const hasTemplates = itemTemplates.length > 0;

                                    const templateIds = itemTemplates.map((t: any) => Number(t.Report_Id));
                                    const activeTemplateIds = templateIds.filter((tId: number) =>
                                      userRightsIds.includes(tId)
                                    );
                                    const hasBaseAccess = userRightsIds.includes(Number(item.id));
                                    const isChecked = hasBaseAccess || activeTemplateIds.length > 0;

                                    // Selected values for the multiselect (including base item.id and active templateIds)
                                    const selectedValues: number[] = [
                                      ...(hasBaseAccess ? [Number(item.id)] : []),
                                      ...activeTemplateIds,
                                    ];

                                    const handleCardToggle = () => {
                                      if (isChecked) {
                                        // Uncheck all rights for this menu (both default view and all templates)
                                        setUserRightsIds((prev) =>
                                          prev.filter((id) => id !== Number(item.id) && !templateIds.includes(id))
                                        );
                                      } else {
                                        // Check this item with Default View
                                        setUserRightsIds((prev) => [...prev, Number(item.id)]);
                                      }
                                    };

                                    const handleTemplateMultiSelect = (event: any) => {
                                      const value = event.target.value;
                                      const newSelected: number[] = typeof value === "string"
                                        ? value.split(",").map(Number)
                                        : (value as number[]);

                                      setUserRightsIds((prev) => {
                                        const cleaned = prev.filter(
                                          (id) => id !== Number(item.id) && !templateIds.includes(id)
                                        );
                                        return [...cleaned, ...newSelected];
                                      });
                                    };

                                    return (
                                      <Grid item xs={12} sm={6} md={4} key={item.id} sx={{ display: "flex" }}>
                                        <Paper
                                          elevation={0}
                                          sx={{
                                            width: "100%",
                                            minHeight: 106,
                                            display: "flex",
                                            flexDirection: "column",
                                            justifyContent: "space-between",
                                            p: 1.25,
                                            borderRadius: 2,
                                            border: isChecked ? "1.5px solid #22c55e" : "1px solid #e2e8f0",
                                            backgroundColor: isChecked ? "#f0fdf4" : "#ffffff",
                                            boxShadow: isChecked
                                              ? "0 2px 8px rgba(34, 197, 94, 0.12)"
                                              : "0 1px 3px rgba(0, 0, 0, 0.03)",
                                            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                                            "&:hover": {
                                              transform: "translateY(-2px)",
                                              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                                              borderColor: isChecked ? "#16a34a" : "#cbd5e1",
                                            },
                                          }}
                                        >
                                          {/* TOP AREA: Checkbox, Name, Route */}
                                          <Box
                                            onClick={handleCardToggle}
                                            sx={{
                                              display: "flex",
                                              alignItems: "flex-start",
                                              gap: 1,
                                              cursor: "pointer",
                                              userSelect: "none",
                                              width: "100%",
                                            }}
                                          >
                                            <Checkbox
                                              checked={isChecked}
                                              onChange={(e) => {
                                                e.stopPropagation();
                                                handleCardToggle();
                                              }}
                                              color="success"
                                              size="small"
                                              sx={{
                                                p: 0,
                                                mt: 0.1,
                                                color: "#94a3b8",
                                                "&.Mui-checked": {
                                                  color: "#16a34a",
                                                },
                                              }}
                                            />

                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                              <Box display="flex" alignItems="center" justifyContent="space-between" gap={0.5}>
                                                <Typography
                                                  variant="body2"
                                                  sx={{
                                                    fontWeight: isChecked ? 700 : 600,
                                                    fontSize: "0.78rem",
                                                    color: isChecked ? "#15803d" : "#1e293b",
                                                    lineHeight: 1.25,
                                                    wordBreak: "break-word",
                                                  }}
                                                >
                                                  {item.name}
                                                </Typography>
                                                {hasTemplates && (
                                                  <Tooltip title={`${itemTemplates.length} custom template(s) available`}>
                                                    <Chip
                                                      size="small"
                                                      label={
                                                        activeTemplateIds.length > 0
                                                          ? `${activeTemplateIds.length}/${itemTemplates.length} T`
                                                          : `${itemTemplates.length} T`
                                                      }
                                                      icon={<LayersIcon sx={{ fontSize: "11px !important", color: isChecked ? "#15803d !important" : "#64748b !important" }} />}
                                                      sx={{
                                                        height: 18,
                                                        fontSize: "0.6rem",
                                                        fontWeight: 700,
                                                        px: 0.25,
                                                        backgroundColor: activeTemplateIds.length > 0 ? "#bbf7d0" : (isChecked ? "#dcfce7" : "#f1f5f9"),
                                                        color: isChecked ? "#15803d" : "#64748b",
                                                        border: isChecked ? "1px solid #86efac" : "1px solid #e2e8f0",
                                                        "& .MuiChip-label": { px: 0.5 },
                                                      }}
                                                    />
                                                  </Tooltip>
                                                )}
                                              </Box>

                                              {item.rUrl && (
                                                <Typography
                                                  variant="caption"
                                                  sx={{
                                                    fontSize: "0.625rem",
                                                    color: "#64748b",
                                                    display: "block",
                                                    mt: 0.25,
                                                    whiteSpace: "nowrap",
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    fontFamily: "monospace",
                                                    opacity: 0.85,
                                                  }}
                                                >
                                                  {item.rUrl}
                                                </Typography>
                                              )}
                                            </Box>
                                          </Box>

                                          {/* BOTTOM AREA: Multiselect Template Dropdown or Standard View Indicator */}
                                          <Box
                                            sx={{
                                              mt: 1,
                                              pt: 0.75,
                                              borderTop: isChecked ? "1px dashed #bbf7d0" : "1px dashed #e2e8f0",
                                            }}
                                          >
                                            {hasTemplates ? (
                                              <Box sx={{ width: "100%" }}>
                                                <Box display="flex" alignItems="center" gap={0.5} mb={0.35}>
                                                  <DashboardCustomizeIcon
                                                    sx={{
                                                      fontSize: 12,
                                                      color: isChecked ? "#15803d" : "#94a3b8",
                                                    }}
                                                  />
                                                  <Typography
                                                    variant="caption"
                                                    sx={{
                                                      fontSize: "0.625rem",
                                                      fontWeight: 700,
                                                      color: isChecked ? "#15803d" : "#64748b",
                                                      letterSpacing: 0.2,
                                                      textTransform: "uppercase",
                                                    }}
                                                  >
                                                    Select Templates
                                                  </Typography>
                                                </Box>

                                                <Select
                                                  multiple
                                                  size="small"
                                                  disabled={!isChecked}
                                                  value={selectedValues}
                                                  onChange={handleTemplateMultiSelect}
                                                  onClick={(e) => e.stopPropagation()}
                                                  displayEmpty
                                                  renderValue={(selected) => {
                                                    const sel = selected as number[];
                                                    if (sel.length === 0) {
                                                      return (
                                                        <Typography
                                                          component="span"
                                                          sx={{ fontSize: "0.68rem", color: "#94a3b8" }}
                                                        >
                                                          Select templates...
                                                        </Typography>
                                                      );
                                                    }
                                                    const names = sel.map((val) => {
                                                      if (val === Number(item.id)) return "Default View";
                                                      const found = itemTemplates.find(
                                                        (t: any) => Number(t.Report_Id) === val
                                                      );
                                                      return found?.Report_Name || "Template";
                                                    });

                                                    if (names.length === 1) {
                                                      return (
                                                        <Typography
                                                          component="span"
                                                          sx={{
                                                            fontSize: "0.7rem",
                                                            fontWeight: 600,
                                                            color: isChecked ? "#15803d" : "inherit",
                                                          }}
                                                        >
                                                          {names[0]}
                                                        </Typography>
                                                      );
                                                    }

                                                    return (
                                                      <Typography
                                                        component="span"
                                                        sx={{
                                                          fontSize: "0.68rem",
                                                          fontWeight: 700,
                                                          color: isChecked ? "#15803d" : "inherit",
                                                          whiteSpace: "nowrap",
                                                          overflow: "hidden",
                                                          textOverflow: "ellipsis",
                                                          display: "block",
                                                        }}
                                                      >
                                                        {`${names.length} Selected (${names.join(", ")})`}
                                                      </Typography>
                                                    );
                                                  }}
                                                  MenuProps={{
                                                    PaperProps: {
                                                      sx: {
                                                        maxHeight: 280,
                                                        borderRadius: 2,
                                                        boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                                                      },
                                                    },
                                                  }}
                                                  sx={{
                                                    width: "100%",
                                                    height: 26,
                                                    fontSize: "0.7rem",
                                                    fontWeight: 500,
                                                    backgroundColor: isChecked ? "#ffffff" : "#f8fafc",
                                                    borderRadius: 1.25,
                                                    border: isChecked ? "1px solid #86efac" : "1px solid #cbd5e1",
                                                    "& .MuiSelect-select": {
                                                      py: 0,
                                                      px: 1,
                                                      display: "flex",
                                                      alignItems: "center",
                                                      overflow: "hidden",
                                                    },
                                                    "& fieldset": {
                                                      border: "none",
                                                    },
                                                    "&:hover": {
                                                      borderColor: isChecked ? "#16a34a" : "#94a3b8",
                                                    },
                                                  }}
                                                >
                                                  <MenuItem value={Number(item.id)} sx={{ py: 0.5, px: 1 }}>
                                                    <Checkbox
                                                      checked={selectedValues.includes(Number(item.id))}
                                                      size="small"
                                                      color="success"
                                                      sx={{ p: 0.25, mr: 0.5 }}
                                                    />
                                                    <ListItemText
                                                      primary="Default View (Standard)"
                                                      primaryTypographyProps={{
                                                        fontSize: "0.72rem",
                                                        fontWeight: selectedValues.includes(Number(item.id)) ? 700 : 500,
                                                        color: selectedValues.includes(Number(item.id)) ? "#15803d" : "inherit",
                                                      }}
                                                    />
                                                  </MenuItem>

                                                  {itemTemplates.map((t: any) => {
                                                    const isOptionSelected = selectedValues.includes(Number(t.Report_Id));
                                                    return (
                                                      <MenuItem key={t.Report_Id} value={Number(t.Report_Id)} sx={{ py: 0.5, px: 1 }}>
                                                        <Checkbox
                                                          checked={isOptionSelected}
                                                          size="small"
                                                          color="success"
                                                          sx={{ p: 0.25, mr: 0.5 }}
                                                        />
                                                        <ListItemText
                                                          primary={t.Report_Name}
                                                          primaryTypographyProps={{
                                                            fontSize: "0.72rem",
                                                            fontWeight: isOptionSelected ? 700 : 500,
                                                            color: isOptionSelected ? "#15803d" : "inherit",
                                                          }}
                                                        />
                                                      </MenuItem>
                                                    );
                                                  })}
                                                </Select>
                                              </Box>
                                            ) : (
                                              <Box
                                                display="flex"
                                                alignItems="center"
                                                justifyContent="space-between"
                                                sx={{ height: 26, px: 0.5 }}
                                              >
                                                <Box display="flex" alignItems="center" gap={0.5}>
                                                  <ViewAgendaIcon
                                                    sx={{
                                                      fontSize: 12,
                                                      color: isChecked ? "#16a34a" : "#cbd5e1",
                                                    }}
                                                  />
                                                  <Typography
                                                    variant="caption"
                                                    sx={{
                                                      fontSize: "0.625rem",
                                                      color: isChecked ? "#15803d" : "#94a3b8",
                                                      fontWeight: 600,
                                                    }}
                                                  >
                                                    Standard Report View
                                                  </Typography>
                                                </Box>
                                                {isChecked && (
                                                  <Chip
                                                    label="Active"
                                                    size="small"
                                                    sx={{
                                                      height: 16,
                                                      fontSize: "0.55rem",
                                                      fontWeight: 700,
                                                      backgroundColor: "#dcfce7",
                                                      color: "#15803d",
                                                      borderRadius: 0.75,
                                                      "& .MuiChip-label": { px: 0.5 },
                                                    }}
                                                  />
                                                )}
                                              </Box>
                                            )}
                                          </Box>
                                        </Paper>
                                      </Grid>
                                    );
                                  })}
                                </Grid>
                              </Box>
                            </Collapse>
                          </Paper>
                        );
                      })}
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Box>
          </Box>
        </Box>
      </Box>
    </>
  );
};

export default UserRights;
