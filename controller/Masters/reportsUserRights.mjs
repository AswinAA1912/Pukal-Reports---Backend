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
            IF OBJECT_ID('tbl_AppMenu_UserRights') IS NULL
            BEGIN
                CREATE TABLE tbl_AppMenu_UserRights (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    UserId INT NOT NULL,
                    MenuId INT NOT NULL,
                    Read_Rights INT DEFAULT 1,
                    Add_Rights INT DEFAULT 1,
                    Edit_Rights INT DEFAULT 1,
                    Delete_Rights INT DEFAULT 1,
                    Print_Rights INT DEFAULT 1,
                    EntryAt DATETIME DEFAULT GETDATE()
                );
            END

            IF OBJECT_ID('tbl_AppMenu_UserTypeRights') IS NULL
            BEGIN
                CREATE TABLE tbl_AppMenu_UserTypeRights (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    UserTypeId INT NOT NULL,
                    MenuId INT NOT NULL,
                    Read_Rights INT DEFAULT 1,
                    Add_Rights INT DEFAULT 1,
                    Edit_Rights INT DEFAULT 1,
                    Delete_Rights INT DEFAULT 1,
                    Print_Rights INT DEFAULT 1,
                    EntryAt DATETIME DEFAULT GETDATE()
                );
            END

            -- One-time sync from legacy tbl_reports_userrights if present
            IF OBJECT_ID('tbl_reports_userrights') IS NOT NULL
            BEGIN
                INSERT INTO tbl_AppMenu_UserRights (UserId, MenuId, Read_Rights, Add_Rights, Edit_Rights, Delete_Rights, Print_Rights, EntryAt)
                SELECT r.user_id, r.menu_id, 1, 1, 1, 1, 1, GETDATE()
                FROM tbl_reports_userrights r
                WHERE NOT EXISTS (
                    SELECT 1 FROM tbl_AppMenu_UserRights u WHERE u.UserId = r.user_id AND u.MenuId = r.menu_id
                );
            END

            -- One-time sync from legacy tbl_reports_usertype_rights if present
            IF OBJECT_ID('tbl_reports_usertype_rights') IS NOT NULL
            BEGIN
                INSERT INTO tbl_AppMenu_UserTypeRights (UserTypeId, MenuId, Read_Rights, Add_Rights, Edit_Rights, Delete_Rights, Print_Rights, EntryAt)
                SELECT r.user_type_id, r.menu_id, 1, 1, 1, 1, 1, GETDATE()
                FROM tbl_reports_usertype_rights r
                WHERE NOT EXISTS (
                    SELECT 1 FROM tbl_AppMenu_UserTypeRights u WHERE u.UserTypeId = r.user_type_id AND u.MenuId = r.menu_id
                );
            END
        `);
    } catch (err) {
        console.warn('ensureTable tbl_AppMenu_UserRights warning:', err.message);
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

                // 1. Check tbl_AppMenu_UserTypeRights first
                let utResult = await utReq.query(`
                    SELECT 
                        utr.UserTypeId AS user_type_id,
                        utr.UserTypeId,
                        utr.MenuId AS menu_id,
                        utr.MenuId,
                        COALESCE(utr.Read_Rights, 1) AS Read_Rights,
                        COALESCE(utr.Add_Rights, 1) AS Add_Rights,
                        COALESCE(utr.Edit_Rights, 1) AS Edit_Rights,
                        COALESCE(utr.Delete_Rights, 1) AS Delete_Rights,
                        COALESCE(utr.Print_Rights, 1) AS Print_Rights,
                        m.name AS MenuName,
                        m.menu_type,
                        m.url,
                        m.parent_id
                    FROM tbl_AppMenu_UserTypeRights utr
                    LEFT JOIN [${userPortalDB}].[dbo].[tbl_AppMenu] m ON m.id = utr.MenuId
                    WHERE utr.UserTypeId = @user_type_id
                      AND (utr.Read_Rights = 1 OR utr.Read_Rights IS NULL)
                    ORDER BY m.name
                `);

                // 2. Fallback: check tbl_AppMenu_UserRights joined with tbl_Users
                if (!utResult.recordset || utResult.recordset.length === 0) {
                    utResult = await utReq.query(`
                        SELECT DISTINCT
                            @user_type_id AS user_type_id,
                            @user_type_id AS UserTypeId,
                            ur.MenuId AS menu_id,
                            ur.MenuId,
                            1 AS Read_Rights,
                            1 AS Add_Rights,
                            1 AS Edit_Rights,
                            1 AS Delete_Rights,
                            1 AS Print_Rights,
                            m.name AS MenuName,
                            m.menu_type,
                            m.url,
                            m.parent_id
                        FROM tbl_AppMenu_UserRights ur
                        INNER JOIN tbl_Users u ON u.UserId = ur.UserId
                        LEFT JOIN [${userPortalDB}].[dbo].[tbl_AppMenu] m ON m.id = ur.MenuId
                        WHERE u.UserTypeId = @user_type_id
                          AND (ur.Read_Rights = 1 OR ur.Read_Rights IS NULL)
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
                    ur.UserId AS user_id,
                    ur.UserId,
                    ur.MenuId AS menu_id,
                    ur.MenuId,
                    ISNULL(u.UserTypeId, 0) AS user_type_id,
                    ISNULL(u.UserTypeId, 0) AS UserTypeId,
                    u.Name AS UserName,
                    u.UserName AS UserLoginName,
                    m.name AS MenuName,
                    m.menu_type,
                    m.url,
                    m.parent_id,
                    COALESCE(ur.Read_Rights, 1) AS Read_Rights,
                    COALESCE(ur.Add_Rights, 1) AS Add_Rights,
                    COALESCE(ur.Edit_Rights, 1) AS Edit_Rights,
                    COALESCE(ur.Delete_Rights, 1) AS Delete_Rights,
                    COALESCE(ur.Print_Rights, 1) AS Print_Rights
                FROM tbl_AppMenu_UserRights ur
                LEFT JOIN tbl_Users u ON u.UserId = ur.UserId
                LEFT JOIN [${userPortalDB}].[dbo].[tbl_AppMenu] m ON m.id = ur.MenuId
                WHERE 1 = 1
                  AND (ur.Read_Rights = 1 OR ur.Read_Rights IS NULL)
                ${uId !== null ? ' AND ur.UserId = @user_id ' : ''}
                ${mId !== null ? ' AND ur.MenuId = @menu_id ' : ''}
                ${utId !== null ? ' AND u.UserTypeId = @user_type_id ' : ''}
                ORDER BY u.Name, m.name
            `;

            let result = await request.query(queryStr);

            // AUTO-INHERIT FOR NEW USERS:
            // If querying a user and no rights found in tbl_AppMenu_UserRights yet:
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
                        -- 1. Try copying from tbl_AppMenu_UserTypeRights
                        IF EXISTS (SELECT 1 FROM tbl_AppMenu_UserTypeRights WHERE UserTypeId = @user_type_id AND (Read_Rights = 1 OR Read_Rights IS NULL))
                        BEGIN
                            INSERT INTO tbl_AppMenu_UserRights (UserId, MenuId, Read_Rights, Add_Rights, Edit_Rights, Delete_Rights, Print_Rights, EntryAt)
                            SELECT @target_user_id, MenuId, ISNULL(Read_Rights, 1), ISNULL(Add_Rights, 1), ISNULL(Edit_Rights, 1), ISNULL(Delete_Rights, 1), ISNULL(Print_Rights, 1), GETDATE()
                            FROM tbl_AppMenu_UserTypeRights
                            WHERE UserTypeId = @user_type_id AND (Read_Rights = 1 OR Read_Rights IS NULL);
                        END
                        -- 2. Fallback: copy from existing users of this UserType
                        ELSE IF EXISTS (
                            SELECT 1 FROM tbl_AppMenu_UserRights ur 
                            INNER JOIN tbl_Users u ON u.UserId = ur.UserId 
                            WHERE u.UserTypeId = @user_type_id AND (ur.Read_Rights = 1 OR ur.Read_Rights IS NULL)
                        )
                        BEGIN
                            INSERT INTO tbl_AppMenu_UserRights (UserId, MenuId, Read_Rights, Add_Rights, Edit_Rights, Delete_Rights, Print_Rights, EntryAt)
                            SELECT DISTINCT @target_user_id, ur.MenuId, 1, 1, 1, 1, 1, GETDATE()
                            FROM tbl_AppMenu_UserRights ur
                            INNER JOIN tbl_Users u ON u.UserId = ur.UserId
                            WHERE u.UserTypeId = @user_type_id AND (ur.Read_Rights = 1 OR ur.Read_Rights IS NULL);
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

        const hasUserId = checkIsNumber(user_id);
        const hasUserTypeId = checkIsNumber(user_type_id);

        if (!hasUserId && !hasUserTypeId) {
            return invalidInput(res, 'Valid user_id or user_type_id is required');
        }

        await ensureTable(req);

        const targetMenuIds = Array.isArray(menu_ids)
            ? menu_ids.map(Number).filter(id => !isNaN(id))
            : (checkIsNumber(menu_id) ? [Number(menu_id)] : []);

        if (targetMenuIds.length === 0) {
            return invalidInput(res, 'menu_id or menu_ids array is required');
        }

        const transaction = new sql.Transaction(req.db || undefined);

        try {
            await transaction.begin();

            if (hasUserId) {
                const uId = Number(user_id);
                for (const mId of targetMenuIds) {
                    const reqUpsert = new sql.Request(transaction)
                        .input('user_id', uId)
                        .input('menu_id', mId);

                    await reqUpsert.query(`
                        IF NOT EXISTS (SELECT 1 FROM tbl_AppMenu_UserRights WHERE UserId = @user_id AND MenuId = @menu_id)
                        BEGIN
                            INSERT INTO tbl_AppMenu_UserRights 
                                (UserId, MenuId, Read_Rights, Add_Rights, Edit_Rights, Delete_Rights, Print_Rights, EntryAt)
                            VALUES 
                                (@user_id, @menu_id, 1, 1, 1, 1, 1, GETDATE());
                        END
                        ELSE
                        BEGIN
                            UPDATE tbl_AppMenu_UserRights 
                            SET Read_Rights = 1, Add_Rights = 1, Edit_Rights = 1, Delete_Rights = 1, Print_Rights = 1, EntryAt = GETDATE()
                            WHERE UserId = @user_id AND MenuId = @menu_id;
                        END
                    `);
                }
            } else if (hasUserTypeId) {
                const utId = Number(user_type_id);
                for (const mId of targetMenuIds) {
                    const reqUpsert = new sql.Request(transaction)
                        .input('user_type_id', utId)
                        .input('menu_id', mId);

                    await reqUpsert.query(`
                        IF NOT EXISTS (SELECT 1 FROM tbl_AppMenu_UserTypeRights WHERE UserTypeId = @user_type_id AND MenuId = @menu_id)
                        BEGIN
                            INSERT INTO tbl_AppMenu_UserTypeRights 
                                (UserTypeId, MenuId, Read_Rights, Add_Rights, Edit_Rights, Delete_Rights, Print_Rights, EntryAt)
                            VALUES 
                                (@user_type_id, @menu_id, 1, 1, 1, 1, 1, GETDATE());
                        END
                        ELSE
                        BEGIN
                            UPDATE tbl_AppMenu_UserTypeRights 
                            SET Read_Rights = 1, Add_Rights = 1, Edit_Rights = 1, Delete_Rights = 1, Print_Rights = 1, EntryAt = GETDATE()
                            WHERE UserTypeId = @user_type_id AND MenuId = @menu_id;
                        END
                    `);
                }
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

            // 1. If user_type_id is provided, save to tbl_AppMenu_UserTypeRights AND update users
            if (hasUserTypeId) {
                const utId = Number(user_type_id);

                // Delete old rights from tbl_AppMenu_UserTypeRights
                const deleteUtReq = new sql.Request(transaction).input('user_type_id', utId);
                await deleteUtReq.query('DELETE FROM tbl_AppMenu_UserTypeRights WHERE UserTypeId = @user_type_id');

                // Insert new rights into tbl_AppMenu_UserTypeRights
                for (const mId of targetMenuIds) {
                    const insertUtReq = new sql.Request(transaction)
                        .input('user_type_id', utId)
                        .input('menu_id', mId);
                    await insertUtReq.query(`
                        INSERT INTO tbl_AppMenu_UserTypeRights 
                            (UserTypeId, MenuId, Read_Rights, Add_Rights, Edit_Rights, Delete_Rights, Print_Rights, EntryAt) 
                        VALUES 
                            (@user_type_id, @menu_id, 1, 1, 1, 1, 1, GETDATE())
                    `);
                }

                // If user_ids array is explicitly passed (e.g. from UI Collective Mode selection):
                if (Array.isArray(user_ids) && user_ids.length > 0) {
                    const targetUserIds = user_ids.map(Number).filter(id => !isNaN(id));
                    for (const uId of targetUserIds) {
                        const delUserReq = new sql.Request(transaction).input('u_id', uId);
                        await delUserReq.query('DELETE FROM tbl_AppMenu_UserRights WHERE UserId = @u_id');

                        for (const mId of targetMenuIds) {
                            const insUserReq = new sql.Request(transaction)
                                .input('user_id', uId)
                                .input('menu_id', mId);
                            await insUserReq.query(`
                                INSERT INTO tbl_AppMenu_UserRights 
                                    (UserId, MenuId, Read_Rights, Add_Rights, Edit_Rights, Delete_Rights, Print_Rights, EntryAt) 
                                VALUES 
                                    (@user_id, @menu_id, 1, 1, 1, 1, 1, GETDATE())
                            `);
                        }
                    }
                } else if (!hasUserId) {
                    // Update all current users matching this user_type_id in tbl_AppMenu_UserRights
                    const updateAllReq = new sql.Request(transaction).input('user_type_id', utId);
                    await updateAllReq.query(`
                        DELETE ur
                        FROM tbl_AppMenu_UserRights ur
                        INNER JOIN tbl_Users u ON u.UserId = ur.UserId
                        WHERE u.UserTypeId = @user_type_id;

                        INSERT INTO tbl_AppMenu_UserRights (UserId, MenuId, Read_Rights, Add_Rights, Edit_Rights, Delete_Rights, Print_Rights, EntryAt)
                        SELECT u.UserId, utr.MenuId, 1, 1, 1, 1, 1, GETDATE()
                        FROM tbl_Users u
                        CROSS JOIN tbl_AppMenu_UserTypeRights utr
                        WHERE u.UserTypeId = @user_type_id AND utr.UserTypeId = @user_type_id AND u.UDel_Flag = 0;
                    `);
                }
            }

            // 2. If specific user_id is provided, update that user's rights in tbl_AppMenu_UserRights
            if (hasUserId) {
                const uId = Number(user_id);

                const deleteReq = new sql.Request(transaction).input('user_id', uId);
                await deleteReq.query('DELETE FROM tbl_AppMenu_UserRights WHERE UserId = @user_id');

                for (const mId of targetMenuIds) {
                    const insertReq = new sql.Request(transaction)
                        .input('user_id', uId)
                        .input('menu_id', mId);
                    await insertReq.query(`
                        INSERT INTO tbl_AppMenu_UserRights 
                            (UserId, MenuId, Read_Rights, Add_Rights, Edit_Rights, Delete_Rights, Print_Rights, EntryAt) 
                        VALUES 
                            (@user_id, @menu_id, 1, 1, 1, 1, 1, GETDATE())
                    `);
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
                    await request.query('DELETE FROM tbl_AppMenu_UserRights WHERE UserId = @user_id AND MenuId = @menu_id');
                } else {
                    await request.query('DELETE FROM tbl_AppMenu_UserRights WHERE UserId = @user_id');
                }
            } else if (hasUserTypeId) {
                const utId = Number(user_type_id);
                request.input('user_type_id', utId);
                if (mId !== null) {
                    request.input('menu_id', mId);
                    await request.query(`
                        DELETE FROM tbl_AppMenu_UserTypeRights WHERE UserTypeId = @user_type_id AND MenuId = @menu_id;
                        DELETE ur 
                        FROM tbl_AppMenu_UserRights ur
                        INNER JOIN tbl_Users u ON u.UserId = ur.UserId
                        WHERE u.UserTypeId = @user_type_id AND ur.MenuId = @menu_id;
                    `);
                } else {
                    await request.query(`
                        DELETE FROM tbl_AppMenu_UserTypeRights WHERE UserTypeId = @user_type_id;
                        DELETE ur 
                        FROM tbl_AppMenu_UserRights ur
                        INNER JOIN tbl_Users u ON u.UserId = ur.UserId
                        WHERE u.UserTypeId = @user_type_id;
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
