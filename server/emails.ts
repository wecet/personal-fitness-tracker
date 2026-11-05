/** The password reset email: plain text for any client, and a simple branded HTML version. */
export function resetEmail(link: string) {
  const text = [
    'Reset your Tempo password',
    '',
    'Someone (hopefully you) asked to reset the password for your Tempo account.',
    'Open this link within the next hour to choose a new one:',
    '',
    link,
    '',
    "If you didn't ask for this, ignore this email. Your password won't change.",
  ].join('\n');

  const html = `<!doctype html>
<html><body style="margin:0;padding:32px 16px;background:#1b1c1f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#f6f5f3">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:440px;background:#242629;border:1px solid #383b40;border-radius:16px" cellpadding="0" cellspacing="0">
<tr><td style="padding:32px 28px">
<p style="margin:0 0 24px;font-size:20px;font-weight:800;letter-spacing:-0.03em"><span style="color:#ff6f61">&#9646;</span> tempo</p>
<h1 style="margin:0 0 12px;font-size:22px">Reset your password</h1>
<p style="margin:0 0 24px;color:#9a9ca3;line-height:1.5">Someone (hopefully you) asked to reset the password for your Tempo account. This link works for the next hour.</p>
<a href="${link}" style="display:inline-block;padding:12px 20px;border-radius:12px;background:#ff6f61;color:#2a1210;font-weight:700;text-decoration:none">Choose a new password</a>
<p style="margin:24px 0 0;color:#9a9ca3;font-size:13px;line-height:1.5">If you didn&#8217;t ask for this, ignore this email. Your password won&#8217;t change.</p>
</td></tr></table>
</td></tr></table>
</body></html>`;

  return { subject: 'Reset your Tempo password', text, html };
}
