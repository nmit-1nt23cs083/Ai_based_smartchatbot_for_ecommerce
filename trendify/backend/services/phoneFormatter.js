'use strict';

/**
 * Format phone number to WhatsApp format: +91XXXXXXXXXX
 * Removes any non-digit characters and adds country code if missing
 */
function formatPhoneForWhatsApp(phone, countryCode = '+91') {
  if (!phone) return null;

  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');

  // If already has country code digits (starts with 91 for India), just add +
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return `+${cleaned}`;
  }

  // If 10 digits (India mobile), add +91
  if (cleaned.length === 10) {
    return `${countryCode}${cleaned}`;
  }

  // If already formatted correctly
  if (phone.startsWith('+')) {
    return phone;
  }

  // Fallback: try country code + cleaned
  return `${countryCode}${cleaned}`;
}

module.exports = { formatPhoneForWhatsApp };
