import express from 'express';
import debtorsCreditors from '../controller/Payment/debtorsCreditors.mjs';

const PaymentRouter = express.Router();

PaymentRouter.get('/transactions', debtorsCreditors.getTransactions);

export default PaymentRouter;