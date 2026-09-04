import sql from 'mssql';
import { servError, dataFound, noData, invalidInput, success } from '../../res.mjs';
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
                    menu_id INT NOT NULL,
                    user_type_id INT NULL
                );
            END
            ELSE IF COL_LENGTH('tbl_reports_userrights', 'user_type_id') IS NULL
            BEGIN
                ALTER TABLE tbl_reports_userrights ADD user_type_id INT NULL;
            END

            IF OBJECT_ID('tbl_reports_usertype_rights') IS NULL
            BEGIN
                CREATE TABLE tbl_reports_usertype_rights (
                    user_type_id INT NOT NULL,
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
    // Query params: user_id, menu_id, user_type_id
    const getReportsUserRights = async (req, res) => {
        try {
            await ensureTable(req);

            const { user_id, menu_id, user_type_id } = req.query;

            const uId = user_id ? Number(user_id) : null;
            const mId = menu_id ? Number(menu_id) : null;
            const utId = user_type_id ? Number(user_type_id) : null;

            // CASE 1: Query rights by UserType directly
            if (utId !== null && uId === null) {
                const utReq = (req.db ? new sql.Request(req.db) : new sql.Request())
                    .input('user_type_id', utId);

                // 1. Check tbl_reports_usertype_rights first
                let utResult = await utReq.query(`
                    SELECT 
                        utr.user_type_id,
                        utr.menu_id,
                        m.name AS MenuName,
                        m.menu_type,
                        m.url,
                        m.parent_id
                    FROM tbl_reports_usertype_rights utr
                    LEFT JOIN [${userPortalDB}].[dbo].[tbl_AppMenu] m ON m.id = utr.menu_id
                    WHERE utr.user_type_id = @user_type_id
                    ORDER BY m.name
                `);

                // 2. Fallback: check tbl_reports_userrights by user_type_id
                if (!utResult.recordset || utResult.recordset.length === 0) {
                    utResult = await utReq.query(`
                        SELECT DISTINCT
                            ur.user_type_id,
                            ur.menu_id,
                            m.name AS MenuName,
                            m.menu_type,
                            m.url,
                            m.parent_id
                        FROM tbl_reports_userrights ur
                        LEFT JOIN [${userPortalDB}].[dbo].[tbl_AppMenu] m ON m.id = ur.menu_id
                        WHERE ur.user_type_id = @user_type_id
                        ORDER BY m.name
                    `);
                }

                // 3. Fallback: check tbl_reports_userrights joined with tbl_Users
                if (!utResult.recordset || utResult.recordset.length === 0) {
                    utResult = await utReq.query(`
                        SELECT DISTINCT
                            @user_type_id AS user_type_id,
                            ur.menu_id,
                            m.name AS MenuName,
                            m.menu_type,
                            m.url,
                            m.parent_id
                        FROM tbl_reports_userrights ur
                        INNER JOIN tbl_Users u ON u.UserId = ur.user_id
                        LEFT JOIN [${userPortalDB}].[dbo].[tbl_AppMenu] m ON m.id = ur.menu_id
                        WHERE u.UserTypeId = @user_type_id
                        ORDER BY m.name
                    `);
                }

                if (utResult.recordset && utResult.recordset.length > 0) {
                    return dataFound(res, utResult.recordset);
                } else {
                    return noData(res);
                }
            }

            // CASE 2: Query rights by User (and auto-inherit for new users if not yet assigned)
            const request = req.db ? new sql.Request(req.db) : new sql.Request();

            if (uId !== null) {
                request.input('user_id', uId);
            }
            if (mId !== null) {
                request.input('menu_id', mId);
            }
            if (utId !== null) {
                request.input('user_type_id', utId);
            }

            const queryStr = `
                SELECT 
                    ur.user_id,
                    ur.menu_id,
                    ISNULL(ur.user_type_id, u.UserTypeId) AS user_type_id,
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
                ${utId !== null ? ' AND (ur.user_type_id = @user_type_id OR u.UserTypeId = @user_type_id) ' : ''}
                ORDER BY u.Name, m.name
            `;

            let result = await request.query(queryStr);

            // AUTO-INHERIT FOR NEW USERS:
            // If querying a user and no rights found in tbl_reports_userrights yet:
            if (uId !== null && (!result.recordset || result.recordset.length === 0)) {
                const userReq = (req.db ? new sql.Request(req.db) : new sql.Request())
                    .input('user_id', uId);
                const userQuery = await userReq.query(`
                    SELECT UserId, UserTypeId FROM tbl_Users WHERE UserId = @user_id AND UDel_Flag = 0
                `);

                if (userQuery.recordset && userQuery.recordset.length > 0 && userQuery.recordset[0].UserTypeId) {
                    const assignedUserTypeId = Number(userQuery.recordset[0].UserTypeId);

                    const autoAssignReq = (req.db ? new sql.Request(req.db) : new sql.Request())
                        .input('target_user_id', uId)
                        .input('user_type_id', assignedUserTypeId);

                    await autoAssignReq.query(`
                        -- 1. Try copying from tbl_reports_usertype_rights
                        IF EXISTS (SELECT 1 FROM tbl_reports_usertype_rights WHERE user_type_id = @user_type_id)
                        BEGIN
                            INSERT INTO tbl_reports_userrights (user_id, menu_id, user_type_id)
                            SELECT @target_user_id, menu_id, @user_type_id
                            FROM tbl_reports_usertype_rights
                            WHERE user_type_id = @user_type_id;
                        END
                        -- 2. Fallback: copy from existing users of this UserType
                        ELSE IF EXISTS (
                            SELECT 1 FROM tbl_reports_userrights ur 
                            INNER JOIN tbl_Users u ON u.UserId = ur.user_id 
                            WHERE u.UserTypeId = @user_type_id OR ur.user_type_id = @user_type_id
                        )
                        BEGIN
                            INSERT INTO tbl_reports_userrights (user_id, menu_id, user_type_id)
                            SELECT DISTINCT @target_user_id, ur.menu_id, @user_type_id
                            FROM tbl_reports_userrights ur
                            INNER JOIN tbl_Users u ON u.UserId = ur.user_id
                            WHERE u.UserTypeId = @user_type_id OR ur.user_type_id = @user_type_id;
                        END
                    `);

                    // Re-query now that rights have been automatically populated for the new user
                    result = await request.query(queryStr);
                }
            }

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
        const { user_id, menu_id, menu_ids, user_type_id } = req.body;

        if (!checkIsNumber(user_id)) {
            return invalidInput(res, 'Valid user_id is required');
        }

        await ensureTable(req);

        const uId = Number(user_id);
        const transaction = new sql.Transaction(req.db || undefined);

        try {
            await transaction.begin();

            let resolvedUserTypeId = checkIsNumber(user_type_id) ? Number(user_type_id) : null;
            if (resolvedUserTypeId === null) {
                const uReq = new sql.Request(transaction).input('u_id', uId);
                const uRes = await uReq.query('SELECT UserTypeId FROM tbl_Users WHERE UserId = @u_id');
                if (uRes.recordset?.length > 0 && uRes.recordset[0].UserTypeId) {
                    resolvedUserTypeId = Number(uRes.recordset[0].UserTypeId);
                }
            }

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
                    .input('menu_id', mId)
                    .input('user_type_id', resolvedUserTypeId);

                await reqInsert.query(`
                    IF NOT EXISTS (SELECT 1 FROM tbl_reports_userrights WHERE user_id = @user_id AND menu_id = @menu_id)
                    BEGIN
                        INSERT INTO tbl_reports_userrights (user_id, menu_id, user_type_id) VALUES (@user_id, @menu_id, @user_type_id);
                    END
                    ELSE
                    BEGIN
                        UPDATE tbl_reports_userrights 
                        SET user_type_id = @user_type_id 
                        WHERE user_id = @user_id AND menu_id = @menu_id;
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
    // Body: { user_id, user_type_id, menu_ids: [...], user_ids: [...] }
    const updateReportsUserRights = async (req, res) => {
        const { user_id, user_type_id, menu_ids, user_ids } = req.body;

        const hasUserId = checkIsNumber(user_id);
        const hasUserTypeId = checkIsNumber(user_type_id);

        if (!hasUserId && !hasUserTypeId) {
            return invalidInput(res, 'Valid user_id or user_type_id is required');
        }

        if (!Array.isArray(menu_ids)) {
            return invalidInput(res, 'menu_ids array is required');
        }

        await ensureTable(req);

        const targetMenuIds = menu_ids.map(Number).filter(id => !isNaN(id));
        const transaction = new sql.Transaction(req.db || undefined);

        try {
            await transaction.begin();

            // 1. If user_type_id is provided, save to tbl_reports_usertype_rights AND update users
            if (hasUserTypeId) {
                const utId = Number(user_type_id);

                // Update tbl_reports_usertype_rights
                const deleteUtReq = new sql.Request(transaction).input('user_type_id', utId);
                await deleteUtReq.query('DELETE FROM tbl_reports_usertype_rights WHERE user_type_id = @user_type_id');

                for (const mId of targetMenuIds) {
                    const insertUtReq = new sql.Request(transaction)
                        .input('user_type_id', utId)
                        .input('menu_id', mId);
                    await insertUtReq.query('INSERT INTO tbl_reports_usertype_rights (user_type_id, menu_id) VALUES (@user_type_id, @menu_id)');
                }

                // If user_ids array is explicitly passed (e.g. from UI Collective Mode selection):
                if (Array.isArray(user_ids) && user_ids.length > 0) {
                    const targetUserIds = user_ids.map(Number).filter(id => !isNaN(id));
                    for (const uId of targetUserIds) {
                        const delUserReq = new sql.Request(transaction).input('u_id', uId);
                        await delUserReq.query('DELETE FROM tbl_reports_userrights WHERE user_id = @u_id');

                        for (const mId of targetMenuIds) {
                            const insUserReq = new sql.Request(transaction)
                                .input('user_id', uId)
                                .input('menu_id', mId)
                                .input('user_type_id', utId);
                            await insUserReq.query('INSERT INTO tbl_reports_userrights (user_id, menu_id, user_type_id) VALUES (@user_id, @menu_id, @user_type_id)');
                        }
                    }
                } else if (!hasUserId) {
                    // Update all current users matching this user_type_id in tbl_reports_userrights
                    const updateAllReq = new sql.Request(transaction).input('user_type_id', utId);
                    await updateAllReq.query(`
                        DELETE ur
                        FROM tbl_reports_userrights ur
                        INNER JOIN tbl_Users u ON u.UserId = ur.user_id
                        WHERE u.UserTypeId = @user_type_id OR ur.user_type_id = @user_type_id;

                        INSERT INTO tbl_reports_userrights (user_id, menu_id, user_type_id)
                        SELECT u.UserId, utr.menu_id, @user_type_id
                        FROM tbl_Users u
                        CROSS JOIN tbl_reports_usertype_rights utr
                        WHERE u.UserTypeId = @user_type_id AND utr.user_type_id = @user_type_id AND u.UDel_Flag = 0;
                    `);
                }
            }

            // 2. If specific user_id is provided, update that user's rights
            if (hasUserId) {
                const uId = Number(user_id);
                let resolvedUserTypeId = hasUserTypeId ? Number(user_type_id) : null;

                if (resolvedUserTypeId === null) {
                    const uReq = new sql.Request(transaction).input('u_id', uId);
                    const uRes = await uReq.query('SELECT UserTypeId FROM tbl_Users WHERE UserId = @u_id');
                    if (uRes.recordset?.length > 0 && uRes.recordset[0].UserTypeId) {
                        resolvedUserTypeId = Number(uRes.recordset[0].UserTypeId);
                    }
                }

                const deleteReq = new sql.Request(transaction).input('user_id', uId);
                await deleteReq.query('DELETE FROM tbl_reports_userrights WHERE user_id = @user_id');

                for (const mId of targetMenuIds) {
                    const insertReq = new sql.Request(transaction)
                        .input('user_id', uId)
                        .input('menu_id', mId)
                        .input('user_type_id', resolvedUserTypeId);
                    await insertReq.query('INSERT INTO tbl_reports_userrights (user_id, menu_id, user_type_id) VALUES (@user_id, @menu_id, @user_type_id)');
                }
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
    // Body or Query: user_id, menu_id (optional), user_type_id (optional)
    const deleteReportsUserRights = async (req, res) => {
        try {
            await ensureTable(req);

            const user_id = req.query.user_id || req.body.user_id;
            const user_type_id = req.query.user_type_id || req.body.user_type_id;
            const menu_id = req.query.menu_id || req.body.menu_id;

            const hasUserId = checkIsNumber(user_id);
            const hasUserTypeId = checkIsNumber(user_type_id);

            if (!hasUserId && !hasUserTypeId) {
                return invalidInput(res, 'Valid user_id or user_type_id is required');
            }

            const mId = menu_id ? Number(menu_id) : null;
            const request = req.db ? new sql.Request(req.db) : new sql.Request();

            if (hasUserId) {
                request.input('user_id', Number(user_id));
                if (mId !== null) {
                    request.input('menu_id', mId);
                    await request.query('DELETE FROM tbl_reports_userrights WHERE user_id = @user_id AND menu_id = @menu_id');
                } else {
                    await request.query('DELETE FROM tbl_reports_userrights WHERE user_id = @user_id');
                }
            } else if (hasUserTypeId) {
                const utId = Number(user_type_id);
                request.input('user_type_id', utId);
                if (mId !== null) {
                    request.input('menu_id', mId);
                    await request.query(`
                        DELETE FROM tbl_reports_usertype_rights WHERE user_type_id = @user_type_id AND menu_id = @menu_id;
                        DELETE FROM tbl_reports_userrights WHERE user_type_id = @user_type_id AND menu_id = @menu_id;
                    `);
                } else {
                    await request.query(`
                        DELETE FROM tbl_reports_usertype_rights WHERE user_type_id = @user_type_id;
                        DELETE FROM tbl_reports_userrights WHERE user_type_id = @user_type_id;
                    `);
                }
            }

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
