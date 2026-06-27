import express from 'express';
import retailers from '../controller/Masters/retailers.mjs';
import posRateMaster from '../controller/Masters/posRateMaster.mjs';

const MastersRouter = express.Router();

MastersRouter.get('/posRateMaster', posRateMaster.getPosRateMaster);
MastersRouter.get('/retailers/dropDown', retailers.getRetailerDropDown);

export default MastersRouter;