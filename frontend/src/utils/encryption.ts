import CryptoJS from "crypto-js";

// ⚠️ Use the SAME secret key used by backend
const passwordKey="ly4@&gr$vnh905RyB>?%#@-(KSMT)"; 

export const encryptPassword = (plainText: string): string => {
  return CryptoJS.AES.encrypt(plainText, passwordKey).toString();
};
