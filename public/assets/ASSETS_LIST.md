# Liste des Ressources Graphiques (Cartes NEON-UNO)

Ce document répertorie tous les éléments graphiques nécessaires pour l'interface de jeu. Toutes les images doivent être exportées au format **PNG-24** (avec transparence) ou **SVG** pour une netteté optimale.

---

## 1. Fonds de Cartes (Backgrounds)
*Dossier : `/public/assets/cards/backgrounds/`*

| Nom du fichier | Description |
| :--- | :--- |
| `card_red.png` | Fond avec bordure néon rouge |
| `card_blue.png` | Fond avec bordure néon bleue |
| `card_green.png` | Fond avec bordure néon verte |
| `card_yellow.png` | Fond avec bordure néon jaune |
| `card_special.png` | Fond pour cartes Wild (流光 / Noir néon) |
| `card_back.png` | **Dos de la carte** (Logo NEON-UNO) |

---

## 2. Symboles Centraux (Symbols)
*Dossier : `/public/assets/cards/symbols/`*

### Chiffres (0-9)
*   `num_0.png` à `num_9.png` : Chiffres de style néon (Blanc ou couleur néon).

### Actions & Bonus
| Nom du fichier | Icône / Symbole |
| :--- | :--- |
| `action_skip.png` | Symbole "Interdiction" (Cercle barré) |
| `action_reverse.png` | Flèches de changement de sens |
| `action_draw2.png` | Texte ou symbole "+2" |
| `action_wild.png` | Roue chromatique (4 couleurs) |
| `action_draw4.png` | Texte ou symbole "+4" avec couleurs |

---

## 3. Interface Utilisateur (UI)
*Dossier : `/public/assets/ui/`*

*   `virus_overlay.png` : Effet de glitch ou "infection" numérique pour l'événement Virus.
*   `team_blue_icon.png` : Icône de l'équipe Néon Bleu.
*   `team_magenta_icon.png` : Icône de l'équipe Néon Rose (Magenta).

---

## Spécifications Techniques
1.  **Transparence** : Les symboles (`symbols/`) doivent avoir un fond transparent.
2.  **Style** : Privilégier des effets "Outer Glow" (Lueur externe) pour renforcer le côté néon.
3.  **Résolution** : 
    *   Cartes : ~300x450px
    *   Symboles : ~256x256px (Carré)
