import express from 'express';
import { getSalesInvoice } from '../controller/Sales/salesInvoice/salesInvoceCrud.mjs';
import salesInvoice from '../controller/Sales/salesInvoice.mjs';

const SalesRouter = express.Router();

SalesRouter.get('/salesFilterDropdown', salesInvoice.getMobileReportDropdowns);
SalesRouter.get('/salesInvoice', getSalesInvoice);

export default SalesRouter;