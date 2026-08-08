import sql from 'mssql'
import { servError, sentData } from '../../res.mjs';


const Godown = () => {

    const getGodown = async (req, res) => {

        try {

            const request = new sql.Request()
                .query(`
                    SELECT 
                     * from tbl_Godown_Master`
                );

            const result = await request;

            sentData(res, result.recordset);

        } catch (e) {
            servError(e, res)
        }
    }


    return {
        getGodown
    }
}

export default Godown()