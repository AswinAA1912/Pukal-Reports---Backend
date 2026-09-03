import sql from 'mssql'
import { servError, dataFound, noData, invalidInput, failed, success, sentData } from '../../res.mjs';
import { checkIsNumber, decryptPasswordFun, encryptPasswordFun, randomString } from '../../helper_functions.mjs';
import dotenv from 'dotenv';
dotenv.config();

const DB_Name = process.env.DATABASE;
const COM_ID = Number(process.env.COMPANY || process.env.SELECTED_COMPANY_ID);
const userPortalDB = process.env.USERPORTALDB;

if (!checkIsNumber(COM_ID)) {
    throw new Error('COMPANY id is not specified in .env')
}

if (!DB_Name) {
    throw new Error('Company DATABASE is not specified in .env')
}

const user = () => {

    const getUsers = async (req, res) => {
        try {
            const { UserTypeId, BranchId, UserId, Cost_Center_Id, CostCenterTypeId } = req.query;
            const request = new sql.Request()
                .input('UserTypeId', UserTypeId || null)
                .input('BranchId', BranchId || null)
                .input('UserId', UserId || null)
                .input('Cost_Center_Id', Cost_Center_Id || null)
                .input('CostCenterTypeId', CostCenterTypeId || null)
                .query(`
                    SELECT
                        u.UserTypeId,
                        u.UserId,
                        u.UserName,
                        -- u.Password,
                        u.BranchId,
                        b.BranchName,
                        u.Name,
                        ut.UserType,
                        -- u.Autheticate_Id,
                        u.Company_Id AS Company_id,
                        c.Company_Name,
			        	ec.Cost_Center_Id,
			        	ec.Cost_Center_Name,
			        	uct.UserType AS costcentertype,
			            ec.User_Type AS CostCenterTypeId 
                    FROM tbl_Users AS u
                    LEFT JOIN tbl_User_Type AS ut ON ut.Id = u.UserTypeId
                    LEFT JOIN tbl_Company_Master AS c ON c.Company_id = u.Company_Id
			        LEFT JOIN tbl_ERP_Cost_Center AS ec ON ec.User_Id = u.UserId
			        LEFT JOIN tbl_User_Type AS uct ON uct.Id = ec.User_Type
			        LEFT JOIN tbl_Branch_Master AS b ON b.BranchId = u.BranchId
                    WHERE 
                        u.UDel_Flag = 0 
                        AND u.UserId <> 0
                        ${checkIsNumber(UserTypeId) ? ' AND u.UserTypeId = @UserTypeId ' : ''}
                        ${checkIsNumber(BranchId) ? ' AND u.BranchId = @BranchId ' : ''}
                        ${checkIsNumber(UserId) ? ' AND u.UserId = @UserId ' : ''}
                        ${checkIsNumber(Cost_Center_Id) ? ' AND ec.Cost_Center_Id = @Cost_Center_Id ' : ''}
                        ${checkIsNumber(CostCenterTypeId) ? ' AND ec.User_Type = @CostCenterTypeId ' : ''}
                    ORDER BY u.Name `
                );

            const result = await request;

            if (result.recordset.length > 0) {
                // const encryptPassword = result.recordset.map(o => ({ ...o, Password: encryptPasswordFun(o.Password) }))
                // const sorted = encryptPassword.sort((a, b) => a.Name.localeCompare(b.Name));
                dataFound(res, result.recordset)
            } else {
                noData(res)
            }
        } catch (e) {
            servError(e, res)
        }
    };

    const userDropdown = async (req, res) => {
        try {
            const { UserTypeId, BranchId, UserId, withAuth } = req.query;

            const request = new sql.Request()
                .input('UserTypeId', UserTypeId || null)
                .input('BranchId', BranchId || null)
                .input('UserId', UserId || null)
                .query(`
                    SELECT 
                        UserId, 
                        Name 
                        ${Boolean(withAuth) ? ', Autheticate_Id ' : ''} 
                    FROM tbl_Users
                    WHERE 
                        UDel_Flag = 0
                        ${checkIsNumber(UserTypeId) ? ' AND UserTypeId = @UserTypeId ' : ''}
                        ${checkIsNumber(BranchId) ? ' AND BranchId = @BranchId ' : ''}
                        ${checkIsNumber(UserId) ? ' AND UserId = @UserId ' : ''}`
                );

            const result = await request;

            sentData(res, result.recordset)

        } catch (e) {
            return servError(e, res)
        }
    };

    return {
        getUsers,
        userDropdown,
    }
}

export default user();