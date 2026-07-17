# Contrat de game feel

Les valeurs de réglage sont centralisées dans `GAME_FEEL` dans `src/app.js`. Le fantôme suit la cible dans une boucle `requestAnimationFrame` avec interpolation exponentielle indépendante de la fréquence d'écran. La prévisualisation logique reste immédiate : l'élégance visuelle n'ajoute donc pas de retard au placement.

## Matrice de feedback

| Événement | Visuel | Son | Haptique | Durée cible |
| --- | --- | --- | --- | ---: |
| Prise d'un fragment | source atténuée, fantôme relevé | tintement court | — | immédiat |
| Déplacement valide | suivi interpolé, cases respirantes | — | — | 1 frame |
| Déplacement invalide | fantôme désaturé, aperçu corail | erreur douce | impulsion | 320 ms |
| Pose sans ligne | arrivée élastique | pose selon la taille | impulsion courte | 340 ms |
| Ligne/colonne | flash de grille, onde, pluie d'étincelles | accord ascendant | motif triple | 470–720 ms |
| Multi-ligne | callout combo et explosion renforcée | accord enrichi | motif triple | 1 180 ms |
| Grille vide | flash global, onde large, surcharge | accord maximal | motif en cinq temps | 1 520 ms |
| Changement de matière | badge et palette lumineuse | intégré à l'accord | — | 1 050 ms |

## Instrumentation

`window.__LUMINA_TEST__.getInputMetrics()` expose les mesures `activationToFrame` et `moveToFrame` avec moyenne, p95 et maximum. Le parcours Chrome automatisé exige un p95 inférieur à 80 ms dans l'environnement de test ; l'objectif perceptif sur appareil à 60 Hz reste une réponse visible dans les deux premières images.

Le mode mouvements réduits désactive les particules et ramène le suivi visuel directement à la cible. Les vibrations et le son restent désactivables séparément.
