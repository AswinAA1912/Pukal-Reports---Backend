import sql from 'mssql'
import { servError, sentData } from '../../res.mjs';


const VoucherType = () => {

    const getVoucherTypes = async (req, res) => {

        try {

            const request = new sql.Request()
                .query(`
                    SELECT  Vocher_Type_Id as Value,Voucher_Type as label
                     from tbl_Voucher_Type`
                );

            const result = await request;

            sentData(res, result.recordset);

        } catch (e) {
            servError(e, res)
        }
    }


    return {
        getVoucherTypes
    }
}

export default VoucherType()