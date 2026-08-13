# Sécurité du téléchargement d’images distantes

Le worker `product-media` est le seul composant autorisé à télécharger une image marchande. Le
téléchargement ne se déclenche que pour un média `AUTHORIZED_CACHE` avec `cacheAllowed=true`.

Contrôles appliqués :

- schémas HTTP(S) sans identifiants incorporés ;
- ports distants limités à 80 et 443 ;
- rejet de localhost, noms internes, IP privées, link-local, documentation, CGNAT et réservées ;
- résolution DNS avant chaque requête et épinglage de la connexion aux réponses validées ;
- nouvelle validation à chaque redirection, avec nombre maximal configurable ;
- délai strict par requête ;
- `Accept-Encoding: identity` pour éviter l’expansion d’un contenu compressé ;
- limite sur `Content-Length` puis limite réelle pendant la lecture en flux ;
- liste blanche MIME ; SVG, HTML et formats actifs exclus ;
- égalité obligatoire entre le MIME HTTP et la signature binaire détectée ;
- limite de pixels vérifiée depuis les en-têtes PNG/JPEG/WebP avant tout décodage ;
- stockage par empreinte SHA-256, avec provenance `authorized-remote` ;
- journalisation structurée sans URL ni secret.

Variables : `REMOTE_IMAGE_TIMEOUT_MS`, `MAX_REMOTE_IMAGE_BYTES`,
`REMOTE_IMAGE_MAX_REDIRECTS`, `MAX_IMAGE_PIXELS`, `ALLOWED_IMAGE_MIME_TYPES` et
`PRODUCT_MEDIA_CACHE_TTL_SECONDS`.

AVIF est accepté après signature binaire, mais la lecture précoce des dimensions AVIF est
**À COMPLÉTER** avant d’autoriser sa transformation côté serveur. Aucune transformation AVIF n’est
actuellement implémentée.
