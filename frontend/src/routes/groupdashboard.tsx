import React from "react";
import {
  Box,
  Typography,
  Divider,
  CircularProgress,
  Card,
  CardContent,
  useMediaQuery,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
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

const GroupDashboard: React.FC = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const { data: menuList = [], isLoading } = useQuery({
    queryKey: ["dashboard-menus", user?.id],
    queryFn: async () => {
      return await fetchAndFilterMenus(user);
    },
    enabled: !!user,
  });

  const today = new Date();

  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

  const formatDate = (date: Date) =>
    date.toISOString().split("T")[0];

  const fromDate = formatDate(firstDay);
  const toDate = formatDate(today);
  const companyId = user?.companyId ?? undefined;
  const [openDialog, setOpenDialog] = React.useState(false);
  const [selectedGroup, setSelectedGroup] = React.useState("");
  const [selectedMenus, setSelectedMenus] = React.useState<any[]>([]);

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

  const getMenuGroup = (menu: any) => {
    const name = menu.name.toLowerCase();

    if (
      name.includes("sales") ||
      name.includes("sale order")
    ) {
      return "Sales";
    }

    if (
      name.includes("pur") ||
      name.includes("purchase")
    ) {
      return "Purchase";
    }

    return "Others";
  };

  const handleGroupClick = (groupName: string, menus: any[]) => {
    setSelectedGroup(groupName);
    setSelectedMenus(menus);
    setOpenDialog(true);
  };

  const groupedMenus = React.useMemo(() => {
    const groups: any = {
      Sales: [],
      Purchase: [],
      Others: [],
    };

    menuList.forEach((menu: any) => {
      const group = getMenuGroup(menu);
      groups[group].push(menu);
    });

    return groups;
  }, [menuList]);

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
            py: isMobile ? 2 : 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <Typography fontSize={22} fontWeight={700} mb={2}>
            MENU
          </Typography>

          <Divider sx={{ mb: 3 }} />

          {isLoading ? (
            <Box textAlign="center">
              <CircularProgress />
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
              {Object.entries(groupedMenus).map(([groupName, menus]: any) => (
                menus.length > 0 && (
                  <Box
                    key={groupName}
                    onClick={() => handleGroupClick(groupName, menus)}
                    sx={{
                      cursor: "pointer",
                      p: 2,
                      borderRadius: 3,
                      textAlign: "center",
                      background: "#cfe6ec",
                      color: "#000000",
                      fontWeight: 700,
                      letterSpacing: 1,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                      transition: "all 0.3s ease",
                      "&:hover": {
                        transform: "translateY(-5px)",
                        boxShadow: "0 10px 24px rgba(0,0,0,0.3)",
                      },
                    }}
                  >
                    <Typography fontSize={18} fontWeight={700}>
                      {groupName.toUpperCase()}
                    </Typography>
                  </Box>
                )
              ))}
            </Box>
          )}
        </Box>
      </Box>

      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {selectedGroup.toUpperCase()}
        </DialogTitle>

        <DialogContent dividers>
          <Box display="flex" flexDirection="column" gap={2}>
            {selectedMenus.map((menu: any) => (
              <Box
                key={menu.id}
                onClick={() => {
                  handleExternalOrMenuNavigation(menu.rUrl, menu.name, navigate, token, user);
                  setOpenDialog(false);
                }}
                sx={{
                  cursor: "pointer",
                  p: 2,
                  borderRadius: 2,
                  border: "1px solid #e0e0e0",
                  transition: "all 0.2s",
                  "&:hover": {
                    background: "#f1f5f9",
                  },
                }}
              >
                <Typography fontWeight={600}>
                  {menu.name}
                </Typography>
              </Box>
            ))}
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GroupDashboard;