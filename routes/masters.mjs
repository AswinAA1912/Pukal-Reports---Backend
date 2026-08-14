import express from 'express';
import retailers from '../controller/Masters/retailers.mjs';
import posRateMaster from '../controller/Masters/posRateMaster.mjs';
import godown from '../controller/Masters/godown.mjs';
import vouchertype from '../controller/Masters/vouchertype.mjs';

const MastersRouter = express.Router();

MastersRouter.get('/posRateMaster', posRateMaster.getPosRateMaster);
MastersRouter.get('/retailers/dropDown', retailers.getRetailerDropDown);
MastersRouter.get('/godown', godown.getGodown);

MastersRouter.get('/getVoucherTypes', vouchertype.getVoucherTypes);


export default MastersRouter;