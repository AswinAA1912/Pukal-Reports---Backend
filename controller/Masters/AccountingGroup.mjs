import sql from 'mssql';
import { servError, sentData } from '../../res.mjs';

const AccountingGroup = () => {

    const getAccountingGroup = async (req, res) => {
        try {
            const request = new sql.Request()
                .query(`
                    SELECT * FROM tbl_Accounting_Group
                `);

            const result = await request;

            sentData(res, result.recordset);
        } catch (e) {
            servError(e, res);
        }
    };

    return {
        getAccountingGroup
    };
};

export default AccountingGroup();

