# Quizz Voyage — Prototype

Prototype frontend statique pour un jeu de quiz collaboratif (admin + joueurs). Ce dépôt contient :

- `index.html` : page unique (admin / joueur)
- `script.js` : logique prototype (Firebase placeholders)
- `styles.css` : styles simples
- `sample_quiz.json` : exemple de quiz
- `prompt_instructions.txt` : consigne à coller avant le descriptif du voyage

Configuration rapide :

1. Créez un projet Firebase et activez Firestore, Storage et Authentication (Anonymous ou Email).
2. Copiez les valeurs Firebase dans `script.js` (objet `firebaseConfig`).
3. Ouvrez `index.html` dans un navigateur ou hébergez via Firebase Hosting / Netlify.

Notes : ceci est un prototype minimal. Il montre comment :

- créer une partie et stocker le quiz JSON dans Firestore
- uploader des images dans Firebase Storage
- permettre à des joueurs de rejoindre et d'écouter la question courante
- envoyer des réponses et calculer un score côté client (prototype)
- utiliser une Cloud Function prototype pour agréger le leaderboard (voir `functions/`)

Prochaines étapes possibles :

- sécuriser les opérations Firestore avec des règles adaptées (important)
- déployer les Cloud Functions (optionnel) pour agrégation et validation
- améliorer UI/UX, accessibilité et responsive design
- automatiser le déploiement via `firebase.json` et scripts

Déployer la fonction prototype (optionnel) :

Installez Firebase CLI et initialisez `functions` si nécessaire, puis :

```bash
cd functions
npm install
firebase deploy --only functions
```

Après déploiement, vous pouvez appeler la fonction HTTP `finalizeGame` pour calculer le classement final :

```bash
# Exemple avec curl
curl "https://us-central1-YOUR_PROJECT.cloudfunctions.net/finalizeGame?gameId=123456"
```

Déployer les règles de sécurité (Firestore + Storage) :

```bash
# depuis la racine du projet
firebase deploy --only firestore:rules,storage
```

Les fichiers fournis sont :

- `firestore.rules` : règles d'accès pour la collection `games`, `players`, `answers` et `meta`.
- `storage.rules` : règles d'accès pour `games/{gameId}/media/*`.

## Déploiement complet recommandé

1. Ouvrez un terminal dans le dossier `c:\Users\Lenovo\Downloads\Quizz Malta`
2. Installez les dépendances :

```bash
npm install
cd functions
npm install
cd ..
```

3. Connectez-vous à Firebase :

```bash
firebase login
```

4. Vérifiez que le projet Firebase est bien configuré dans `.firebaserc` :

```json
{
  "projects": {
    "default": "quizvoyage-9c85d"
  }
}
```

5. Déployez tout :

```bash
firebase deploy --only firestore:rules,storage,hosting,functions
```

6. Vérifiez l'URL fournie par Firebase Hosting et testez la création d'une partie.

## Checklist de déploiement

- [ ] `firebaseConfig` rempli dans `script.js`
- [ ] `.firebaserc` contient `quizvoyage-9c85d`
- [ ] `firebase login` effectué
- [ ] `npm install` lancé à la racine et dans `functions`
- [ ] `functions/serviceAccountKey.json` ajouté si vous utilisez `set-admin.js`
- [ ] `firebase deploy --only firestore:rules,storage,hosting,functions` exécuté
- [ ] page de jeu accessible et création/join testés
- [ ] admin global créé dans Firebase Auth (`adel.h.hamdi@gmail.com`)
