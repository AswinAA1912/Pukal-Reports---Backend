import express from 'express';

import AuthorizationRouter from './authorization.mjs';
import MastersRouter from './masters.mjs';
import ReportRouter from './reports.mjs';
import SalesRouter from './sales.mjs';
import PaymentRouter from './payment.mjs';
import JournalRouter from './journal.mjs';

const indexRouter = express.Router();

indexRouter.use('/authorization', AuthorizationRouter);
indexRouter.use('/masters', MastersRouter);
indexRouter.use('/sales', SalesRouter);
indexRouter.use('/reports', ReportRouter);
indexRouter.use('/payment', PaymentRouter);
indexRouter.use('/journal', JournalRouter);

export default indexRouter;