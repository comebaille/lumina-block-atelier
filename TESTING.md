# Vérification professionnelle

Commande complète :

```bash
npm install
npm run verify
```

La chaîne couvre :

1. syntaxe JavaScript et intégrité des fichiers statiques ;
2. métadonnées PWA, assets locaux et budget de 250 Ko pour le fond WebP ;
3. tests unitaires du moteur avec `node:test` ;
4. manifeste de provenance et couverture visuelle ;
5. scénario réel dans Chrome à 390×844 : glisser interpolé, pose à zéro point, ligne, combo, rotation de matière, grille entièrement vidée, réglages, pause et reprise ;
6. audit axe WCAG A/AA et WCAG 2.2 AA ;
7. seuil de réponse du glisser instrumenté avec un p95 inférieur à 80 ms dans le navigateur de test ;
8. absence de débordement horizontal et captures à 360×740, 390×844, 430×932 et 900×900.

Les captures de contrôle sont écrites dans `test-results/` et restent hors Git.

## Vérifications manuelles annoncées

- tactile mobile et zones sûres ;
- lisibilité en mode contraste renforcé ;
- réduction des animations ;
- focus visible, ordre des modales et retour du focus ;
- chargement du fond, des icônes et du manifeste ;
- lisibilité des matières prisme, opale, solaire et obsidienne sur les petites cellules ;
- URL GitHub Pages et enregistrement du service worker.
