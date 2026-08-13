# Moteur d’images produit sécurisé

## Principe de sécurité et de conformité

Mila sépare strictement l’extraction de métadonnées produit et le droit d’utiliser une image.
Une URL trouvée dans JSON-LD ou Open Graph n’est jamais, à elle seule, une autorisation de
reproduction, de mise en cache ou même de hotlink. Le moteur applique donc **refus par défaut**.

Le flux est le suivant :

1. le `ProductProvider` correspondant récupère titre, prix, disponibilité et URL d’image ;
2. l’URL d’image est persistée avec sa provenance, normalement `REMOTE_UNVERIFIED` ;
3. `decideMediaUsage` confronte la provenance à la `MerchantMediaPolicy` ;
4. sans politique `VERIFIED` en cours de validité, l’image reste `REVIEW_REQUIRED` et n’est pas
   affichée ;
5. l’interface sélectionne une image autorisée ou un visuel de la bibliothèque générique ;
6. si et seulement si la politique autorise le cache et le stockage local, un job `product-media`
   télécharge le fichier dans MinIO après les contrôles de sécurité ;
7. un blocage administratif rend le média immédiatement inaccessible dans toutes les listes.

## Modèle de données

`ProductMedia` conserve l’URL d’origine, la clé locale éventuelle, la source, le statut d’usage,
les droits précis, l’attribution, les preuves et dates de vérification, la durée du cache ainsi que
les signalements. La table historique `gift_images` est conservée physiquement pour permettre une
migration sans perte ; son modèle applicatif est désormais `ProductMedia`.

`MerchantMediaPolicy` est unique par marchand. Ses autorisations sont indépendantes : affichage
distant, cache, stockage, transformation et usage commercial. L’absence de ligne équivaut à un
refus. Une politique ne peut passer à `VERIFIED` sans URL vers des conditions ou une licence.

`MediaClaim` prépare le traitement des réclamations. Sa création bloque aussi le média concerné.

## Sources et statuts

- `OFFICIAL_API`, `AFFILIATE_FEED`, `LICENSED` : exploitables uniquement avec une politique
  marchande vérifiée ;
- `USER_UPLOADED` : affichable après déclaration explicite de droits et contrôle du fichier ;
- `REMOTE_VERIFIED` : image distante dont les droits ont été vérifiés ;
- `REMOTE_UNVERIFIED` : détectée seulement, jamais affichée ni copiée ;
- `GENERIC_LIBRARY`, `GENERATED` : actifs contrôlés par Mila ;
- `BLOCKED` : interdit partout.

Les statuts `AUTHORIZED_REMOTE_ONLY` et `AUTHORIZED_CACHE` empêchent notamment qu’une permission
de hotlink soit interprétée comme une permission de copie.

## Téléversement parent

Le parent peut choisir son propre fichier JPEG, PNG ou WebP. Il doit confirmer qu’il en est
l’auteur ou qu’il dispose des droits nécessaires ; la case n’est pas pré-cochée. Le fichier suit le
flux signé MinIO, la vérification de signature et le scan avant exposition publique. Sans fichier
utilisateur utilisable, Mila affiche une illustration générique.

## Retrait et traçabilité

L’administration liste la provenance et les droits. L’action « Bloquer » place simultanément la
source, l’usage et le statut dans un état bloqué et écrit le motif dans le journal d’audit. Un média
bloqué ne passe plus le sélecteur public ni le contrôle d’accès `/assets/product-image/*`.

La suppression physique différée d’une copie MinIO bloquée reste **À COMPLÉTER** après définition
de la durée légale de conservation des preuves de réclamation.
