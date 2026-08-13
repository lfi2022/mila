# Mila --- Product & Business Roadmap

## Stage Product Media Compliance — réalisé le 13 août 2026

Le moteur image est implémenté en refus par défaut : aucune URL marchande détectée n’est affichée
ou copiée sans autorisation explicite. Le modèle de provenance/droits, les politiques marchandes,
les fournisseurs nommés, le pipeline asynchrone protégé contre SSRF et contenus hostiles, les
visuels génériques Mila, la déclaration utilisateur, l’inventaire administratif et le retrait sont
opérationnels et testés. Les détails et limites sont consignés dans `docs/product-media/` et
`docs/assets/LICENSES.md`. Les contrats et droits propres aux marchands restent **À COMPLÉTER** et
aucune capacité image correspondante n’est activée.

> **Document vivant --- Roadmap produit, technique et business**
>
> Objectif : faire de **Mila** une plateforme de listes de naissance
> universelle, simple, moderne, sûre et rentable, puis l'étendre
> progressivement au cycle de vie familial (naissance, anniversaires,
> Noël et autres événements).
>
> **Principe directeur :** prendre les meilleures idées du marché sans
> copier leur identité, les simplifier, les améliorer et les réunir dans
> une expérience Mila cohérente.

---

## 0. Vision

Mila ne doit pas être seulement « un site pour faire une liste de
naissance ».

La vision cible est :

**Une seule liste, tous les magasins, aucun casse-tête pour les proches,
des récompenses pour les parents et une expérience qui continue après la
naissance.**

Mila doit progressivement réunir :

- liste universelle multi-enseignes ;
- cadeaux ajoutés par URL ou manuellement ;
- réservation sans compte pour les proches ;
- cadeaux neufs, d'occasion, services et cadeaux libres ;
- participations financières ;
- cagnotte/contributions via Mollie ;
- récompenses Mila financées par les revenus réels de la plateforme ;
- comparaison de prix ;
- suivi des prix ;
- messages, voix et vidéos ;
- remerciements ;
- livre souvenir ;
- co-parents ;
- confidentialité avancée ;
- parrainage ;
- SEO éditorial ;
- partenaires ;
- réutilisation pour anniversaires, Noël et autres événements.

---

---

# PRIORITÉ ABSOLUE — Sortie de Lovable et création du backend self-hosted

**Cette étape passe avant toutes les autres phases de la roadmap.**

Lovable est utilisé uniquement comme outil de génération/prototypage de l'interface actuelle.

La version de production de Mila ne doit dépendre d'aucun service propriétaire Lovable ni d'aucun backend imposé par Lovable.

## Objectif final

Après export du code :

- Mila doit fonctionner sans Lovable ;
- aucun appel runtime vers Lovable ;
- aucun service Supabase imposé ;
- aucune base Supabase ;
- aucune authentification Supabase ;
- aucun storage Supabase ;
- aucune fonction Edge Supabase ;
- aucune télémétrie Lovable nécessaire au fonctionnement ;
- aucune API Lovable ;
- aucun secret Lovable ;
- aucune dépendance obligatoire à un service externe non choisi explicitement.

Le projet doit devenir une application **self-hosted**, maîtrisée de bout en bout.

---

# A. Audit complet du code exporté de Lovable

Dès extraction du projet, effectuer un audit complet.

## Inventaire frontend

Identifier :

- framework utilisé ;
- router ;
- librairies UI ;
- Tailwind/configuration CSS ;
- gestion d'état ;
- formulaires ;
- appels API ;
- hooks custom ;
- composants générés ;
- pages ;
- routes ;
- variables d'environnement ;
- dépendances npm ;
- analytics ;
- SDK tiers ;
- code spécifique Lovable.

## Inventaire backend existant éventuel

Identifier tout ce qui utilise :

- Supabase ;
- fonctions serverless ;
- fonctions Edge ;
- RPC ;
- REST automatique ;
- auth externe ;
- storage externe ;
- webhooks ;
- fonctions cloud ;
- BaaS.

## Recherche obligatoire dans tout le repository

Rechercher notamment :

```text
lovable
supabase
SUPABASE_
VITE_SUPABASE_
createClient
@supabase
functions.invoke
storage.from
auth.
rpc(
realtime
edge-functions
lovable.dev
lovable.app
```

La liste doit être adaptée aux technologies réellement présentes.

Produire un rapport :

- fichier ;
- ligne ;
- dépendance ;
- usage ;
- niveau de criticité ;
- remplacement prévu.

---

# B. Suppression de toutes les dépendances Lovable

Après export :

- supprimer SDK Lovable éventuels ;
- supprimer instrumentation Lovable ;
- supprimer composants uniquement nécessaires à Lovable ;
- supprimer variables d'environnement Lovable ;
- supprimer callbacks Lovable ;
- supprimer domaines Lovable codés en dur ;
- supprimer toute référence de production à `lovable.app` ;
- supprimer toute dépendance de preview.

La suppression doit être faite proprement.

Ne pas casser le frontend juste pour retirer les références.

Créer une abstraction/remplacement lorsque nécessaire.

---

# B2. Audit d'architecture frontend — éviter le monolithe

Avant de créer ou connecter le nouveau backend, auditer la structure frontend exportée depuis Lovable.

L'objectif est d'éviter de conserver un frontend généré sous forme de gros blocs difficiles à maintenir.

## Vérifications obligatoires

Identifier :

- pages trop volumineuses ;
- composants dépassant une taille raisonnable ;
- composants mélangeant UI, appels API et logique métier ;
- duplication de logique ;
- hooks trop complexes ;
- état global utilisé sans nécessité ;
- appels réseau dispersés dans les composants ;
- validations dupliquées ;
- formulaires non factorisés ;
- routes directement couplées aux composants ;
- dépendances circulaires ;
- imports massifs ;
- fichiers "god component" ;
- composants avec trop de responsabilités.

## Objectif architectural

Le frontend doit tendre vers une architecture modulaire par domaine.

Exemple :

```text
src/
  app/
  routes/
  features/
    auth/
    lists/
    gifts/
    reservations/
    rewards/
    payments/
    admin/
  components/
    ui/
    shared/
  services/
    api/
  hooks/
  lib/
  types/
```

Chaque feature doit idéalement regrouper :

- composants ;
- hooks ;
- types ;
- services ;
- validations ;
- tests.

## Règles

Un composant React ne doit pas :

- contenir directement des règles financières ;
- décider des autorisations ;
- appeler directement MySQL ;
- contenir des centaines de lignes de logique métier ;
- gérer plusieurs domaines fonctionnels sans séparation.

Les appels API doivent passer par une couche centralisée.

Exemple :

```text
src/services/api/
  auth.ts
  lists.ts
  gifts.ts
  reservations.ts
  rewards.ts
  payments.ts
```

ou architecture équivalente selon le frontend réel.

## Refactor progressif

Ne pas réécrire tout le frontend uniquement pour obtenir une architecture parfaite.

Procédure :

1. auditer ;
2. identifier les zones critiques ;
3. extraire les responsabilités ;
4. ajouter des tests ;
5. connecter au nouveau backend ;
6. refactoriser les blocs réellement problématiques.

Chaque refactor important doit être isolé dans un commit clair.

## Seuil d'alerte

Lorsqu'un fichier devient manifestement trop complexe ou mélange plusieurs responsabilités, il doit être signalé dans l'audit.

Créer dans `MIGRATION_FROM_LOVABLE.md` une section :

```text
Frontend Architecture Debt
```

avec :

- fichier ;
- problème ;
- priorité ;
- refactor proposé ;
- stage cible.

# C. Suppression complète de Supabase

**Mila ne doit pas dépendre de Supabase en production.**

Si Supabase est actuellement utilisé, remplacer chaque fonction.

## Supabase Auth

Remplacer par une authentification propre au backend Mila.

Prévoir :

- users en base ;
- mots de passe hashés ;
- email verification ;
- reset password ;
- sessions ;
- refresh tokens si nécessaire ;
- protection CSRF selon architecture ;
- rate limiting ;
- brute-force protection.

Algorithmes recommandés :

- Argon2id ;
- ou bcrypt avec paramètres adaptés.

Ne jamais stocker un mot de passe en clair.

## Supabase Database

Migrer vers une base MySQL déporté.

Architecture recommandée :

- MySQL ;
- Prisma ORM ou ORM déjà choisi si pertinent ;
- migrations versionnées ;
- seed explicite ;
- backups.

## Supabase Storage

Remplacer par un stockage self-hosted ou compatible S3 choisi explicitement.

Options possibles :

- MinIO self-hosted ;
- stockage objet S3-compatible ;
- filesystem local uniquement si adapté au déploiement.

Prévoir :

- images produits ;
- couvertures ;
- uploads parents ;
- vidéos/audio futurs ;
- exports.

## Supabase Realtime

Ne pas le remplacer automatiquement si ce n'est pas nécessaire.

Pour les fonctions temps réel réellement utiles :

- WebSocket ;
- SSE ;
- Redis pub/sub ;
- polling raisonnable.

Choisir selon le besoin réel.

## Supabase Edge Functions

Chaque fonction Edge doit devenir :

- route backend ;
- service backend ;
- job worker ;
- webhook handler ;
- tâche planifiée.

---

# D. Création du backend Mila

Le backend devient la source de vérité.

Architecture cible recommandée :

```text
Frontend
   |
   v
API Mila
   |
   +--> MySQL déporté
   +--> Redis
   +--> Workers
   +--> Object Storage
   +--> Email Provider
   +--> Mollie
   +--> Affiliate Networks
```

## Stack recommandée

Si le frontend actuel est TypeScript/React, privilégier :

- Node.js ;
- TypeScript ;
- Fastify ou NestJS ;
- Prisma ;
- MySQL ;
- Redis ;
- queue worker compatible ;
- Docker.

Le choix exact doit être confirmé après audit du code exporté.

Ne pas réécrire inutilement ce qui fonctionne.

---

# E. Structure backend recommandée

```text
backend/
  src/
    modules/
      auth/
      users/
      lists/
      gifts/
      reservations/
      merchants/
      products/
      prices/
      orders/
      payments/
      mollie/
      rewards/
      referrals/
      notifications/
      admin/
      media/
      reports/
    common/
      auth/
      database/
      errors/
      validation/
      security/
      logging/
    jobs/
    workers/
    webhooks/
  prisma/
    schema.prisma
    migrations/
    seed.ts
```

Adapter cette structure au framework réellement choisi.

---

# F. API versionnée

Créer une API explicite.

Exemple :

```text
/api/v1/auth
/api/v1/users
/api/v1/lists
/api/v1/gifts
/api/v1/reservations
/api/v1/merchants
/api/v1/payments
/api/v1/rewards
/api/v1/admin
```

Éviter de mélanger logique frontend et accès direct base de données.

Le frontend ne doit jamais se connecter directement à PostgreSQL.

---

# F2. Versionnement des routes API

Le backend Mila doit utiliser un versionnement explicite des routes dès le départ.

Version initiale :

```text
/api/v1/
```

Exemples :

```text
/api/v1/auth
/api/v1/users
/api/v1/lists
/api/v1/gifts
/api/v1/reservations
/api/v1/merchants
/api/v1/orders
/api/v1/payments
/api/v1/rewards
/api/v1/admin
```

## Principe

Une nouvelle version majeure d'API ne doit être créée que lorsqu'un changement casse la compatibilité existante.

Exemple futur :

```text
/api/v2/
```

Ne pas créer `v2` uniquement pour une petite fonctionnalité additive.

## Compatibilité

Les changements suivants peuvent généralement rester dans `v1` :

- ajout d'un champ optionnel ;
- nouvelle route ;
- nouveau filtre facultatif ;
- nouveau statut compatible ;
- amélioration interne.

Créer une nouvelle version lorsqu'il faut par exemple :

- modifier fortement la structure d'une réponse ;
- supprimer un champ utilisé ;
- modifier la sémantique d'une route ;
- modifier un workflow de paiement incompatible ;
- modifier une authentification de manière cassante.

## Organisation backend

Prévoir une architecture permettant de maintenir plusieurs versions temporairement.

Exemple :

```text
src/
  api/
    v1/
      auth/
      lists/
      gifts/
    v2/
      lists/
```

ou une couche contrôleur/version selon le framework.

La logique métier commune doit rester dans des services partagés afin d'éviter de dupliquer tout le backend.

## Dépréciation

Lorsqu'une route doit être remplacée :

1. ajouter la nouvelle version ;
2. conserver l'ancienne pendant une période définie ;
3. journaliser son utilisation ;
4. avertir les clients internes ;
5. migrer le frontend ;
6. supprimer l'ancienne route dans un stage dédié.

Prévoir éventuellement des headers :

```text
Deprecation
Sunset
```

si cela devient utile.

## Frontend

Le client API frontend doit centraliser la version :

```text
API_BASE_URL=/api/v1
```

Éviter d'écrire `/api/v1` en dur dans des dizaines de composants.

## Documentation

Chaque route doit être documentée avec :

- méthode ;
- path ;
- auth ;
- permissions ;
- body ;
- response ;
- erreurs ;
- version.

OpenAPI/Swagger est recommandé si compatible avec le framework choisi.

## Git

Toute évolution de version API doit être clairement visible dans les commits.

Exemples :

```text
feat(api-v1): add gift reservation endpoint
feat(api-v1): add merchant price refresh endpoint
feat(api-v2): introduce revised contribution model
chore(api-v1): deprecate legacy contribution endpoint
```

# G. Authentification Mila

Le backend doit gérer :

## Sessions parent

- signup ;
- login ;
- logout ;
- session refresh ;
- email verification ;
- password reset.

## Visiteurs

Les proches ne créent pas de compte.

Utiliser :

- token réservation ;
- token contribution ;
- token modification ;
- expiration ;
- révocation.

## Admin

Rôles stricts :

- USER ;
- MODERATOR ;
- ADMIN ;
- SUPER_ADMIN.

Les contrôles sont côté backend.

---

# H. Base MySQL déporté

Prévoir :

- migrations ;
- indexes ;
- contraintes ;
- relations ;
- historique ;
- soft delete si nécessaire ;
- timestamps ;
- transactions.

La base doit supporter :

- utilisateurs ;
- listes ;
- cadeaux ;
- réservations ;
- marchands ;
- prix ;
- commandes ;
- paiements ;
- rewards ;
- logs.

---

# I. Redis

Redis pourra servir à :

- cache ;
- rate limiting ;
- locks ;
- queues ;
- sessions si nécessaire ;
- pub/sub ;
- déduplication ;
- idempotence temporaire.

Ne pas utiliser Redis comme source de vérité financière.

---

# J. Workers

Créer des workers indépendants pour :

- extraction produit ;
- mise à jour prix ;
- vérification stock ;
- emails ;
- notifications ;
- webhooks Mollie ;
- affiliation ;
- rewards ;
- génération média ;
- nettoyage ;
- retry.

Exemple :

```text
worker-product
worker-email
worker-payments
worker-rewards
```

Ils peuvent initialement tourner dans le même projet mais doivent être logiquement séparés.

---

# K. Stockage self-hosted

Pour éviter une dépendance Supabase Storage :

## Recommandation

MinIO ou autre stockage S3-compatible.

Buckets possibles :

```text
product-images
list-covers
user-uploads
media-messages
exports
```

Prévoir :

- URLs signées ;
- private/public ;
- expiration ;
- antivirus ;
- quotas ;
- CDN futur.

---

# L. Dockerisation complète

Créer une stack Docker reproductible.

Exemple cible :

```text
frontend
backend
worker
postgres
redis
minio
reverse-proxy
```

En développement :

`docker compose up -d`

En production :

déploiement adapté à l'infrastructure.

---

# M. Reverse proxy

Prévoir nginx, Traefik ou reverse proxy existant.

Routes :

```text
mila.domain/
mila.domain/api/
mila.domain/uploads/
```

Exemple :

- frontend -> `/`
- backend -> `/api`
- storage public contrôlé -> `/assets` ou `/uploads`

Aucun port backend sensible exposé publiquement inutilement.

---

# N. Variables d'environnement

Créer un `.env.example` complet.

Catégories :

```text
NODE_ENV=
APP_URL=
API_URL=

DATABASE_URL=

REDIS_URL=

AUTH_SECRET=
SESSION_SECRET=

SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=

STORAGE_ENDPOINT=
STORAGE_ACCESS_KEY=
STORAGE_SECRET_KEY=
STORAGE_BUCKET=

MOLLIE_API_KEY=
MOLLIE_CLIENT_ID=
MOLLIE_CLIENT_SECRET=
MOLLIE_WEBHOOK_SECRET_IF_USED=

AFFILIATE_*
```

Ne jamais :

- mettre de secrets dans Git ;
- exposer des secrets via `VITE_*` ;
- transmettre clés backend au frontend.

---

# O. Migration des données éventuelles

Si le prototype contient déjà des données Supabase à conserver :

1. exporter ;
2. mapper vers nouveau schéma ;
3. nettoyer ;
4. importer ;
5. vérifier intégrité ;
6. comparer les volumes.

Créer un script de migration reproductible.

Si les données sont uniquement de test :

ne pas complexifier inutilement.

---

# P. Migration frontend

Remplacer tous les appels directs Supabase par une couche API.

Créer par exemple :

```text
src/lib/api/
src/services/
```

Le frontend appelle uniquement :

```text
fetch('/api/v1/...')
```

ou client API centralisé.

Prévoir :

- gestion auth ;
- erreurs ;
- refresh ;
- timeout ;
- loading ;
- retry ciblé.

---

# Q. Suppression de la logique métier du frontend

Le frontend peut gérer :

- présentation ;
- validation UX ;
- état local.

Le backend décide :

- permissions ;
- montant ;
- reward ;
- réservation ;
- statut paiement ;
- rôle ;
- commission ;
- commande ;
- payout.

Ne jamais faire confiance au frontend pour une décision financière ou d'autorisation.

---

# R. Tests après extraction Lovable

Avant toute nouvelle fonctionnalité, tester :

## Public

- homepage ;
- démo ;
- liste publique ;
- réservation.

## Auth

- signup ;
- login ;
- logout ;
- reset.

## Parent

- créer liste ;
- modifier ;
- ajouter cadeau ;
- partager.

## Backend

- erreurs ;
- auth ;
- permissions ;
- validation.

## Sécurité

- accès liste autre utilisateur ;
- admin ;
- IDOR ;
- injection ;
- SSRF ;
- upload ;
- auth bypass.

---

# S. Critère de sortie de Lovable

Mila est considéré comme **indépendant de Lovable** uniquement lorsque :

- [ ] repository exporté ;
- [ ] build fonctionne localement ;
- [ ] frontend fonctionne sans Lovable ;
- [ ] backend self-hosted fonctionne ;
- [ ] MySQL déporté fonctionne ;
- [ ] auth ne dépend plus de Supabase ;
- [ ] storage ne dépend plus de Supabase ;
- [ ] aucune requête runtime Lovable ;
- [ ] aucune requête runtime Supabase ;
- [ ] domaine personnel utilisable ;
- [ ] Docker compose fonctionnel ;
- [ ] `.env.example` documenté ;
- [ ] migrations testées ;
- [ ] backups prévus ;
- [ ] tests critiques passent.

---

# T. Priorité de développement mise à jour

L'ordre devient :

## P0 — EXTRACTION / INDÉPENDANCE

1. exporter le code Lovable ;
2. audit complet ;
3. inventorier Supabase/Lovable ;
4. définir backend ;
5. créer MySQL ;
6. créer Prisma/migrations ;
7. créer API ;
8. migrer auth ;
9. migrer storage ;
10. supprimer appels Supabase ;
11. supprimer Lovable ;
12. Dockeriser ;
13. tests sécurité.

## P1 — PRODUIT CŒUR

Ensuite seulement :

- listes ;
- cadeaux ;
- réservation ;
- emails ;
- co-parent ;
- confidentialité ;
- admin.

## P2 — BUSINESS

Puis :

- merchants ;
- affiliation ;
- rewards ;
- Mollie ;
- contributions ;
- commandes.

---

# U. Livrable obligatoire de migration

Après extraction du projet, produire un document :

`MIGRATION_FROM_LOVABLE.md`

Il doit contenir :

- architecture trouvée ;
- dépendances Lovable ;
- dépendances Supabase ;
- fichiers concernés ;
- architecture cible ;
- schéma DB ;
- plan migration ;
- variables env ;
- commandes Docker ;
- migrations ;
- seed ;
- tests ;
- points bloquants ;
- éléments supprimés.

---

# V. Règle absolue

**Lovable est un outil de création, pas une dépendance de production.**

Après migration, un développeur doit pouvoir cloner Mila sur une machine neuve et lancer le projet sans compte Lovable et sans compte Supabase.

# 1. Principes produit non négociables

## 1.1 Simplicité

Un parent doit pouvoir :

1.  créer son compte ;
2.  créer sa liste ;
3.  coller un lien ;
4.  vérifier le cadeau détecté ;
5.  partager sa liste.

Un proche doit pouvoir :

1.  ouvrir le lien ;
2.  choisir un cadeau ;
3.  réserver/participer ;
4.  laisser éventuellement un message ;
5.  terminer.

**Aucun compte obligatoire pour les proches.**

## 1.2 Liberté

Mila ne doit pas enfermer les parents dans un magasin.

Une liste peut mélanger :

- Amazon ;
- IKEA ;
- boutiques bébé ;
- artisans ;
- seconde main ;
- produits sans URL ;
- services ;
- participations ;
- expériences ;
- cadeaux déjà possédés mais pour lesquels une contribution est
  souhaitée.

## 1.3 Confiance

Mila manipule des informations familiales et potentiellement de
l'argent.

La sécurité, la confidentialité et la transparence doivent donc être
traitées comme des fonctionnalités produit.

## 1.4 Rentabilité saine

Mila ne doit pas financer artificiellement des récompenses impossibles à
maintenir.

Les récompenses liées à l'affiliation doivent provenir d'une **valeur
économique réellement confirmée**.

## 1.5 Pas de faux chiffres

Aucune donnée fictive dans les dashboards de production :

- pas de faux utilisateurs ;
- pas de faux revenus ;
- pas de faux avis ;
- pas de fausses réservations ;
- pas de faux partenaires ;
- pas de faux achats.

Les données de démonstration doivent être explicitement identifiées
comme telles.

---

# 2. Positionnement

## Proposition principale

> **Tous les magasins. Une seule liste. Pour un moment unique.**

## Piliers

### Liste universelle

Tous les magasins dans une seule liste.

### Simplicité familiale

Aucun compte requis pour les proches.

### Anti-doublon

Réservation immédiate et fiable.

### Récompenses Mila

Une partie de la valeur réellement générée par Mila peut revenir aux
parents.

### Économie circulaire

Possibilité d'accepter des cadeaux d'occasion.

### Après la naissance

Messages, souvenirs, remerciements et transformation de la liste en
événement futur.

---

# 3. Architecture fonctionnelle cible

## Utilisateurs

Rôles plateforme :

- `USER`
- `MODERATOR`
- `ADMIN`
- `SUPER_ADMIN`

Rôles sur une liste :

- `OWNER`
- `CO_OWNER`
- `EDITOR`

Entités conceptuelles :

- `User`
- `List`
- `ListMember`
- `Gift`
- `GiftReservation`
- `GiftContribution`
- `Merchant`
- `MerchantOffer`
- `AffiliateClick`
- `AffiliateCommission`
- `RewardWallet`
- `RewardTransaction`
- `RewardRedemption`
- `Referral`
- `Partner`
- `PartnerCampaign`
- `Payment`
- `Refund`
- `Message`
- `MediaMessage`
- `Notification`
- `ThankYou`
- `Report`
- `AdminAuditLog`

---

# 4. Phase 0 --- Audit et durcissement de l'existant

**Priorité : CRITIQUE**

Avant d'ajouter des fonctionnalités, auditer l'application actuelle.

## Backend

- [ ] Inventorier toutes les routes API.
- [ ] Identifier les routes publiques.
- [ ] Identifier les routes authentifiées.
- [ ] Identifier les routes administrateur.
- [ ] Vérifier les contrôles d'autorisation côté serveur.
- [ ] Vérifier qu'un utilisateur ne peut jamais lire/modifier la liste
      d'un autre.
- [ ] Vérifier les contrôles `OWNER`, `CO_OWNER`, `EDITOR`.
- [ ] Auditer les validations.
- [ ] Auditer les erreurs.
- [ ] Auditer les logs.
- [ ] Vérifier le rate limiting.
- [ ] Vérifier la protection brute-force.
- [ ] Vérifier CSRF si applicable.
- [ ] Vérifier CORS.
- [ ] Vérifier les headers de sécurité.
- [ ] Vérifier la gestion des secrets.
- [ ] Vérifier les uploads.
- [ ] Vérifier les MIME types.
- [ ] Vérifier les limites de taille.
- [ ] Vérifier les tokens temporaires.
- [ ] Vérifier l'expiration des tokens.
- [ ] Vérifier l'idempotence des actions financières.

## Extraction d'URL / SSRF

- [ ] Autoriser uniquement HTTP/HTTPS.
- [ ] Bloquer `javascript:`.
- [ ] Bloquer `data:`.
- [ ] Bloquer `file:`.
- [ ] Bloquer localhost.
- [ ] Bloquer loopback IPv4/IPv6.
- [ ] Bloquer IP privées.
- [ ] Bloquer link-local.
- [ ] Bloquer metadata cloud.
- [ ] Revalider après chaque redirection HTTP.
- [ ] Limiter le nombre de redirections.
- [ ] Limiter la taille téléchargée.
- [ ] Timeout strict.
- [ ] User-Agent identifiable.
- [ ] Parser Open Graph.
- [ ] Parser JSON-LD Product.
- [ ] Parser metadata HTML.
- [ ] Sanitizer HTML.
- [ ] Ne jamais exécuter le JavaScript distant.

## Réservations

- [ ] Tester deux réservations simultanées.
- [ ] Empêcher le double booking en base.
- [ ] Utiliser transaction/contrainte atomique.
- [ ] Tester annulation.
- [ ] Tester expiration éventuelle.
- [ ] Tester passage `AVAILABLE -> RESERVED -> PURCHASED`.
- [ ] Tester mode surprise.
- [ ] Tester cadeau masqué après réservation.

## Admin

- [ ] Aucune sécurité basée uniquement sur l'interface.
- [ ] Toutes les routes admin vérifient le rôle.
- [ ] Journaliser les actions sensibles.
- [ ] Tester escalade de privilèges.
- [ ] Tester IDOR.
- [ ] Tester accès aux wallets.
- [ ] Tester accès aux paiements.

---

# 5. Phase 1 --- Cœur de Mila irréprochable

**Objectif : première bêta réellement utilisable**

## Authentification

- [ ] Inscription.
- [ ] Connexion.
- [ ] Déconnexion.
- [ ] Vérification email.
- [ ] Mot de passe oublié.
- [ ] Réinitialisation sécurisée.
- [ ] Modification profil.
- [ ] Suppression compte.
- [ ] Export des données.

## Création de liste

- [ ] Nom.
- [ ] Slug.
- [ ] Description.
- [ ] Image de couverture.
- [ ] Date prévue facultative.
- [ ] Prénom facultatif.
- [ ] Type de liste.
- [ ] Visibilité.
- [ ] Mode surprise.
- [ ] Paramètres de réservation.
- [ ] Paramètres cadeaux réservés.

## Visibilité

- [ ] `PUBLIC`
- [ ] `UNLISTED`
- [ ] `PROTECTED`

Pour `PROTECTED` :

- [ ] code/mot de passe hashé ;
- [ ] rate limiting ;
- [ ] cookie/session d'accès temporaire.

## Co-parent

- [ ] Invitation par email.
- [ ] Acceptation sécurisée.
- [ ] `OWNER`.
- [ ] `CO_OWNER`.
- [ ] `EDITOR`.
- [ ] Révocation.
- [ ] Historique.

## Ajout de cadeau par URL

Objectif UX :

> Coller → détecter → confirmer.

Extraire :

- [ ] titre ;
- [ ] image ;
- [ ] prix ;
- [ ] devise ;
- [ ] marchand ;
- [ ] description ;
- [ ] disponibilité si fiable ;
- [ ] référence produit si détectable.

Toujours permettre correction manuelle.

## Cadeau manuel

Types :

- [ ] produit ;
- [ ] service ;
- [ ] expérience ;
- [ ] cadeau libre ;
- [ ] participation ;
- [ ] cadeau d'occasion accepté.

## Liste publique

- [ ] Responsive.
- [ ] Accessible.
- [ ] Rapide.
- [ ] Image de couverture.
- [ ] Produits.
- [ ] Marchands.
- [ ] Prix.
- [ ] Statut.
- [ ] Message des parents.
- [ ] Progression facultative.
- [ ] Partage.

## Réservation sans compte

Demander le minimum :

- [ ] prénom ;
- [ ] email ;
- [ ] message facultatif.

Créer un token sécurisé permettant :

- [ ] consulter ;
- [ ] annuler ;
- [ ] modifier message ;
- [ ] indiquer acheté.

## Emails

- [ ] bienvenue ;
- [ ] vérification email ;
- [ ] reset password ;
- [ ] invitation co-parent ;
- [ ] réservation ;
- [ ] annulation ;
- [ ] cadeau acheté ;
- [ ] notification parent.

## Partage

- [ ] copier URL ;
- [ ] QR code ;
- [ ] WhatsApp ;
- [ ] email ;
- [ ] Web Share API ;
- [ ] Open Graph.

---

# 6. Phase 2 --- Marchands et affiliation

## Merchant

Chaque marchand peut avoir :

- nom ;
- domaine(s) ;
- logo ;
- actif/inactif ;
- affiliation active ;
- réseau ;
- identifiant ;
- template ;
- règles ;
- taux de récompense ;
- tracking.

## Route `/go/:token`

Flux :

1.  identifier cadeau ;
2.  identifier liste ;
3.  identifier marchand ;
4.  enregistrer clic ;
5.  appliquer affiliation si éligible ;
6.  rediriger.

Sécurité :

- [ ] token opaque ;
- [ ] destination contrôlée ;
- [ ] aucune open redirect ;
- [ ] URL originale conservée ;
- [ ] tracking respectueux de la vie privée.

## AffiliateClick

Conserver uniquement ce qui est utile :

- cadeau ;
- liste ;
- marchand ;
- timestamp ;
- campagne ;
- source ;
- référence anonyme.

## AffiliateCommission

Prévoir :

- réseau ;
- externalId ;
- clickId ;
- merchantId ;
- orderReference ;
- montant commande si disponible ;
- commission ;
- devise ;
- statut ;
- date ;
- confirmation ;
- annulation.

Statuts :

- `PENDING`
- `CONFIRMED`
- `CANCELLED`

Idempotence obligatoire sur les événements externes.

---

# 7. Phase 3 --- Récompenses Mila

## Principe

Mila ne récompense pas un clic.

Mila partage une partie d'un revenu réellement généré et vérifié, sauf
bonus explicitement financé par Mila/partenaire.

## Wallet

Un wallet par liste.

Afficher :

- disponible ;
- en attente ;
- gagné à vie ;
- utilisé à vie.

## Ledger

Chaque mouvement est une transaction.

Types :

- `AFFILIATE_COMMISSION`
- `REFERRAL`
- `PREMIUM_PURCHASE`
- `PARTNER_BONUS`
- `PROMOTIONAL_BONUS`
- `REDEMPTION`
- `ADJUSTMENT`

Statuts :

- `PENDING`
- `CONFIRMED`
- `CANCELLED`
- `EXPIRED`

## Calcul

Exemple :

Commission Mila : 5,00 € Part parents : 30 % Récompense : 1,50 €

Le taux doit être configurable :

- globalement ;
- par réseau ;
- par marchand ;
- par campagne.

## Garde-fous

- [ ] pas de float ;
- [ ] Decimal ou centimes ;
- [ ] idempotence ;
- [ ] audit ;
- [ ] plafonds ;
- [ ] aucune récompense \> revenu source sauf bonus explicite ;
- [ ] annulation possible tant que pending ;
- [ ] correction d'une transaction confirmée via transaction
      compensatrice.

## Interface parents

Carte :

**Récompenses Mila** - disponible ; - en attente ; - historique ; -
explication.

## Admin

- [ ] coût programme ;
- [ ] revenu associé ;
- [ ] marge Mila ;
- [ ] taux reversé ;
- [ ] wallets ;
- [ ] anomalies ;
- [ ] ajustements audités.

---

# 8. Phase 4 --- Paiements Mollie

**Prestataire choisi : Mollie.**

Deux usages doivent être clairement séparés.

## A. Paiements directs à Mila

Pour :

- Mila Premium ;
- produits/services vendus directement par Mila ;
- éventuellement options payantes.

Utiliser la Payments API Mollie.

Flux :

1.  créer une commande interne ;
2.  créer le paiement Mollie côté serveur ;
3.  rediriger vers checkout Mollie ;
4.  recevoir webhook ;
5.  récupérer/vérifier l'état côté serveur ;
6.  marquer payé uniquement après confirmation ;
7.  activer l'entitlement ;
8.  gérer refund/chargeback.

## B. Contributions / cagnotte destinées aux parents

**Ne pas traiter naïvement Mila comme une simple caisse qui encaisse
l'argent des proches puis effectue manuellement un virement aux
parents.**

Étudier et valider avec Mollie le modèle adapté à la plateforme avant
activation production.

Mollie Connect / Marketplaces doit être évalué pour les flux impliquant
plusieurs bénéficiaires, onboarding des comptes connectés et
routage/split des paiements.

Prévoir dans l'architecture :

- `PaymentAccount`
- `Payment`
- `PaymentRoute`
- `Contribution`
- `Refund`
- `Chargeback`

## Mollie Connect

Préparer :

- OAuth ;
- organisation connectée ;
- onboarding ;
- statut onboarding ;
- permissions ;
- routing ;
- application fees si le modèle retenu le permet ;
- webhooks ;
- refunds ;
- chargebacks.

## Webhooks Mollie

Traiter notamment :

- paiement payé ;
- paiement pending ;
- paiement échoué ;
- paiement expiré ;
- paiement annulé ;
- refund ;
- chargeback.

Règles :

- [ ] webhook idempotent ;
- [ ] ne jamais faire confiance au retour navigateur seul ;
- [ ] revérifier l'objet auprès de Mollie ;
- [ ] conserver l'identifiant Mollie ;
- [ ] journaliser sans secrets ;
- [ ] résister aux événements reçus dans le désordre.

## Moyens de paiement

Préparer une UI capable d'afficher dynamiquement les moyens réellement
activés dans Mollie, plutôt que les coder en dur.

Mila étant destiné d'abord à la Belgique/Europe, l'expérience devra être
particulièrement fluide sur mobile.

## Refund

- [ ] remboursement complet ;
- [ ] remboursement partiel ;
- [ ] état pending ;
- [ ] échec ;
- [ ] rapprochement ledger.

## Chargeback

- [ ] événement enregistré ;
- [ ] alerte admin ;
- [ ] impact comptable ;
- [ ] impact reward ;
- [ ] impact contribution ;
- [ ] journal d'audit.

## Environnements

- [ ] test ;
- [ ] production ;
- [ ] clés séparées ;
- [ ] aucun secret frontend ;
- [ ] feature flag `payments`.

---

# 9. Phase 5 --- Contributions financières

Les parents peuvent choisir pour un cadeau :

- achat complet ;
- contribution partielle ;
- contribution libre.

Exemple :

**Poussette --- 650 €** - 320 € financés - 330 € restants

## Fonctionnalités

- [ ] montant objectif ;
- [ ] montant reçu ;
- [ ] montant restant ;
- [ ] contribution libre ;
- [ ] contribution anonyme ;
- [ ] message ;
- [ ] plusieurs contributeurs ;
- [ ] clôture automatique à objectif ;
- [ ] protection dépassement ;
- [ ] remboursement.

## UX

Un proche doit comprendre clairement :

- à quoi il contribue ;
- combien ;
- qui reçoit les fonds ;
- les éventuels frais ;
- les conditions.

## Administration

- [ ] paiements ;
- [ ] contributions ;
- [ ] anomalies ;
- [ ] remboursements ;
- [ ] chargebacks ;
- [ ] rapprochement Mollie.

---

# 10. Phase 6 --- Seconde main

Chaque cadeau peut accepter :

- `NEW_ONLY`
- `SECOND_HAND_ALLOWED`
- `SECOND_HAND_PREFERRED`

Côté parent :

> Ce cadeau peut-il être offert d'occasion ?

Côté proche :

> Vous avez déjà cet objet en excellent état ?

Actions :

- [ ] proposer le sien ;
- [ ] indiquer état ;
- [ ] ajouter photo ;
- [ ] laisser commentaire ;
- [ ] parent accepte/refuse si nécessaire.

Ne pas transformer Mila immédiatement en marketplace de seconde main.

V1 = coordination entre proches et parents.

---

# 11. Phase 7 --- Suivi des prix

## PriceSnapshot

Stocker :

- giftId ;
- merchantId ;
- prix ;
- devise ;
- timestamp ;
- disponibilité.

## Affichage

- prix lors de l'ajout ;
- prix actuel ;
- baisse ;
- hausse ;
- dernière vérification.

## Alertes

Parents :

> La poussette de votre liste vient de baisser de 40 €.

Feature flags :

- `priceTracking`
- `priceAlerts`

## Respect marchand

- fréquence raisonnable ;
- cache ;
- API officielle si disponible ;
- conditions d'utilisation ;
- ne pas crawler agressivement.

---

# 12. Phase 8 --- Comparaison de prix

Créer `ProductIdentity` permettant de rapprocher plusieurs offres du
même produit.

Sources possibles :

- GTIN/EAN ;
- SKU constructeur ;
- MPN ;
- marque + modèle ;
- matching contrôlé.

## MerchantOffer

- produit ;
- marchand ;
- URL ;
- prix ;
- livraison si connue ;
- stock ;
- affiliation ;
- dernière vérification.

## UX

Option parent :

### Toujours utiliser mon magasin

ou

### Autoriser Mila à proposer une meilleure offre

Côté proche :

**Meilleure offre détectée** - Magasin A : 449 € - Magasin B : 459 € -
magasin choisi : 479 €

Ne jamais privilégier une offre uniquement parce que sa commission
affiliée est meilleure.

La pertinence utilisateur prime.

---

# 13. Phase 9 --- Parrainage

Chaque parent peut partager un code/lien.

États :

- `PENDING`
- `QUALIFIED`
- `REWARDED`
- `CANCELLED`

Conditions possibles :

- email vérifié ;
- liste créée ;
- X cadeaux ;
- première réservation ;
- premier achat éligible ;
- ancienneté.

Anti-fraude :

- pas d'auto-parrainage ;
- détection multi-comptes ;
- signaux de risque ;
- plafond ;
- revue manuelle.

Ne pas bannir simplement parce que plusieurs utilisateurs partagent une
IP.

---

# 14. Phase 10 --- Messages et souvenirs

Lors d'une réservation :

- texte ;
- audio ;
- vidéo.

## Media

Prévoir :

- taille maximale ;
- formats ;
- transcodage éventuel ;
- antivirus/scanning ;
- stockage privé ;
- URLs signées ;
- suppression.

## Livre souvenir

Après naissance :

**Le livre de bébé**

Contenu :

- messages ;
- photos autorisées ;
- vidéos ;
- cadeaux ;
- proches ;
- souvenirs.

Premium potentiel :

- export PDF ;
- version imprimable ;
- conservation longue durée ;
- thèmes.

---

# 15. Phase 11 --- Remerciements

Dashboard :

Proche Cadeau Reçu Message Remercié

---

Fonctions :

- [ ] marquer reçu ;
- [ ] marquer remercié ;
- [ ] filtrer non remerciés ;
- [ ] générer brouillon ;
- [ ] carte numérique ;
- [ ] export.

Ne pas envoyer automatiquement un message généré sans validation des
parents.

---

# 16. Phase 12 --- Mila Premium

Le cœur du produit doit rester excellent gratuitement.

## Premium potentiel

- thèmes premium ;
- personnalisation avancée ;
- galerie ;
- livre souvenir ;
- vidéo ;
- exports ;
- URL avancée ;
- statistiques avancées ;
- options de confidentialité ;
- conservation prolongée ;
- absence d'éléments promotionnels ;
- outils souvenirs.

## Pricing à tester

Favoriser un **paiement unique par événement** plutôt qu'un abonnement
imposé.

Tester différentes offres par expérimentation réelle.

## Récompenses

Permettre :

> Payer Mila Premium avec mes Récompenses Mila.

---

# 17. Phase 13 --- Partenaires

Partenaires pertinents :

- photographes ;
- boutiques bébé ;
- créateurs ;
- faire-part ;
- puériculture ;
- vêtements ;
- décoration ;
- services familiaux.

## Partner

- identité ;
- contact ;
- statut ;
- catégorie ;
- zone ;
- contrat ;
- tracking.

## Campaign

- période ;
- avantage ;
- budget ;
- conditions ;
- attribution ;
- reward parents ;
- revenu Mila.

Aucun faux partenariat affiché.

---

# 18. Phase 14 --- SEO et acquisition organique

Créer une vraie plateforme éditoriale.

## Clusters

### Listes

- liste de naissance ;
- liste naissance gratuite ;
- liste multi-enseignes ;
- que mettre sur une liste ;
- exemple liste.

### Produits

- meilleure poussette ;
- meilleur babyphone ;
- siège auto ;
- lit bébé ;
- porte-bébé.

### Budget

- cadeaux moins de 20 € ;
- 30 € ;
- 50 € ;
- 100 €.

### Guides

- indispensables naissance ;
- erreurs à éviter ;
- seconde main ;
- checklist maternité ;
- préparer arrivée bébé.

## Règles

- contenu utile ;
- pas de pages SEO vides ;
- données structurées correctes ;
- canonical ;
- sitemap ;
- Open Graph ;
- Core Web Vitals ;
- maillage interne.

## Affiliation éditoriale

Les guides peuvent contenir des liens affiliés, avec transparence.

---

# 19. Phase 15 --- Analytics produit

Funnel principal :

`homepage_view` → `signup_started` → `signup_completed` → `list_created`
→ `first_gift_added` → `list_shared` → `first_reservation` →
`first_eligible_purchase` → `first_reward`

## KPIs

- visiteurs ;
- signup conversion ;
- listes créées ;
- activation ;
- cadeaux/listes ;
- partages ;
- visites par liste ;
- réservations ;
- GMV observable ;
- commissions ;
- revenu/list ;
- coût récompenses ;
- marge ;
- premium conversion ;
- referral rate ;
- rétention.

## North Star candidates

- listes ayant reçu au moins une réservation ;
- valeur de cadeaux activement utilisée ;
- familles actives.

---

# 20. Phase 16 --- Cycle de vie familial

Architecture `List.type` :

- `BIRTH`
- `BIRTHDAY`
- `CHRISTENING`
- `CHRISTMAS`
- `WEDDING`
- `OTHER`

Ne pas afficher tout dès le lancement.

## Après naissance

Action :

**Clôturer ma liste de naissance**

Puis :

- archive souvenir ;
- remerciements ;
- livre ;
- récompenses ;
- transformer/créer anniversaire.

## Premier anniversaire

Quelques semaines avant :

> Le premier anniversaire approche ❤️

Créer une nouvelle liste à partir du compte existant.

## Noël

Permettre une liste de Noël familiale/enfant.

Objectif : transformer une acquisition naissance en relation de
plusieurs années.

---

# 21. Phase 17 --- Notifications

Canaux :

- in-app ;
- email ;
- push PWA plus tard.

Événements :

- réservation ;
- achat ;
- contribution ;
- message ;
- reward pending ;
- reward confirmed ;
- baisse de prix ;
- co-parent ;
- parrainage ;
- anniversaire futur.

Préférences granulaires.

Anti-spam et regroupement.

---

# 22. Phase 18 --- PWA

Avant une application native :

- manifest ;
- installable ;
- icons ;
- offline minimal ;
- cache intelligent ;
- notifications push si utile ;
- partage natif ;
- raccourcis.

N'envisager Android/iOS natif que si les données d'usage le justifient.

---

# 23. Phase 19 --- Administration complète

## Dashboard

- utilisateurs ;
- listes ;
- cadeaux ;
- réservations ;
- contributions ;
- paiements ;
- rewards ;
- affiliation ;
- marchands ;
- partenaires ;
- signalements ;
- revenus.

## Utilisateurs

- recherche ;
- état ;
- suspension ;
- historique ;
- listes ;
- sécurité.

## Listes

- inspection ;
- signalements ;
- suspension ;
- restauration.

## Merchants

- domaines ;
- affiliation ;
- rewards ;
- règles ;
- statut.

## Payments

- Mollie ID ;
- état ;
- montant ;
- refunds ;
- chargebacks.

## Rewards

- wallet ;
- ledger ;
- source ;
- ajustement ;
- anomalies.

## Audit

Chaque action sensible :

- admin ;
- action ;
- cible ;
- avant/après si approprié ;
- timestamp ;
- raison.

---

# 24. Phase 20 --- Modération et anti-abus

## Signalement

- liste ;
- cadeau ;
- message ;
- utilisateur.

## Risques

- phishing ;
- liens malveillants ;
- spam ;
- faux produits ;
- contenu illégal ;
- fraude paiement ;
- abus referral ;
- bot.

## Outils

- rate limiting ;
- CAPTCHA adaptatif ;
- score de risque ;
- suspension ;
- revue manuelle ;
- audit.

---

# 25. Phase 21 --- RGPD et confidentialité

À valider juridiquement avant production importante.

Prévoir :

- privacy by design ;
- minimisation ;
- finalités ;
- consentement ;
- cookies ;
- export ;
- suppression ;
- rectification ;
- rétention ;
- sous-traitants ;
- journal des traitements ;
- sécurité ;
- gestion incident.

## Enfants

Éviter de collecter inutilement des données relatives au bébé.

Prénom/date/photo doivent rester facultatifs lorsque possible.

## Listes publiques

Expliquer clairement aux parents ce qui sera visible publiquement.

---

# 26. Phase 22 --- Pages légales

Avant lancement :

- [ ] mentions légales ;
- [ ] politique de confidentialité ;
- [ ] politique cookies ;
- [ ] CGU ;
- [ ] conditions Premium ;
- [ ] conditions Récompenses Mila ;
- [ ] conditions parrainage ;
- [ ] informations affiliation ;
- [ ] conditions contributions/paiements ;
- [ ] procédure signalement/contact.

Faire valider les flux financiers et conditions correspondantes par un
professionnel compétent avant activation réelle.

---

# 27. Phase 23 --- Observabilité

## Logs

Logs structurés :

- request ID ;
- user ID pseudonymisé si utile ;
- action ;
- erreur ;
- durée.

Jamais :

- mots de passe ;
- API keys ;
- tokens complets ;
- données bancaires.

## Monitoring

- uptime ;
- erreurs 5xx ;
- latence ;
- queue ;
- email ;
- scraper ;
- webhooks ;
- Mollie ;
- DB ;
- stockage.

## Alertes

- paiement incohérent ;
- webhook en échec ;
- queue bloquée ;
- extraction massive ;
- erreurs auth ;
- taux 5xx ;
- chargeback.

---

# 28. Phase 24 --- Jobs et workers

Créer des workers pour :

- extraction produit ;
- refresh prix ;
- email ;
- notifications ;
- traitement webhooks ;
- affiliation ;
- rewards ;
- génération médias ;
- nettoyage tokens ;
- expiration ;
- analytics.

Les tâches lentes ne doivent pas bloquer les requêtes HTTP.

---

# 29. Phase 25 --- Tests

## Unit

- rewards ;
- prix ;
- permissions ;
- parsing ;
- statut réservation ;
- calcul financier.

## Integration

- DB ;
- Mollie test ;
- webhooks ;
- email ;
- storage.

## E2E

### Parent

inscription → liste → cadeau → partage.

### Proche

liste → réservation → email → modification → acheté.

### Contribution

liste → montant → Mollie test → webhook → confirmation.

### Admin

connexion → recherche → action → audit.

## Sécurité

- IDOR ;
- SSRF ;
- XSS ;
- injections ;
- upload ;
- privilege escalation ;
- brute-force ;
- open redirect ;
- replay webhook.

---

# 30. Phase 26 --- Performance

Objectifs :

- landing rapide ;
- liste publique rapide ;
- images optimisées ;
- CDN ;
- cache ;
- pagination ;
- indexes DB ;
- queues ;
- compression.

Surveiller Core Web Vitals.

---

# 31. Phase 27 --- Accessibilité

- contraste ;
- clavier ;
- focus ;
- labels ;
- ARIA ;
- alt ;
- formulaires ;
- erreurs compréhensibles ;
- taille zones tactiles.

Mila doit rester utilisable par des proches peu techniques.

---

# 32. Phase 28 --- Expérimentations business

Tester sans détériorer la confiance :

- wording hero ;
- CTA ;
- onboarding ;
- nombre d'étapes ;
- Premium ;
- reward messaging ;
- referral ;
- partenaires.

Toujours mesurer.

Ne pas optimiser uniquement le clic : optimiser l'activation réelle.

---

# 33. Phase 29 --- Lancement géographique

## Étape 1

Belgique francophone.

Avantages :

- terrain de test maîtrisable ;
- Bancontact/usage européen ;
- partenariats locaux possibles.

## Étape 2

Belgique entière avec localisation NL si traction.

## Étape 3

Luxembourg.

## Étape 4

France.

Adapter :

- moyens de paiement ;
- marchands ;
- partenaires ;
- législation ;
- langue ;
- SEO.

---

# 34. Phase 30 --- Stratégie partenaires locale

Approcher :

- sages-femmes ;
- photographes ;
- boutiques indépendantes ;
- baby planners ;
- créateurs ;
- magasins de puériculture.

Créer :

- QR partenaire ;
- landing personnalisée ;
- code attribution ;
- dashboard partenaire plus tard.

Exemple :

`mila.be/p/photographe-x`

---

# 35. Ce que Mila ne doit PAS faire trop tôt

- [ ] application native ;
- [ ] réseau social ;
- [ ] marketplace complète de seconde main ;
- [ ] IA ajoutée partout ;
- [ ] dizaines d'outils grossesse sans cohérence ;
- [ ] expansion internationale prématurée ;
- [ ] crypto ;
- [ ] wallet bancaire maison ;
- [ ] stockage manuel de fonds tiers hors modèle PSP validé.

---

# 36. Feature flags recommandés

```text
rewards
affiliateRewards
referralRewards
partnerRewards
premiumRewards
rewardRedemption
bankPayout
rewardMarketplace

payments
molliePayments
mollieConnect
contributions

secondHand
priceTracking
priceAlerts
priceComparison

mediaMessages
audioMessages
videoMessages
memoryBook
thankYouTracker

premium
partners
familyEvents
pwaPush
```

---

# 37. Variables d'environnement --- principe

Créer `.env.example`.

Catégories :

```text
APP_*
DATABASE_*
AUTH_*
EMAIL_*
STORAGE_*
MOLLIE_*
AFFILIATE_*
SECURITY_*
ANALYTICS_*
WORKER_*
```

Aucun secret réel dans Git.

Pour Mollie, prévoir les variables nécessaires selon l'intégration
réellement retenue, sans inventer les secrets.

---

# 38. Modèle financier

## Revenus possibles

1.  affiliation ;
2.  Premium ;
3.  partenaires ;
4.  application fees si juridiquement/contractuellement adapté au flux
    Mollie ;
5.  placements sponsorisés clairement signalés ;
6.  services complémentaires.

## Dépenses

- hébergement ;
- email ;
- stockage vidéo ;
- scraping/price tracking ;
- Mollie ;
- refunds/chargebacks ;
- rewards ;
- marketing ;
- support ;
- juridique.

## Métriques financières

- revenu moyen/liste ;
- revenu affilié/liste ;
- coût reward/liste ;
- marge contribution ;
- coût paiement ;
- CAC ;
- LTV ;
- Premium conversion ;
- partner revenue.

---

# 39. Règles de priorité

Pour chaque nouvelle fonctionnalité, demander :

1.  Résout-elle un vrai problème parent/proche ?
2.  Améliore-t-elle l'activation ?
3.  Améliore-t-elle la rétention ?
4.  Génère-t-elle une valeur économique ?
5.  Réduit-elle un risque ?
6.  Est-elle déjà demandée par les utilisateurs ?
7.  Peut-elle attendre ?

Score suggéré :

`Impact × Confiance ÷ Effort`

---

# 40. Jalons

## M0 --- Prototype

Landing + démonstration.

## M1 --- Alpha privée

- auth ;
- listes ;
- cadeaux ;
- réservation ;
- partage.

## M2 --- Bêta fermée

- sécurité renforcée ;
- emails ;
- co-parent ;
- confidentialité ;
- admin ;
- analytics.

## M3 --- Bêta publique Belgique

- affiliation initiale ;
- merchants ;
- `/go/` ;
- premières métriques ;
- support.

## M4 --- Monétisation

- rewards ;
- Premium Mollie ;
- premiers partenaires.

## M5 --- Contributions

Après validation du modèle Mollie/Connect et juridique.

## M6 --- Différenciation

- seconde main ;
- suivi prix ;
- comparaison.

## M7 --- Rétention

- remerciements ;
- souvenirs ;
- anniversaire/Noël.

---

# 41. Definition of Done

Une fonctionnalité n'est pas terminée parce que l'interface existe.

Elle est terminée si :

- [ ] frontend terminé ;
- [ ] backend terminé ;
- [ ] DB/migration terminée ;
- [ ] validation serveur ;
- [ ] permissions ;
- [ ] erreurs ;
- [ ] loading ;
- [ ] empty state ;
- [ ] mobile ;
- [ ] accessibilité ;
- [ ] logs ;
- [ ] tests ;
- [ ] documentation ;
- [ ] analytics ;
- [ ] sécurité ;
- [ ] feature flag si nécessaire.

---

# 42. Ordre recommandé à partir de maintenant

## MAINTENANT

1.  Audit sécurité complet.
2.  Parcours parent réel.
3.  Parcours proche réel.
4.  Extraction URL.
5.  Réservation atomique.
6.  Emails.
7.  Co-parent.
8.  Confidentialité.
9.  Admin.
10. Analytics.

## ENSUITE

11. Merchants.
12. `/go/`.
13. Affiliation.
14. Ledger rewards.
15. Parrainage.
16. Premium via Mollie.

## APRÈS VALIDATION

17. Contributions Mollie.
18. Seconde main.
19. Price tracking.
20. Comparaison prix.

## RÉTENTION

21. Remerciements.
22. Messages audio/vidéo.
23. Livre souvenir.
24. Anniversaire.
25. Noël.

## SCALE

26. SEO.
27. Partenaires.
28. NL.
29. Luxembourg.
30. France.

---

# 43. Décisions déjà prises

- **Nom : Mila**
- Liste de naissance comme point d'entrée.
- Multi-enseignes.
- Réservation sans compte pour les proches.
- Architecture générique pour autres événements.
- Récompenses Mila.
- Récompenses principalement financées par la valeur réellement
  générée.
- Paiements : **Mollie**.
- Premium : préférence pour paiement ponctuel par événement.
- Seconde main prévue.
- Comparaison de prix prévue.
- Cycle anniversaire/Noël prévu.
- Admin complet obligatoire.
- Privacy/security by design.

---

# 44. Questions à trancher avant production financière

- Quel modèle Mollie exact pour les contributions aux parents ?
- Les parents devront-ils disposer d'un compte/organisation connecté
  Mollie ?
- Mila sera-t-il propriétaire du paiement dans certains flux ?
- Quel niveau de commission/application fee ?
- Qui supporte les frais Mollie ?
- Qui supporte les chargebacks ?
- Quelle politique de remboursement ?
- Les Récompenses Mila sont-elles des crédits, bons, remises ou
  montants retirable ?
- Durée de validité des rewards ?
- Minimum d'utilisation ?
- Traitement comptable et TVA ?
- Conditions d'affiliation par marchand/réseau ?
- Durée de conservation des médias souvenirs ?

**Ne pas activer les flux financiers complexes avant d'avoir répondu
clairement à ces questions.**

---

# 45. Vision à long terme

Mila doit pouvoir évoluer de :

> « Je prépare ma liste de naissance »

vers :

> « Mila accompagne les cadeaux et souvenirs importants de notre
> famille. »

Le moteur de croissance recherché est :

**Parent découvre Mila** → crée une liste → partage → proches découvrent
Mila → achats/contributions → Mila génère du revenu → parents obtiennent
éventuellement des récompenses → parrainage → naissance →
remerciements/souvenirs → anniversaire → Noël → nouveaux événements →
nouveaux utilisateurs.

---

# 46. Manifeste produit

Mila doit rester :

- simple ;
- doux ;
- familial ;
- transparent ;
- moderne ;
- utile ;
- respectueux ;
- universel.

Chaque fonctionnalité doit renforcer cette identité.

**Le but n'est pas d'avoir le plus de fonctionnalités du marché.**

Le but est que les parents puissent dire :

> **« Avec Mila, tout était simple. »**

---

# 12A. Catalogue produit automatisé et récupération d'images

**Objectif :** permettre aux parents de coller simplement un lien marchand et de ne plus avoir à gérer manuellement les informations du produit.

## Extraction produit

Lorsqu'un parent ajoute un lien marchand, Mila doit tenter de récupérer automatiquement :

- titre du produit ;
- image principale ;
- images secondaires lorsque cela est autorisé et utile ;
- prix courant ;
- prix barré/promotional lorsqu'il est réellement présent ;
- devise ;
- disponibilité ;
- référence produit ;
- marque ;
- catégorie ;
- description courte ;
- variantes pertinentes ;
- nom du marchand ;
- URL canonique ;
- GTIN / EAN / MPN / SKU si disponible.

Ordre de priorité recommandé :

1. API officielle marchand ou réseau partenaire ;
2. flux produit officiel ;
3. JSON-LD / Schema.org `Product` ;
4. Open Graph ;
5. metadata HTML ;
6. extraction HTML minimale et prudente en dernier recours.

## Règles copyright / images produit

Mila ne doit pas considérer les images récupérées sur un site marchand comme des ressources librement réutilisables.

La stratégie doit privilégier :

- API officielles ;
- flux affiliés autorisant explicitement l'utilisation des visuels ;
- URLs d'images fournies par le marchand ;
- affichage distant lorsque les conditions du marchand le permettent ;
- stockage temporaire/cache uniquement lorsque cela est juridiquement et contractuellement autorisé.

Ne jamais :

- supprimer un watermark ;
- modifier le copyright ;
- republier une photothèque complète ;
- réutiliser une image hors du contexte du produit ;
- utiliser une image après que le marchand a demandé sa suppression ;
- supposer qu'une image publique est libre de droits.

Prévoir pour chaque `ProductImage` :

- `sourceUrl`
- `sourceType`
- `merchantId`
- `usagePolicy`
- `cached`
- `cachedUntil`
- `attributionRequired`
- `attributionText`
- `lastCheckedAt`
- `status`

Valeurs possibles de `usagePolicy` :

- `OFFICIAL_API`
- `AFFILIATE_FEED`
- `REMOTE_DISPLAY_ALLOWED`
- `TEMPORARY_CACHE_ALLOWED`
- `USER_UPLOADED`
- `MANUAL_REVIEW_REQUIRED`
- `DO_NOT_DISPLAY`

Si aucune utilisation sûre n'est possible :

- afficher un placeholder propre ;
- permettre au parent d'ajouter sa propre image ;
- ne pas contourner la restriction.

## Gestion des images utilisateur

Si le parent téléverse une image manuellement :

- vérifier format ;
- vérifier taille ;
- scanner ;
- compresser ;
- générer plusieurs tailles ;
- stocker avec accès contrôlé ;
- permettre suppression ;
- conserver la provenance `USER_UPLOADED`.

## Cache image

Si le cache est autorisé :

- TTL configurable ;
- invalidation ;
- respect ETag/Last-Modified si disponible ;
- suppression automatique après expiration ;
- aucune conservation indéfinie par défaut.

## Fallback

Si l'image marchand devient indisponible :

1. tenter la source officielle ;
2. rafraîchir les metadata ;
3. utiliser une autre image autorisée ;
4. sinon placeholder.

Les parents ne doivent pas devoir corriger cela manuellement.

---

# 12B. Mise à jour automatique des prix, stocks et informations

**Objectif :** une fois le cadeau ajouté, Mila entretient automatiquement les données.

## ProductRefreshJob

Créer un worker asynchrone chargé de rafraîchir :

- prix ;
- disponibilité ;
- URL canonique ;
- image ;
- titre si changé ;
- merchant offer ;
- promotion éventuelle.

Ne jamais exécuter ce refresh dans la requête utilisateur principale.

## Fréquence

Fréquence configurable selon :

- popularité du produit ;
- proximité de la date de naissance ;
- fréquence de changement observée ;
- importance du prix ;
- règles du marchand ;
- limitations API.

Exemple :

- produit actif très consulté : 6–12 h ;
- produit normal : 24 h ;
- produit peu consulté : 48–72 h ;
- produit réservé/acheté : fréquence réduite.

## PriceSnapshot

Conserver l'historique :

- giftId ;
- merchantId ;
- price ;
- currency ;
- availability ;
- source ;
- checkedAt.

## Détection

Afficher par exemple :

> Prix lors de l'ajout : 129,99 €
>
> Prix actuel : 109,99 €
>
> ↓ 20 € depuis l'ajout

Ou :

> Prix indisponible temporairement

Ne pas afficher une variation si la comparaison n'est pas fiable.

## Alertes parents

Options parent :

- [ ] m'alerter si le prix baisse ;
- [ ] m'alerter si le produit devient indisponible ;
- [ ] m'alerter si l'URL n'est plus valide ;
- [ ] proposer automatiquement une autre offre.

## Correction automatique

Si le marchand change l'URL mais que le produit est toujours identifiable :

- mettre à jour `canonicalUrl` ;
- conserver historique ;
- ne pas casser la liste.

Si le produit disparaît :

- marquer `UNAVAILABLE` ;
- proposer alternative ;
- permettre remplacement.

## Zéro maintenance parent

Principe UX :

> Une fois le cadeau ajouté, Mila s'occupe du suivi.

Le parent ne devrait pas avoir à revenir éditer le prix chaque semaine.

---

# 12C. Choix du comportement automatique par les parents

Chaque parent doit pouvoir choisir le niveau d'automatisation.

## Mode simple recommandé

Par défaut :

- mise à jour automatique du prix ;
- mise à jour automatique de la disponibilité ;
- mise à jour image autorisée ;
- recherche d'alternative si indisponible ;
- aucune modification destructive sans confirmation.

## Préférences par liste

- `AUTO_REFRESH_PRODUCT_DATA`
- `AUTO_UPDATE_PRICE`
- `AUTO_UPDATE_IMAGE`
- `AUTO_REPLACE_DEAD_LINK`
- `AUTO_SUGGEST_BETTER_OFFER`
- `AUTO_SWITCH_TO_BETTER_OFFER`
- `AUTO_ORDER_ALLOWED`

Le mode `AUTO_SWITCH_TO_BETTER_OFFER` doit être désactivé par défaut.

Pourquoi :

le parent peut vouloir un magasin précis pour :

- fidélité ;
- garantie ;
- retrait local ;
- SAV ;
- disponibilité ;
- liste cadeau existante ;
- regroupement de commandes.

---

# 12D. Politique de comparaison et changement de marchand

Pour chaque cadeau, proposer :

### Magasin imposé

> Toujours acheter dans le magasin choisi.

### Meilleur prix suggéré

> Mila peut afficher une meilleure offre, mais le parent garde le contrôle.

### Meilleur prix automatique

> Mila peut remplacer l'offre affichée si les règles choisies sont respectées.

Critères possibles :

- prix produit ;
- frais de livraison ;
- délai ;
- stock ;
- réputation du marchand ;
- région ;
- possibilité de commande groupée ;
- affiliation.

**La commission Mila ne doit jamais être le seul critère de sélection.**

---

# 12E. Regroupement intelligent des commandes

**Objectif :** éviter les commandes séparées absurdes lorsque plusieurs cadeaux proviennent du même marchand.

Exemple IKEA :

Au lieu de créer 5 commandes séparées :

- lit ;
- matelas ;
- draps ;
- veilleuse ;
- rangement ;

Mila doit permettre de les regrouper dans une seule commande.

## OrderGroup

Créer une entité :

- `OrderGroup`
- `listId`
- `merchantId`
- `status`
- `orderMode`
- `deliveryMode`
- `createdAt`
- `submittedAt`

## OrderGroupItem

- giftId ;
- quantity ;
- unitPrice ;
- reservedBy ;
- contributionAmount ;
- selectedVariant ;
- status.

## Modes de commande

- `MANUAL_PARENT`
- `ASSISTED_PARENT`
- `AUTOMATIC_PLATFORM`

`AUTOMATIC_PLATFORM` doit rester derrière un feature flag et ne doit être activé que si le marchand/API/contrat le permet réellement.

## Parent — commande manuelle

Le parent voit :

> 5 cadeaux IKEA sont prêts à commander.

Bouton :

**Préparer ma commande IKEA**

Mila affiche :

- produits ;
- variantes ;
- quantités ;
- montant ;
- liens ;
- état des contributions ;
- informations de livraison.

Puis :

**Ouvrir IKEA et commander**

ou

**Marquer comme commandé**

## Parent — commande assistée

Si une intégration marchand le permet :

Mila prépare un panier ou une liste de liens structurée.

Le parent valide ensuite chez le marchand.

## Commande automatique

Seulement si :

- API officielle ;
- contrat autorisant cela ;
- consentement explicite ;
- moyen de paiement valide ;
- adresse ;
- variantes ;
- stock ;
- frais ;
- livraison ;
- gestion annulation/retour.

Ne jamais automatiser une commande via scraping/robot navigateur non autorisé.

## Règles de regroupement

Regrouper si :

- même marchand ;
- même destination ;
- même fenêtre de commande ;
- économies de livraison ;
- parent l'autorise.

Ne pas regrouper si :

- urgence différente ;
- variante incertaine ;
- cadeau surprise ;
- réservation spécifique incompatible.

---

# 12F. Statuts cadeau et commande

Ajouter des statuts distincts.

## GiftStatus

- `AVAILABLE`
- `RESERVED`
- `FUNDED`
- `READY_TO_ORDER`
- `ORDERED`
- `SHIPPED`
- `RECEIVED`
- `CANCELLED`
- `UNAVAILABLE`

## OrderGroupStatus

- `DRAFT`
- `READY`
- `WAITING_PARENT`
- `SUBMITTED`
- `PARTIALLY_ORDERED`
- `ORDERED`
- `SHIPPED`
- `COMPLETED`
- `CANCELLED`

---

# 12G. Paiement sur Mila : virement ou Mollie

Mila doit pouvoir proposer plusieurs moyens de contribution.

## Option 1 — Mollie

Pour :

- contributions ;
- Premium ;
- frais de service éventuels ;
- commandes intégrées futures.

Flux :

1. proche sélectionne montant ;
2. Mila crée `PaymentIntent` interne ;
3. paiement Mollie ;
4. retour navigateur ;
5. webhook Mollie ;
6. vérification côté serveur ;
7. ledger ;
8. contribution confirmée.

## Option 2 — Virement bancaire

Créer un flux virement manuel ou semi-automatisé.

Le proche reçoit :

- IBAN ;
- bénéficiaire ;
- communication structurée/unique ;
- montant.

La communication doit permettre le rapprochement automatique.

Exemple interne :

`MILA-LST-8F23-GFT-19`

## Réconciliation bancaire

Prévoir :

- import bancaire/API si disponible ;
- recherche communication ;
- montant ;
- date ;
- nom payeur si disponible ;
- rapprochement automatique ;
- revue manuelle si ambigu.

Statuts :

- `WAITING_TRANSFER`
- `TRANSFER_RECEIVED`
- `MATCHED`
- `MANUAL_REVIEW`
- `REFUNDED`

---

# 12H. Compte transitaire / fonds destinés aux parents

**Important : cette partie doit être validée juridiquement et contractuellement avant activation.**

Le besoin produit est :

> Un proche paie sur Mila.
>
> Le paiement est identifié comme contribution à une liste.
>
> Mila orchestre ensuite le transfert vers le parent ou la commande correspondante.

Mais l'implémentation ne doit pas transformer Mila en établissement de paiement improvisé.

## Architecture cible

Prévoir un modèle abstrait :

- `PlatformAccount`
- `ParentPayoutAccount`
- `FundsLedger`
- `TransferInstruction`
- `Payout`
- `HoldingBalance`

## Principe

Les fonds destinés aux parents doivent être séparés conceptuellement des revenus propres de Mila.

Ne pas mélanger :

- revenus affiliation ;
- Premium ;
- frais Mila ;
- contributions parents ;
- refunds ;
- rewards.

## Mollie Connect / modèle marketplace

Étudier en priorité un modèle où :

- le paiement est traité via Mollie ;
- le bénéficiaire parent est onboardé selon le modèle retenu ;
- les fonds sont routés ou transférés selon les capacités contractuelles ;
- Mila peut prélever des frais autorisés ;
- les mouvements restent auditables.

## "Compte transitaire"

Dans la roadmap, le terme doit signifier :

> couche de transit/routage de fonds opérée dans un cadre PSP conforme.

Pas :

> compte bancaire personnel/professionnel Mila qui reçoit tout puis Florian fait des virements manuels.

## Virement vers parents

Prévoir :

- identité bénéficiaire ;
- IBAN ;
- validation ;
- statut ;
- montant ;
- frais ;
- date ;
- référence ;
- historique.

Feature flag :

`parentPayouts`

---

# 12I. Utilisation des fonds par les parents

Les parents doivent pouvoir choisir ce qu'il advient d'une contribution confirmée.

## Option A — Transfert vers parent

Le parent demande le versement de la somme disponible.

## Option B — Utiliser pour commander

Le parent utilise les fonds pour un `OrderGroup`.

Exemple :

> Solde disponible : 420 €
>
> Commande IKEA : 389 €
>
> **Utiliser 389 € de mon solde Mila**

## Option C — Conserver temporairement

Les parents peuvent attendre plusieurs contributions avant de commander.

## Option D — Mix

Une partie pour une commande, le reste versé.

---

# 12J. Commande automatique ou manuelle côté parent

Pour chaque liste, paramètre :

### Toujours manuel

Le parent commande lui-même.

### Assisté par Mila

Mila prépare :

- panier ;
- liens ;
- quantités ;
- budget disponible ;
- checklist.

### Automatique lorsque possible

Mila peut passer la commande uniquement via intégration autorisée.

Le parent doit pouvoir définir par marchand.

Exemple :

```text
IKEA -> MANUAL_PARENT
Amazon -> ASSISTED_PARENT
Boutique partenaire -> AUTOMATIC_PLATFORM
```

---

# 12K. Commande consolidée par marchand

Créer une vue parent :

## À commander

### IKEA — 5 articles

- Lit bébé — financé
- Matelas — financé
- Draps — réservé
- Veilleuse — financée
- Rangement — financé

Montant prêt : 412 €

Bouton :

**Commander les 4 articles financés**

ou

**Attendre le dernier cadeau**

Le parent peut décider :

- commander maintenant ;
- attendre ;
- exclure un article ;
- changer de variante ;
- changer de livraison.

---

# 12L. Réservation vs paiement vs commande

Ces concepts doivent rester distincts.

## Réservation

Un proche promet de s'occuper du cadeau.

## Contribution

Un proche verse tout ou partie du montant.

## Financé

Le montant requis est atteint.

## Commandé

Une commande a réellement été passée.

## Reçu

Le parent confirme la réception.

Ne jamais considérer `RESERVED` comme `PAID`.

---

# 12M. Gestion des trop-perçus

Si plusieurs contributions arrivent presque simultanément et dépassent l'objectif :

Prévoir des règles :

- bloquer dès objectif atteint ;
- accepter léger dépassement ;
- convertir surplus en solde général liste ;
- rembourser ;
- demander décision parent.

Par défaut :

éviter le dépassement lorsque techniquement possible.

---

# 12N. Frais et transparence

Avant chaque paiement, afficher clairement :

- montant du cadeau ;
- montant de la contribution ;
- frais éventuels ;
- montant total payé ;
- montant destiné aux parents ;
- éventuelle part Mila.

Pas de frais cachés.

Si Mila absorbe les frais Mollie :

le calcul business doit le prendre en compte.

Si le proche les paie :

cela doit être explicite.

---

# 12O. Ledger financier unifié

Tous les flux doivent passer dans un ledger.

Types :

- `CONTRIBUTION_IN`
- `CONTRIBUTION_REFUND`
- `PARENT_PAYOUT`
- `ORDER_PAYMENT`
- `MOLLIE_FEE`
- `PLATFORM_FEE`
- `AFFILIATE_REVENUE`
- `REWARD_CREDIT`
- `REWARD_REDEMPTION`
- `PREMIUM_REVENUE`

Chaque entrée doit avoir :

- amount ;
- currency ;
- source ;
- externalReference ;
- status ;
- createdAt ;
- settledAt.

Ne jamais calculer un solde financier important uniquement à partir d'un champ mutable.

---

# 12P. Sécurité financière

- webhooks signés/vérifiés selon capacités Mollie ;
- idempotence ;
- ledger immuable ;
- aucune confiance dans le frontend ;
- séparation des rôles ;
- double validation admin pour grosses opérations manuelles ;
- logs ;
- alertes ;
- audit.

Détecter :

- double paiement ;
- double webhook ;
- double payout ;
- contribution sur cadeau supprimé ;
- payout pendant refund ;
- chargeback après payout.

---

# 12Q. UX "les parents ne se tracassent de rien"

C'est un objectif produit majeur.

Le dashboard parent doit dire simplement :

## À surveiller

- 1 produit indisponible
- 2 baisses de prix
- 4 cadeaux prêts à commander
- 185 € disponibles

Puis proposer les actions.

Mila doit automatiser :

- refresh produit ;
- prix ;
- image ;
- disponibilité ;
- détection lien mort ;
- regroupement marchand ;
- rapprochement paiement ;
- statut de contribution ;
- notifications.

Le parent intervient seulement lorsqu'une décision humaine est nécessaire.

---

# 12R. Centre "À commander"

Créer une page dédiée :

`/dashboard/orders`

Sections :

### Prêts à commander

Groupés par marchand.

### En attente de financement

### Commandés

### Reçus

### Problèmes

Exemples :

- produit indisponible ;
- prix changé ;
- variante inconnue ;
- adresse requise ;
- stock faible.

---

# 12S. Future intégration marchands

Prévoir une abstraction `MerchantConnector`.

Méthodes potentielles :

- `fetchProduct`
- `refreshPrice`
- `checkAvailability`
- `createCart`
- `createOrder`
- `getOrderStatus`
- `cancelOrder`
- `getTracking`

Implémentations :

- `AffiliateFeedConnector`
- `OfficialApiConnector`
- `GenericMetadataConnector`
- `ManualConnector`

Ne jamais coder la logique IKEA/Amazon directement dans le cœur métier.

---

# 12T. Politique d'automatisation par niveau de confiance

Classer les intégrations :

## Niveau 0 — manuel

Lien uniquement.

## Niveau 1 — metadata

Titre/image/prix.

## Niveau 2 — prix & stock

Refresh automatique fiable.

## Niveau 3 — panier

Création panier assistée.

## Niveau 4 — commande

Commande automatique via API autorisée.

Afficher le niveau dans l'admin merchant.

---

# 12U. Definition of Done spécifique catalogue/paiement

Une intégration marchand n'est pas terminée tant que :

- [ ] copyright image traité ;
- [ ] refresh prix testé ;
- [ ] indisponibilité gérée ;
- [ ] fallback image ;
- [ ] rate limits ;
- [ ] logs ;
- [ ] monitoring ;
- [ ] erreurs ;
- [ ] tests ;
- [ ] règles affiliation ;
- [ ] regroupement commande ;
- [ ] politique d'automatisation documentée.

Un flux paiement n'est pas terminé tant que :

- [ ] succès ;
- [ ] pending ;
- [ ] échec ;
- [ ] expiration ;
- [ ] annulation ;
- [ ] refund ;
- [ ] chargeback ;
- [ ] webhook dupliqué ;
- [ ] webhook désordonné ;
- [ ] réconciliation ;
- [ ] payout ;
- [ ] audit ;
- [ ] comptabilité/CGU vérifiées.

---

# W. Base de données SQL déportée — règle d'architecture obligatoire

## Précision infrastructure

La base n'est **pas locale au conteneur backend**.

Le conteneur/app Mila doit toujours considérer MySQL comme un service distant configurable.

Exemple :

```text
DATABASE_HOST=mysql.internal.example
DATABASE_PORT=3306
DATABASE_NAME=mila
DATABASE_USER=mila_app
DATABASE_PASSWORD=...
```

Ces valeurs sont uniquement des exemples de structure et ne doivent jamais être codées en dur.

Le vrai host, utilisateur et mot de passe seront fournis via `.env`.

La base de données de production de Mila sera **déportée du serveur applicatif**.

Le backend Mila ne doit donc pas supposer que PostgreSQL/MySQL tourne sur `localhost`.

## Architecture cible

```text
Internet
   |
Reverse Proxy
   |
Frontend / API Mila
   |
Réseau privé / accès SQL contrôlé
   |
Serveur SQL déporté
```

Le moteur SQL exact doit être confirmé au moment de l'implémentation en fonction de l'existant, avec MySQL comme moteur officiel de Mila.

## Configuration exclusivement par environnement

Les informations de connexion SQL doivent être fournies exclusivement via variables d'environnement.

Exemple :

```text
DATABASE_HOST=
DATABASE_PORT=
DATABASE_NAME=
DATABASE_USER=
DATABASE_PASSWORD=
DATABASE_URL=
```

Selon l'ORM retenu, `DATABASE_URL` peut être construit depuis ces valeurs ou fourni directement.

### Interdictions

Ne jamais écrire dans le code :

```text
10.x.x.x
192.168.x.x
root
postgres
mot_de_passe
```

ou toute autre :

- IP SQL ;
- hostname privé ;
- username ;
- password ;
- token ;
- secret.

Le repository Git doit rester exploitable sans contenir les identifiants de l'infrastructure réelle.

## `.env`

Le fichier `.env` réel contient les informations propres à l'environnement :

- développement ;
- staging ;
- préproduction ;
- production.

Il doit être présent dans `.gitignore`.

## `.env.example`

Maintenir obligatoirement un `.env.example` versionné.

Exemple :

```text
# Database
DATABASE_HOST=A_REMPLIR
DATABASE_PORT=3306
DATABASE_NAME=mila
DATABASE_USER=A_REMPLIR
DATABASE_PASSWORD=A_REMPLIR
DATABASE_URL=A_REMPLIR
```

Toute nouvelle variable utilisée par l'application doit être ajoutée au `.env.example` dans le même stage/commit que la fonctionnalité qui l'introduit.

Ne jamais mettre un vrai secret dans `.env.example`.

## Démarrage

Le backend doit refuser de démarrer proprement si une variable obligatoire manque.

Afficher par exemple :

```text
Missing required environment variable: DATABASE_URL
```

sans afficher les secrets.

## Validation

Créer une validation centralisée de l'environnement au démarrage.

Elle doit vérifier notamment :

- présence ;
- format ;
- port ;
- URL ;
- valeurs autorisées ;
- cohérence production/dev.

---

# X. Sécurité de la base SQL déportée

La base SQL ne doit pas être exposée publiquement à Internet sans nécessité.

Préférer :

- réseau privé ;
- VLAN ;
- VPN ;
- firewall ;
- ACL ;
- allowlist du serveur backend.

Le compte utilisé par Mila ne doit pas être un superuser SQL.

Créer un utilisateur dédié :

```text
mila_app
```

avec uniquement les permissions nécessaires.

Prévoir séparément si nécessaire :

```text
mila_migration
```

pour les migrations disposant de permissions plus importantes.

## Connexions

Prévoir :

- pool de connexions ;
- timeout ;
- reconnexion ;
- gestion panne DB ;
- TLS si nécessaire ;
- healthcheck.

## Backups

La base déportée doit disposer de :

- sauvegardes automatiques ;
- rétention ;
- vérification ;
- restauration testée.

Une sauvegarde non restaurable n'est pas considérée comme une sauvegarde valide.

---

# Y. Git — workflow obligatoire par stage

Le repository Git lié au projet Mila devient la **source de vérité du code**.

Chaque stage de la roadmap doit être développé de manière traçable.

## Règle fondamentale

**À chaque stage terminé et validé : créer un commit Git.**

Ne pas accumuler plusieurs grosses phases dans un seul commit.

Exemple :

```text
Stage 01 — audit Lovable
Stage 02 — backend bootstrap
Stage 03 — database
Stage 04 — authentication
Stage 05 — lists
Stage 06 — gifts
Stage 07 — reservations
...
```

Chaque stage doit produire un point de restauration exploitable.

---

# Z. Procédure Git pour chaque stage

Pour chaque stage :

## 1. État initial

Vérifier :

```bash
git status
```

Comprendre les modifications déjà présentes avant de commencer.

## 2. Développement

Implémenter uniquement le périmètre du stage.

## 3. Tests

Exécuter les tests pertinents :

```text
lint
typecheck
unit tests
integration tests
build
```

et tests spécifiques au stage.

## 4. Vérification secrets

Avant commit, vérifier qu'aucun secret n'est inclus :

- `.env`
- API key ;
- password ;
- token ;
- credentials SQL ;
- clé Mollie ;
- SMTP password.

## 5. Documentation

Mettre à jour si nécessaire :

- README ;
- `.env.example` ;
- roadmap ;
- migrations ;
- documentation API.

## 6. Commit

Créer un commit explicite.

Format recommandé :

```text
feat(stage-04): implement self-hosted authentication
```

Autres exemples :

```text
chore(stage-01): audit and remove Lovable dependencies

feat(stage-02): bootstrap Mila backend

feat(stage-03): add remote PostgreSQL integration

feat(stage-05): implement birth lists

feat(stage-06): implement product extraction

fix(stage-06): harden product URL SSRF protection

feat(stage-10): add Mollie payment integration
```

## 7. Push

Une fois le stage validé :

```bash
git push
```

vers le repository distant lié au projet.

---

# AA. Commits atomiques

Un commit doit correspondre à une modification logique.

Éviter :

```text
update stuff
fix
changes
final
test2
```

Préférer :

```text
feat(gifts): add automatic Open Graph extraction
fix(auth): prevent expired reset token reuse
security(products): block private IPs during metadata fetch
feat(payments): handle Mollie paid webhook
```

Si un stage nécessite plusieurs modifications indépendantes, plusieurs commits sont autorisés.

La règle est donc :

> **au minimum un commit validé par stage, mais autant de commits atomiques supplémentaires que nécessaire.**

---

# AB. Branches

Le workflow recommandé doit utiliser une branche de travail plutôt que de développer directement sur la branche de production.

Exemple :

```text
main
develop
feature/stage-04-auth
feature/stage-05-lists
```

Workflow :

```text
feature branch
      ↓
tests
      ↓
commit(s)
      ↓
push
      ↓
merge vers develop
      ↓
validation
      ↓
main lors d'une release
```

Adapter au repository Git réellement ouvert et lié au projet.

Ne pas recréer un nouveau repository si un repository Git existe déjà.

---

# AC. Tags et jalons

Créer des tags pour les grandes étapes stables.

Exemples :

```text
v0.1.0-alpha
v0.2.0-alpha
v0.5.0-beta
v1.0.0
```

Exemple :

```text
v0.1.0-alpha
```

peut correspondre à :

- Lovable supprimé ;
- backend autonome ;
- SQL déporté ;
- auth fonctionnelle ;
- Docker fonctionnel.

---

# AD. Journal des stages

Créer à la racine :

```text
CHANGELOG.md
```

et/ou :

```text
docs/STAGES.md
```

Pour chaque stage :

```text
## Stage 04 — Authentication

Status: DONE

Commit:
abc1234

Implemented:
- local authentication
- email verification
- password reset
- session management

Tests:
- unit
- integration
- build

Environment:
- AUTH_SECRET
- SMTP_HOST
- SMTP_USER

Migration:
20260813_auth

Notes:
...
```

Cela permet de reprendre le projet beaucoup plus facilement après plusieurs semaines.

---

# AE. Git et migrations SQL

Toute migration SQL/ORM doit être versionnée dans Git.

Une modification du schéma ne doit jamais être faite uniquement à la main directement dans la base de production.

Workflow :

```text
modifier schema
↓
générer migration
↓
tester migration
↓
commit
↓
push
↓
déployer
↓
appliquer migration
```

Si une correction manuelle urgente est effectuée en production, elle doit ensuite être retranscrite dans une migration versionnée.

---

# AF. Git et `.env`

Le `.gitignore` doit contenir au minimum :

```text
.env
.env.local
.env.production
.env.staging
*.pem
*.key
```

Adapter selon le framework.

Peuvent être versionnés :

```text
.env.example
.env.test.example
```

sans aucun secret réel.

---

# AG. Secret scanning

Ajouter autant que possible un contrôle automatique avant push/CI pour détecter :

- API keys ;
- credentials ;
- passwords ;
- tokens ;
- private keys.

Une clé accidentellement commitée doit être considérée comme compromise même si le commit est ensuite supprimé.

Elle doit être révoquée et remplacée.

---

# AH. Stage 0 officiel mis à jour

Avant toute nouvelle fonctionnalité Mila, effectuer désormais dans cet ordre :

1. exporter le code depuis Lovable ;
2. rattacher/vérifier le repository Git existant ;
3. créer une branche de migration ;
4. auditer tout le projet ;
5. inventorier Lovable/Supabase ;
6. définir la nouvelle architecture ;
7. créer le backend ;
8. configurer la base SQL déportée via `.env` ;
9. créer les migrations ;
10. migrer l'authentification ;
11. migrer le stockage ;
12. remplacer tous les appels Supabase ;
13. supprimer les dépendances Lovable ;
14. Dockeriser ;
15. tester ;
16. documenter ;
17. commit/push du stage ;
18. poursuivre stage suivant.

**Aucun stage suivant ne doit commencer si le stage précédent laisse le repository dans un état volontairement cassé.**

---

# AI. Déploiement 100 % Docker et domaines facilement interchangeables

**Objectif :** Mila doit pouvoir être lancé sur un PC local, puis exposé sur un domaine de développement, puis basculé en production sans modifier le code applicatif.

Les changements d'environnement doivent se faire principalement via :

- `.env`
- configuration Docker Compose
- configuration reverse proxy
- DNS

et non par modification des composants frontend/backend.

---

# AJ. Environnements cibles

Prévoir au minimum trois environnements.

## Local

Premier environnement de test :

```text
http://localhost
```

ou éventuellement :

```text
http://mila.localhost
```

selon la configuration retenue.

## Développement public

Domaine prévu :

```text
https://dev06.lfinfo.be
```

Cet environnement doit permettre :

- tests réels HTTPS ;
- Mollie test ;
- webhooks ;
- emails ;
- tests mobile ;
- tests externes ;
- validation avant production.

## Production

Le domaine final sera un domaine dédié à Mila.

Il n'est pas encore nécessaire de le connaître.

La plateforme doit pouvoir passer de :

```text
dev06.lfinfo.be
```

à :

```text
domaine-production-mila.tld
```

sans refactor du code.

---

# AK. Aucune URL publique codée en dur

Interdiction de coder directement dans le frontend/backend :

```text
localhost
dev06.lfinfo.be
parent-gift-hub.lovable.app
mila.example
```

ou n'importe quel futur domaine public.

Utiliser des variables d'environnement centralisées.

Exemple :

```text
APP_URL=
PUBLIC_APP_URL=
API_PUBLIC_URL=
ASSET_PUBLIC_URL=
```

Selon l'architecture réelle, certaines peuvent être fusionnées.

---

# AL. Variables d'environnement recommandées pour les domaines

Exemple `.env.example` :

```text
# Application
APP_ENV=development
APP_NAME=Mila

# Public URLs
APP_URL=http://localhost
PUBLIC_APP_URL=http://localhost
API_PUBLIC_URL=http://localhost/api/v1
ASSET_PUBLIC_URL=http://localhost/assets

# Domain
APP_DOMAIN=localhost

# Cookies
COOKIE_DOMAIN=
COOKIE_SECURE=false

# CORS
CORS_ALLOWED_ORIGINS=http://localhost

# Reverse proxy
TRUST_PROXY=true
```

Pour `dev06.lfinfo.be` :

```text
APP_ENV=staging

APP_URL=https://dev06.lfinfo.be
PUBLIC_APP_URL=https://dev06.lfinfo.be
API_PUBLIC_URL=https://dev06.lfinfo.be/api/v1
ASSET_PUBLIC_URL=https://dev06.lfinfo.be/assets

APP_DOMAIN=dev06.lfinfo.be

COOKIE_DOMAIN=dev06.lfinfo.be
COOKIE_SECURE=true

CORS_ALLOWED_ORIGINS=https://dev06.lfinfo.be
```

En production :

seules ces valeurs changent.

---

# AM. Frontend — base URL centralisée

Le frontend ne doit pas construire ses URLs dans les composants.

Créer une configuration centralisée.

Exemple :

```text
src/config/env.ts
```

ou :

```text
src/config/runtime.ts
```

Les composants utilisent ensuite :

```text
apiClient
assetUrl()
publicUrl()
```

et non :

```text
fetch("https://dev06.lfinfo.be/api/...")
```

---

# AN. API relative lorsque possible

Lorsque frontend et backend sont servis sous le même domaine, privilégier des URLs relatives.

Exemple :

```text
/api/v1/lists
/assets/...
```

plutôt que :

```text
https://dev06.lfinfo.be/api/v1/lists
```

Avantages :

- changement de domaine transparent ;
- simplification CORS ;
- migration staging -> prod plus simple ;
- moins de configuration.

Le reverse proxy route ensuite :

```text
/        -> frontend
/api/    -> backend
/assets/ -> storage/proxy
```

---

# AO. Docker Compose — objectif

Créer une stack complète.

Exemple :

```text
services:
  frontend
  backend
  worker
  redis
  minio
  reverse-proxy
```

La base MySQL étant déportée, elle ne doit pas obligatoirement être incluse dans le compose de production.

En local, deux options sont acceptables :

### Option A

Utiliser aussi la base MySQL déportée de développement.

### Option B

Permettre un profil Docker optionnel avec MySQL local uniquement pour les tests isolés.

Mais le backend ne doit jamais dépendre du fait que MySQL tourne dans Docker.

---

# AP. Profils Docker

Utiliser si pertinent des profils :

```text
local
staging
production
```

ou plusieurs fichiers :

```text
docker-compose.yml
docker-compose.local.yml
docker-compose.staging.yml
docker-compose.prod.yml
```

Éviter de dupliquer énormément de configuration.

La configuration commune doit rester dans le compose principal.

---

# AQ. Reverse proxy conteneurisé

Inclure le reverse proxy dans Docker.

Options possibles :

- Traefik ;
- nginx ;
- Caddy.

Le choix doit être fait selon l'infrastructure finale.

Objectif :

```text
Internet
   |
HTTPS
   |
Reverse Proxy
   |
   +--> Frontend
   +--> API
   +--> Assets
```

---

# AR. HTTPS

En local :

HTTP est acceptable.

Sur :

```text
dev06.lfinfo.be
```

et production :

HTTPS obligatoire.

Prévoir certificat Let's Encrypt ou certificat géré par l'infrastructure existante.

Le changement de domaine doit uniquement nécessiter :

- DNS ;
- variable env ;
- configuration proxy/certificat.

---

# AS. Cookies et changement de domaine

L'authentification doit fonctionner correctement lors du passage entre environnements.

Configurer dynamiquement :

- domain ;
- Secure ;
- SameSite ;
- HttpOnly ;
- expiration.

Local :

```text
COOKIE_SECURE=false
```

Staging/prod :

```text
COOKIE_SECURE=true
```

Ne jamais coder le domaine cookie en dur.

---

# AT. CORS

Si frontend/backend sont sous le même domaine :

favoriser same-origin.

Si des origines séparées sont nécessaires plus tard :

la allowlist doit provenir de `.env`.

Exemple :

```text
CORS_ALLOWED_ORIGINS=https://dev06.lfinfo.be
```

Possibilité de plusieurs origines :

```text
CORS_ALLOWED_ORIGINS=https://dev06.lfinfo.be,https://mila.example
```

---

# AU. Liens générés par Mila

Tous les liens générés doivent utiliser la configuration publique actuelle.

Exemples :

- vérification email ;
- reset password ;
- invitation co-parent ;
- lien réservation ;
- QR code ;
- partage liste ;
- callback Mollie ;
- retour paiement ;
- OAuth éventuel.

Créer une fonction serveur unique :

```text
buildPublicUrl(path)
```

Exemple :

```text
buildPublicUrl("/l/mila-et-leo")
```

Aucun email ne doit contenir un domaine codé en dur.

---

# AV. Webhooks et changement de domaine

Les intégrations externes doivent utiliser :

```text
WEBHOOK_BASE_URL
```

ou être dérivées de `APP_URL`.

Exemple :

```text
https://dev06.lfinfo.be/api/v1/webhooks/mollie
```

Puis en prod :

```text
https://mila.tld/api/v1/webhooks/mollie
```

Le backend ne doit pas avoir besoin d'être recompilé pour cela si l'architecture le permet.

---

# AW. Mollie par environnement

Local :

- utiliser clés de test ;
- webhook via tunnel uniquement si nécessaire.

Staging `dev06.lfinfo.be` :

- clés Mollie test ;
- vrais webhooks HTTPS ;
- environnement idéal pour tester le flux complet.

Production :

- clés live ;
- domaine final ;
- callbacks production.

Variables :

```text
MOLLIE_MODE=test
MOLLIE_API_KEY=A_REMPLIR
MOLLIE_WEBHOOK_URL=
MOLLIE_REDIRECT_URL=
```

Ne jamais mélanger clés test et live.

---

# AX. Emails et domaine

Les templates email doivent utiliser :

```text
APP_URL
```

et non un domaine fixe.

Exemples :

```text
{{appUrl}}/verify-email/...
{{appUrl}}/reservation/...
{{appUrl}}/l/...
```

---

# AY. QR Codes

Les QR codes doivent être générés à partir de l'URL publique courante.

En staging :

```text
https://dev06.lfinfo.be/l/...
```

En production :

```text
https://mila.tld/l/...
```

Les QR codes générés en staging sont considérés comme temporaires.

---

# AZ. Storage et domaine

Si MinIO est utilisé, ne pas exposer directement son hostname interne.

Éviter :

```text
http://minio:9000/...
```

dans les données publiques.

Prévoir une couche publique stable :

```text
/assets/
```

ou :

```text
media.mila.tld
```

plus tard.

Le backend doit pouvoir reconstruire les URLs publiques.

---

# BA. Domaine final inconnu — contrainte obligatoire

Le domaine de production n'étant pas encore choisi, aucune partie de l'application ne doit supposer son nom.

Le code doit fonctionner avec n'importe quel domaine valide fourni via environnement.

Tests à prévoir :

```text
localhost
dev06.lfinfo.be
test.example.com
```

sans modification du code.

---

# BB. Script de changement d'environnement

Créer idéalement des commandes simples.

Exemples :

```bash
docker compose --env-file .env.local up -d
```

```bash
docker compose --env-file .env.staging up -d
```

```bash
docker compose --env-file .env.production up -d
```

ou scripts :

```bash
npm run docker:local
npm run docker:staging
npm run docker:prod
```

---

# BC. Fichiers d'environnement

Ne pas versionner les secrets.

Versionner uniquement des modèles :

```text
.env.example
.env.local.example
.env.staging.example
.env.production.example
```

Exemples :

```text
APP_DOMAIN=A_REMPLIR
DATABASE_HOST=A_REMPLIR
DATABASE_USER=A_REMPLIR
DATABASE_PASSWORD=A_REMPLIR
```

---

# BD. Healthchecks Docker

Chaque service critique doit disposer d'un healthcheck.

Exemples :

- backend ;
- Redis ;
- MinIO ;
- reverse proxy ;
- frontend si pertinent.

Le backend doit également vérifier l'accès MySQL déporté.

---

# BE. Ordre de démarrage

Éviter les simples `depends_on` supposant qu'un service est prêt.

Utiliser :

- healthchecks ;
- retry DB ;
- migrations contrôlées ;
- startup robuste.

---

# BF. Migrations au déploiement

Prévoir une commande explicite.

Exemple :

```bash
docker compose exec backend npx prisma migrate deploy
```

ou commande équivalente.

Ne pas appliquer automatiquement des migrations destructives au démarrage d'un conteneur production sans stratégie.

---

# BG. Procédure locale -> staging -> production

## Étape 1 — PC local

```text
localhost
```

Objectifs :

- frontend ;
- backend ;
- MySQL déporté dev ou MySQL local optionnel ;
- Redis ;
- storage ;
- tests.

## Étape 2 — Staging public

```text
dev06.lfinfo.be
```

Objectifs :

- HTTPS ;
- DNS réel ;
- cookies Secure ;
- emails ;
- Mollie test ;
- webhooks ;
- tests mobile ;
- tests famille/proches ;
- monitoring.

## Étape 3 — Production

Domaine Mila dédié.

Modifier principalement :

```text
APP_ENV
APP_URL
APP_DOMAIN
COOKIE_DOMAIN
CORS_ALLOWED_ORIGINS
MOLLIE credentials
SMTP settings si nécessaire
```

Puis :

- DNS ;
- certificat ;
- déploiement ;
- migrations ;
- smoke tests.

---

# BH. Checklist changement de domaine

Avant bascule :

- [ ] DNS configuré ;
- [ ] HTTPS valide ;
- [ ] APP_URL ;
- [ ] APP_DOMAIN ;
- [ ] COOKIE_DOMAIN ;
- [ ] CORS ;
- [ ] OAuth callbacks ;
- [ ] Mollie webhook ;
- [ ] Mollie redirect ;
- [ ] email URLs ;
- [ ] Open Graph ;
- [ ] canonical ;
- [ ] sitemap ;
- [ ] robots ;
- [ ] asset URLs ;
- [ ] QR codes ;
- [ ] tests auth ;
- [ ] tests paiement.

---

# BI. Canonical et SEO selon environnement

Local :

pas d'indexation.

Staging :

```text
noindex, nofollow
```

et `robots.txt` bloquant l'indexation.

`dev06.lfinfo.be` ne doit pas concurrencer le futur domaine production dans Google.

Production :

- indexation activée ;
- canonical production ;
- sitemap production.

Créer une variable :

```text
SEO_INDEXING_ENABLED=false
```

Local/staging :

```text
false
```

Production :

```text
true
```

---

# BJ. Open Graph selon domaine

Les metadata doivent utiliser l'URL publique actuelle.

Ne jamais conserver :

```text
parent-gift-hub.lovable.app
```

après migration.

---

# BK. Critère de réussite domaine portable

La portabilité du domaine est validée si :

1. le projet tourne sur localhost ;
2. le même build/code tourne sur `dev06.lfinfo.be` ;
3. aucun fichier source n'a été modifié pour effectuer ce changement ;
4. seuls env/DNS/proxy ont changé ;
5. auth fonctionne ;
6. emails génèrent les bons liens ;
7. Mollie utilise les bonnes callbacks ;
8. assets fonctionnent ;
9. QR codes utilisent le domaine courant ;
10. SEO staging reste désactivé.

---

# BL. Git et changements d'environnement

Les vrais `.env` ne doivent jamais être commités.

Les modifications d'infrastructure réutilisables peuvent être versionnées :

- Docker Compose ;
- reverse proxy templates ;
- `.env.*.example` ;
- documentation.

Commit exemple :

```text
feat(infra): add portable multi-domain Docker deployment
```

Puis :

```text
docs(infra): document localhost to dev06 deployment
```
