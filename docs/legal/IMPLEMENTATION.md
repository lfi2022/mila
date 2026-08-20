# Implémentation juridique et vie privée

Dernière revue technique : 13 août 2026.

Ce document décrit l’implémentation réellement présente. Il ne constitue pas un avis juridique. Les textes sources sont `mentions-legales.md`, `conditions-generales.md`, `politique-confidentialite.md` et `politique-cookies.md`.

## Pages publiques et versions

Les routes publiques `/mentions-legales`, `/conditions`, `/confidentialite` et `/cookies` rendent l’intégralité des documents, avec métadonnées SEO, URL canonique, sommaire, styles mobiles et liens permanents dans le pied de page. Les valeurs d’éditeur sont injectées par `/api/v1/legal/config` depuis les variables `LEGAL_*`. En production, les coordonnées obligatoires sont validées au démarrage. Les versions probatoires sont `LEGAL_TERMS_VERSION`, `LEGAL_PRIVACY_VERSION` et `LEGAL_COOKIE_POLICY_VERSION`.

Éléments restant À COMPLÉTER dans la configuration de production : identité et dénomination exactes, numéro BCE/TVA, adresse professionnelle publiable, hébergeur/fournisseur physique, responsable de publication, et adresses de contact effectivement supervisées. Aucune valeur fictive n’est injectée par le code.

## Acceptation des conditions et marketing

La création d’un compte exige une case CGU/CGV non pré-cochée. Le backend refuse une version différente de la version courante. Chaque acceptation est conservée dans `privacy_consents` avec l’utilisateur, la finalité `terms`, la version, la décision, la date serveur, la source, l’identifiant de requête et des empreintes HMAC de l’adresse IP et du user-agent. L’historique est append-only.

Le marketing est une case facultative distincte et non pré-cochée. Une décision négative est aussi enregistrée afin de démontrer l’absence d’opt-in. L’utilisateur peut modifier ce choix depuis son profil ; chaque changement crée une nouvelle preuve sans écraser l’historique.

## Inventaire technique des cookies et stockages

Inventaire généré à partir des appels `setCookie`, `document.cookie`, `localStorage` et du service worker détectés dans le dépôt :

La commande reproductible `npm run privacy:audit` extrait les noms littéraux et leurs fichiers sources. Les noms calculés depuis la configuration (session et CSRF) ainsi que les durées/finalités sont ensuite rapprochés manuellement du schéma de configuration et des routes, car une expression régulière ne peut pas les qualifier juridiquement.

| Élément                                                   | Finalité                                            |                         Durée détectée | Catégorie    |
| --------------------------------------------------------- | --------------------------------------------------- | -------------------------------------: | ------------ |
| cookie de session configurable, par défaut `mila_session` | authentification HttpOnly                           |                  `SESSION_TTL_SECONDS` | nécessaire   |
| suffixe `_csrf`                                           | protection CSRF                                     |                       durée de session | nécessaire   |
| `mila_list_access`                                        | accès à une liste protégée                          |                                1 heure | nécessaire   |
| `sidebar_state`                                           | préférence d’interface déclenchée par l’utilisateur |                                7 jours | fonctionnel  |
| `mila_partner_attribution`                                | attribution partenaire après action explicite       |                               30 jours | marketing    |
| `mila.cookie-consent`                                     | choix de confidentialité et identifiant de preuve   | jusqu’au retrait/changement de version | nécessaire   |
| `mila.analytics-visitor`                                  | audience interne pseudonyme                         |                       jusqu’au retrait | statistiques |
| `mila_referral`                                           | code de parrainage temporaire avant inscription     |            jusqu’à inscription/abandon | fonctionnel  |
| caches du service worker                                  | hors-ligne et ressources statiques                  |                   rotation par version | nécessaire   |

Les anciennes préférences d’audience seules ne valent plus consentement. Aucun événement d’audience n’est émis sans le nouveau consentement catégorisé. Le retrait supprime l’identifiant visiteur et arrête les observateurs de performance. Le bandeau offre « Tout refuser » et « Tout accepter » au même niveau, permet le choix par catégorie et reste rouvrable depuis chaque pied de page, la politique cookies et le profil. La preuve serveur anonyme conserve un identifiant pseudonyme, la version, la date, les choix, l’identifiant de requête et des empreintes HMAC ; elle ne conserve pas l’IP brute.

Les appels Google Fonts ont été supprimés : aucun chargement Google n’a lieu avant consentement. Aucun SDK publicitaire ou outil d’analytics tiers n’a été détecté. La catégorie marketing existe pour le mécanisme d’attribution interne, mais aucun traceur marketing tiers n’est actuellement chargé.

## Traitements et prestataires détectés

- MySQL : comptes, listes, cadeaux, réservations, consentements, demandes RGPD, opérations et journaux nécessaires.
- Redis : sessions de travail asynchrones, files et télémétrie des workers.
- MinIO/S3 compatible : couvertures, images, médias et exports ; l’infrastructure observée est auto-hébergée/configurable.
- SMTP : e-mails transactionnels de bienvenue, validation, réinitialisation, invitations et notifications. Le fournisseur contractuel exact reste À COMPLÉTER.
- Mollie : client et webhooks de paiement présents derrière des feature flags. Activation et contrats restent une décision de déploiement.
- Marchands et réseaux d’affiliation configurés : liens sortants, redirection et commissions lorsqu’un marchand réel est activé. Aucun partenaire fictif n’est déduit des textes.
- Navigateur : stockage local de consentement, parrainage temporaire, identifiant d’audience et cache PWA.

Les journaux applicatifs masquent les mots de passe, jetons, cookies, clés de stockage, clé Mollie et IBAN. Les données d’audience utilisent des chemins normalisés afin de ne pas enregistrer les slugs de listes.

## Minimisation et données relatives aux enfants

L’API publique ne renvoie ni identité ni e-mail du propriétaire, ni identité de l’acheteur/réservant. La date prévue, susceptible de révéler une information relative à une grossesse, est supprimée de toute réponse publique. Le prénom de l’enfant est supprimé des listes `PUBLIC` indexables ; il reste possible sur un lien `UNLISTED` ou `PROTECTED` choisi par le parent. Les métadonnées SEO n’intègrent plus le prénom. Les contenus libres et le titre restent sous le contrôle du parent et doivent être couverts par l’information produit et la modération.

## Exercice des droits et traçabilité

Le profil permet de modifier le prénom affiché, télécharger les données, supprimer/anonymiser le compte, gérer le marketing et les cookies, et déposer une demande d’accès, rectification, effacement, limitation, opposition, portabilité ou autre. L’export inclut les consentements et demandes RGPD.

La suppression révoque les sessions, anonymise le compte et retire les listes de la publication. Les données devant rester disponibles pour une obligation légale, la sécurité, la défense d’un droit ou une transaction ne sont pas présentées comme immédiatement effacées.

L’administration réservée aux rôles `ADMIN` et `SUPER_ADMIN` liste les demandes, leur échéance de 30 jours, leur état, leur responsable et leur résolution. Toute prise en charge ou clôture produit une entrée `admin_audit_logs` avec avant/après, acteur, motif et identifiant de requête.

## Zones financières

**VALIDATION JURIDIQUE REQUISE** avant toute mise en production de la cagnotte, des contributions destinées aux parents, de la conservation ou transmission de fonds, des virements aux parents, de Mollie Connect, des commandes automatiques, des remboursements/chargebacks et du partage de revenus. Le code ne doit pas faire de Mila un détenteur de fonds pour compte de tiers. Le modèle doit s’appuyer autant que possible sur un prestataire de paiement réglementé et sur un contrat validé.

Le flux manuel implémenté en août 2026 transmet une instruction de virement du compte de l'invité vers le compte personnel du parent explicitement sélectionné pour la liste. Ce parent doit être le propriétaire ou un coparent disposant de son propre compte configuré. Le changement de bénéficiaire ne modifie pas les instructions déjà émises, qui conservent un instantané du destinataire. Mila ne reçoit pas, ne conserve pas, ne reverse pas et ne rembourse pas ces fonds. Le parent confirme manuellement la réception ; cette confirmation ne constitue pas une vérification bancaire. L'IBAN est chiffré et n'est révélé qu'après création d'une intention limitée dans le temps. **VALIDATION JURIDIQUE REQUISE** reste applicable à la qualification de ce service, aux textes présentés aux utilisateurs et au traitement fiscal des sommes reçues.

Les textes décrivent des possibilités conditionnelles ; ils ne constituent pas une autorisation d’activer les feature flags correspondants. Cette implémentation ne modifie aucun flux financier ni aucune architecture de paiement.

## Vérifications et maintenance

À chaque ajout d’un SDK, d’un `setCookie`, d’un accès `localStorage`, d’un prestataire ou d’une nouvelle finalité : mettre à jour cet inventaire, le tableau généré de la politique cookies, la version concernée, les tests de non-dépôt et, si nécessaire, redemander le consentement. Avant production, faire valider les quatre documents et toutes les mentions À COMPLÉTER par un professionnel du droit belge.
