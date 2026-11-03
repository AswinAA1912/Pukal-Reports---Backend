import React, { useState, useMemo } from "react";
import {
  Box,
  Typography,
  Divider,
  CircularProgress,
  Card,
  CardContent,
  useMediaQuery,
  TextField,
  InputAdornment,
  IconButton,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  Tooltip,
} from "recharts";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/authContext";
import Header from "../Layout/Header";
import { useQuery } from "@tanstack/react-query";
import { fetchAndFilterMenus } from "../utils/menuRights";
import { handleExternalOrMenuNavigation } from "../utils/navigation";
import { DashBoardSalesGraph } from "../services/graphAnalysis.services";

const Dashboard: React.FC = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const companyId = user?.companyId ?? undefined;

  const { data: menuList = [], isLoading } = useQuery({
    queryKey: ["dashboard-menus", companyId, user?.id],
    queryFn: async () => {
      return await fetchAndFilterMenus(user);
    },
    enabled: !!companyId && !!user,
  });

  const [searchQuery, setSearchQuery] = useState("");

  const filteredMenuList = useMemo(() => {
    if (!searchQuery.trim()) return menuList;
    const q = searchQuery.toLowerCase().trim();
    return menuList.filter((item: any) =>
      item.name?.toLowerCase().includes(q)
    );
  }, [menuList, searchQuery]);

  const today = new Date();

  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

  const formatDate = (date: Date) =>
    date.toISOString().split("T")[0];

  const fromDate = formatDate(firstDay);
  const toDate = formatDate(today);

  const { data: graphData, isLoading: graphLoading } = useQuery({
    queryKey: ["dashboard-graph", user?.companyId, fromDate, toDate],
    queryFn: async () => {
      const res = await DashBoardSalesGraph.getDashboardGraph({
        Fromdate: fromDate,
        Todate: toDate,
        Company_Id: companyId,
      });
      return res.data.data;
    },
    enabled: !!user?.companyId,
  });

  const latestDate = graphData?.DayWise?.length
    ? new Date(
      Math.max(
        ...graphData.DayWise.map((d: any) =>
          new Date(d.Invoice_Date).getTime()
        )
      )
    )
    : new Date();

  const currentMonth = latestDate.getMonth() + 1;
  const currentYear = latestDate.getFullYear();
  const currentDay = latestDate.getDate();

  const monthData =
    graphData?.DayWise?.filter((d: any) => {
      const dateStr = d.Invoice_Date.split("T")[0];
      const [year, month, day] = dateStr.split("-").map(Number);

      return (
        year === currentYear &&
        month === currentMonth &&
        day <= currentDay
      );
    }) || [];

  const totalInvoices = monthData.reduce(
    (sum: number, item: any) => sum + item.Invoice_Count,
    0
  );

  const totalSales = monthData.reduce(
    (sum: number, item: any) => sum + item.Total_Invoice_value,
    0
  );

  const chartData = monthData.map((d: any) => ({
    day: Number(d.Invoice_Date.split("T")[0].split("-")[2]),
    value: d.Total_Invoice_value,
  }));

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        overflow: "hidden",
      }}
    >
      <Header headerColor="#1E3A8A" showSearch={false} position="static" />

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          width: "100%",
          overflow: "hidden",
          backgroundColor: "#cfe6ec",
        }}
      >
        {/* LEFT PANEL */}
        <Box
          sx={{
            width: isMobile ? "100%" : 360,
            px: isMobile ? 2 : 5,
            py: isMobile ? 3 : 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 3
          }}
        >
          <Box>
            <Typography
              sx={{
                fontSize: isMobile ? 20 : 32,
                fontWeight: 400,
                mb: 1,
                whiteSpace: isMobile ? "normal" : "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                wordBreak: "break-word",
              }}
            >
              Welcome {user?.Name || "admin"},
            </Typography>

            <Typography
              sx={{
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: 1,
                fontFamily: "serif",
              }}
            >
              {user?.Company_Name || "PUKAL FOODS PVT LTD"}
            </Typography>
          </Box>

          {/* SALES ERP CARD */}
          <Card
            onClick={() => navigate("/graphanalysis")}
            sx={{
              cursor: "pointer",
              borderRadius: 3,
              background: "linear-gradient(135deg,#1E3A8A,#2563EB)",
              color: "#fff",
              boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
              transition: "all 0.3s ease",
              "&:hover": {
                transform: "translateY(-6px)",
                boxShadow: "0 12px 28px rgba(0,0,0,0.35)",
              },
            }}
          >
            <CardContent
              sx={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                justifyContent: "space-between",
                alignItems: isMobile ? "flex-start" : "center",
                gap: isMobile ? 2 : 0,
              }}
            >
              {/* LEFT SIDE DATA */}
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  sx={{
                    fontSize: 14,
                    opacity: 0.9,
                    mb: 1,
                    letterSpacing: 1,
                  }}
                >
                  TOTAL SALES
                </Typography>

                {graphLoading ? (
                  <CircularProgress size={22} sx={{ color: "#fff" }} />
                ) : (
                  <>
                    <Typography
                      sx={{
                        fontSize: 28,
                        fontWeight: 700,
                      }}
                    >
                      ₹ {new Intl.NumberFormat("en-IN").format(totalSales)}
                    </Typography>

                    <Typography
                      sx={{
                        fontSize: 14,
                        opacity: 0.85,
                        mt: 1,
                      }}
                    >
                      {totalInvoices} Invoices
                    </Typography>
                  </>
                )}

                <Typography sx={{ fontSize: 12, opacity: 0.8, mt: 1 }}>
                  This Month
                </Typography>
              </Box>

              {/* RIGHT SIDE MINI GRAPH */}
              <Box sx={{
                width: isMobile ? "100%" : 120,
                height: isMobile ? 100 : 70,
              }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>

                    <defs>
                      <linearGradient id="salesLine" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ffffff" stopOpacity={1} />
                        <stop offset="100%" stopColor="#ffffff" stopOpacity={0.2} />
                      </linearGradient>
                    </defs>

                    <XAxis dataKey="day" hide />

                    <Tooltip
                      contentStyle={{
                        background: "#1E3A8A",
                        border: "none",
                        borderRadius: "6px",
                        color: "#fff"
                      }}
                      formatter={(value: any) =>
                        `₹ ${new Intl.NumberFormat("en-IN").format(Number(value || 0))}`
                      }
                    />

                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#ffffff"
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 5 }}
                      isAnimationActive={true}
                      animationDuration={1200}
                    />

                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Box>

        {!isMobile && <Divider orientation="vertical" flexItem />}

        {/* RIGHT MENU */}
        <Box
          sx={{
            flex: 1,
            px: isMobile ? 2 : 6,
            py: isMobile ? 4 : 4,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-start",
            overflowY: "auto",
            maxHeight: "100%",
          }}
        >
          {/* Header row with MENU title and Search Bar parallel to each other */}
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", sm: "row" },
              justifyContent: "space-between",
              alignItems: { xs: "stretch", sm: "center" },
              gap: 1.5,
              mb: 2,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography fontSize={22} fontWeight={700}>
                MENU
              </Typography>
              {searchQuery && (
                <Typography fontSize={13} color="text.secondary" fontWeight={500}>
                  ({filteredMenuList.length} {filteredMenuList.length === 1 ? "item" : "items"})
                </Typography>
              )}
            </Box>

            <TextField
              size="small"
              placeholder="Search menus..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: "#64748b", fontSize: 20 }} />
                  </InputAdornment>
                ),
                endAdornment: searchQuery ? (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setSearchQuery("")}
                      sx={{ p: 0.2 }}
                    >
                      <ClearIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
              sx={{
                width: { xs: "100%", sm: 260, md: 300 },
                "& .MuiOutlinedInput-root": {
                  borderRadius: 2,
                  bgcolor: "#ffffff7e",
                  fontSize: "0.82rem",
                  height: 36,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                  "&:hover": {
                    bgcolor: "#ffffff8e",
                  },
                  "&.Mui-focused": {
                    bgcolor: "#ffffff8e",
                  },
                },
              }}
            />
          </Box>

          <Divider sx={{ mb: 3 }} />

          {isLoading ? (
            <Box textAlign="center" py={4}>
              <CircularProgress />
            </Box>
          ) : filteredMenuList.length === 0 ? (
            <Box
              sx={{
                py: 6,
                textAlign: "center",
                bgcolor: "rgba(255,255,255,0.6)",
                borderRadius: 2,
                p: 3,
              }}
            >
              <Typography fontSize={15} fontWeight={600} color="#64748b">
                No menus found matching "{searchQuery}"
              </Typography>
              <Typography fontSize={13} color="#94a3b8" mt={0.5}>
                Try searching with different keywords
              </Typography>
            </Box>
          ) : (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: isMobile
                  ? "1fr"
                  : "repeat(auto-fill, minmax(220px, 1fr))",
                gap: 2,
              }}
            >
              {filteredMenuList.map((item: any) => (
                <Box
                  key={item.id}
                  onClick={() => handleExternalOrMenuNavigation(item.rUrl, item.name, navigate, token, user)}
                  sx={{
                    cursor: "pointer",
                    p: 2,
                    borderRadius: 2,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                    transition: "all 0.2s ease",
                    "&:hover": {
                      transform: "translateY(-3px)",
                      boxShadow: "0 6px 16px rgba(0,0,0,0.15)",
                      background: "#b1c6da",
                    },
                  }}
                >
                  <Typography fontSize={16} fontWeight={600}>
                    {item.name}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default Dashboard;