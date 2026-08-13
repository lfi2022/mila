# Mila — évolution vers une plateforme complète

## 1. Audit de l'existant

Ce qui fonctionne déjà et sera conservé :

- **Auth** : email/mot de passe + Google, page `/auth`, contexte `useAuth`, profils créés automatiquement à l'inscription.
- **Base de données** : `profiles`, `registries` (une liste = un propriétaire, slug public, `is_public`), `items` (titre, magasin, lien, prix, image, quantité, quantité réservée), `reservations` (prénom, email, message, quantité), `notifications`. Règles d'accès en place, déclencheurs qui synchronisent la quantité réservée et notifient les parents.
- **Frontend** : accueil, tableau de bord parents (`/dashboard`), éditeur de liste (`/dashboard/$registryId`), page publique (`/liste/$slug`), design terracotta doux (Fraunces + Manrope), composants UI shadcn complets.

Limites à corriger :

- Une liste est liée à un seul parent (`owner_id`) → impossible d'inviter le second parent.
- Pas de type de liste, pas d'archivage, pas de mode surprise, un seul niveau de visibilité (public/privé).
- Ajout de cadeau 100 % manuel : pas d'extraction depuis une URL.
- Pas de statut explicite par cadeau (seulement un compteur), risque de double réservation en cas de clics simultanés.
- Aucun système de marchands, de redirection `/go/`, de suivi de clics.
- Pas d'espace visiteur pour gérer sa réservation, pas d'emails, pas d'administration, pas de rôles.
- Partage limité au copier-lien (pas de QR code ni partage natif).
- La liste publique reste indexable sans choix du parent.

## 2. Nouveaux modèles de données

Évolution du schéma existant (les données actuelles sont migrées, rien n'est supprimé) :

- `registries` devient une liste générique : `type` (BIRTH, BIRTHDAY, CHRISTENING, WEDDING, CHRISTMAS, OTHER), `visibility` (PUBLIC, UNLISTED, PROTECTED), `access_code_hash`, `surprise_mode`, `surprises_revealed_at`, `allow_indexing`, `status` (ACTIVE, ARCHIVED, SUSPENDED), `cover_image_url`, `description`, `is_demo`.
- `list_members` : membres d'une liste avec rôle OWNER / CO_OWNER / EDITOR (les propriétaires actuels sont insérés automatiquement comme OWNER).
- `list_invitations` : invitation du second parent par email avec token à expiration.
- `items` : `status` (AVAILABLE, RESERVED, PURCHASED), `kind` (LINK, MANUAL, CONTRIBUTION), `currency`, `merchant_id`, `hidden_by_moderator`, `public_token` pour `/go/`.
- `merchants` : nom, domaines, logo, activation, affiliation (réseau, identifiant, gabarit de lien). Les secrets restent côté serveur.
- `click_events` : clic sur un cadeau (cadeau, liste, marchand, date, type, affilié ou non) sans donnée personnelle.
- `reservations` : `status`, `token_hash` + expiration pour le lien sécurisé visiteur, `purchased_at`, `cancelled_at`.
- `user_roles` (+ enum USER, MODERATOR, ADMIN, SUPER_ADMIN) dans une table séparée avec fonction `has_role`.
- `reports` (signalements) et `admin_audit_log`.
- `plans` / `entitlements` : table de features et flags par liste (`premium` désactivé par défaut, aucun paiement simulé).
- `contribution_goals` : préparé derrière un flag désactivé, aucune manipulation d'argent.

Réservation : verrou en base (transaction + contrainte) pour qu'un cadeau ne puisse jamais être réservé deux fois.

## 3. Nouvelles routes

Parents :
- `/dashboard` enrichi : checklist d'onboarding, listes actives/archivées.
- `/dashboard/$listId` : onglets Cadeaux, Réservations & messages, Partage, Parents, Paramètres.
- `/onboarding` : 4 étapes courtes après inscription.
- `/profil` : profil, suppression de compte, export des données.
- `/invitation/$token` : acceptation d'invitation du second parent.

Public :
- `/l/$slug` (nouvelle URL courte, `/liste/$slug` redirigé pour ne rien casser).
- `/go/$token` : redirection sécurisée vers le marchand + enregistrement du clic.
- `/r/$token` : espace visiteur pour voir, modifier, marquer comme acheté ou annuler sa réservation.
- `/confidentialite`, `/conditions`, `/demo`.

Admin (protégé côté serveur) :
- `/admin` tableau de bord (chiffres réels uniquement), `/admin/utilisateurs`, `/admin/listes`, `/admin/marchands`, `/admin/moderation`.

## 4. Implémenté maintenant (P0 + P1)

1. Migration du schéma complet ci-dessus avec règles d'accès et rôles.
2. Multi-parents : invitation, rôles, permissions serveur.
3. Ajout de cadeau par URL : extraction serveur des métadonnées (Open Graph, JSON-LD Product, meta), aperçu modifiable, repli manuel toujours possible. Fetch fortement sécurisé (schémas autorisés, blocage IP privées/localhost, taille et délai limités).
4. Cadeaux manuels et cadeaux « participation » (affichage seul pour l'instant).
5. Statuts de cadeaux + réservation sans compte protégée contre la concurrence.
6. Lien sécurisé visiteur `/r/$token` (voir, modifier le message, marquer acheté, annuler).
7. Marchands + reconnaissance par domaine + redirection `/go/` + suivi des clics anonymes.
8. Mode surprise, 3 niveaux de confidentialité (dont code d'accès), contrôle de l'indexation, SEO propre par liste (title, description, Open Graph, canonical, noindex quand demandé).
9. Partage : copier, QR code téléchargeable, WhatsApp, Facebook, email, partage natif mobile.
10. Centre de notifications parents respectant le mode surprise.
11. Emails transactionnels : couche d'abstraction + gabarits centralisés (réservation, annulation, achat, message, invitation, bienvenue). Envoi réel activé si l'envoi d'emails est disponible, sinon journalisé sans casser le parcours.
12. Administration : rôles, dashboard avec données réelles, gestion des marchands (avec test de génération de lien), modération et journal d'audit.
13. Onboarding + checklist, liste de démonstration clairement marquée « fictive ».
14. Sécurité : validation serveur systématique, limitation de débit sur réservation/extraction/auth, anti-spam, validation stricte des URL.

## 5. Préparé mais laissé désactivé

- Autres types de listes (BIRTHDAY, WEDDING…) : modèle prêt, seule l'interface Naissance visible.
- Mila Premium : plans, features et entitlements en base, aucun blocage actif, aucun paiement.
- Cagnotte / contributions financières : modèle minimal derrière un flag désactivé, aucun stockage d'argent.
- Contenu éditorial SEO : structure de routes prévue, pas de contenu créé.

## 6. Méthode

Livraison par étapes, en conservant l'existant fonctionnel à chaque étape : migration → serveur (fonctions, sécurité, extraction, `/go/`) → parcours parents → parcours public/visiteur → admin → finitions SEO/RGPD/accessibilité. Aucune donnée fictive hors démo identifiée.
