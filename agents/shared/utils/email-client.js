const nodemailer = require('nodemailer');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }
  return transporter;
}

async function sendEmail({ to, subject, html, text, from }) {
  const transport = getTransporter();
  const mailOptions = {
    from: from || `Werkpilot <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]*>/g, ''),
  };
  return transport.sendMail(mailOptions);
}

async function sendCEOEmail({ subject, html, text }) {
  return sendEmail({
    to: process.env.CEO_EMAIL,
    subject: `[Werkpilot] ${subject}`,
    html,
    text,
  });
}

module.exports = { getTransporter, sendEmail, sendCEOEmail };
