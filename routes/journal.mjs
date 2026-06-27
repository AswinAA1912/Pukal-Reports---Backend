import express from 'express';
import journalDependency from '../controller/Journal/journalDependency.mjs';

const JournalRouter = express.Router();

JournalRouter.get('/accountPendingReference', journalDependency.getAccountPendingReference);
JournalRouter.get('/partyOutstanding', journalDependency.partyOutstanding);

export default JournalRouter;