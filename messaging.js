async function sendText(toPhone, body) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!sid || !token || !from) {
    return {
      sent: false,
      fallbackUrl: `sms:${toPhone.replace(/[^0-9+]/g, '')}?body=${encodeURIComponent(body)}`
    };
  }

  const twilio = require('twilio')(sid, token);
  await twilio.messages.create({ to: toPhone, from, body });
  return { sent: true };
}

async function sendEmail(toEmail, subject, body) {
  const key = process.env.SENDGRID_API_KEY;
  const from = process.env.SENDGRID_FROM_EMAIL;

  if (!key || !from) {
    return {
      sent: false,
      fallbackUrl: `mailto:${toEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    };
  }

  const sgMail = require('@sendgrid/mail');
  sgMail.setApiKey(key);
  await sgMail.send({ to: toEmail, from, subject, text: body });
  return { sent: true };
}

module.exports = { sendText, sendEmail };
