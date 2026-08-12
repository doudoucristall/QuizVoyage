const fs = require('fs');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');

(async ()=>{
  const rules = fs.readFileSync('firestore.rules', 'utf8');
  const PROJECT_ID = 'quizvoyage-test';

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules }
  });

  // Helper to get a context db. The emulator's mock token expects `sub` as the user id.
  const authedDb = (auth) => {
    if(typeof auth === 'string') return testEnv.authenticatedContext(auth, { sub: auth }).firestore();
    const { uid, ...rest } = auth || {};
    const sub = uid || rest.sub;
    const claims = { ...rest };
    if(sub) claims.sub = sub;
    return testEnv.authenticatedContext(sub, claims).firestore();
  };
  const unauthDb = () => testEnv.unauthenticatedContext().firestore();

  try{
    // 1) Unauthenticated user should NOT be able to create a game
    const unauth = unauthDb();
    const gameRef = unauth.collection('games').doc('100001');
    await assertFails(gameRef.set({ adminUid: null, quiz: {quiz:{questions:[]}}, settings: {status:'waiting'} }));
    console.log('Pass: unauthenticated cannot create game');

    // 2) Authenticated user 'alice' can create a game with adminUid == alice
    const aliceDb = authedDb({ uid: 'alice', siteAdmin: false });
    const gRefAlice = aliceDb.collection('games').doc('200002');
    await assertSucceeds(gRefAlice.set({ admin: 'alice', adminUid: 'alice', quiz: {quiz:{questions:[{id:'q1'}]}}, settings: {status:'waiting'} }));
    console.log('Pass: alice can create game with adminUid alice');

    // 3) Different user 'bob' should NOT be allowed to update alice's game
    const bobDb = authedDb({ uid: 'bob', siteAdmin: false });
    const gRefAliceAsBob = bobDb.collection('games').doc('200002');
    await assertFails(gRefAliceAsBob.update({ 'settings.status': 'started' }));
    console.log('Pass: bob cannot update alice game');

    // 4) Alice can update her game
    await assertSucceeds(gRefAlice.update({ 'settings.status': 'started', 'settings.currentIndex': 0 }));
    console.log('Pass: alice can update her game');

    // 5) siteAdmin claim can update any game
    const adminDb = authedDb({ uid: 'admin', siteAdmin: true });
    const gRefAdmin = adminDb.collection('games').doc('200002');
    await assertSucceeds(gRefAdmin.update({ 'settings.status': 'paused' }));
    console.log('Pass: siteAdmin can update');

    // 6) Player create doc: uid must equal request.resource.data.uid
    const playerRef = aliceDb.collection('games').doc('200002').collection('players').doc('p1');
    await assertSucceeds(playerRef.set({ uid: 'alice', pseudo: 'Alice', score: 0, totalTime: 0 }));
    await assertFails(playerRef.set({ uid: 'someoneelse', pseudo: 'Bad', score: 0, totalTime: 0 }));
    console.log('Pass: players create constraint enforced');

    // 7) Answers create: playerUid must match request.auth.uid
    const ansRef = aliceDb.collection('games').doc('200002').collection('answers').doc('a1');
    await assertSucceeds(ansRef.set({ playerUid: 'alice', playerId: 'p1', questionId: 'q1', awarded: 0, submittedAt: new Date() }));
    const ansRefBob = bobDb.collection('games').doc('200002').collection('answers').doc('a2');
    await assertFails(ansRefBob.set({ playerUid: 'alice', playerId: 'p1', questionId: 'q1', awarded: 0, submittedAt: new Date() }));
    console.log('Pass: answers create constraint enforced');

    console.log('\nAll rule checks completed.');
  }catch(e){
    console.error('Test failed', e);
  }finally{
    await testEnv.cleanup();
    process.exit(0);
  }
})();
