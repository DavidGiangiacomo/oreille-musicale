# ADR 0001 — Jouer le son avec Web Audio, y compris dans l'appli Android

- **Statut** : accepté (essai sur téléphone réussi, issue #15)
- **Date** : 18 novembre 2026

## Contexte

L'appli existe sur le web et sur Android avec une seule base de code (`docs/DESIGN.md`, D1 et §10.1). Sur Android, elle tourne dans la WebView de Capacitor. Le son est le cœur du produit : il doit être juste, sans clic, et partir rapidement après un geste. Le document de conception identifie l'audio dans la WebView comme le premier risque technique (§13).

## Décision

Le son est produit par l'API Web Audio, sur le web comme dans l'appli Android :

- échantillons de piano décodés en mémoire, joués à la bonne hauteur par variation de vitesse de lecture ;
- toutes les notes d'une question planifiées d'un coup sur l'horloge audio ;
- compresseur-limiteur en sortie ;
- dans `MainActivity`, `setVolumeControlStream(AudioManager.STREAM_MUSIC)` pour que les touches de volume règlent le volume des médias.

L'interface `AudioEngine` (`src/audio/engine.ts`) isole ce choix : si l'essai échoue, un plugin Capacitor natif pourra la réimplémenter sans toucher au reste de l'appli.

## Vérifications déjà faites

Dans Chromium (bureau), par rendu hors ligne :

- piano et son pur ont le même niveau perçu (RMS -20 dB environ pour une note) ;
- un accord de 4 notes plafonne à -1,4 dB : pas de saturation ;
- le son démarre environ 65 ms après la commande (50 ms d'avance de planification incluses).

## Essai sur téléphone

Réalisé avec succès par le mainteneur le 18 novembre 2026, avec l'APK de test produit par la CI : chargement et justesse du piano, délai entre l'appui et le son, absence de clics, touches de volume, reprise après un passage en arrière-plan. La démonstration a aussi été validée dans Firefox et Safari (issue #14).

Pour refaire l'essai sur un autre appareil : onglet *Actions* du dépôt → workflow « Android » → dernière exécution → artefact `oreille-musicale-apk-debug`.

## Conséquences

- Un seul moteur audio à maintenir et à tester.
- Si l'essai révèle un problème (latence excessive, clics, coupures), on écrira un plugin natif derrière `AudioEngine`, et cet ADR sera remplacé.
