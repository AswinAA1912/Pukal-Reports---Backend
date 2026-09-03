import sql from 'mssql';
import { servError, dataFound, noData, invalidInput, failed, success, sentData } from '../../res.mjs';
import { checkIsNumber } from '../../helper_functions.mjs';
import dotenv from 'dotenv';
dotenv.config();

const userPortalDB = process.env.USERPORTALDB || 'User_Portal';

const ensureTable = async (req) => {
    try {
        const initReq = req?.db ? new sql.Request(req.db) : new sql.Request();
        await initReq.query(`
            IF OBJECT_ID('tbl_reports_userrights') IS NULL
            BEGIN
                CREATE TABLE tbl_reports_userrights (
                    user_id INT NOT NULL,
                    menu_id INT NOT NULL
                );
            END
        `);
    } catch (err) {
        console.warn('ensureTable tbl_reports_userrights warning:', err.message);
    }
};

const reportsUserRights = () => {

    // GET /api/masters/reportsUserRights
    // Query params: user_id, menu_id
    const getReportsUserRights = async (req, res) => {
        try {
            await ensureTable(req);

            const { user_id, menu_id } = req.query;

            const uId = user_id ? Number(user_id) : null;
            const mId = menu_id ? Number(menu_id) : null;

            const request = req.db ? new sql.Request(req.db) : new sql.Request();

            if (uId !== null) {
                request.input('user_id', uId);
            }
            if (mId !== null) {
                request.input('menu_id', mId);
            }

            const queryStr = `
                SELECT 
                    ur.user_id,
                    ur.menu_id,
                    u.Name AS UserName,
                    u.UserName AS UserLoginName,
                    m.name AS MenuName,
                    m.menu_type,
                    m.url,
                    m.parent_id
                FROM tbl_reports_userrights ur
                LEFT JOIN tbl_Users u ON u.UserId = ur.user_id
                LEFT JOIN [${userPortalDB}].[dbo].[tbl_AppMenu] m ON m.id = ur.menu_id
                WHERE 1 = 1
                ${uId !== null ? ' AND ur.user_id = @user_id ' : ''}
                ${mId !== null ? ' AND ur.menu_id = @menu_id ' : ''}
                ORDER BY u.Name, m.name
            `;

            const result = await request.query(queryStr);

            if (result.recordset && result.recordset.length > 0) {
                dataFound(res, result.recordset);
            } else {
                noData(res);
            }
        } catch (e) {
            servError(e, res);
        }
    };

    // POST /api/masters/reportsUserRights
    const createReportsUserRights = async (req, res) => {
        const { user_id, menu_id, menu_ids } = req.body;

        if (!checkIsNumber(user_id)) {
            return invalidInput(res, 'Valid user_id is required');
        }

        await ensureTable(req);

        const uId = Number(user_id);
        const transaction = new sql.Transaction(req.db || undefined);

        try {
            await transaction.begin();

            const targetMenuIds = Array.isArray(menu_ids)
                ? menu_ids.map(Number).filter(id => !isNaN(id))
                : (checkIsNumber(menu_id) ? [Number(menu_id)] : []);

            if (targetMenuIds.length === 0) {
                await transaction.rollback();
                return invalidInput(res, 'menu_id or menu_ids array is required');
            }

            for (const mId of targetMenuIds) {
                const reqInsert = new sql.Request(transaction)
                    .input('user_id', uId)
                    .input('menu_id', mId);

                await reqInsert.query(`
                    IF NOT EXISTS (SELECT 1 FROM tbl_reports_userrights WHERE user_id = @user_id AND menu_id = @menu_id)
                    BEGIN
                        INSERT INTO tbl_reports_userrights (user_id, menu_id) VALUES (@user_id, @menu_id);
                    END
                `);
            }

            await transaction.commit();
            success(res, 'Reports user rights created successfully');
        } catch (e) {
            try {
                await transaction.rollback();
            } catch (rollErr) {
                console.error("Rollback failed:", rollErr);
            }
            servError(e, res);
        }
    };

    // PUT /api/masters/reportsUserRights
    // Body: { user_id, menu_ids: [...] }
    const updateReportsUserRights = async (req, res) => {
        const { user_id, menu_ids } = req.body;

        if (!checkIsNumber(user_id)) {
            return invalidInput(res, 'Valid user_id is required');
        }

        if (!Array.isArray(menu_ids)) {
            return invalidInput(res, 'menu_ids array is required');
        }

        await ensureTable(req);

        const uId = Number(user_id);
        const targetMenuIds = menu_ids.map(Number).filter(id => !isNaN(id));
        const transaction = new sql.Transaction(req.db || undefined);

        try {
            await transaction.begin();

            // 1. Delete all existing rights for the user
            const deleteReq = new sql.Request(transaction)
                .input('user_id', uId);
            await deleteReq.query('DELETE FROM tbl_reports_userrights WHERE user_id = @user_id');

            // 2. Insert new rights
            for (const mId of targetMenuIds) {
                const insertReq = new sql.Request(transaction)
                    .input('user_id', uId)
                    .input('menu_id', mId);
                await insertReq.query('INSERT INTO tbl_reports_userrights (user_id, menu_id) VALUES (@user_id, @menu_id)');
            }

            await transaction.commit();
            success(res, 'Reports user rights updated successfully');
        } catch (e) {
            try {
                await transaction.rollback();
            } catch (rollErr) {
                console.error("Rollback failed:", rollErr);
            }
            servError(e, res);
        }
    };

    // DELETE /api/masters/reportsUserRights
    // Body or Query: user_id, menu_id (optional)
    const deleteReportsUserRights = async (req, res) => {
        try {
            await ensureTable(req);

            const user_id = req.query.user_id || req.body.user_id;
            const menu_id = req.query.menu_id || req.body.menu_id;

            if (!checkIsNumber(user_id)) {
                return invalidInput(res, 'Valid user_id is required');
            }

            const uId = Number(user_id);
            const mId = menu_id ? Number(menu_id) : null;

            const request = (req.db ? new sql.Request(req.db) : new sql.Request()).input('user_id', uId);
            let queryStr = '';

            if (mId !== null) {
                request.input('menu_id', mId);
                queryStr = 'DELETE FROM tbl_reports_userrights WHERE user_id = @user_id AND menu_id = @menu_id';
            } else {
                queryStr = 'DELETE FROM tbl_reports_userrights WHERE user_id = @user_id';
            }

            await request.query(queryStr);
            success(res, 'Reports user rights deleted successfully');
        } catch (e) {
            servError(e, res);
        }
    };

    return {
        getReportsUserRights,
        createReportsUserRights,
        updateReportsUserRights,
        deleteReportsUserRights
    };
};

export default reportsUserRights();
