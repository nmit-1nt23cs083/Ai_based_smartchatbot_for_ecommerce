'use strict';

const twilio = require('twilio');

const client = twilio(
  process.env.TWILIO_SID,
  process.env.TWILIO_AUTH_TOKEN
);

async function sendWhatsApp(to, message) {
  await client.messages.create({
    from: 'whatsapp:+14155238886',
    to: `whatsapp:${to}`,
    body: message
  });
}

module.exports = { sendWhatsApp };