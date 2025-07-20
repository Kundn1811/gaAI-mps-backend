import admin from 'firebase-admin';
import path from 'path';

console.log("path", path.resolve(__dirname, '../../firebase-service-account.json'));
const serviceAccount = require(path.resolve(__dirname, '../../firebase-service-account.json'));

if(!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'gaaih-mps-backed' 
  });
}
export default admin;