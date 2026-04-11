'use strict';

const https = require('https');
const { sendEmail } = require('./emailService');
const { sendWhatsApp } = require('./whatsappService');
const { generateMessage } = require('./aiService');
const { formatPhoneForWhatsApp } = require('./phoneFormatter');

// Map to track scheduled cart reminders (userId -> timeoutId)
const scheduledReminders = new Map();

/**
 * Send Telegram notification
 */
async function sendTelegram(text) {
  return new Promise((resolve) => {
    try {
      if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
        console.warn('⚠️ [Telegram] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID - skipping');
        resolve(false);
        return;
      }

      const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
      const payload = JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: text,
        parse_mode: 'HTML'
      });

      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      };

      const req = https.request(url, options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (result.ok) {
              console.log('[Telegram] ✅ Message sent!');
              resolve(true);
            } else {
              console.error('[Telegram] ❌ Error:', result.description);
              resolve(false);
            }
          } catch (e) {
            console.error('[Telegram] ❌ Parse error:', e.message);
            resolve(false);
          }
        });
      });

      req.on('error', (err) => {
        console.error('[Telegram] ❌ Request failed:', err.message);
        resolve(false);
      });

      req.write(payload);
      req.end();
    } catch (err) {
      console.error('[Telegram] ❌ Failed:', err.message);
      resolve(false);
    }
  });
}

/**
 * Send Smart Notifications (Email + WhatsApp + Telegram)
 * Logs event, email, and phone for debugging
 */
async function sendSmartNotification(event, user, order = null, cartItems = null) {
  try {
    if (!user || !user.email) {
      console.error(`❌ [${event}] Missing user or email`);
      return false;
    }

    const message = await generateMessage(event, user, order, cartItems);
    
    // 📧 Send Email
    const emailSent = await sendEmail(user.email, message.subject, message.html).catch(err => {
      console.error(`❌ [${event}] Email failed for ${user.email}:`, err.message);
      return false;
    });

    // 📱 Send WhatsApp (if phone number is available)
    let whatsappSent = false;
    if (user.phone) {
      const formattedPhone = formatPhoneForWhatsApp(user.phone, user.country_code || '+91');
      console.log(`📤 [${event}] Attempting WhatsApp to: ${formattedPhone}`);
      
      whatsappSent = await sendWhatsApp(formattedPhone, message.whatsapp || message.subject).catch(err => {
        console.error(`⚠️ [${event}] WhatsApp failed for ${user.phone}:`, err.message);
        return false;
      });
    } else {
      console.warn(`⚠️ [${event}] No phone number for ${user.email} - WhatsApp skipped`);
    }

    // 📲 Send Telegram
    let telegramSent = false;
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      const telegramText = `<b>${event.toUpperCase()}</b>\n\n${message.subject}\n\nUser: ${user.email}`;
      telegramSent = await sendTelegram(telegramText).catch(err => {
        console.error(`⚠️ [${event}] Telegram failed:`, err.message);
        return false;
      });
    } else {
      console.warn(`⚠️ [${event}] Telegram not configured - skipped`);
    }

    // Log summary
    const status = emailSent ? '✅ Email' : '❌ Email';
    const whatsappStatus = whatsappSent ? '✅ WhatsApp' : '⚠️ WhatsApp';
    const telegramStatus = telegramSent ? '✅ Telegram' : '⚠️ Telegram';
    console.log(`[${event}] ${status} | ${whatsappStatus} | ${telegramStatus} | User: ${user.email} | Phone: ${user.phone || 'N/A'}`);

    return emailSent || whatsappSent || telegramSent; // Success if at least one channel worked
  } catch (err) {
    console.error(`❌ [${event}] Critical error for ${user.email}:`, err.message);
    return false;
  }
}

// Schedule cart reminder email after 3 minutes
async function scheduleCartReminder(userId, user, cartItems) {
  try {
    // Cancel any existing reminder for this user
    if (scheduledReminders.has(userId)) {
      clearTimeout(scheduledReminders.get(userId));
    }

    // Schedule new reminder for 3 minutes (180000 ms)
    const timeoutId = setTimeout(async () => {
      try {
        console.log(`⏰ Sending cart reminder to ${user.email}...`);
        await sendSmartNotification('cart_reminder', user, null, cartItems);
        scheduledReminders.delete(userId);
      } catch (err) {
        console.error('❌ Cart reminder failed:', err.message);
      }
    }, 180000); // 3 minutes

    scheduledReminders.set(userId, timeoutId);
    console.log(`⏲️ Cart reminder scheduled for ${user.email} (in 3 minutes)`);
    return true;
  } catch (err) {
    console.error('❌ Failed to schedule reminder:', err.message);
    return false;
  }
}

// Cancel scheduled reminder (e.g., when user purchases)
function cancelCartReminder(userId) {
  if (scheduledReminders.has(userId)) {
    clearTimeout(scheduledReminders.get(userId));
    scheduledReminders.delete(userId);
    console.log(`🚫 Cart reminder cancelled for user ${userId}`);
    return true;
  }
  return false;
}

// Unsubscribe user from all notifications
function unsubscribeUser(user) {
  return {
    email_notifications: 0,
    whatsapp_consent: 0,
    telegram_consent: 0
  };
}

module.exports = { sendSmartNotification, scheduleCartReminder, cancelCartReminder, unsubscribeUser };

