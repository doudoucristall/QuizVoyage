const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const keyPath = path.join(__dirname, 'serviceAccountKey.json');
if(!fs.existsSync(keyPath)){
  console.error('Place your service account JSON at functions/serviceAccountKey.json');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(require('./serviceAccountKey.json')) });

async function setAdmin(email){
  try{
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(user.uid, { siteAdmin: true });
    console.log('siteAdmin claim set for', email);
    process.exit(0);
  }catch(err){
    console.error(err);
    process.exit(1);
  }
}

const email = process.argv[2] || 'adel.h.hamdi@gmail.com';
setAdmin(email);
