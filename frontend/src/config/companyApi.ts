export const getCompanyAPI = (): string => {
  const api = localStorage.getItem("COMPANY_API");

  if (!api) {
    throw new Error("Company API not set. Please login again.");
  }

  // Ensure trailing slash
  return api.endsWith("/") ? api : `${api}/`;
};
