'use strict';

const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (!transporter) {
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;

    if (!emailUser || !emailPass) {
      console.error('❌ Missing EMAIL_USER or EMAIL_PASS in .env');
      throw new Error('Email credentials not configured');
    }

    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: emailUser, pass: emailPass }
    });

    console.log(`✅ Email service ready for ${emailUser}`);
  }
  return transporter;
}

async function sendEmail(to, subject, html) {
  try {
    const transporter = getTransporter();
    
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      html
    });
    console.log(`✅ Email sent: "${subject}" → ${to}`);
    return true;
  } catch (error) {
    console.error(`❌ Email failed for ${to}:`, error.message);
    throw error;
  }
}

module.exports = { sendEmail };

module.exports = { sendEmail };
