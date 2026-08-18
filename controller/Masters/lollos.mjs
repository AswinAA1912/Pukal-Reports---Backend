import sql from "mssql";
import {
    dataFound,
    noData,
    servError,
} from "../../res.mjs";

const lol = () => {

    const lollist = async (req, res) => {
        try {
            const result = await sql.query("SELECT * FROM tbl_Lol_Column");

            if (result.recordset.length) {
                dataFound(res, result.recordset);
            } else {
                noData(res);
            }
        } catch (e) {
            servError(e, res);
        }
    };

    const loslist = async (req, res) => {
        try {
            const result = await sql.query("SELECT * FROM tbl_Column_Los");

            if (result.recordset.length) {
                dataFound(res, result.recordset);
            } else {
                noData(res);
            }
        } catch (e) {
            servError(e, res);
        }
    };

    return {
        lollist,
        loslist,
    };
};

export default lol();
