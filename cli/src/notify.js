/**
 * Outbound notifications to Slack / Teams / generic webhooks.
 *
 * Config (in .openspecpm/config.json):
 *   "notify": {
 *     "slack": "https://hooks.slack.com/services/T.../B.../...",
 *     "teams": "https://outlook.office.com/webhook/...",
 *     "generic": ["https://your.endpoint/openspecpm"]
 *   }
 *
 * Secrets stay in the config file — make sure that file isn't committed if
 * the webhook URLs themselves are sensitive (they often are).
 */

export async function notify({ config, title, body, level = 'info', fetchImpl = globalThis.fetch } = {}) {
  if (!config?.notify) return { sent: 0, errors: [] };
  const targets = [];
  if (config.notify.slack) targets.push({ kind: 'slack', url: config.notify.slack });
  if (config.notify.teams) targets.push({ kind: 'teams', url: config.notify.teams });
  for (const url of config.notify.generic ?? []) targets.push({ kind: 'generic', url });
  if (!targets.length) return { sent: 0, errors: [] };

  let sent = 0;
  const errors = [];
  for (const t of targets) {
    try {
      const res = await fetchImpl(t.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formatPayload(t.kind, { title, body, level })),
      });
      // A 401/403/500 from Slack/Teams reaches the network but the message
      // never lands. Without this check, those would be counted as `sent`,
      // and a user running `standup --broadcast` would think their channel
      // got the update when the webhook silently rejected it.
      if (!res?.ok) {
        const status = res?.status ?? '?';
        const statusText = res?.statusText ?? '';
        let snippet = '';
        try {
          snippet = (await res.text()).slice(0, 200);
        } catch { /* res.text() failed; ignore */ }
        errors.push({ target: t.kind, error: redactUrl(t.url, `HTTP ${status} ${statusText}${snippet ? ` — ${snippet}` : ''}`) });
        continue;
      }
      sent++;
    } catch (err) {
      // Strip the webhook URL from fetch's error message before returning it.
      // The URL is itself a bearer credential for Slack/Teams — anyone holding
      // it can post to the channel. We don't want it surfacing in audit.log
      // or stdout via a caller that surfaces this errors[] array.
      errors.push({ target: t.kind, error: redactUrl(t.url, err.message ?? String(err)) });
    }
  }
  return { sent, errors };
}

function redactUrl(url, msg) {
  if (!url || typeof msg !== 'string') return msg;
  return msg.split(url).join('<webhook>');
}

function formatPayload(kind, { title, body, level }) {
  const text = `*${title}*\n${body}`;
  if (kind === 'slack') return { text };
  if (kind === 'teams') {
    // Teams legacy connector card.
    return {
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      summary: title,
      themeColor: level === 'error' ? 'D32F2F' : level === 'warn' ? 'F9A825' : '2E7D32',
      title,
      text: body,
    };
  }
  // Generic: a plain JSON envelope.
  return { source: 'openspecpm', title, body, level, ts: new Date().toISOString() };
}
