import { getHostAPI } from "../config/portalBaseURL";

interface FetchLinkParams {
  address: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  bodyData?: any;
  others?: RequestInit;
  autoHeaders?: boolean;
  loadingOn?: () => void;
  loadingOff?: () => void;
}

interface UserStorage {
  Autheticate_Id?: string;
  Global_User_Id?: string;
  companyId?: number;
}

export const fetchLink = async <T = any>({
  address,
  method = "GET",
  headers = {},
  bodyData = null,
  others = {},
  autoHeaders = false,
  loadingOn,
  loadingOff,
}: FetchLinkParams): Promise<T> => {
  
  const storage: UserStorage | null = JSON.parse(
    localStorage.getItem("user") || "null"
  );

  const token = localStorage.getItem("AUTH_ID") || storage?.Autheticate_Id || storage?.Global_User_Id;

  const isFormData = bodyData instanceof FormData;

  const defaultHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: token || "",
  };

  const companyId = localStorage.getItem("COMPANY_ID") || (storage?.companyId ? String(storage.companyId) : "");
  if (companyId) {
    defaultHeaders["Db"] = companyId;
  }

  const finalHeaders: Record<string, string> = autoHeaders
    ? defaultHeaders
    : { ...defaultHeaders, ...headers };

  const options: RequestInit = {
    method,
    headers: finalHeaders,
    ...others,
  };

  if (["POST", "PUT", "DELETE"].includes(method)) {
    if (!isFormData) {
      options.body = JSON.stringify(bodyData || {});
    } else {
      options.body = bodyData;
    }
  }

  try {
    if (loadingOn) loadingOn();

    const response = await fetch(
      `${getHostAPI()}${address.replace(/\s+/g, "")}`,
      options
    );

    const contentType = response.headers.get("content-type");

    if (contentType?.includes("application/json")) {
      const json = await response.json();
      return json;
    }

    const text = await response.text();
    console.error("Invalid API response:", text);
    throw new Error("Server returned non-JSON response");

  } catch (e) {
    console.error("Fetch Error", e);
    throw e;
  } finally {
    if (loadingOff) loadingOff();
  }
};