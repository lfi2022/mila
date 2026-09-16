# Paiement des cadeaux avec Mollie

Le visiteur peut ajouter plusieurs articles et participations d'une même liste à un panier, puis payer en une fois. Un achat entier réserve l'article pendant 30 minutes pendant le paiement. Une participation ne réserve pas l'article. Le webhook relit le paiement chez Mollie et crédite les articles et le montant attribué à la liste seulement après confirmation. Si un paiement arrive après l'expiration d'une réservation, le paiement reste visible pour traitement et remboursement manuel ; il n'est pas attribué à la liste.

Une réservation peut également être créée sans paiement immédiat. Dans le tableau de bord, les parents peuvent envoyer manuellement un rappel au réservant ou libérer l'article. Le rappel renouvelle le lien privé pendant 90 jours ; ce lien permet de payer la réservation existante avec Mollie ou de l'annuler. Une adresse e-mail est nécessaire pour envoyer le rappel et payer plus tard.

## Avant l'activation

Confirmer avec Mollie que le profil marchand Mila peut encaisser des cadeaux et cagnottes destinés à des parents particuliers, puis effectuer des virements manuels depuis le compte bancaire de Mila. L'API Payments classique verse normalement le solde Mollie sur le compte bancaire du marchand : le code de liste est une ventilation dans Mila, pas un compte Mollie distinct. Le montant « disponible pour demander » est un solde attribué calculé par Mila, pas le solde bancaire disponible chez Mollie. Avant chaque virement, rapprocher les paiements, remboursements, chargebacks, frais et règlements dans Mollie et vérifier le solde bancaire effectif.

## Configuration

1. Déployer la migration `202609150001_payment_cart` et lancer les contrôles Prisma.
2. Créer un profil et une clé API **test** dans Mollie. Configurer `MOLLIE_MODE=test`, `MOLLIE_API_KEY=test_...`, `MOLLIE_WEBHOOK_URL=https://<domaine>/api/v1/webhooks/mollie` et `MOLLIE_REDIRECT_URL=https://<domaine>/paiement/retour`.
3. Activer `FEATURE_MOLLIE_PAYMENTS=true`, `FEATURE_GIFT_MOLLIE_CHECKOUT=true` et `FEATURE_CONTRIBUTIONS=true`. Garder `FEATURE_BANK_TRANSFERS=false` si les participations doivent passer uniquement par Mollie. `FEATURE_PARENT_PAYOUTS` concerne un autre parcours Connect et reste désactivé pour les virements manuels.
4. Configurer `EMAIL_PROVIDER=smtp`, `EMAIL_FROM`, les variables `SMTP_*`, `WORKER_EMAIL_ENABLED=true`, puis démarrer le worker. En mode `console`, le reçu n'est pas envoyé.
5. Tester un panier avec plusieurs achats et participations, un paiement réussi, un échec, une expiration et un remboursement complet. Vérifier les onglets « Contributions » côté parent et « Paiements » côté administrateur.
6. Après accord de Mollie et rapprochement satisfaisant, remplacer la clé par la clé **live** et passer `MOLLIE_MODE=live`. Ne jamais mettre une clé API dans le navigateur.

## Exploitation des virements

Les parents configurent leur IBAN dans leur profil, puis demandent un montant attribué à leur liste. L'administrateur valide la demande, effectue le virement bancaire lui-même et saisit sa référence pour marquer la demande « effectuée ». L'application ne déclenche aucun virement automatiquement. Le compte destinataire et son IBAN chiffré sont figés dans la demande ; une modification ultérieure du profil ne redirige pas la demande déjà créée.

Le remboursement d'un panier de cadeaux depuis l'administration est complet. Un remboursement partiel reçu directement chez Mollie réduit le solde attribué à la liste, mais ne désigne pas automatiquement l'article concerné : il doit être rapproché manuellement.
