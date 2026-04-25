/**
 * Reply Classifier Service v1
 * Keyword-based classification of incoming reply text.
 * Returns one of: 'auto_responder', 'soft_no', 'warm', 'referral'
 */

const AUTO_RESPONDER_KEYWORDS = [
  'out of office',
  'out of the office',
  'automatic reply',
  'automated response',
  'currently away',
  'on vacation',
  'on holiday',
  'on leave',
  'will be back',
  'limited access to email',
  'not checking email',
  'unable to respond',
  'unsubscribe confirmation',
  'your message has been received'
];

const SOFT_NO_KEYWORDS = [
  'not interested',
  'no thanks',
  'not a fit',
  'not at this time',
  'no budget',
  'already have',
  'using someone else',
  'have a team',
  'internal team',
  'please remove',
  'do not contact',
  'unsubscribe me',
  'wrong person',
  'not the right person'
];

const REFERRAL_KEYWORDS = [
  'talk to',
  'reach out to',
  'contact',
  'email',
  'you should speak with',
  'the right person is',
  'cc ing',
  'copying',
  'forwarding to',
  'introducing you to'
];

const WARM_KEYWORDS = [
  'tell me more',
  'interested',
  'what are your rates',
  'pricing',
  'send portfolio',
  'case studies',
  'availability',
  'schedule a call',
  'book a time',
  'let me know',
  'sounds good',
  'can we talk',
  'what does',
  'how long',
  'how much'
];

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

function matchKeywords(text, keywords) {
  const lower = text.toLowerCase();
  return keywords.filter(kw => lower.includes(kw));
}

/**
 * Classify a reply message
 * @param {String} text - Raw reply body text
 * @returns {{ class: String, confidence: String, matched_keywords: String[] }}
 */
function classifyReply(text) {
  if (!text || typeof text !== 'string') {
    return { class: 'warm', confidence: 'low', matched_keywords: [] };
  }

  const trimmed = text.trim();

  // 1. Auto-responder (check first)
  const autoMatches = matchKeywords(trimmed, AUTO_RESPONDER_KEYWORDS);
  if (autoMatches.length > 0) {
    return {
      class: 'auto_responder',
      confidence: autoMatches.length >= 2 ? 'high' : 'medium',
      matched_keywords: autoMatches
    };
  }

  // 2. Referral (must contain email address AND keyword AND be short)
  const referralMatches = matchKeywords(trimmed, REFERRAL_KEYWORDS);
  const hasEmail = EMAIL_REGEX.test(trimmed);
  if (referralMatches.length > 0 && hasEmail && trimmed.length < 300) {
    return {
      class: 'referral',
      confidence: referralMatches.length >= 2 ? 'high' : 'medium',
      matched_keywords: referralMatches
    };
  }

  // 3. Soft no
  const softNoMatches = matchKeywords(trimmed, SOFT_NO_KEYWORDS);
  if (softNoMatches.length > 0) {
    return {
      class: 'soft_no',
      confidence: softNoMatches.length >= 2 ? 'high' : 'medium',
      matched_keywords: softNoMatches
    };
  }

  // 4. Warm (explicit keyword match or default)
  const warmMatches = matchKeywords(trimmed, WARM_KEYWORDS);
  if (warmMatches.length > 0) {
    return {
      class: 'warm',
      confidence: warmMatches.length >= 2 ? 'high' : 'medium',
      matched_keywords: warmMatches
    };
  }

  // Default: warm with low confidence (human should review)
  return { class: 'warm', confidence: 'low', matched_keywords: [] };
}

/**
 * Extract email address from reply text
 * @param {String} text - Reply body
 * @returns {String|null} First email found or null
 */
function extractEmail(text) {
  const match = text.match(EMAIL_REGEX);
  return match ? match[0] : null;
}

module.exports = { classifyReply, extractEmail };
