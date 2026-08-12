// Prototype script.js — remplissez firebaseConfig avec vos valeurs
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyD3Das0QRL3ReqTcihKX6KUutot1t-m-Ds",
  authDomain: "quizvoyage-9c85d.firebaseapp.com",
  projectId: "quizvoyage-9c85d",
  storageBucket: "quizvoyage-9c85d.firebasestorage.app",
  messagingSenderId: "408026881865",
  appId: "1:408026881865:web:17a05180977322584f4498",
  measurementId: "G-PKCN1V01VY"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();
const auth = firebase.auth();

function $(id){ return document.getElementById(id); }

// UI toggles
$('btnAdmin').addEventListener('click', ()=>{ showView('admin'); });
$('btnPlayer').addEventListener('click', ()=>{ showView('player'); });
$('chooseCreate').addEventListener('click', ()=>{ showView('admin'); hideEntryChoice(); });
$('chooseJoin').addEventListener('click', ()=>{ showView('player'); hideEntryChoice(); });

function hideEntryChoice(){ const e = document.getElementById('entryChoice'); if(e) e.style.display='none'; }
function showView(v){
  document.querySelectorAll('.view').forEach(el=>el.classList.add('hidden'));
  if(v==='admin') $('adminView').classList.remove('hidden');
  else $('playerView').classList.remove('hidden');
}

/* ---------------- Admin: create + start game ---------------- */
async function createGame(){
  let quizText = $('quizJson').value.trim();
  if(!quizText) return alert('Collez le JSON du quiz.');
  let quiz;
  try{ quiz = JSON.parse(quizText); }catch(e){ return alert('JSON invalide'); }

  // Require an authenticated user to create a game (prevents adminUid being null)
  if(!auth.currentUser){
    return alert('Connexion nécessaire avant de créer une partie. Réessayez après la connexion anonyme.');
  }

  const code = Math.floor(100000 + Math.random()*900000).toString();
  const gameDocRef = db.collection('games').doc(code);
  $('gameCodeArea').textContent = `Code de la partie: ${code}`;

  // upload images if any
  const files = $('imageFiles').files;
  const imagesMap = {};
  for(const f of files){
    const ref = storage.ref().child(`games/${code}/media/${f.name}`);
    await ref.put(f);
    imagesMap[f.name] = await ref.getDownloadURL();
  }

  // replace image filenames by storage URLs
  if(Array.isArray(quiz.quiz?.questions)){
    quiz.quiz.questions.forEach(q=>{
      if(Array.isArray(q.image_filenames)){
        q.image_urls = q.image_filenames.map(fn=>imagesMap[fn]||null).filter(Boolean);
      }
    });
  }

  const totalTimeSeconds = quiz.quiz.total_time_seconds || Math.max(60, (quiz.quiz.questions?.length||1)*30);

  const user = auth.currentUser;
  const adminUid = user ? user.uid : null;
  await gameDocRef.set({
    admin: $('adminPseudo').value || 'admin',
    adminUid: adminUid,
    settings: { createdAt: firebase.firestore.FieldValue.serverTimestamp(), status: 'waiting', totalTimeSeconds, currentIndex: -1 },
    quiz,
  });

  $('startGame').disabled = false;
  // build shareable link
  const base = window.location.href.split('#')[0].split('?')[0];
  const share = `${base}?game=${code}`;
  const shareBlock = document.getElementById('shareBlock');
  if(shareBlock){ shareBlock.classList.remove('hidden'); }
  const shareInput = document.getElementById('shareLink');
  if(shareInput) shareInput.value = share;
  // generate QR automatically for immediate sharing (fallback uses Google Chart API)
  const qr = document.getElementById('qrImg');
  const qrWrap = document.getElementById('qrWrap');
  if(qr && qrWrap){
    const qrUrl = 'https://chart.googleapis.com/chart?cht=qr&chs=300x300&chl=' + encodeURIComponent(share);
    qr.src = qrUrl;
    qrWrap.classList.remove('hidden');
  }
}
$('createGame').addEventListener('click', createGame);

// copy link button
const copyBtn = document.getElementById('copyLink');
if(copyBtn){ copyBtn.addEventListener('click', ()=>{ const s = document.getElementById('shareLink'); if(s){ s.select(); document.execCommand('copy'); alert('Lien copié'); } }); }

// share button (Web Share API) and QR fallback
const shareBtn = document.getElementById('shareButton');
if(shareBtn){
  shareBtn.addEventListener('click', ()=>{
    const s = document.getElementById('shareLink');
    if(!s) return;
    const url = s.value;
    // try Web Share API
    if(navigator.share){
      navigator.share({ title: document.title, text: 'Rejoignez la partie', url }).catch(()=>{});
    } else {
      // fallback: show QR and copy instructions
      const qr = document.getElementById('qrImg');
      const qrWrap = document.getElementById('qrWrap');
      if(qr && qrWrap){
        const qrUrl = 'https://chart.googleapis.com/chart?cht=qr&chs=300x300&chl=' + encodeURIComponent(url);
        qr.src = qrUrl;
        qrWrap.classList.remove('hidden');
      }
      s.select(); document.execCommand('copy'); alert('Lien copié — affichez le QR pour partager');
    }
  });
}

// Start game: set currentIndex 0 and mark start timestamp
async function startGame(){
  try{
    console.log('startGame() clicked');
    const code = ($('gameCodeArea')?.textContent || '').replace('Code de la partie: ','').trim();
    if(!code) return alert('Créez la partie d\'abord.');
    const gameRef = db.collection('games').doc(code);
    const snap = await gameRef.get();
    if(!snap.exists) return alert('Partie introuvable (vérifiez le code).');
    const numQ = snap.data()?.quiz?.questions?.length || 1;
    await gameRef.update({ 'settings.status': 'started', 'settings.currentIndex': 0, 'settings.startedAt': firebase.firestore.FieldValue.serverTimestamp(), 'settings.numQuestions': numQ });
    console.log('startGame: update réussi pour', code);
    alert('Partie démarrée');
    // disable button to avoid double-clicks
    const btn = document.getElementById('startGame'); if(btn) btn.disabled = true;
  }catch(err){
    console.error('Erreur startGame:', err);
    alert('Erreur lors du démarrage: '+(err.message||err));
  }
}
$('startGame').addEventListener('click', startGame);

/* ---------------- Player: join + listen + answer ---------------- */
let currentGameCode = null;
let currentPlayerRef = null;
let currentQuestion = null;
let questionTimer = null;

async function joinGame(){
  const code = $('joinCode').value.trim();
  const pseudo = $('playerPseudo').value.trim() || 'joueur';
  if(!code) return alert('Entrez le code.');
  currentGameCode = code;

  // create a player doc with auto id and attach uid
  const user = auth.currentUser;
  const uid = user ? user.uid : null;
  const playerRef = db.collection('games').doc(code).collection('players').doc();
  await playerRef.set({ pseudo, uid: uid, score:0, joinedAt: firebase.firestore.FieldValue.serverTimestamp(), totalTime:0 });
  currentPlayerRef = playerRef;
  $('playerArea').classList.remove('hidden');

  // listen for game changes
  db.collection('games').doc(code).onSnapshot(doc=>{
    const data = doc.data();
    if(!data) return alert('Partie introuvable.');
    const idx = data.settings?.currentIndex;
    const startedAt = data.settings?.startedAt;
    const numQ = data.settings?.numQuestions || (data.quiz?.questions?.length||1);
    const totalTime = data.settings?.totalTimeSeconds || (numQ*30);
    if(idx>=0 && data.quiz?.questions?.[idx]){
      // compute per-question time as equal split
      const questionTime = Math.ceil(totalTime / Math.max(1,numQ));
      // if newly changed question, render
      if(!currentQuestion || currentQuestion.id !== data.quiz.questions[idx].id){
        startQuestionTimer(data.quiz.questions[idx], questionTime);
      }
    }
  });
}
$('joinGame').addEventListener('click', joinGame);

function startQuestionTimer(q, questionTime){
  currentQuestion = q;
  renderQuestion(q);
  const endAt = Date.now() + questionTime*1000;
  clearInterval(questionTimer);
  questionTimer = setInterval(()=>{
    const remaining = Math.max(0, Math.round((endAt - Date.now())/1000));
    $('timer').textContent = `Temps restant: ${remaining}s`;
    if(remaining<=0){ clearInterval(questionTimer); $('timer').textContent='Temps écoulé'; }
  }, 200);
  // store question end time for scoring
  currentQuestion._endAt = endAt;
  currentQuestion._questionTime = questionTime;
}

function renderQuestion(q){
  $('questionText').textContent = q.question || '...';
  const opts = $('options'); opts.innerHTML='';
  if(q.options && q.options.length){
    q.options.forEach((o,i)=>{
      const b = document.createElement('button'); b.textContent = o; b.addEventListener('click', ()=>answer(q,i));
      opts.appendChild(b);
    });
  } else {
    const p = document.createElement('p'); p.textContent = 'Question ouverte ou autre type.'; opts.appendChild(p);
  }
}

async function answer(q, chosenIndex){
  if(!currentPlayerRef) return alert('Rejoignez la partie d\'abord');
  // compute time used
  const now = Date.now();
  const questionTime = currentQuestion._questionTime || 30;
  const remaining = Math.max(0, (currentQuestion._endAt - now)/1000);
  const timeUsed = questionTime - Math.round(remaining);

  // determine correctness
  let isCorrect = false;
  if(q.type === 'mcq' && typeof q.correct === 'number') isCorrect = (q.correct === chosenIndex);
  else if(q.type === 'tf') isCorrect = (q.correct === Boolean(chosenIndex));
  else if(q.type === 'open') isCorrect = String(q.correct||'').toLowerCase() === String(chosenIndex||'').toLowerCase();

  // compute points: base + bonus based on remaining time
  const base = q.base_points || 100;
  const timeWeight = typeof q.time_weight === 'number' ? q.time_weight : 0.3;
  const bonus = isCorrect ? Math.round(base * timeWeight * (remaining / questionTime)) : 0;
  const awarded = isCorrect ? base + bonus : 0;

  const ansId = `${currentPlayerRef.id}_${q.id}`;
  const user = auth.currentUser;
  const playerUid = user ? user.uid : null;
  const ansRef = db.collection('games').doc(currentGameCode).collection('answers').doc(ansId);
  // Write the answer only; do NOT modify player's stored score here (prevent client-side cheating).
  await ansRef.set({ playerId: currentPlayerRef.id, playerUid, questionId: q.id, chosenIndex, isCorrect, awarded, timeUsed, submittedAt: firebase.firestore.FieldValue.serverTimestamp() });

  // feedback
  alert(`Réponse enregistrée — ${isCorrect?('Correct +'+awarded+' pts'):'Incorrect'}`);
}

// Expose firebaseConfig helper for quick editing in console
window._fb = { firebaseConfig };

// Anonymous sign-in on load
auth.onAuthStateChanged(user=>{
  const status = $('authStatus');
  const adminInfo = $('adminAuthInfo');
  if(user){
    if(status) status.textContent = `Connecté (${user.isAnonymous ? 'anonyme' : user.email || user.uid})`;
    if(adminInfo) adminInfo.textContent = `UID: ${user.uid} (${user.isAnonymous? 'anonyme' : 'identifié'})`;
    // show entry choice overlay
    const e = document.getElementById('entryChoice'); if(e) e.style.display = 'flex';
    // if URL contains ?game=CODE, prefill and go to player view
    const params = new URLSearchParams(window.location.search);
    const gp = params.get('game');
    if(gp){
      const jc = document.getElementById('joinCode'); if(jc) jc.value = gp;
      showView('player'); hideEntryChoice();
    }
  } else {
    if(status) status.textContent = 'Connexion anonyme...';
    auth.signInAnonymously().catch(err=>{ if(status) status.textContent = 'Erreur auth: '+err.message; });
  }
});

// Helper: explicit anonymous sign-in button (in case automatic signInAnonymously failed)
const anonBtn = document.getElementById('btnAnonSignIn');
if(anonBtn){
  anonBtn.addEventListener('click', ()=>{
    auth.signInAnonymously().then(()=>{ alert('Tentative de connexion anonyme initiée — vérifiez le statut.'); }).catch(err=>{ alert('Erreur auth: '+err.message); });
  });
}

/* ---------------- Leaderboard (admin-side aggregation) ---------------- */
async function computeLeaderboard(){
  const code = $('gameCodeArea').textContent.replace('Code de la partie: ','').trim();
  if(!code) return alert('Créez la partie d\'abord ou entrez le code.');
  const answersSnap = await db.collection('games').doc(code).collection('answers').get();
  const players = {};
  answersSnap.forEach(a=>{
    const d = a.data();
    const pid = d.playerId || d.playerUid || 'unknown';
    if(!players[pid]) players[pid] = { pseudo: d.playerId, score:0, totalTime:0 };
    players[pid].score += d.awarded || 0;
    players[pid].totalTime += d.timeUsed || 0;
  });
  const list = Object.keys(players).map(k=>({ id:k, ...players[k]})).sort((a,b)=>{ if(b.score!==a.score) return b.score-a.score; return a.totalTime - b.totalTime; });
  const lb = $('leaderboard'); const lbList = $('leaderboardList'); lbList.innerHTML='';
  list.forEach(p=>{ const li = document.createElement('li'); li.textContent = `${p.pseudo} — ${p.score} pts — ${p.totalTime}s`; lbList.appendChild(li); });
  lb.classList.remove('hidden');
}
const computeBtn = document.getElementById('computeLeaderboard'); if(computeBtn) computeBtn.addEventListener('click', computeLeaderboard);

