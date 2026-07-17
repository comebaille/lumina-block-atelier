# LUMINA — Atelier de cristaux

Un puzzle de blocs 8×8 original, pensé d’abord pour mobile et installé comme une app. LUMINA transforme la boucle « poser, compléter, effacer » en atelier de cristal nocturne : fragments irisés, verre profond, combos lumineux et retours tactiles.

## Jouer en local

```bash
npm install
npm start
```

Puis ouvrir `http://127.0.0.1:4173/`.

## Contrôles

- Mobile : toucher une pièce puis une case, ou glisser la pièce sur la grille.
- Ordinateur : clic/survol, ou Tab puis flèches dans la grille.
- Objectif : remplir une ligne ou une colonne complète ; les deux peuvent être effacées en un seul mouvement.

La partie, le record, les réglages et l’objectif quotidien sont sauvegardés localement. Son, vibrations, mouvements réduits et contraste renforcé sont réglables.

## Installer sur mobile

- iPhone/iPad : ouvrir le lien dans Safari → Partager → **Sur l’écran d’accueil**.
- Android : ouvrir le lien dans Chrome → menu → **Installer l’application** ou **Ajouter à l’écran d’accueil**.

## Qualité et provenance

- `npm run verify` lance les contrôles statiques, unitaires, visuels et d’accessibilité.
- `asset-manifest.json` trace l’image générée, ses dérivés et chaque composant visuel important.
- `ARCHITECTURE.md` documente les modules et les entrées.
- `TESTING.md` détaille les tailles d’écran et parcours testés.

## Positionnement

LUMINA est un hommage original au genre du block puzzle mobile. Le nom, l’identité, l’interface, le code et les assets sont originaux ; aucun asset ou branding de Bloc Blast n’est repris.

Licence du code : MIT.
