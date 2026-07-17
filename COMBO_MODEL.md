# Modèle de combo LUMINA

## Recherche et choix de design

La présentation officielle de Block Blast confirme la boucle glisser, remplir et effacer, mais ne publie pas de formule de score ou de combo détaillée. Les guides et retours de joueurs décrivent en plus des variantes selon la version : certains parlent d'une chaîne cassée dès une pose sans effacement, d'autres d'une tolérance de trois poses, notamment sur iOS.

LUMINA utilise donc un modèle original, explicite et stable, inspiré de ce comportement observé sans prétendre reproduire un algorithme propriétaire : le combo peut être sauvé en effaçant au plus tard sur la troisième pose suivante.

Sources consultées :

- présentation officielle : https://www.blockblast.com/about-us
- guide communautaire sur les chaînes consécutives : https://smartblockblastsolver.com/blogs/block-blast-combos
- description de la fenêtre de trois poses : https://blockblastgame.io/
- observation de joueurs sur la rupture après trois tours : https://www.reddit.com/r/blockblast/comments/1jnfuwg/

## Règles livrées

- Une pose simple rapporte **0 point**.
- Une ligne ou colonne effacée rapporte des points.
- Plusieurs lignes et colonnes effacées dans le même mouvement augmentent fortement la base : `100 × n × (n + 1) / 2`.
- Le niveau de combo augmente du nombre d'alignements effacés. Un double effacement ajoute donc 2 au combo.
- Multiplicateur : `1 + 0,5 × (combo - 1)`, plafonné à `×12`.
- Après un effacement, trois poses sont disponibles. Un nouvel effacement sur la première, deuxième ou troisième pose conserve la chaîne. Une troisième pose sans effacement la rompt.
- Une grille entièrement vidée ajoute une surcharge fixe de **2 500 points**.

| Alignements simultanés | Base avant combo |
| ---: | ---: |
| 1 | 100 |
| 2 | 300 |
| 3 | 600 |
| 4 | 1 000 |

Exemple : avec un combo 2 encore actif, effacer trois alignements produit un combo 5, un multiplicateur `×3`, puis `600 × 3 = 1 800` points.
