import { MenuService } from "../services/menus.service";
import { UserRightsService } from "../services/userRights.service";
import { SettingsService } from "../services/reportSettings.services";

export interface MenuItem {
  id: number;
  name: string;
  rUrl: string;
  display_order: number;
}

export const fetchAndFilterMenus = async (user: any): Promise<MenuItem[]> => {
  if (!user) return [];

  const isDevOrAdmin =
    String(user.UserTypeId) === "0" || String(user.UserTypeId) === "1";

  // 1. Fetch raw menus from the API
  const menuRes = await MenuService.getMenus();
  const rawMenus = menuRes.data?.data || [];

  // Flatten active submenus (menu_type 1 is main menu, is_active 3 is active)
  let subMenus: MenuItem[] = rawMenus
    .filter((menu: any) => menu.menu_type === 1 && menu.is_active === 3)
    .flatMap((menu: any) =>
      (menu.SubMenu || [])
        .filter((sub: any) => sub.is_active === 3)
        .map((sub: any) => ({
          id: sub.id,
          name: sub.name,
          rUrl: sub.rUrl,
          display_order: sub.display_order,
        }))
    );

  if (isDevOrAdmin) {
    // Developer & Administrator see all menus, plus the "User Rights" management page
    const hasUserRightsMenu = subMenus.some((m) => m.rUrl === "/userRights");
    if (!hasUserRightsMenu) {
      subMenus.push({
        id: -999,
        name: "USER RIGHTS",
        rUrl: "/userRights",
        display_order: 9999,
      });
    }
    return subMenus.sort((a, b) => a.display_order - b.display_order);
  } else {
    // Normal user: fetch active user rights and filter
    try {
      const rightsRes = await UserRightsService.getUserRights(user.id);
      if (rightsRes.data?.success) {
        const allowedMenuIds = (rightsRes.data.data || []).map((r: any) =>
          Number(r.menu_id)
        );

        // Fetch template list to check if user has template-level access to any menu
        const allowedParentReports = new Set<string>();
        try {
          const templatesRes = await SettingsService.getReportList();
          const templatesData = templatesRes.data?.data || {};

          Object.entries(templatesData).forEach(([parentReport, items]: [string, any]) => {
            if (Array.isArray(items)) {
              items.forEach((reportObj: any) => {
                if (allowedMenuIds.includes(Number(reportObj.Report_Id))) {
                  allowedParentReports.add(parentReport.toUpperCase());
                }
              });
            }
          });
        } catch (tempErr) {
          console.error("Failed to load templates in menu rights helper:", tempErr);
        }

        return subMenus
          .filter((sub) =>
            allowedMenuIds.includes(sub.id) ||
            allowedParentReports.has(sub.name.toUpperCase())
          )
          .sort((a, b) => a.display_order - b.display_order);
      }
    } catch (err) {
      console.error("Error loading user rights, returning empty menus:", err);
    }
    return []; // Return empty menu list if fetching rights failed
  }
};
