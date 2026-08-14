type EmailLayoutOptions = {
  title: string;
  preheader?: string;
  content: string;
  appUrl: string;
};

export function renderEmailLayout({ title, preheader, content, appUrl }: EmailLayoutOptions) {
  const year = new Date().getFullYear();

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(title)}</title>
</head>

<body
  style="
    margin:0;
    padding:0;
    background:linear-gradient(180deg,#f8f3f1 0%,#f2ebe8 100%);
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
    color:#2d2f3a;
  "
>
  ${
    preheader
      ? `<div
          style="
            display:none;
            max-height:0;
            overflow:hidden;
            opacity:0;
            color:transparent;
          "
        >
          ${escapeHtml(preheader)}
        </div>`
      : ""
  }

  <table
    role="presentation"
    width="100%"
    cellspacing="0"
    cellpadding="0"
    border="0"
    style="
      width:100%;
      background:linear-gradient(180deg,#f7f1ef 0%,#f2e8e4 100%);
    "
  >
    <tr>
      <td align="center" style="padding:32px 14px 22px;">

        <table
          role="presentation"
          width="100%"
          cellspacing="0"
          cellpadding="0"
          border="0"
          style="
            width:100%;
            max-width:620px;
          "
        >
          <tr>
            <td align="center" style="padding:4px 0 22px;">
              <a
                href="${escapeHtml(appUrl)}"
                style="
                  text-decoration:none;
                  display:inline-block;
                "
              >
                <div
                  style="
                    width:92px;
                    height:92px;
                    margin:0 auto 10px;
                    background:linear-gradient(135deg,#f7d8d3 0%,#ead9ef 50%,#dfe6ff 100%);
                    border:2px solid rgba(255,255,255,0.9);
                    border-radius:24px;
                    box-shadow:0 16px 30px rgba(90,74,74,0.16);
                    text-align:center;
                    line-height:92px;
                  "
                >
                  <img
                    src="${escapeHtml(new URL("/icon-192.png", appUrl).toString())}"
                    alt="Mila"
                    width="56"
                    height="56"
                    style="
                      display:inline-block;
                      width:56px;
                      height:56px;
                      vertical-align:middle;
                      border:0;
                      outline:none;
                      text-decoration:none;
                    "
                  >
                </div>
              </a>

              <div
                style="
                  font-size:10px;
                  line-height:1.5;
                  font-weight:700;
                  letter-spacing:2px;
                  text-transform:uppercase;
                  color:#a68b86;
                "
              >
                Vos envies, réunies avec douceur
              </div>
            </td>
          </tr>
        </table>

        <table
          role="presentation"
          width="100%"
          cellspacing="0"
          cellpadding="0"
          border="0"
          style="
            width:100%;
            max-width:620px;
            background:#ffffff;
            border:1px solid #f3e6e2;
            border-radius:30px;
            overflow:hidden;
            box-shadow:0 22px 42px rgba(76,58,55,0.10);
          "
        >
          <tr>
            <td
              style="
                height:12px;
                background:linear-gradient(90deg,#edc9c5 0%,#d8c4db 100%);
                font-size:0;
                line-height:0;
              "
            >
              &nbsp;
            </td>
          </tr>

          <tr>
            <td
              style="
                padding:42px 42px 30px;
              "
            >
              ${content}
            </td>
          </tr>

          <tr>
            <td
              align="center"
              style="
                padding:26px 34px 30px;
                background:linear-gradient(180deg,#fbf7f6 0%,#f7f3f1 100%);
                border-top:1px solid #f1e8e4;
              "
            >
              <div
                style="
                  margin-bottom:10px;
                  font-size:13px;
                  line-height:1.6;
                  color:#7d7a88;
                "
              >
                Une question ou simplement envie de retrouver vos listes ?
              </div>

              <a
                href="${escapeHtml(appUrl)}"
                style="
                  color:#3d4662;
                  text-decoration:none;
                  font-size:13px;
                  font-weight:700;
                "
              >
                Ouvrir Mila
              </a>

              <div
                style="
                  margin-top:24px;
                  font-size:11px;
                  line-height:1.7;
                  color:#a09ca8;
                "
              >
                Cet e-mail a été envoyé automatiquement par Mila.<br>
                © ${year} Mila · avecmila.be
              </div>
            </td>
          </tr>
        </table>

        <table
          role="presentation"
          width="100%"
          cellspacing="0"
          cellpadding="0"
          border="0"
          style="
            width:100%;
            max-width:620px;
          "
        >
          <tr>
            <td
              align="center"
              style="
                padding:18px 24px 0;
                font-size:10px;
                line-height:1.6;
                color:#a39ba3;
              "
            >
              Pour votre sécurité, ne transmettez jamais un lien privé reçu par e-mail
              à une personne que vous ne connaissez pas.
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function emailButton(label: string, url: string) {
  return `
<table
  role="presentation"
  cellspacing="0"
  cellpadding="0"
  border="0"
  style="
    margin:30px 0 28px;
  "
>
  <tr>
    <td
      align="center"
      style="
        background:linear-gradient(135deg,#4e587d 0%,#726179 100%);
        border-radius:999px;
        box-shadow:0 12px 20px rgba(78,88,125,0.22);
      "
    >
      <a
        href="${escapeHtml(url)}"
        style="
          display:inline-block;
          padding:16px 30px;
          font-size:15px;
          font-weight:700;
          line-height:1.1;
          letter-spacing:0.2px;
          color:#ffffff;
          text-decoration:none;
          border-radius:999px;
          border:1px solid rgba(255,255,255,0.18);
        "
      >
        ${escapeHtml(label)}
      </a>
    </td>
  </tr>
</table>`;
}

export function emailHeading(title: string) {
  return `
<h1
  style="
    margin:0 0 16px;
    font-size:31px;
    line-height:1.23;
    font-weight:800;
    letter-spacing:-0.8px;
    color:#2d2f3a;
  "
>
  ${escapeHtml(title)}
</h1>`;
}

export function emailSubheading(title: string) {
  return `
<h2
  style="
    margin:28px 0 12px;
    font-size:18px;
    line-height:1.4;
    font-weight:700;
    color:#45495f;
  "
>
  ${escapeHtml(title)}
</h2>`;
}

export function emailParagraph(text: string) {
  return `
<p
  style="
    margin:0 0 18px;
    font-size:16px;
    line-height:1.8;
    font-weight:500;
    color:#5f6473;
  "
>
  ${escapeHtml(text)}
</p>`;
}

export function emailLead(text: string) {
  return `
<p
  style="
    margin:0 0 24px;
    font-size:18px;
    line-height:1.7;
    font-weight:500;
    color:#55596f;
  "
>
  ${escapeHtml(text)}
</p>`;
}

export function emailNotice(text: string) {
  return `
<table
  role="presentation"
  width="100%"
  cellspacing="0"
  cellpadding="0"
  border="0"
  style="
    width:100%;
    margin:26px 0 4px;
  "
>
  <tr>
    <td
      style="
        padding:17px 18px;
        border-radius:16px;
        background:linear-gradient(180deg,#faf3f2 0%,#f5efee 100%);
        border:1px solid #efdfe0;
        color:#6f6a78;
        font-size:13px;
        line-height:1.65;
      "
    >
      ${escapeHtml(text)}
    </td>
  </tr>
</table>`;
}

export function emailHighlight(title: string, text: string, icon = "✨") {
  return `
<table
  role="presentation"
  width="100%"
  cellspacing="0"
  cellpadding="0"
  border="0"
  style="
    width:100%;
    margin:26px 0;
  "
>
  <tr>
    <td
      style="
        padding:22px;
        background:linear-gradient(180deg,#fffdfc 0%,#faf4f2 100%);
        border:1px solid #f0e5e1;
        border-radius:20px;
        box-shadow:inset 0 1px 0 rgba(255,255,255,0.8);
      "
    >
      <table
        role="presentation"
        width="100%"
        cellspacing="0"
        cellpadding="0"
        border="0"
      >
        <tr>
          <td
            valign="top"
            width="44"
            style="
              width:44px;
              font-size:24px;
              line-height:1;
              padding-top:2px;
            "
          >
            ${escapeHtml(icon)}
          </td>

          <td valign="top">
            <div
              style="
                margin-bottom:6px;
                font-size:15px;
                line-height:1.4;
                font-weight:700;
                color:#3b4153;
              "
            >
              ${escapeHtml(title)}
            </div>

            <div
              style="
                font-size:14px;
                line-height:1.65;
                color:#707587;
              "
            >
              ${escapeHtml(text)}
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

export function emailFeature(icon: string, title: string, text: string) {
  return `
<table
  role="presentation"
  width="100%"
  cellspacing="0"
  cellpadding="0"
  border="0"
  style="
    width:100%;
    margin:0 0 12px;
  "
>
  <tr>
    <td
      style="
        padding:15px 16px;
        background:#ffffff;
        border:1px solid #eee8e4;
        border-radius:14px;
      "
    >
      <table
        role="presentation"
        width="100%"
        cellspacing="0"
        cellpadding="0"
        border="0"
      >
        <tr>
          <td
            valign="top"
            width="38"
            style="
              width:38px;
              font-size:20px;
              line-height:1;
              padding-top:2px;
            "
          >
            ${escapeHtml(icon)}
          </td>

          <td valign="top">
            <div
              style="
                margin-bottom:3px;
                font-size:14px;
                line-height:1.4;
                font-weight:700;
                color:#464a61;
              "
            >
              ${escapeHtml(title)}
            </div>

            <div
              style="
                font-size:13px;
                line-height:1.6;
                color:#7d7e89;
              "
            >
              ${escapeHtml(text)}
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

export function emailDivider() {
  return `
<table
  role="presentation"
  width="100%"
  cellspacing="0"
  cellpadding="0"
  border="0"
  style="width:100%;margin:28px 0;"
>
  <tr>
    <td
      style="
        height:1px;
        background:#f0ebe8;
        font-size:0;
        line-height:0;
      "
    >
      &nbsp;
    </td>
  </tr>
</table>`;
}

export function emailFallbackLink(url: string) {
  return `
<table
  role="presentation"
  width="100%"
  cellspacing="0"
  cellpadding="0"
  border="0"
  style="
    width:100%;
    margin:24px 0 4px;
  "
>
  <tr>
    <td
      style="
        padding:15px 16px;
        border-radius:14px;
        background:#f9f8f7;
        border:1px solid #efebe8;
      "
    >
      <div
        style="
          margin-bottom:6px;
          font-size:11px;
          line-height:1.5;
          color:#9899a4;
        "
      >
        Le bouton ne fonctionne pas ? Copiez ce lien dans votre navigateur :
      </div>

      <div
        style="
          font-size:11px;
          line-height:1.5;
          word-break:break-all;
          color:#aa7776;
        "
      >
        ${escapeHtml(url)}
      </div>
    </td>
  </tr>
</table>`;
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
