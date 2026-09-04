import sql from 'mssql'
import { servError, dataFound, noData } from '../../res.mjs';


const userTypeMaster = () => {

    const getUserType = async (req, res) => {

        try {
            const result = await sql.query('SELECT Id, UserType, Alias FROM tbl_User_Type WHERE IsActive = 1');

            if (result.recordset.length > 0) {
                dataFound(res, result.recordset)
            } else {
                noData(res)
            }

        } catch (e) {
            servError(e, res)
        }

    }


    return {
        getUserType,
    }
}

export default userTypeMaster()