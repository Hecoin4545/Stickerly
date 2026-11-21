/**
 * Gemini Vision AI Service
 * Uses Google Gemini API for:
 * 1. Face verification (does the uploaded photo match the user's profile photo?)
 * 2. Gesture/pose verification (did the person do the requested pose?)
 * 3. Item detection from video frames (Find & Click mode)
 * 4. Item match verification (does the submitted photo match the described item?)
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

/**
 * Fetch an image from a URL and return as base64
 */
async function fetchImageAsBase64(imageUrl) {
  return new Promise((resolve, reject) => {
    const protocol = imageUrl.startsWith('https') ? https : http;
    protocol.get(imageUrl, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer.toString('base64'));
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Read a local file and return as base64
 */
function readLocalFileAsBase64(filePath) {
  const buffer = fs.readFileSync(filePath);
  return buffer.toString('base64');
}

/**
 * Get image as base64 (from URL or local path)
 */
async function getImageBase64(imageSource) {
  if (imageSource.startsWith('http://') || imageSource.startsWith('https://')) {
    return await fetchImageAsBase64(imageSource);
  } else {
    // local file path
    return readLocalFileAsBase64(imageSource);
  }
}

/**
 * Call Gemini Vision API with images and prompt
 */
async function callGeminiVision(prompt, images = []) {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    // If no API key, return a permissive mock (dev mode)
    console.warn('[GeminiService] No GEMINI_API_KEY set — skipping AI verification');
    return { passed: true, reason: 'AI verification skipped (no API key configured)', confidence: 100 };
  }

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const parts = [];

  // Add images
  for (const img of images) {
    const { base64, mimeType = 'image/jpeg' } = img;
    parts.push({
      inlineData: {
        mimeType,
        data: base64,
      },
    });
  }

  // Add prompt
  parts.push({ text: prompt });

  const requestBody = {
    contents: [{ parts }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 512,
    },
  };

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} — ${errorText}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return parseGeminiResponse(text);
}

/**
 * Parse Gemini's text response into structured result
 */
function parseGeminiResponse(text) {
  const lower = text.toLowerCase();
  const passed =
    lower.includes('"result": "pass"') ||
    lower.includes('"result":"pass"') ||
    lower.includes('result: pass') ||
    lower.includes('pass') && !lower.includes('fail') && !lower.includes('no match') && !lower.includes('does not match');

  const failKeywords = ['"result": "fail"', '"result":"fail"', 'result: fail', 'fail', 'no match', 'does not match', 'mismatch', 'different person', 'not the same'];
  const isFail = failKeywords.some((kw) => lower.includes(kw));

  // Extract confidence if present
  const confidenceMatch = text.match(/"?confidence"?\s*[:=]\s*(\d+)/i);
  const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 80;

  // Extract reason
  const reasonMatch = text.match(/"?reason"?\s*[:=]\s*"?([^"\n]+)"?/i);
  const reason = reasonMatch ? reasonMatch[1].trim() : text.slice(0, 200);

  return {
    passed: isFail ? false : passed,
    reason,
    confidence,
    rawResponse: text,
  };
}

/**
 * Verify that a submitted photo contains the same person as the profile photo.
 * @param {string} profilePhotoUrl - URL/path to the user's profile photo
 * @param {string} submittedPhotoUrl - URL/path to the uploaded sticker photo
 * @returns {{ passed: boolean, reason: string, confidence: number }}
 */
async function verifyFaceMatch(profilePhotoUrl, submittedPhotoUrl) {
  try {
    const [profileBase64, submittedBase64] = await Promise.all([
      getImageBase64(profilePhotoUrl),
      getImageBase64(submittedPhotoUrl),
    ]);

    const prompt = `You are a photo verification system. Compare these two images:
Image 1: The user's profile photo (reference face)
Image 2: A newly submitted photo

Task: Determine if the SAME PERSON visible in Image 1 appears in Image 2.

Important guidelines:
- Only compare faces/people, not backgrounds or settings
- Different angles, lighting, or expressions are OK as long as it's the same person
- If Image 2 has multiple people, check if the profile person is among them
- If either image has no visible person/face, return fail

Respond in this exact JSON format:
{
  "result": "pass" or "fail",
  "confidence": <0-100>,
  "reason": "<brief explanation>"
}`;

    return await callGeminiVision(prompt, [
      { base64: profileBase64, mimeType: 'image/jpeg' },
      { base64: submittedBase64, mimeType: 'image/jpeg' },
    ]);
  } catch (err) {
    console.error('[GeminiService] verifyFaceMatch error:', err.message);
    // On error, don't block the user — let it pass with a warning
    return { passed: true, reason: 'Face verification unavailable (service error)', confidence: 0 };
  }
}

/**
 * Verify that a submitted photo shows the requested gesture/pose.
 * @param {string} submittedPhotoUrl - URL/path to the uploaded sticker photo
 * @param {string} poseDescription - The pose/gesture the user was asked to do
 * @returns {{ passed: boolean, reason: string, confidence: number }}
 */
async function verifyGesture(submittedPhotoUrl, poseDescription) {
  try {
    const submittedBase64 = await getImageBase64(submittedPhotoUrl);

    const prompt = `You are a gesture verification system. 

The user was asked to do the following pose/gesture:
"${poseDescription}"

Look at the submitted photo and determine if the person in it is performing this pose or gesture (or something reasonably close to it).

Be somewhat lenient — if the general idea of the pose is captured, consider it a pass.
If the photo shows no person, or the pose is completely wrong, return fail.

Respond in this exact JSON format:
{
  "result": "pass" or "fail",
  "confidence": <0-100>,
  "reason": "<brief explanation>"
}`;

    return await callGeminiVision(prompt, [
      { base64: submittedBase64, mimeType: 'image/jpeg' },
    ]);
  } catch (err) {
    console.error('[GeminiService] verifyGesture error:', err.message);
    return { passed: true, reason: 'Gesture verification unavailable (service error)', confidence: 0 };
  }
}

/**
 * Analyze a video frame / image to extract notable items/objects/scenes.
 * Used by admin when uploading a video for Find & Click mode.
 * @param {string} imageUrl - URL/path to a video frame or image
 * @returns {string[]} Array of item descriptions
 */
async function extractItemsFromImage(imageUrl) {
  try {
    const imageBase64 = await getImageBase64(imageUrl);

    const prompt = `You are analyzing this image/video frame to identify items for a photo scavenger hunt game.

Identify 5-10 specific, clearly visible items, objects, or scenes in this image that players could realistically find and photograph in real life.

For each item, write a short clue/sentence that describes it without being too obvious (like a riddle or scavenger hunt clue).

Respond ONLY as a JSON array of strings, example:
[
  "Something tall and brown that gives shade",
  "A circular object used for transportation",
  "A place where people wait to travel somewhere"
]

Make sure each clue is unique, clear enough to understand, and refers to something actually visible in the image.`;

    const result = await callGeminiVision(prompt, [
      { base64: imageBase64, mimeType: 'image/jpeg' },
    ]);

    // Try to parse the raw response as JSON array
    try {
      const match = result.rawResponse?.match(/\[[\s\S]*\]/);
      if (match) {
        const items = JSON.parse(match[0]);
        if (Array.isArray(items) && items.length > 0) {
          return items.filter((i) => typeof i === 'string' && i.trim());
        }
      }
    } catch {}

    // Fallback: split by newlines
    return (result.rawResponse || '').split('\n').filter((l) => l.trim() && l.includes('"')).slice(0, 10);
  } catch (err) {
    console.error('[GeminiService] extractItemsFromImage error:', err.message);
    return [];
  }
}

/**
 * Verify that a submitted photo matches the described item/clue.
 * @param {string} submittedPhotoUrl - URL/path to the submitted photo
 * @param {string} itemClue - The clue/description the user was given
 * @param {string} actualItemDescription - The actual item it describes (admin context)
 * @returns {{ passed: boolean, reason: string, confidence: number }}
 */
async function verifyItemMatch(submittedPhotoUrl, itemClue, actualItemDescription = '') {
  try {
    const submittedBase64 = await getImageBase64(submittedPhotoUrl);

    const prompt = `You are a photo scavenger hunt judge.

The player was given this clue to find and photograph:
"${itemClue}"
${actualItemDescription ? `\nThe item this describes is: "${actualItemDescription}"` : ''}

Look at the submitted photo. Does it show the item or scene described by the clue?

Be fair but accurate:
- If the photo clearly shows the item described, return pass
- If the photo shows something completely different, return fail  
- Partial matches (like showing a similar but not exact item) can pass if the spirit is right

Respond in this exact JSON format:
{
  "result": "pass" or "fail",
  "confidence": <0-100>,
  "reason": "<brief explanation of what you see and why it passes or fails>"
}`;

    return await callGeminiVision(prompt, [
      { base64: submittedBase64, mimeType: 'image/jpeg' },
    ]);
  } catch (err) {
    console.error('[GeminiService] verifyItemMatch error:', err.message);
    return { passed: true, reason: 'Item verification unavailable (service error)', confidence: 0 };
  }
}

module.exports = {
  verifyFaceMatch,
  verifyGesture,
  verifyItemMatch,
  extractItemsFromImage,
};
