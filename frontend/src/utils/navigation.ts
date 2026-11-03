// src/utils/navigation.ts

import { NavigateFunction } from "react-router-dom";

/**
 * Checks if a menu item represents an external url or the "Ticketing Tool",
 * appends auth credentials (token, user ID, company ID, etc.) as query parameters,
 * and navigates accordingly.
 * 
 * @param path The route URL (rUrl/path)
 * @param label The display name/label of the menu item
 * @param navigate The react-router-dom navigate function
 * @param token The user auth token
 * @param user The logged-in user object
 */
export const handleExternalOrMenuNavigation = (
  path: string,
  label: string,
  navigate: NavigateFunction,
  token: string | null,
  user: any
) => {
  const normalizedLabel = (label || "").toLowerCase();
  const normalizedPath = (path || "").trim();

  const isExternal =
    normalizedPath.startsWith("http://") ||
    normalizedPath.startsWith("https://") ||
    normalizedLabel.includes("ticketing") ||
    normalizedLabel.includes("ticket");

  if (isExternal) {
    let targetUrl = normalizedPath;
    
    // Ensure we have a valid URL protocol
    if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
      targetUrl = "https://" + targetUrl;
    }

    try {
      const urlObj = new URL(targetUrl);
      
      if (token) {
        urlObj.searchParams.set("Auth", token);
        urlObj.searchParams.set("token", token);
      }
      
      if (user?.uniqueName) {
        urlObj.searchParams.set("id", user.uniqueName);
        urlObj.searchParams.set("username", user.uniqueName);
      }
      
      if (user?.id) {
        urlObj.searchParams.set("user_id", String(user.id));
        urlObj.searchParams.set("userId", String(user.id));
      }
      
      if (user?.companyId) {
        urlObj.searchParams.set("company_id", String(user.companyId));
        urlObj.searchParams.set("companyId", String(user.companyId));
      }
      
      window.open(urlObj.toString(), "_blank");
    } catch (e) {
      console.error("Failed to parse menu URL, falling back to simple appending", e);
      let separator = targetUrl.includes("?") ? "&" : "?";
      let redirectUrl = targetUrl;
      
      if (token) {
        redirectUrl += `${separator}Auth=${encodeURIComponent(token)}&token=${encodeURIComponent(token)}`;
        separator = "&";
      }
      
      if (user?.uniqueName) {
        redirectUrl += `${separator}id=${encodeURIComponent(user.uniqueName)}&username=${encodeURIComponent(user.uniqueName)}`;
        separator = "&";
      }
      
      if (user?.id) {
        redirectUrl += `${separator}user_id=${encodeURIComponent(user.id)}&userId=${encodeURIComponent(user.id)}`;
        separator = "&";
      }
      
      if (user?.companyId) {
        redirectUrl += `${separator}company_id=${encodeURIComponent(user.companyId)}&companyId=${encodeURIComponent(user.companyId)}`;
      }
      
      window.open(redirectUrl, "_blank");
    }
  } else {
    navigate(path);
  }
};
