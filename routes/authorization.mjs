import express from 'express';
import LoginController from '../controller/Authorization/login.mjs';
import appMenu from '../controller/Authorization/appMenu.mjs';

const AuthorizationRouter = express.Router();

AuthorizationRouter.get('/userAuth', LoginController.getUserByAuth);
AuthorizationRouter.post('/login', LoginController.login);
AuthorizationRouter.post('/userPortal/login', LoginController.globalLogin);
AuthorizationRouter.get('/userPortal/accounts', LoginController.getAccountsInUserPortal);
AuthorizationRouter.get('/menuMaster', appMenu.listMenu);

export default AuthorizationRouter;