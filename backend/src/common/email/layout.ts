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
    background:#f8f6f3;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
    color:#34384e;
  "
>
  ${
    preheader
      ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
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
    style="width:100%;background:#f8f6f3;"
  >
    <tr>
      <td align="center" style="padding:36px 16px;">

        <table
          role="presentation"
          width="100%"
          cellspacing="0"
          cellpadding="0"
          border="0"
          style="
            width:100%;
            max-width:600px;
            background:#ffffff;
            border:1px solid #eee7e1;
            border-radius:24px;
            overflow:hidden;
          "
        >

          <!-- Header -->
          <tr>
            <td
              align="center"
              style="
                padding:34px 32px 26px;
                background:#fbf3ef;
              "
            >
              <a
                href="${escapeHtml(appUrl)}"
                style="text-decoration:none;"
              >
                <span
                  style="
                    font-size:34px;
                    font-weight:700;
                    letter-spacing:-1.5px;
                    color:#3f435c;
                  "
                >
                  mila
                </span>
                <span
                  style="
                    font-size:26px;
                    color:#e3a2a8;
                  "
                >♥</span>
              </a>

              <div
                style="
                  margin-top:7px;
                  font-size:11px;
                  font-weight:600;
                  letter-spacing:2.2px;
                  text-transform:uppercase;
                  color:#aa8f88;
                "
              >
                Vos envies, réunies avec douceur
              </div>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:38px 38px 26px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td
              align="center"
              style="
                padding:26px 32px 34px;
                border-top:1px solid #f0ebe7;
                font-size:12px;
                line-height:1.7;
                color:#999aa5;
              "
            >
              Cet e-mail a été envoyé automatiquement par Mila.

              <br>

              <a
                href="${escapeHtml(appUrl)}"
                style="
                  color:#7c7181;
                  text-decoration:none;
                  font-weight:600;
                "
              >
                avecmila.be
              </a>

              <br><br>

              © ${year} Mila
            </td>
          </tr>

        </table>

        <div
          style="
            max-width:600px;
            padding:18px 20px 0;
            font-size:11px;
            line-height:1.5;
            text-align:center;
            color:#aaa8ae;
          "
        >
          Prenez soin de ne jamais transmettre un lien privé reçu par e-mail
          à une personne que vous ne connaissez pas.
        </div>

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
  style="margin:28px auto;"
>
  <tr>
    <td
      align="center"
      bgcolor="#4b506b"
      style="border-radius:999px;"
    >
      <a
        href="${escapeHtml(url)}"
        style="
          display:inline-block;
          padding:15px 28px;
          font-size:15px;
          font-weight:600;
          line-height:1;
          color:#ffffff;
          text-decoration:none;
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
    margin:0 0 18px;
    font-size:27px;
    line-height:1.3;
    font-weight:700;
    letter-spacing:-0.4px;
    color:#34384e;
  "
>
  ${escapeHtml(title)}
</h1>`;
}

export function emailParagraph(text: string) {
  return `
<p
  style="
    margin:0 0 18px;
    font-size:16px;
    line-height:1.7;
    color:#656878;
  "
>
  ${escapeHtml(text)}
</p>`;
}

export function emailNotice(text: string) {
  return `
<div
  style="
    margin:24px 0;
    padding:16px 18px;
    border-radius:16px;
    background:#faf6f3;
    color:#777887;
    font-size:13px;
    line-height:1.6;
  "
>
  ${escapeHtml(text)}
</div>`;
}

export function emailFallbackLink(url: string) {
  return `
<p
  style="
    margin:24px 0 8px;
    font-size:12px;
    line-height:1.6;
    color:#9899a4;
  "
>
  Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :
</p>

<p
  style="
    margin:0;
    font-size:12px;
    line-height:1.5;
    word-break:break-all;
    color:#a07876;
  "
>
  ${escapeHtml(url)}
</p>`;
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
