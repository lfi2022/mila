import type { NotificationJob } from "../../modules/notifications/queue.js";
import type { EmailMessage } from "./types.js";

import {
  emailButton,
  emailFallbackLink,
  emailHeading,
  emailHighlight,
  emailLead,
  emailNotice,
  emailParagraph,
  escapeHtml,
  renderEmailLayout,
} from "./layout.js";

export function renderNotificationEmail(appUrl: string, job: NotificationJob): EmailMessage {
  const token = typeof job.payload?.["token"] === "string" ? job.payload["token"] : undefined;

  const body = typeof job.payload?.["body"] === "string" ? job.payload["body"] : undefined;

  switch (job.type) {
    case "WELCOME":
      return welcomeEmail(appUrl);

    case "EMAIL_VERIFICATION":
      return verificationEmail(appUrl, token);

    case "PASSWORD_RESET":
      return passwordResetEmail(appUrl, token);

    case "LIST_INVITATION":
      return listInvitationEmail(appUrl, token);

    case "PRICE_DROP":
      return priceDropEmail(appUrl, body);

    case "STOCK_UNAVAILABLE":
      return stockUnavailableEmail(appUrl, body);

    case "DEAD_LINK":
      return deadLinkEmail(appUrl, body);

    default:
      return genericEmail(appUrl, body);
  }
}

/**
 * ---------------------------------------------------------
 * BIENVENUE
 * ---------------------------------------------------------
 */

function welcomeEmail(appUrl: string): EmailMessage {
  const subject = "Bienvenue dans l’univers Mila ✨";

  const text = [
    "Bienvenue sur Mila ✨",
    "",
    "Votre espace est prêt.",
    "",
    "Vous pouvez maintenant créer votre liste, ajouter toutes vos envies et les partager simplement avec vos proches.",
    "",
    "Parce que les plus beaux cadeaux commencent souvent par une petite envie.",
    "",
    appUrl,
    "",
    "À très vite,",
    "Mila",
  ].join("\n");

  const content = `
    ${emailHeading("Bienvenue chez Mila ✨")}

    ${emailLead(
      "Votre espace est prêt. Il ne vous reste plus qu'à imaginer la liste qui vous ressemble.",
    )}

    ${emailHighlight(
      "Créez votre univers",
      "Ajoutez vos coups de cœur, rassemblez toutes vos envies au même endroit et partagez-les facilement avec vos proches.",
      "🎁",
    )}

    ${emailParagraph(
      "Grande enseigne, petite boutique, création artisanale ou simple idée cadeau : avec Mila, toutes vos envies ont leur place.",
    )}

    ${emailButton("Créer ma première liste", appUrl)}

    ${emailNotice(
      "La bonne surprise commence toujours par une petite envie…",
    )}
  `;

  return {
    subject,
    text,
    html: renderEmailLayout({
      title: subject,
      preheader: "Votre joli espace Mila est prêt ✨",
      content,
      appUrl,
    }),
  };
}

/**
 * ---------------------------------------------------------
 * VÉRIFICATION E-MAIL
 * ---------------------------------------------------------
 */

function verificationEmail(appUrl: string, token?: string): EmailMessage {
  const subject = "Plus qu’une petite étape ✨";

  const link = token
    ? buildUrl(appUrl, `/verification-email?token=${encodeURIComponent(token)}`)
    : appUrl;

  const text = [
    "Bienvenue sur Mila ✨",
    "",
    "Votre espace est presque prêt.",
    "",
    "Il suffit maintenant de confirmer votre adresse e-mail :",
    link,
    "",
    "Si vous n'êtes pas à l'origine de cette inscription, vous pouvez simplement ignorer cet e-mail.",
    "",
    "À très vite,",
    "Mila",
  ].join("\n");

  const content = `
    ${emailHeading("Encore une toute petite étape ✨")}

    ${emailLead(
      "Votre espace Mila est presque prêt. Confirmez simplement votre adresse e-mail pour finaliser votre inscription.",
    )}

    ${emailHighlight(
      "Confirmer votre compte",
      "Une validation rapide suffit pour commencer à organiser vos envies et les partager avec votre entourage.",
      "✅",
    )}

    ${emailButton("Confirmer mon adresse", link)}

    ${emailFallbackLink(link)}

    ${emailNotice(
      "Vous n'avez pas créé de compte Mila ? Pas d'inquiétude, vous pouvez simplement ignorer cet e-mail.",
    )}
  `;

  return {
    subject,
    text,
    html: renderEmailLayout({
      title: subject,
      preheader: "Confirmez votre adresse et commencez à créer votre liste Mila.",
      content,
      appUrl,
    }),
  };
}

/**
 * ---------------------------------------------------------
 * MOT DE PASSE
 * ---------------------------------------------------------
 */

function passwordResetEmail(appUrl: string, token?: string): EmailMessage {
  const subject = "Un petit oubli ? On s’occupe de tout 💌";

  const link = token
    ? buildUrl(appUrl, `/reinitialiser-mot-de-passe?token=${encodeURIComponent(token)}`)
    : appUrl;

  const text = [
    "Bonjour,",
    "",
    "Vous avez demandé à modifier le mot de passe de votre compte Mila.",
    "",
    "Vous pouvez en choisir un nouveau ici :",
    link,
    "",
    "Si vous n'êtes pas à l'origine de cette demande, vous n'avez rien à faire.",
    "",
    "À bientôt,",
    "Mila",
  ].join("\n");

  const content = `
    ${emailHeading("Un petit oubli ? 💌")}

    ${emailLead(
      "Pas de souci, cela arrive à tout le monde. Nous avons reçu une demande pour modifier le mot de passe de votre compte Mila.",
    )}

    ${emailHighlight(
      "Réinitialiser votre accès",
      "Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe en quelques secondes.",
      "🔐",
    )}

    ${emailButton("Créer un nouveau mot de passe", link)}

    ${emailFallbackLink(link)}

    ${emailNotice(
      "Vous n'êtes pas à l'origine de cette demande ? Vous pouvez ignorer cet e-mail : votre mot de passe actuel restera inchangé.",
    )}
  `;

  return {
    subject,
    text,
    html: renderEmailLayout({
      title: subject,
      preheader: "Voici votre lien pour choisir un nouveau mot de passe.",
      content,
      appUrl,
    }),
  };
}

/**
 * ---------------------------------------------------------
 * INVITATION À UNE LISTE
 * ---------------------------------------------------------
 */

function listInvitationEmail(appUrl: string, token?: string): EmailMessage {
  const subject = "Une invitation Mila vous attend 💌";

  const link = token ? buildUrl(appUrl, `/invitation/${encodeURIComponent(token)}`) : appUrl;

  const text = [
    "Une jolie invitation vous attend sur Mila ✨",
    "",
    "Quelqu'un souhaite partager une liste avec vous.",
    "",
    "Découvrez votre invitation :",
    link,
    "",
    "À très vite,",
    "Mila",
  ].join("\n");

  const content = `
    ${emailHeading("Vous êtes invité(e) 💌")}

    ${emailLead("Quelqu'un a choisi de partager un petit bout de son univers avec vous.")}

    ${emailHighlight(
      "Une invitation à ouvrir",
      "Vous avez été invité(e) à rejoindre une liste Mila et à participer à sa gestion en toute simplicité.",
      "✨",
    )}

    ${emailButton("Découvrir l’invitation", link)}

    ${emailFallbackLink(link)}

    ${emailNotice(
      "Cette invitation vous est personnellement destinée. Si vous ne la reconnaissez pas, vous pouvez simplement l'ignorer.",
    )}
  `;

  return {
    subject,
    text,
    html: renderEmailLayout({
      title: subject,
      preheader: "Quelqu'un souhaite partager une liste Mila avec vous.",
      content,
      appUrl,
    }),
  };
}

/**
 * ---------------------------------------------------------
 * BAISSE DE PRIX
 * ---------------------------------------------------------
 */

function priceDropEmail(appUrl: string, body?: string): EmailMessage {
  const subject = "Bonne nouvelle pour l’une de vos envies ✨";

  const message = body ?? "Le prix de l'un des cadeaux de votre liste vient de baisser.";

  const text = [
    "Une bonne nouvelle vient d'arriver sur votre liste Mila ✨",
    "",
    message,
    "",
    "Découvrez-la ici :",
    appUrl,
    "",
    "Mila",
  ].join("\n");

  const content = `
    ${emailHeading("Une jolie surprise ✨")}

    ${emailLead("Bonne nouvelle : un de vos coups de cœur a peut-être trouvé un meilleur moment.")}

    ${emailHighlight(
      "Prix en baisse",
      message,
      "📉",
    )}

    ${emailParagraph("C'est peut-être le bon moment pour aller y jeter un petit coup d'œil.")}

    ${emailButton("Voir ma liste", appUrl)}

    ${emailNotice(
      "Mila suit les prix lorsque les informations du marchand sont disponibles. Le prix affiché sur le site du vendeur au moment de l'achat reste toujours la référence.",
    )}
  `;

  return {
    subject,
    text,
    html: renderEmailLayout({
      title: subject,
      preheader: "Un cadeau de votre liste vient peut-être de devenir encore plus intéressant.",
      content,
      appUrl,
    }),
  };
}

/**
 * ---------------------------------------------------------
 * PRODUIT INDISPONIBLE
 * ---------------------------------------------------------
 */

function stockUnavailableEmail(appUrl: string, body?: string): EmailMessage {
  const subject = "Une petite vérification sur votre liste 🎁";

  const message = body ?? "L'un des cadeaux de votre liste semble momentanément indisponible.";

  const text = [
    "Un cadeau de votre liste mérite un petit coup d'œil.",
    "",
    message,
    "",
    "Vous pouvez le vérifier directement depuis votre espace Mila :",
    appUrl,
    "",
    "Mila",
  ].join("\n");

  const content = `
    ${emailHeading("Un cadeau joue à cache-cache 🎁")}

    ${emailLead("Une petite vérification peut être utile.")}

    ${emailHighlight(
      "Disponibilité à surveiller",
      message,
      "🛍️",
    )}

    ${emailParagraph(
      "Il peut simplement s'agir d'une rupture temporaire ou d'un changement chez le marchand.",
    )}

    ${emailButton("Voir le cadeau", appUrl)}

    ${emailNotice("Pas d'inquiétude : votre cadeau reste bien enregistré dans votre liste Mila.")}
  `;

  return {
    subject,
    text,
    html: renderEmailLayout({
      title: subject,
      preheader: "Un cadeau de votre liste semble momentanément indisponible.",
      content,
      appUrl,
    }),
  };
}

/**
 * ---------------------------------------------------------
 * LIEN INACCESSIBLE
 * ---------------------------------------------------------
 */

function deadLinkEmail(appUrl: string, body?: string): EmailMessage {
  const subject = "Un petit lien s’est égaré 🔗";

  const message =
    body ?? "Mila n'arrive plus à retrouver correctement l'un des cadeaux de votre liste.";

  const text = [
    "Un lien de votre liste Mila mérite une petite vérification.",
    "",
    message,
    "",
    "Cela peut arriver lorsqu'une boutique déplace ou modifie une fiche produit.",
    "",
    appUrl,
    "",
    "Mila",
  ].join("\n");

  const content = `
    ${emailHeading("Un petit lien s’est égaré 🔗")}

    ${emailLead("Mila n'a pas pu retrouver le produit avec certitude.")}

    ${emailHighlight(
      "Lien à vérifier",
      message,
      "🔎",
    )}

    ${emailParagraph(
      "Cela arrive parfois lorsqu'une boutique modifie, déplace ou retire une page produit.",
    )}

    ${emailButton("Vérifier mon cadeau", appUrl)}

    ${emailNotice(
      "Mila continuera à garder un œil dessus lorsque le marchand nous permet de le faire.",
    )}
  `;

  return {
    subject,
    text,
    html: renderEmailLayout({
      title: subject,
      preheader: "Un lien de votre liste mérite une petite vérification.",
      content,
      appUrl,
    }),
  };
}

/**
 * ---------------------------------------------------------
 * NOTIFICATION GÉNÉRIQUE
 * ---------------------------------------------------------
 */

function genericEmail(appUrl: string, body?: string): EmailMessage {
  const subject = "Du nouveau dans votre univers Mila ✨";

  const message = body ?? "Une nouveauté vous attend dans votre espace Mila.";

  const text = ["Du nouveau sur Mila ✨", "", message, "", appUrl, "", "À bientôt,", "Mila"].join(
    "\n",
  );

  const content = `
    ${emailHeading("Une petite nouveauté vous attend ✨")}

    ${emailLead("Du nouveau dans votre univers Mila.")}

    ${emailHighlight(
      "À l'affiche",
      message,
      "✨",
    )}

    ${emailButton("Découvrir sur Mila", appUrl)}
  `;

  return {
    subject,
    text,
    html: renderEmailLayout({
      title: subject,
      preheader: message,
      content,
      appUrl,
    }),
  };
}

function buildUrl(appUrl: string, path: string) {
  return new URL(path, appUrl).toString();
}
