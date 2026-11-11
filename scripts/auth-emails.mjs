// The emails Supabase sends for IRLY's sign-in (scripts/auth-config.mjs applies them).
//
// One look for all of them: IRLY's black ground, the logo, white type, one white button. Built the way email
// programs need it: tables, inline styles, no script, no web font; the text stays readable with images off, and
// the page declares both colour schemes so a dark-mode mail program does not repaint it.
// French and English in the same email: the server does not know the member's language when the email leaves.
// Supabase fills {{ .Token }} (the 6-digit code) and {{ .ConfirmationURL }} (the link).

const BG = '#0A0A0A';
const CARD = '#151515';
const LINE = '#2A2A2A';
const TEXT = '#FFFFFF';
const SOFT = '#B5B5B5';
const FAINT = '#7A7A7A';
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const LOGO = 'https://getirly.com/logo-512.png';

const p = (color, size, text, extra = '') => `<p style="margin:0;${extra}font-family:${FONT};font-size:${size}px;line-height:1.5;color:${color};">${text}</p>`;

/** The frame every email shares: preview line, logo, title, body rows, footer. */
function frame({ preview, title, rows, footer }) {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>IRLY</title>
</head>
<body style="margin:0;padding:0;background:${BG};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${BG};">${preview}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BG}" style="background:${BG};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
<tr><td align="center" style="padding:0 0 22px 0;">
<img src="${LOGO}" width="64" height="64" alt="IRLY" style="display:block;border:0;border-radius:16px;width:64px;height:64px;">
<p style="margin:14px 0 0 0;font-family:${FONT};font-size:15px;font-weight:700;letter-spacing:7px;color:${TEXT};">IRLY</p>
</td></tr>
<tr><td bgcolor="${CARD}" style="background:${CARD};border:1px solid ${LINE};border-radius:20px;padding:30px 26px;">
<h1 style="margin:0 0 6px 0;font-family:${FONT};font-size:22px;line-height:1.3;font-weight:700;color:${TEXT};">${title.fr}</h1>
${p(SOFT, 15, title.en, 'margin-bottom:22px;')}
${rows.join('\n')}
</td></tr>
<tr><td align="center" style="padding:22px 12px 0 12px;">
${p(FAINT, 12.5, footer)}
${p(FAINT, 12.5, 'IRLY · Make Friends IRL · <a href="https://getirly.com" style="color:' + SOFT + ';text-decoration:underline;">getirly.com</a>', 'margin-top:10px;')}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

const codeBox = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="${BG}" style="background:${BG};border:1px solid ${LINE};border-radius:14px;padding:18px 8px;">
<p style="margin:0;font-family:'SFMono-Regular',Menlo,Consolas,'Courier New',monospace;font-size:34px;line-height:1.2;font-weight:700;letter-spacing:9px;color:${TEXT};">{{ .Token }}</p>
</td></tr></table>`;

const button = (label) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="${TEXT}" style="background:${TEXT};border-radius:14px;">
<a href="{{ .ConfirmationURL }}" style="display:block;padding:15px 18px;font-family:${FONT};font-size:16px;font-weight:700;color:${BG};text-decoration:none;">${label}</a>
</td></tr></table>`;

const gap = (h) => `<div style="height:${h}px;line-height:${h}px;font-size:0;">&nbsp;</div>`;

/** A new account to confirm, or a sign-in by email: the code the app asks for, and the link. */
export const signInEmail = frame({
  preview: 'Ton code IRLY : {{ .Token }} · Your IRLY code: {{ .Token }}',
  title: { fr: 'Ton code de connexion', en: 'Your sign-in code' },
  rows: [
    codeBox,
    gap(16),
    p(SOFT, 14.5, 'Saisis ce code dans l’application.<br>Enter this code in the app.'),
    gap(22),
    p(SOFT, 14.5, 'Ou continue en un geste, sur ton téléphone :<br>Or continue in one tap, on your phone:', 'margin-bottom:12px;'),
    button('Ouvrir IRLY · Open IRLY'),
  ],
  footer: 'Si tu n’as rien demandé, ignore cet e-mail : personne n’entre sans ce code.<br>If you did not ask for this, ignore this email: nobody gets in without this code.',
});
export const signInSubject = 'Ton code IRLY · Your IRLY code';

/** A forgotten password: the link to choose a new one. */
export const recoveryEmail = frame({
  preview: 'Choisis un nouveau mot de passe IRLY · Choose a new IRLY password',
  title: { fr: 'Nouveau mot de passe', en: 'New password' },
  rows: [
    p(SOFT, 14.5, 'Tu as demandé à changer ton mot de passe IRLY. Ouvre ce lien pour en choisir un nouveau.<br><br>You asked to change your IRLY password. Open this link to choose a new one.', 'margin-bottom:20px;'),
    button('Nouveau mot de passe · New password'),
  ],
  footer: 'Si tu n’as rien demandé, ignore cet e-mail : ton mot de passe ne change pas.<br>If you did not ask for this, ignore this email: your password stays the same.',
});
export const recoverySubject = 'Ton mot de passe IRLY · Your IRLY password';
