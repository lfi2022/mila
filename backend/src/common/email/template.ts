import type { NotificationJob } from "../../modules/notifications/queue.js";
import type { EmailMessage } from "./types.js";

import {
  emailButton,
  emailFallbackLink,
  emailHeading,
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

function welcomeEmail(appUrl: string): EmailMessage {
  const subject = "Bienvenue sur Mila ❤️";

  const text = [
    "Bienvenue sur Mila !",
    "",
    "Votre compte est prêt.",
    "Vous pouvez maintenant créer votre liste et réunir toutes vos envies au même endroit.",
    "",
    appUrl,
    "",
    "À bientôt,",
    "Mila",
  ].join("\n");

  const content = `
    ${emailHeading("Bienvenue sur Mila ❤️")}

    ${emailParagraph(
      "Votre compte est prêt. Vous pouvez maintenant créer votre liste et réunir toutes vos envies au même endroit.",
    )}

    ${emailButton("Découvrir mon espace", appUrl)}

    ${emailNotice(
      "Amazon, IKEA, petites boutiques, cadeaux personnalisés… avec Mila, toutes vos envies peuvent vivre sur une seule liste.",
    )}
  `;

  return {
    subject,
    text,
    html: renderEmailLayout({
      title: subject,
      preheader: "Votre aventure Mila peut commencer.",
      content,
      appUrl,
    }),
  };
}

function verificationEmail(appUrl: string, token?: string): EmailMessage {
  const subject = "Confirmez votre adresse e-mail ❤️";

  const link = token
    ? buildUrl(appUrl, `/verification-email?token=${encodeURIComponent(token)}`)
    : appUrl;

  const text = [
    "Bienvenue sur Mila !",
    "",
    "Il ne reste qu'une petite étape pour activer votre compte.",
    "",
    "Confirmez votre adresse e-mail :",
    link,
    "",
    "Si vous n'avez pas créé de compte Mila, vous pouvez ignorer cet e-mail.",
  ].join("\n");

  const content = `
    ${emailHeading("Encore une petite étape ❤️")}

    ${emailParagraph(
      "Pour protéger votre compte et commencer à créer votre liste, confirmez simplement votre adresse e-mail.",
    )}

    ${emailButton("Confirmer mon adresse", link)}

    ${emailFallbackLink(link)}

    ${emailNotice(
      "Vous n'êtes pas à l'origine de cette inscription ? Aucun souci, vous pouvez simplement ignorer cet e-mail.",
    )}
  `;

  return {
    subject,
    text,
    html: renderEmailLayout({
      title: subject,
      preheader: "Confirmez votre adresse pour activer votre compte Mila.",
      content,
      appUrl,
    }),
  };
}

function passwordResetEmail(appUrl: string, token?: string): EmailMessage {
  const subject = "Réinitialisez votre mot de passe Mila";

  const link = token
    ? buildUrl(appUrl, `/reinitialiser-mot-de-passe?token=${encodeURIComponent(token)}`)
    : appUrl;

  const text = [
    "Une demande de réinitialisation de votre mot de passe Mila a été reçue.",
    "",
    link,
    "",
    "Si vous n'avez rien demandé, ignorez cet e-mail.",
  ].join("\n");

  const content = `
    ${emailHeading("Mot de passe oublié ?")}

    ${emailParagraph("Nous avons reçu une demande de réinitialisation de votre mot de passe.")}

    ${emailButton("Choisir un nouveau mot de passe", link)}

    ${emailFallbackLink(link)}

    ${emailNotice(
      "Si vous n'avez pas demandé cette réinitialisation, ne cliquez sur rien : votre mot de passe actuel reste inchangé.",
    )}
  `;

  return {
    subject,
    text,
    html: renderEmailLayout({
      title: subject,
      preheader: "Votre lien sécurisé de réinitialisation Mila.",
      content,
      appUrl,
    }),
  };
}

function listInvitationEmail(appUrl: string, token?: string): EmailMessage {
  const subject = "Vous êtes invité(e) sur une liste Mila ❤️";

  const link = token ? buildUrl(appUrl, `/invitation/${encodeURIComponent(token)}`) : appUrl;

  const text = ["Vous avez reçu une invitation à rejoindre une liste Mila.", "", link].join("\n");

  const content = `
    ${emailHeading("Une jolie invitation vous attend ❤️")}

    ${emailParagraph(
      "Vous avez été invité(e) à rejoindre et participer à la gestion d'une liste Mila.",
    )}

    ${emailButton("Voir l'invitation", link)}

    ${emailFallbackLink(link)}

    ${emailNotice(
      "Cette invitation est personnelle. Si vous ne vous attendiez pas à la recevoir, vous pouvez simplement l'ignorer.",
    )}
  `;

  return {
    subject,
    text,
    html: renderEmailLayout({
      title: subject,
      preheader: "Une invitation Mila vous attend.",
      content,
      appUrl,
    }),
  };
}

function priceDropEmail(appUrl: string, body?: string): EmailMessage {
  const subject = "Bonne nouvelle : un prix a baissé 🎉";

  const message = body ?? "Un cadeau de votre liste vient de baisser de prix.";

  const text = `${message}\n\n${appUrl}`;

  const content = `
    ${emailHeading("Une petite économie se profile 🎉")}

    ${emailParagraph(message)}

    ${emailButton("Voir ma liste", appUrl)}

    ${emailNotice(
      "Les prix sont récupérés automatiquement lorsqu'une source fiable est disponible. Le prix affiché par le marchand au moment de l'achat reste la référence.",
    )}
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

function stockUnavailableEmail(appUrl: string, body?: string): EmailMessage {
  const subject = "Un cadeau semble indisponible";

  const message =
    body ?? "Un cadeau de votre liste semble ne plus être disponible chez le marchand.";

  const text = `${message}\n\n${appUrl}`;

  const content = `
    ${emailHeading("Un cadeau mérite votre attention")}

    ${emailParagraph(message)}

    ${emailParagraph(
      "Vous pouvez vérifier le produit ou choisir une autre offre depuis votre espace Mila.",
    )}

    ${emailButton("Vérifier ma liste", appUrl)}
  `;

  return {
    subject,
    text,
    html: renderEmailLayout({
      title: subject,
      preheader: "Un cadeau de votre liste semble indisponible.",
      content,
      appUrl,
    }),
  };
}

function deadLinkEmail(appUrl: string, body?: string): EmailMessage {
  const subject = "Un lien cadeau est à vérifier";

  const message =
    body ?? "Mila n'arrive plus à vérifier correctement l'un des liens de votre liste.";

  const text = `${message}\n\n${appUrl}`;

  const content = `
    ${emailHeading("Un petit lien à vérifier 🔗")}

    ${emailParagraph(message)}

    ${emailParagraph("Cela peut arriver lorsqu'un marchand déplace ou retire une fiche produit.")}

    ${emailButton("Vérifier le cadeau", appUrl)}

    ${emailNotice(
      "Mila continuera à surveiller automatiquement le produit lorsque cela est possible.",
    )}
  `;

  return {
    subject,
    text,
    html: renderEmailLayout({
      title: subject,
      preheader: "Un lien de votre liste semble ne plus fonctionner.",
      content,
      appUrl,
    }),
  };
}

function genericEmail(appUrl: string, body?: string): EmailMessage {
  const subject = "Une nouvelle activité sur Mila";

  const message = body ?? "Une nouvelle activité est disponible dans votre espace Mila.";

  const text = `${message}\n\n${appUrl}`;

  const content = `
    ${emailHeading("Du nouveau sur Mila ❤️")}

    ${emailParagraph(message)}

    ${emailButton("Ouvrir Mila", appUrl)}
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
