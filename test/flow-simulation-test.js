const fs = require('fs');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');

(async ()=>{
  const rules = fs.readFileSync('firestore.rules', 'utf8');
  const PROJECT_ID = 'quizflow-test';

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules }
  });

  // helpers
  const authed = (uid, claims={}) => {
    const token = { sub: uid, ...claims };
    return testEnv.authenticatedContext(uid, token).firestore();
  };

  try{
    // Admin creates game
    const aliceDb = authed('alice');
    const gameRef = aliceDb.collection('games').doc('G100');
    await assertSucceeds(gameRef.set({ admin: 'alice', adminUid: 'alice', quiz: { quiz:{questions:[{id:'q1', type:'mcq', correct:0}] } }, settings:{ createdAt: new Date(), status:'waiting' } }));
    console.log('Created game as alice');

    // Admin starts game
    await assertSucceeds(gameRef.update({ 'settings.status': 'started', 'settings.currentIndex': 0, 'settings.startedAt': new Date(), 'settings.numQuestions': 1 }));
    const snap = await gameRef.get();
    console.log('Game status after start:', snap.data().settings.status);

    // Player joins
    const bobDb = authed('bob');
    const playerRef = bobDb.collection('games').doc('G100').collection('players').doc('p-bob');
    await assertSucceeds(playerRef.set({ uid: 'bob', pseudo: 'Bob', score:0, totalTime:0, joinedAt: new Date() }));
    console.log('Bob joined');

    // Player submits answer
    const ansRef = bobDb.collection('games').doc('G100').collection('answers').doc('p-bob_q1');
    await assertSucceeds(ansRef.set({ playerUid: 'bob', playerId: 'p-bob', questionId: 'q1', chosenIndex:0, isCorrect:true, awarded:100, timeUsed:5, submittedAt: new Date() }));
    console.log('Bob submitted answer');

    // Verify answer exists (admin read)
    const adminRead = aliceDb.collection('games').doc('G100').collection('answers').doc('p-bob_q1');
    const aSnap = await adminRead.get();
    console.log('Answer read by admin exists:', aSnap.exists);

    console.log('Flow simulation complete.');
  }catch(e){
    console.error('Flow simulation failed', e);
  }finally{
    await testEnv.cleanup();
    process.exit(0);
  }
})();
