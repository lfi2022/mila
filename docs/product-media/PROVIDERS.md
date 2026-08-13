# Fournisseurs produit

Le contrat `ProductProvider` expose séparément les capacités `metadata`, `price`, `availability`,
`images`, `imageCache` et `affiliateLinks`. Une capacité déclarée signifie que l’intégration
technique et les droits correspondants ont été validés ; elle ne se déduit jamais de la présence
d’un élément Open Graph.

| Fournisseur | Domaines initiaux           | Métadonnées | Image | Cache image | Statut             |
| ----------- | --------------------------- | ----------: | ----: | ----------: | ------------------ |
| Amazon      | amazon.be/fr/de/nl          |         oui |   non |         non | connecteur prudent |
| IKEA        | ikea.com                    |         oui |   non |         non | connecteur prudent |
| Vertbaudet  | vertbaudet.be/fr            |         oui |   non |         non | connecteur prudent |
| Cybex       | cybex-online.com            |         oui |   non |         non | connecteur prudent |
| bol         | bol.com                     |         oui |   non |         non | connecteur prudent |
| Générique   | tout domaine HTTP(S) public |         oui |   non |         non | repli              |

Ces connecteurs utilisent aujourd’hui uniquement les métadonnées structurées publiques. Les clés,
contrats, endpoints officiels et droits d’image propres à chaque marchand sont **À COMPLÉTER** avant
d’activer `images` ou `imageCache`. Toute évolution doit être accompagnée d’une
`MerchantMediaPolicy` vérifiée et d’une preuve contractuelle.
