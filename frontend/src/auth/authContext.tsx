// src/auth/authContext.tsx
import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  useCallback,
} from "react";
import { getUserByAuth, fetchCompanies } from "../services/auth.services";
import { toast } from "react-toastify";

export type User = {
  id: number;
  uniqueName: string;
  Name?: string | null;
  Company_Name?: string | null;
  companyId?: number | null;
  Global_User_Id?: string;
  UserTypeId?: string | number | null;
};

export type Company = {
  id: number;
  name: string;
  api: string;
};

export type AuthContextType = {
  user: User | null;
  token: string | null;
  companies: Company[];
  login: (
    token: string,
    user: User,
    companies: Company[],
    companyApi?: string
  ) => void;
  logout: () => void;
  switchCompany: (company: Company) => Promise<void>;
  isInitializing: boolean;
  isAutoLogin: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isAutoLogin, setIsAutoLogin] = useState(false);

  /**
   * AUTO LOGIN
   */
  useEffect(() => {
    const init = async () => {
      const params = new URLSearchParams(window.location.search);
      const authFromUrl = params.get("Auth") || params.get("token");
      const companyIdFromUrl = params.get("company_id");
      const usernameFromUrl = params.get("username");

      // Clear search query parameters immediately so they don't persist on page reload or cause errors
      if (authFromUrl) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      try {
        const storedAuth = localStorage.getItem("AUTH_ID");
        const storedUser = localStorage.getItem("user");
        const storedCompanies = localStorage.getItem("companies");

        /**
         * CASE 1
         * URL login (AutoLogin)
         */
        if (authFromUrl) {
          setIsAutoLogin(true);
          setToken(authFromUrl);
          localStorage.setItem("AUTH_ID", authFromUrl);

          const username =
            usernameFromUrl ||
            JSON.parse(localStorage.getItem("user") || "null")?.uniqueName ||
            "admin";

          const companyResponses = await fetchCompanies(username);

          const companiesData: Company[] = companyResponses.map((c) => ({
            id: Number(c.Local_Id),
            name: c.Company_Name,
            api: c.Web_Api,
          }));

          setCompanies(companiesData);
          localStorage.setItem("companies", JSON.stringify(companiesData));

          const selectedCompany =
            companiesData.find((c) => String(c.id) === companyIdFromUrl) ||
            companiesData[0];

          if (!selectedCompany) throw new Error("Company not found");

          localStorage.setItem("COMPANY_API", selectedCompany.api);
          localStorage.setItem("COMPANY_ID", String(selectedCompany.id));

          const fullUser = await getUserByAuth(authFromUrl, selectedCompany.api, selectedCompany.id);

          const formattedUser: User = {
            id: fullUser.UserId,
            uniqueName: fullUser.UserName,
            Name: fullUser.Name,
            companyId: selectedCompany.id,
            Company_Name: selectedCompany.name,
            Global_User_Id: fullUser.Autheticate_Id,
            UserTypeId: fullUser.UserTypeId,
          };

          setUser(formattedUser);
          localStorage.setItem("user", JSON.stringify(formattedUser));
        }

        /**
         * CASE 2
         * Refresh login (restore session)
         */
        else if (storedAuth && storedUser) {
          setIsAutoLogin(false);
          setToken(storedAuth);
          setUser(JSON.parse(storedUser));

          if (storedCompanies) {
            setCompanies(JSON.parse(storedCompanies));
          }
        }
      } catch (err: any) {
        console.error("Auth init error:", err);
        toast.error(`Session restore failed: ${err?.message || err}`);
      } finally {
        setIsInitializing(false);
      }
    };

    init();
  }, []);

  /**
   * LOGIN
   */
  const login = useCallback(
    (
      newToken: string,
      newUser: User,
      userCompanies: Company[],
      companyApi?: string
    ) => {
      setToken(newToken);
      setUser(newUser);
      setCompanies(userCompanies);

      localStorage.setItem("AUTH_ID", newToken);
      localStorage.setItem("user", JSON.stringify(newUser));
      localStorage.setItem("companies", JSON.stringify(userCompanies));
      if (newUser.companyId) {
        localStorage.setItem("COMPANY_ID", String(newUser.companyId));
      }

      if (companyApi) {
        localStorage.setItem("COMPANY_API", companyApi);
      }
    },
    []
  );

  /**
   * LOGOUT
   */
  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setCompanies([]);

    localStorage.clear();
  }, []);

  /**
   * SWITCH COMPANY
   */
  const switchCompany = useCallback(
    async (company: Company) => {
      if (!user || !token) return;

      try {
        // Fetch user details for the new company from the backend
        const fullUser = await getUserByAuth(token, company.api, company.id);

        const formattedUser: User = {
          id: fullUser.UserId,
          uniqueName: fullUser.UserName,
          Name: fullUser.Name,
          companyId: company.id,
          Company_Name: company.name,
          Global_User_Id: fullUser.Autheticate_Id,
          UserTypeId: fullUser.UserTypeId,
        };

        localStorage.setItem("COMPANY_API", company.api);
        localStorage.setItem("COMPANY_ID", String(company.id));
        setUser(formattedUser);
        localStorage.setItem("user", JSON.stringify(formattedUser));

        toast.success(`Switched to company: ${company.name}`);

        // Redirect to the company server URL
        const targetUrl = company.api;
        if (targetUrl) {
          const baseUrl = targetUrl.endsWith('/') ? targetUrl : `${targetUrl}/`;
          window.location.href = `${baseUrl}?Auth=${token}&company_id=${company.id}`;
        } else {
          window.location.reload();
        }
      } catch (err: any) {
        console.error("Switch company error:", err);
        toast.error(err.message || "Failed to switch company");
        throw err;
      }
    },
    [user, token]
  );

  const value = useMemo(
    () => ({
      user,
      token,
      companies,
      login,
      logout,
      switchCompany,
      isInitializing,
      isAutoLogin,
    }),
    [user, token, companies, login, logout, switchCompany, isInitializing]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}