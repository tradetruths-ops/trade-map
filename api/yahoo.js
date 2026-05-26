const https = require('https');

module.exports = function handler(req, res) {
  const { symbol = 'QQQ', interval = '1d', range = '1y' } = req.query;
  const opts = {
    hostname: 'query1.finance.yahoo.com',
    path: `/v8/finance/chart/${symbol}?interval=${interval}&range=${range}&includePrePost=false`,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
    rejectUnauthorized: false,
  };
  https.get(opts, upstream => {
    let body = '';
    upstream.on('data', c => body += c);
    upstream.on('end', () => {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'max-age=60');
      res.status(200).send(body);
    });
  }).on('error', () => {
    res.status(502).send('Proxy error');
  });
};
