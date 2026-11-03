// src/pages/Login.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Button,
  Typography,
  TextField,
  Paper,
  List,
  ListItemButton,
  ListItemText,
  InputAdornment,
  IconButton,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useAuth, Company } from "../auth/authContext";
import { toast } from "react-toastify";
import { encryptPassword } from "../utils/encryption";
import { fetchCompanies, globalLogin, getUserByAuth, CompanyResponse } from "../services/auth.services";

type Step = "USERNAME" | "COMPANY" | "PASSWORD";


const Login: React.FC = () => {
  const { login, token, isInitializing } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("USERNAME");
  const [companies, setCompanies] = useState<CompanyResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState<CompanyResponse>({
    Company_Name: "",
    Local_Id: 0,
    Global_Id: 0,
    Web_Api: "",
    Global_User_ID: "",
    username: "",
    password: "",
  });

  const passwordRef = useRef<HTMLInputElement>(null);

  // Redirect if already logged in
  useEffect(() => {
    if (!isInitializing && token) {
      navigate("/dashboard", { replace: true });
    }
  }, [token, isInitializing, navigate]);

  // STEP 1: Verify username → fetch companies
  const verifyUsername = async () => {
    if (!form.username.trim()) return;

    try {
      const data = await fetchCompanies(form.username.trim());
      if (!data.length) {
        toast.error("No companies mapped to this user");
        return;
      }
      setCompanies(data);
      setStep("COMPANY");
    } catch {
      toast.error("Failed to fetch companies");
    }
  };

  // STEP 2: Select company
  const selectCompany = (c: CompanyResponse) => {
    setForm((f) => ({ ...f, ...c }));
    localStorage.setItem("COMPANY_ID", String(c.Local_Id));
    setStep("PASSWORD");
    setTimeout(() => passwordRef.current?.focus(), 100);
  };

  // STEP 3: Login
  const handleLogin = async () => {
    try {
      setLoading(true);

      // 🔐 Encrypt password
      const encryptedPassword = encryptPassword(form.password);

      // 1️⃣ Global login (HOST API)
      const loginResponse = await globalLogin({
        Global_User_ID: String(form.Global_User_ID || (form as any).Global_User_Id || ""),
        Password: encryptedPassword,
      });

      // const parseData = localStorage.getItem("AUTH_ID");

      const Autheticate_Id = loginResponse.Autheticate_Id;

      if (!Autheticate_Id || !form.Web_Api) {
        toast.error("Incomplete login data");
        return;
      }

      // ✅ Normalize COMPANY API from selected company
      const companyAPI = form.Web_Api.endsWith("/")
        ? `${form.Web_Api}`
        : `${form.Web_Api}`;

      // 2️⃣ Fetch user from COMPANY API
      const fullUser = await getUserByAuth(Autheticate_Id, companyAPI, Number(form.Local_Id));

      if (!fullUser.UserId) {
        toast.error("User not found in selected company");
        return;
      }

      // ✅ Store in localStorage only on successful user fetch
      localStorage.setItem("COMPANY_API", companyAPI);
      localStorage.setItem("AUTH_ID", Autheticate_Id);

      // ✅ Map companies to match AuthContext Company type
      const mappedCompanies: Company[] = companies.map((c) => ({
        id: Number(c.Local_Id),        // Local_Id → id
        name: c.Company_Name,          // Company_Name → name
        api: c.Web_Api,                // Web_Api → api
      }));

      // ✅ Call login in AuthContext with correct types
      login(
        Autheticate_Id,
        {
          id: Number(fullUser.UserId),
          uniqueName: fullUser.UserName,
          Name: fullUser.Name,
          companyId: Number(fullUser.Company_id),
          Company_Name: fullUser.Company_Name,
          Global_User_Id: fullUser.Autheticate_Id,
          UserTypeId: fullUser.UserTypeId,
        },
        mappedCompanies,      // ✅ now matches Company[]
        companyAPI            // ✅ optional selected company API
      );

      toast.success("Login successful");
      navigate("/dashboard", { replace: true });

    } catch (err: any) {
      toast.error(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };


  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "linear-gradient(to bottom right, #0ea5e9, #0284c7)",
      }}
    >
      <Paper elevation={12} sx={{ width: 420, p: 5, borderRadius: 4 }}>
        <Typography
          variant="h4"
          sx={{ fontWeight: 700, mb: 4, color: "#0369a1" }}
        >
          Pukal Reports
        </Typography>

        {/* STEP 1: USERNAME */}
        {step === "USERNAME" && (
          <>
            <TextField
              label="Username"
              fullWidth
              autoFocus
              value={form.username}
              onChange={(e) =>
                setForm({ ...form, username: e.target.value })
              }
              onKeyDown={(e) => e.key === "Enter" && verifyUsername()}
              sx={{ mb: 3 }}
            />
            <Button
              fullWidth
              variant="contained"
              disabled={!form.username.trim()}
              onClick={verifyUsername}
              sx={{
                backgroundColor: "#0D47A1",
                "&:hover": { backgroundColor: "#0B3C91" },
              }}
            >
              Next
            </Button>
          </>
        )}

        {/* STEP 2: COMPANY */}
        {step === "COMPANY" && (
          <>
            <Typography sx={{ mb: 2, fontWeight: 600 }}>
              Select Company
            </Typography>
            <List>
              {companies.map((c) => (
                <ListItemButton
                  key={c.Local_Id}
                  onClick={() => selectCompany(c)}
                  sx={{
                    borderRadius: 2,
                    mb: 1,
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <ListItemText primary={c.Company_Name} />
                </ListItemButton>
              ))}
            </List>
          </>
        )}

        {/* STEP 3: PASSWORD */}
        {step === "PASSWORD" && (
          <>
            <TextField
              label="Password"
              type={showPassword ? "text" : "password"}
              fullWidth
              inputRef={passwordRef}
              value={form.password}
              onChange={(e) =>
                setForm({ ...form, password: e.target.value })
              }
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={() => setShowPassword(!showPassword)}
                      onMouseDown={(e) => e.preventDefault()}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 3 }}
            />
            <Button
              fullWidth
              variant="contained"
              disabled={loading || !form.password}
              onClick={handleLogin}
              sx={{
                backgroundColor: "#0D47A1",
                "&:hover": { backgroundColor: "#0B3C91" },
              }}
            >
              {loading ? "Signing in..." : "Login"}
            </Button>
          </>
        )}
      </Paper>
    </Box>
  );
};

export default Login;
