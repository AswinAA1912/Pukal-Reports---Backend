// src/config/portalBaseURL.ts


// const api = "http://localhost:9001/api/";
// const api = "http://192.168.1.5:9001/api/";

// // const api = 'https://erpsmt.in/api/';
// // const api = 'https://pukaltechnologies.in/api/';
// // const api = "http://shrifoods.erpsmt.in/api/";


// export default api;

export const getHostAPI = (): string => {
  // const { protocol, hostname, port } = window.location;
  // if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.startsWith("192.168.")) {
  //   return `${protocol}//${hostname}:9001/api/`;
  // }
  // return `${protocol}//${hostname}${port ? `:${port}` : ""}/api/`;

  const { protocol, host } = window.location, api = `${protocol}//${host}/api/`;

  return api
};


export const getCompanyAPI = (): string => {
  const companyAPI = localStorage.getItem("COMPANY_API");

  if (companyAPI && companyAPI.startsWith("http")) {
    return companyAPI.endsWith("/") ? companyAPI : `${companyAPI}/`;
  }

  return "";
};

export const getBaseURL = (): string => {
  return getHostAPI().replace(/api\/$/, "");
};
