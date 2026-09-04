import express from 'express';
import retailers from '../controller/Masters/retailers.mjs';
import posRateMaster from '../controller/Masters/posRateMaster.mjs';
import godown from '../controller/Masters/godown.mjs';
import vouchertype from '../controller/Masters/vouchertype.mjs';
import lollos from '../controller/Masters/lollos.mjs';
import users from '../controller/Masters/users.mjs';
import reportsUserRights from '../controller/Masters/reportsUserRights.mjs';
import userType from '../controller/Masters/userType.mjs';

const MastersRouter = express.Router();

MastersRouter.get('/posRateMaster', posRateMaster.getPosRateMaster);
MastersRouter.get('/retailers/dropDown', retailers.getRetailerDropDown);
MastersRouter.get('/godown', godown.getGodown);

MastersRouter.get('/getVoucherTypes', vouchertype.getVoucherTypes);
MastersRouter.get('/voucherTypes', vouchertype.getVoucherTypeDetails);
MastersRouter.get('/voucherType', vouchertype.getVoucherTypeDetails);
MastersRouter.get('/godownsWithVoucherTypes', vouchertype.getGodownsWithVoucherTypes);

MastersRouter.get('/lol', lollos.lollist);
MastersRouter.get('/los', lollos.loslist);

MastersRouter.get('/getUser', users.getUsers);
MastersRouter.get('/userdropdown', users.userDropdown);
MastersRouter.get('/userType', userType.getUserType);

MastersRouter.get('/reportsUserRights', reportsUserRights.getReportsUserRights);
MastersRouter.post('/reportsUserRights', reportsUserRights.createReportsUserRights);
MastersRouter.put('/reportsUserRights', reportsUserRights.updateReportsUserRights);
MastersRouter.delete('/reportsUserRights', reportsUserRights.deleteReportsUserRights);

export default MastersRouter;