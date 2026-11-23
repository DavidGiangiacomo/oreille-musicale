# Serveur de synchronisation

Serveur de la synchronisation entre appareils d'Oreille musicale (`docs/DESIGN.md`, §10.8) : un [Cloudflare Worker](https://developers.cloudflare.com/workers/) et une base [D1](https://developers.cloudflare.com/d1/).

Il ne garde que des blocs chiffrés sur l'appareil, rangés par dossier. Il ne connaît ni la clé de synchronisation, ni le contenu des enregistrements, ni même leur nature : seulement l'identifiant du dossier, l'empreinte du jeton d'accès, des identifiants opaques et des blocs illisibles. Le protocole est décrit dans [`src/sync/protocol.ts`](../src/sync/protocol.ts).

## Développement

```sh
npm ci           # dans server/ (et npm ci à la racine, pour les tests d'intégration)
npm run typecheck
npm test         # le Worker sur le SQLite de Node, et le moteur de l'appli contre lui
npm run build    # empaquetage par Wrangler, sans rien déployer
```

Pour essayer le Worker en local avec une vraie base D1 locale :

```sh
npx wrangler d1 migrations apply oreille-musicale-sync --local
npx wrangler dev
```

## Mise en ligne sur Cloudflare

À faire une seule fois. L'offre gratuite suffit : 100 000 requêtes par jour, une base de 5 Go, sans mise en pause.

1. **Créer un compte** sur [dash.cloudflare.com](https://dash.cloudflare.com/sign-up).
2. **Noter l'identifiant du compte** : page d'accueil du tableau de bord, menu « ⋯ » à côté du nom du compte → « Copy account ID » (ou dans la colonne de droite de la page « Workers & Pages »).
3. **Créer un jeton d'API** : « My Profile » → « API Tokens » → « Create Token » → modèle « Edit Cloudflare Workers », puis ajouter la permission « Account → D1 → Edit ». Le copier : il ne s'affiche qu'une fois.
4. **Dans GitHub**, Settings → Secrets and variables → Actions → onglet « Secrets » : `CLOUDFLARE_API_TOKEN` (le jeton) et `CLOUDFLARE_ACCOUNT_ID` (l'identifiant du compte).
5. **Déployer** : onglet Actions → « Serveur de synchronisation » → « Run workflow ». Le workflow retrouve la base D1 `oreille-musicale-sync`, ou la crée, met ses tables à jour, puis publie le Worker à l'adresse `https://oreille-musicale-sync.<sous-domaine>.workers.dev`. Il se relance ensuite tout seul à chaque modification du serveur sur `main`.

Ne jamais mettre le jeton d'API dans le dépôt ni le coller dans une discussion : il ne vit que dans les secrets GitHub.

## Auto-hébergement

Le serveur est libre (GPL v3 ou ultérieure), comme l'appli. Pour en héberger un autre : suivre les étapes ci-dessus sur son propre compte Cloudflare, puis indiquer l'adresse du Worker à l'appli.
