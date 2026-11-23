# Politique de confidentialité

_Oreille musicale — dernière mise à jour : 23 novembre 2026_

Oreille musicale est un logiciel libre d'entraînement de l'oreille musicale, sans compte, sans publicité et sans traceur. **Aucune donnée personnelle n'est collectée.** Si tu actives la synchronisation entre tes appareils, ta progression est chiffrée sur l'appareil avant d'être envoyée : personne d'autre que toi ne peut la lire.

## Ce qui reste sur ton appareil

- **Ta progression** : tes réponses (élément joué, réponse donnée, temps de réponse), les étapes franchies, et tes réglages (notation, objectif quotidien, rappel). Elle est enregistrée sur ton appareil : dans le stockage du navigateur pour la version web, dans celui de l'application sur Android. Elle ne le quitte que si tu actives la synchronisation, et alors chiffrée (voir plus bas).
- **Le rappel quotidien** (Android, si tu l'actives) est programmé sur le téléphone lui-même ; rien n'est envoyé à un serveur.
- **La sauvegarde** : quand tu exportes ta progression, l'appli crée un fichier que tu enregistres ou partages où tu veux. Elle n'envoie ce fichier nulle part d'elle-même.

## Synchronisation entre appareils (facultative)

Désactivée par défaut. Si tu l'actives, l'appli crée une **clé de synchronisation** que tu recopies sur tes autres appareils.

- **Ce qui est envoyé** : tes réponses, séances, étapes franchies et réglages partagés (notation, timbre, tempo, objectif, chansons repères…), **chiffrés sur l'appareil** (AES-GCM 256 bits) avec une clé tirée de ta clé de synchronisation. Le volume, le thème et le rappel restent sur chaque appareil.
- **Ce que le serveur voit** : un identifiant de dossier et l'empreinte d'un jeton d'accès, tous deux tirés de ta clé, et des blocs chiffrés illisibles, sans même leur nature. La clé elle-même ne quitte jamais tes appareils : ni nous ni personne ne peut la retrouver, ni lire tes données.
- **Hébergement** : le serveur du projet tourne chez Cloudflare (Workers et base D1). Comme pour tout service en ligne, Cloudflare peut enregistrer des données techniques de connexion (adresse IP, heure), selon sa propre [politique de confidentialité](https://www.cloudflare.com/privacypolicy/). Ni compte, ni e-mail, ni nom ne sont demandés.
- **Effacement** : la carte « Synchronisation » de l'accueil permet d'effacer tes données du serveur à tout moment. Désactiver la synchronisation sur un appareil n'efface rien.
- **Clé perdue** : les données du serveur deviennent illisibles ; celles de tes appareils restent.

## Réseau

- La **version web** est hébergée par GitHub Pages : comme pour tout site, GitHub peut enregistrer des données techniques de connexion (adresse IP, navigateur), selon sa propre [déclaration de confidentialité](https://docs.github.com/fr/site-policy/privacy-policies/github-general-privacy-statement). Sans la synchronisation, l'appli n'envoie aucune donnée.
- L'**application Android** embarque tout ce dont elle a besoin et fonctionne sans connexion (la synchronisation, si tu l'actives, se fait quand le réseau est là).
- Le **lien de dons** de l'écran « À propos » ouvre la page Ko-fi du projet dans ton navigateur. Ko-fi est un service extérieur, avec sa propre politique de confidentialité ; l'appli ne lui transmet rien.

## Ce que l'appli n'utilise pas

Ni micro, ni caméra, ni position, ni contacts, ni identifiant publicitaire, ni outil de mesure d'audience.

## Supprimer tes données

Désinstalle l'application Android, ou efface les données du site dans les réglages de ton navigateur. Pense à exporter ta progression d'abord si tu veux la garder. Si tu as activé la synchronisation, efface aussi tes données du serveur depuis la carte « Synchronisation ».

## Contact

Pour toute question : [ouvrir une discussion sur le dépôt du projet](https://github.com/DavidGiangiacomo/oreille-musicale/issues).
