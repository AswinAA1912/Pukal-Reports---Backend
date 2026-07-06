import sql from 'mssql';
import { AsyncLocalStorage } from 'async_hooks';

export const asyncLocalStorage = new AsyncLocalStorage();

// Intercept Request constructor
const OriginalRequest = sql.Request;
class ContextRequest extends OriginalRequest {
  constructor(connection) {
    if (connection) {
      super(connection);
    } else {
      const storeConnection = asyncLocalStorage.getStore();
      if (storeConnection) {
        super(storeConnection);
      } else {
        super();
      }
    }
  }
}
sql.Request = ContextRequest;

// Intercept Transaction constructor
const OriginalTransaction = sql.Transaction;
class ContextTransaction extends OriginalTransaction {
  constructor(connection) {
    if (connection) {
      super(connection);
    } else {
      const storeConnection = asyncLocalStorage.getStore();
      if (storeConnection) {
        super(storeConnection);
      } else {
        super();
      }
    }
  }
}
sql.Transaction = ContextTransaction;

// Intercept sql.query global function
sql.query = function (...args) {
  const req = new sql.Request();
  if (typeof args[0] === 'string') {
    return req.query(args[0], args[1]);
  }
  const values = [...args];
  const strings = values.shift();
  return req._template(strings, values, 'query');
};

// Intercept sql.batch global function
sql.batch = function (...args) {
  const req = new sql.Request();
  if (typeof args[0] === 'string') {
    return req.batch(args[0], args[1]);
  }
  const values = [...args];
  const strings = values.shift();
  return req._template(strings, values, 'batch');
};

console.log("Database Context Request/Transaction intercepts registered successfully.");
