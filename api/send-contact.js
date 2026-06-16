const nodemailer = require('nodemailer');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { name, email, subject, message } = req.body || {};
  if (!email || !message) return res.status(400).json({ error: 'Missing required fields' });

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return res.status(500).json({ error: 'Email is not configured' });
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  try {
    await transporter.sendMail({
      from: `"Trade Map Contact Form" <${process.env.GMAIL_USER}>`,
      to: process.env.GMAIL_USER,
      replyTo: email,
      subject: `[Trade Map Contact] ${subject || 'Support Request'}`,
      text: `${name ? `Name: ${name}\n` : ''}Email: ${email}\n\n${message}`,
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('send-contact error:', err);
    return res.status(500).json({ error: 'Could not send message' });
  }
};
