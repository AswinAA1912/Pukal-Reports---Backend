import axios from "axios";
import { getBaseURL } from "../config/portalBaseURL";

export interface UserDropdownItem {
    UserId: string | number;
    Name: string;
    UserName?: string;
    UserTypeId?: string | number;
    UserType?: string;
    BranchId?: number | null;
    BranchName?: string;
}

export interface UserTypeItem {
    Id: string | number;
    UserType: string;
    Alias?: string;
}

export interface UserRightItem {
    user_id: number;
    menu_id: number;
    user_type_id?: number | null;
    UserName: string;
    UserLoginName: string;
    MenuName: string;
    menu_type: number;
    url: string;
    parent_id: number | null;
}

export const UserRightsService = {
    getUserTypes: () =>
        axios.get<{ success: boolean; data: UserTypeItem[] }>(
            `${getBaseURL()}api/masters/userType`
        ),
    getUserDropdown: async () => {
        try {
            const res = await axios.get<{ success: boolean; data: UserDropdownItem[] }>(
                `${getBaseURL()}api/masters/getUser`
            );
            if (res.data?.success && Array.isArray(res.data?.data) && res.data.data.length > 0) {
                return res;
            }
        } catch (e) {
            console.warn("getUser failed, falling back to userdropdown:", e);
        }
        return axios.get<{ success: boolean; data: UserDropdownItem[] }>(
            `${getBaseURL()}api/masters/userdropdown`
        );
    },
    getUserRights: (userId: number | string) =>
        axios.get<{ success: boolean; data: UserRightItem[] }>(
            `${getBaseURL()}api/masters/reportsUserRights`,
            { params: { user_id: userId } }
        ),
    getUserTypeRights: (userTypeId: number | string) =>
        axios.get<{ success: boolean; data: UserRightItem[] }>(
            `${getBaseURL()}api/masters/reportsUserRights`,
            { params: { user_type_id: userTypeId } }
        ),
    saveUserRights: (userId: number | string, menuIds: number[], userTypeId?: number | string) =>
        axios.put<{ success: boolean; message: string }>(
            `${getBaseURL()}api/masters/reportsUserRights`,
            { 
                user_id: Number(userId), 
                menu_ids: menuIds,
                user_type_id: userTypeId !== undefined && userTypeId !== null && String(userTypeId).trim() !== '' ? Number(userTypeId) : undefined
            }
        ),
    saveUserTypeRights: (userTypeId: number | string, menuIds: number[], userIds?: (number | string)[]) =>
        axios.put<{ success: boolean; message: string }>(
            `${getBaseURL()}api/masters/reportsUserRights`,
            { 
                user_type_id: Number(userTypeId), 
                menu_ids: menuIds,
                user_ids: Array.isArray(userIds) ? userIds.map(Number) : undefined
            }
        ),
};
