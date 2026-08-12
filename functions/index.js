const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

// HTTP function to finalize a game and compute leaderboard
exports.finalizeGame = functions.https.onRequest(async (req, res) => {
  try{
    const gameId = req.query.gameId || req.body.gameId;
    if(!gameId) return res.status(400).send('gameId required');

    const gameRef = db.collection('games').doc(gameId);
    const gameSnap = await gameRef.get();
    if(!gameSnap.exists) return res.status(404).send('game not found');

    const answersSnap = await gameRef.collection('answers').get();
    const playersSnap = await gameRef.collection('players').get();

    const players = {};
    playersSnap.forEach(p=>{ players[p.id] = { id: p.id, pseudo: p.data().pseudo || 'joueur', score: 0, totalTime: 0 }});

    answersSnap.forEach(a=>{
      const d = a.data();
      if(!players[d.playerId]) players[d.playerId] = { id: d.playerId, pseudo: 'joueur', score:0, totalTime:0 };
      players[d.playerId].score += d.awarded || 0;
      players[d.playerId].totalTime += d.timeUsed || 0;
    });

    const leaderboard = Object.values(players).sort((a,b)=>{ if(b.score!==a.score) return b.score-a.score; return a.totalTime - b.totalTime; });

    await gameRef.collection('meta').doc('leaderboard').set({ updatedAt: admin.firestore.FieldValue.serverTimestamp(), leaderboard });
    await gameRef.update({ 'settings.status': 'finished', 'settings.finishedAt': admin.firestore.FieldValue.serverTimestamp() });

    return res.json({ ok:true, leaderboard });
  }catch(err){ console.error(err); return res.status(500).send(err.message); }
});
