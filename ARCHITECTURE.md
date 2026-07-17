# Architecture de LUMINA

LUMINA est une PWA statique, sans dépendance runtime ni collecte de données. Cette forme réduit le coût de chargement mobile, fonctionne sur GitHub Pages et permet l’usage hors ligne après la première visite.

## Modules

- `src/engine.js` : moteur pur et testable — formes, placements, détection/effacement de lignes, génération de fragments et calcul du score.
- `src/app.js` : état de partie, interactions tactile/clic/clavier, rendu DOM, sauvegarde, objectifs, modales, installation PWA et effets visuels.
- `src/audio.js` : retours sonores synthétisés avec Web Audio ; aucun fichier audio ni requête réseau.
- `styles.css` : direction artistique, matériaux de cristaux, responsive mobile, zones sûres et modes contraste/mouvements réduits.
- `sw.js` et `manifest.webmanifest` : installation et cache hors ligne avec chemins relatifs compatibles GitHub Pages.

## État et confidentialité

La grille, le score, le record, l’objectif quotidien et les réglages restent dans `localStorage`. Aucune donnée ne quitte l’appareil. Une sauvegarde invalide est ignorée et remplacée par une partie saine.

## Entrées

- Tactile : toucher une pièce puis une case, ou glisser-déposer avec la pièce relevée au-dessus du doigt.
- Souris : sélection/clic et aperçu au survol.
- Clavier : Tab vers les pièces et la grille, flèches pour parcourir les 64 cases, Entrée/Espace pour poser.

## Identité originale

Le jeu reprend la boucle abstraite du puzzle de blocs 8×8, mais son nom, sa direction artistique, son interface, ses assets, ses effets et sa présentation sont originaux. Il ne prétend à aucune affiliation avec Bloc Blast.
