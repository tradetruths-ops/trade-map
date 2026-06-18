const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://nzdodkjluxxquconnflu.supabase.co';
const ALLOWED_KEYS = ['levels', 'stocks', 'calendar', 'daily_note', 'discord_free', 'discord_members'];

module.exports = async function handler(req, res) {
  const sb = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (req.method === 'GET') {
    const key = req.query?.key;
    if (!ALLOWED_KEYS.includes(key)) return res.status(400).json({ error: 'Invalid key' });
    const { data, error } = await sb.from('app_data').select('value').eq('key', key).maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ value: data ? data.value : null });
  }

  if (req.method === 'POST') {
    const { key, value, adminPassword } = req.body || {};
    if (!ALLOWED_KEYS.includes(key)) return res.status(400).json({ error: 'Invalid key' });
    if (!process.env.ADMIN_API_PASSWORD || adminPassword !== process.env.ADMIN_API_PASSWORD) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { error } = await sb.from('app_data').upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
};
