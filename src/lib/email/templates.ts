/**
 * Centralised transactional email templates.
 * Pure functions so they can be unit-tested and reused by any provider.
 */

export type EmailTemplate = { subject: string; html: string; text: string };

const BRAND = "Mila";

function layout(title: string, bodyHtml: string, footer?: string): string {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:24px;background:#fdf3f1;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#2e3a5c">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #f2ddd8;border-radius:18px;padding:32px">
    <p style="margin:0 0 24px;font-size:20px;font-weight:700;color:#2e3a5c">${BRAND}<span style="color:#f7b0a0">.</span></p>
    <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3">${title}</h1>
    ${bodyHtml}
    <p style="margin:32px 0 0;font-size:12px;color:#7c8299">${footer ?? `Vous recevez cet email car vous utilisez ${BRAND}, la plateforme de listes de naissance.`}</p>
  </div>
</body></html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:24px 0"><a href="${href}" style="display:inline-block;background:#2e3a5c;color:#fff;text-decoration:none;padding:12px 20px;border-radius:12px;font-weight:600">${label}</a></p>`;
}

export const emailTemplates = {
  welcome: (params: { name: string; appUrl: string }): EmailTemplate => ({
    subject: `Bienvenue sur ${BRAND} 👶`,
    html: layout(
      `Bienvenue ${params.name} !`,
      `<p>Votre compte est prêt. Créez votre liste de naissance, ajoutez vos cadeaux préférés depuis n'importe quelle boutique, puis partagez-la à vos proches.</p>${button(`${params.appUrl}/onboarding`, "Créer ma liste")}`,
    ),
    text: `Bienvenue ${params.name} ! Créez votre liste : ${params.appUrl}/onboarding`,
  }),

  coParentInvitation: (params: {
    listTitle: string;
    inviterName: string;
    link: string;
  }): EmailTemplate => ({
    subject: `${params.inviterName} vous invite à gérer « ${params.listTitle} »`,
    html: layout(
      "Vous êtes invité·e à gérer une liste",
      `<p><strong>${params.inviterName}</strong> souhaite gérer la liste « ${params.listTitle} » avec vous sur ${BRAND}.</p>${button(params.link, "Rejoindre la liste")}<p style="font-size:13px;color:#7c8299">Ce lien expire dans 14 jours.</p>`,
    ),
    text: `${params.inviterName} vous invite à gérer « ${params.listTitle} » : ${params.link}`,
  }),

  reservationConfirmation: (params: {
    guestName: string;
    itemTitle: string;
    listTitle: string;
    manageLink: string;
  }): EmailTemplate => ({
    subject: `Votre réservation : ${params.itemTitle}`,
    html: layout(
      `Merci ${params.guestName} !`,
      `<p>Vous avez réservé <strong>${params.itemTitle}</strong> sur la liste « ${params.listTitle} ». Personne d'autre ne pourra le réserver.</p>
       <p>Avec le lien ci-dessous, vous pouvez à tout moment modifier votre message, indiquer que le cadeau a été acheté ou annuler votre réservation.</p>
       ${button(params.manageLink, "Gérer ma réservation")}
       <p style="font-size:13px;color:#7c8299">Conservez ce lien : il est personnel et confidentiel.</p>`,
      "Vous recevez cet email car vous avez réservé un cadeau sur une liste Mila.",
    ),
    text: `Merci ${params.guestName} ! Vous avez réservé ${params.itemTitle}. Gérer votre réservation : ${params.manageLink}`,
  }),

  reservationCancelled: (params: { itemTitle: string; listTitle: string }): EmailTemplate => ({
    subject: `Réservation annulée : ${params.itemTitle}`,
    html: layout(
      "Réservation annulée",
      `<p>La réservation de <strong>${params.itemTitle}</strong> sur « ${params.listTitle} » a bien été annulée. Le cadeau est de nouveau disponible.</p>`,
    ),
    text: `Réservation annulée : ${params.itemTitle} (${params.listTitle}).`,
  }),

  giftReserved: (params: {
    itemTitle: string;
    guestName: string;
    listTitle: string;
    appUrl: string;
    surprise: boolean;
  }): EmailTemplate => ({
    subject: params.surprise
      ? `Un cadeau vient d'être réservé 🎁`
      : `${params.guestName} a réservé ${params.itemTitle}`,
    html: layout(
      params.surprise
        ? "Un cadeau a trouvé quelqu'un 🎁"
        : `${params.guestName} a réservé un cadeau`,
      params.surprise
        ? `<p>Bonne nouvelle : un cadeau de « ${params.listTitle} » vient d'être réservé. Le mode surprise est activé, les détails restent cachés jusqu'à ce que vous les révéliez.</p>${button(`${params.appUrl}/dashboard`, "Voir mon tableau de bord")}`
        : `<p><strong>${params.guestName}</strong> a réservé <strong>${params.itemTitle}</strong> sur « ${params.listTitle} ».</p>${button(`${params.appUrl}/dashboard`, "Voir les réservations")}`,
    ),
    text: params.surprise
      ? `Un cadeau de « ${params.listTitle} » vient d'être réservé.`
      : `${params.guestName} a réservé ${params.itemTitle} sur ${params.listTitle}.`,
  }),

  giftPurchased: (params: {
    itemTitle: string;
    listTitle: string;
    appUrl: string;
    surprise: boolean;
  }): EmailTemplate => ({
    subject: params.surprise ? "Un cadeau a été acheté 🎁" : `${params.itemTitle} a été acheté`,
    html: layout(
      params.surprise ? "Un cadeau a été acheté 🎁" : `« ${params.itemTitle} » a été acheté`,
      `<p>Un proche a confirmé son achat sur la liste « ${params.listTitle} ».</p>${button(`${params.appUrl}/dashboard`, "Ouvrir Mila")}`,
    ),
    text: `Un cadeau a été acheté sur ${params.listTitle}.`,
  }),

  messageReceived: (params: {
    guestName: string;
    message: string;
    listTitle: string;
    appUrl: string;
  }): EmailTemplate => ({
    subject: `Nouveau message de ${params.guestName}`,
    html: layout(
      `Un mot doux de ${params.guestName}`,
      `<blockquote style="margin:0;padding:16px;background:#fdf3f1;border-radius:12px;font-style:italic">${params.message}</blockquote>${button(`${params.appUrl}/dashboard`, "Voir tous les messages")}`,
    ),
    text: `${params.guestName} : ${params.message}`,
  }),

  rewardCredited: (params: {
    amount: string;
    pending: boolean;
    appUrl: string;
    registryId: string;
  }): EmailTemplate => ({
    subject: params.pending
      ? `Une récompense de ${params.amount} est en attente`
      : `${params.amount} ajoutés à vos Récompenses Mila 🎁`,
    html: layout(
      params.pending ? "Une récompense arrive" : "Vos cadeaux vous font un cadeau ❤️",
      params.pending
        ? `<p>Une récompense de <strong>${params.amount}</strong> est en attente de confirmation. Elle deviendra disponible dès que la source sera définitivement validée.</p>${button(`${params.appUrl}/recompenses/${params.registryId}`, "Voir mes récompenses")}`
        : `<p><strong>${params.amount}</strong> viennent d'être ajoutés à vos Récompenses Mila.</p>${button(`${params.appUrl}/recompenses/${params.registryId}`, "Voir mes récompenses")}`,
    ),
    text: params.pending
      ? `Une récompense de ${params.amount} est en attente de confirmation.`
      : `${params.amount} ajoutés à vos Récompenses Mila : ${params.appUrl}/recompenses/${params.registryId}`,
  }),

  rewardRedeemed: (params: {
    amount: string;
    label: string;
    appUrl: string;
    registryId: string;
  }): EmailTemplate => ({
    subject: `Vous avez utilisé ${params.amount} de récompenses`,
    html: layout(
      "Récompenses utilisées",
      `<p>Votre demande pour <strong>${params.label}</strong> (${params.amount}) a bien été enregistrée.</p>${button(`${params.appUrl}/recompenses/${params.registryId}`, "Voir mon historique")}`,
    ),
    text: `Vous avez utilisé ${params.amount} de récompenses pour ${params.label}.`,
  }),

  referralQualified: (params: {
    amount: string;
    appUrl: string;
    registryId: string;
  }): EmailTemplate => ({
    subject: "Votre parrainage a été validé 🎉",
    html: layout(
      "Parrainage validé",
      `<p>Un parent que vous avez invité a créé sa liste : <strong>${params.amount}</strong> ont été ajoutés à vos Récompenses Mila.</p>${button(`${params.appUrl}/recompenses/${params.registryId}`, "Voir mes récompenses")}`,
    ),
    text: `Parrainage validé : ${params.amount} ajoutés à vos récompenses.`,
  }),

  rewardExpiring: (params: {
    amount: string;
    date: string;
    appUrl: string;
    registryId: string;
  }): EmailTemplate => ({
    subject: `${params.amount} de récompenses expirent bientôt`,
    html: layout(
      "Vos récompenses expirent bientôt",
      `<p><strong>${params.amount}</strong> de récompenses expirent le ${params.date}.</p>${button(`${params.appUrl}/recompenses/${params.registryId}`, "Utiliser mes récompenses")}`,
    ),
    text: `${params.amount} de récompenses expirent le ${params.date}.`,
  }),
} as const;
