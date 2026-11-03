import axios from "axios";
import { getBaseURL } from "../config/portalBaseURL";

export interface Menus {
    name: string;
    is_active: number;
    actionType: string;
    rUrl: string;
}

export const MenuService = {
    getMenus: () =>
        axios.get<{ success: boolean; data: Menus[] }>(
            `${getBaseURL()}api/authorization/menuMaster`,
        ),
};

