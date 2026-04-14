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

## 4. Améliorations Visuelles (Visual Polish)
*Dossier : `/public/assets/ui/fx/`*

| Nom du fichier | Description |
| :--- | :--- |
| `freeze_overlay.png` | Overlay plein écran "Givre/Statique" (quand l'équipe est gelée) |
| `attack_warning.png` | Flash rouge ou avertissement "+2/+4" (quand on reçoit des cartes) |
| `uno_button.png` | Bouton interactif stylisé pour crier "UNO !" |
| `draw_button.png` | Icône/Bouton pour piocher une carte |
| `gauge_frame.png` | Cadre décoratif/verre pour la barre d'énergie (Projecteur) |
| `cure_success.png` | Feedback visuel de réussite de scan/shake (Virus soigné) |
| `victory_banner.png` | Bannière de victoire à afficher en fin de partie |

---

## 5. Charte Graphique (Neon Palette)

Pour obtenir l'effet néon optimal, utilisez ces codes couleurs lors de la création de vos ressources :

| Type de Carte | Fond (Dark Base) | Tracé Néon (Stroke) | Éclat/Accent (Inner Fine) |
| :--- | :--- | :--- | :--- |
| **Rouge** | `#2C0B0B` | `#E74C3C` | `#FF5E5E` |
| **Bleu** | `#0B1A2C` | `#72EFF9` | `#FFFFFF` |
| **Vert** | `#0B2C14` | `#2ECC71` | `#A2FFC8` |
| **Jaune** | `#2C260B` | `#F1C40F` | `#FFFD91` |
| **Noir (Wild)** | `#0B0F19` | `#F572F7` | `#FFFFFF` |

---

## Spécifications Techniques

1.  **Format** : PNG-24 avec couche Alpha (transparence) ou SVG.
2.  **Résolution** : 
    *   Cartes : **300 x 450 px** (Ratio exact 2:3).
    *   Symboles : ~256 x 256 px (Carré).
3.  **Gestion des Arrondis (Border Radius)** :
    *   Basé sur une résolution de **300x450px** :
        *   Rayon extérieur (Bordure carte) : **30px**.
        *   Rayon intérieur (si décalage de -15px) : **15px**.
        *   Rayon contenu (si décalage de -40px) : **0px à 4px** (quasi直角).
4.  **Effets Visuels** :
    *   Utiliser le mode de fusion "Superposition" (Screen) pour les lueurs.
    *   Ajouter un "Outer Glow" de 10-20px de la couleur du tracé pour simuler le néon.
5.  **Contraste** : Le fond des cartes doit rester très sombre (`#0B0F19` ou variante foncée) pour que les symboles néons "pop" visuellement.
