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
    background:#f6f1ee;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
    color:#34384e;
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
      background:#f6f1ee;
    "
  >
    <tr>
      <td align="center" style="padding:32px 14px 22px;">

        <!-- LOGO OUTSIDE CARD -->
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
  <img
    src="${escapeHtml(new URL("/icon-192.png", appUrl).toString())}"
    alt="Mila"
    width="96"
    height="96"
    style="
      display:block;
      width:96px;
      height:96px;
      margin:0 auto;
      border:0;
      outline:none;
      text-decoration:none;
      border-radius:24px;
    "
  >
</a>

              <div
                style="
                  margin-top:9px;
                  font-size:10px;
                  line-height:1.4;
                  font-weight:700;
                  letter-spacing:2px;
                  text-transform:uppercase;
                  color:#a8918d;
                "
              >
                Vos envies, réunies avec douceur
              </div>
            </td>
          </tr>
        </table>

        <!-- MAIN CARD -->
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
            border:1px solid #ebe3df;
            border-radius:28px;
            overflow:hidden;
            box-shadow:0 10px 30px rgba(73,58,54,0.05);
          "
        >

          <!-- SOFT TOP STRIP -->
          <tr>
            <td
              style="
                height:10px;
                background:#ead0cd;
                font-size:0;
                line-height:0;
              "
            >
              &nbsp;
            </td>
          </tr>

          <!-- CONTENT -->
          <tr>
            <td
              style="
                padding:46px 42px 34px;
              "
            >
              ${content}
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td
              align="center"
              style="
                padding:28px 34px 32px;
                background:#fbf8f6;
                border-top:1px solid #f0e9e5;
              "
            >
              <div
                style="
                  margin-bottom:10px;
                  font-size:13px;
                  line-height:1.6;
                  color:#8e8b95;
                "
              >
                Une question ou simplement envie de retrouver vos listes ?
              </div>

              <a
                href="${escapeHtml(appUrl)}"
                style="
                  color:#575c78;
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
                  color:#aaa5ab;
                "
              >
                Cet e-mail a été envoyé automatiquement par Mila.<br>
                © ${year} Mila · avecmila.be
              </div>
            </td>
          </tr>
        </table>

        <!-- SECURITY NOTE -->
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
                color:#aaa5ab;
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
      bgcolor="#4b506b"
      style="
        border-radius:999px;
      "
    >
      <a
        href="${escapeHtml(url)}"
        style="
          display:inline-block;
          padding:15px 27px;
          font-size:15px;
          font-weight:700;
          line-height:1.1;
          color:#ffffff;
          text-decoration:none;
          border-radius:999px;
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
    font-size:30px;
    line-height:1.24;
    font-weight:750;
    letter-spacing:-0.7px;
    color:#34384e;
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
    line-height:1.75;
    color:#686a78;
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
        background:#faf5f2;
        border:1px solid #f1e6e1;
        color:#7b7882;
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
        background:#fbf7f5;
        border:1px solid #eee4df;
        border-radius:20px;
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
                color:#464a61;
              "
            >
              ${escapeHtml(title)}
            </div>

            <div
              style="
                font-size:14px;
                line-height:1.65;
                color:#777885;
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
