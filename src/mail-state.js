export function normalizeMail(raw = {}) {
  return {
    config: {
      host: '',
      port: 993,
      tlsMode: 'tls',
      user: '',
      address: '',
      folder: 'INBOX',
      automatic: false,
      intervalMinutes: 30,
      lookbackDays: 7,
      ...raw.config,
      password: undefined,
    },
    cursors: raw.cursors || {},
    processed: Array.isArray(raw.processed) ? raw.processed : [],
    runs: Array.isArray(raw.runs) ? raw.runs.slice(0, 30) : [],
    lease: raw.lease || null,
    lastAttemptAt: raw.lastAttemptAt || '',
    lastSuccessAt: raw.lastSuccessAt || '',
    error: raw.error || '',
  }
}
