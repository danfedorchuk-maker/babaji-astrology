 console.log("--- BABAJI UNIVERSAL START ---");
    try {
        const { name, dob, tob, loc, tradition, lang } = req.body;
 
        // ─── 1. LANGUAGE SETUP ───────────────────────────────────────────────
        // lang comes from frontend (navigator.language), e.g. "ru", "hi", "zh-TW", "fr"
        const detectedLang = (lang || 'en').toLowerCase().split('-')[0];
        const scriptTag = (lang || 'en').toLowerCase(); // keep full tag for zh-TW etc.
 
        // Languages where we want to preserve the full BCP-47 tag
        const fullTagLanguages = ['zh-tw', 'zh-hk', 'pt-br', 'pt-pt'];
        const langCode = fullTagLanguages.includes(scriptTag) ? scriptTag : detectedLang;
 
        // ─── 2. DATE PARSING ─────────────────────────────────────────────────
        let day, month, year;
        if (dob.includes('-')) {
            [year, month, day] = dob.split('-').map(Number);
        } else {
            [month, day, year] = dob.split('/').map(Number);
        }
 
        // ─── 3. GEOCODING ────────────────────────────────────────────────────
        const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(loc)}&format=json&limit=1`,
            { headers: { 'User-Agent': 'BabajiAstrology/1.0' } }
        );
        const geoData = await geoRes.json();
        if (!geoData.length) {
            return res.status(200).json({ reading: "LOCATION ERROR: Could not find that city.", planets: [], aspects: [] });
        }
        const lat = parseFloat(geoData[0].lat);
        const lon = parseFloat(geoData[0].lon);
 
        // ─── 4. TIMEZONE ─────────────────────────────────────────────────────
        const tzRes = await fetch(`https://timeapi.io/api/timezone/coordinate?latitude=${lat}&longitude=${lon}`);
        const tzData = await tzRes.json();
        // Try multiple paths in the response
        let tzone = 0;
        if (tzData.currentUtcOffset?.seconds != null) {
            tzone = tzData.currentUtcOffset.seconds / 3600;
        } else if (tzData.utcOffset != null) {
            tzone = tzData.utcOffset;
        } else if (tzData.rawOffset != null) {
            tzone = tzData.rawOffset / 3600;
        }
 
        // ─── 5. SELECT ASTROLOGY ENDPOINT ────────────────────────────────────
        let endpoint;
        if (tradition === 'western') {
            endpoint = 'https://json.astrologyapi.com/v1/planets/tropical';
        } else if (tradition === 'chinese') {
            endpoint = 'https://json.astrologyapi.com/v1/chinese_zodiac';
        } else {
            endpoint = 'https://json.astrologyapi.com/v1/planets';
        }
 
        // ─── 6. FETCH CHART ──────────────────────────────────────────────────
        const astroBody = tradition === 'chinese'
            ? { day, month, year } // Chinese endpoint only needs date
            : {
                day, month, year,
                hour: parseInt(tob.split(':')[0]),
                min: parseInt(tob.split(':')[1]),
                lat, lon, tzone,
                house_type: "placidus"
            };
 
        const astroResponse = await fetch(endpoint, {
            method: "POST",
            headers: {
                "x-astrologyapi-key": process.env.ASTRO_ACCESS_TOKEN,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(astroBody)
        });
        const astroData = await astroResponse.json();
        const planets = Array.isArray(astroData) ? astroData : astroData.planets || null;
 
        // ─── 7. BUILD CHART SUMMARY ──────────────────────────────────────────
        let planetSummary;
        if (tradition === 'chinese') {
            planetSummary = `Chinese Zodiac: ${astroData.name || ''}\nElement: ${astroData.element || ''}\nForce: ${astroData.force || ''}\nStone: ${astroData.stone || ''}`;
        } else if (planets) {
            planetSummary = planets
                .map(p => `${p.name} in ${p.sign} (${parseFloat(p.normDegree).toFixed(2)}°) — House ${p.house}`)
                .join('\n');
        } else {
            return res.status(200).json({
                reading: `HARDWARE ERROR: ${JSON.stringify(astroData)}`,
                planets: [],
                aspects: []
            });
        }
 
        // ─── 8. LANGUAGE INSTRUCTION FOR GROQ ───────────────────────────────
        const langInstructions = {
            'en': 'Respond in English.',
            'ru': 'Отвечай только на русском языке.',
            'hi': 'केवल हिन्दी में उत्तर दें।',
            'zh': 'Please respond in Simplified Chinese (简体中文).',
            'zh-tw': 'Please respond in Traditional Chinese (繁體中文).',
            'zh-hk': 'Please respond in Traditional Chinese (繁體中文).',
            'fr': 'Réponds uniquement en français.',
            'de': 'Antworte nur auf Deutsch.',
            'es': 'Responde únicamente en español.',
            'it': 'Rispondi solo in italiano.',
            'pt': 'Responda apenas em português.',
            'pt-br': 'Responda apenas em português do Brasil.',
            'ar': 'أجب باللغة العربية فقط.',
            'ja': '日本語でのみ回答してください。',
            'ko': '한국어로만 답변해 주세요.',
            'tr': 'Yalnızca Türkçe yanıt ver.',
            'pl': 'Odpowiadaj tylko po polsku.',
            'nl': 'Antwoord alleen in het Nederlands.',
            'sv': 'Svara endast på svenska.',
            'da': 'Svar kun på dansk.',
            'fi': 'Vastaa vain suomeksi.',
            'nb': 'Svar kun på norsk.',
            'uk': 'Відповідай лише українською мовою.',
            'cs': 'Odpovídej pouze v češtině.',
            'sk': 'Odpovedaj iba po slovensky.',
            'ro': 'Răspunde doar în română.',
            'hu': 'Csak magyarul válaszolj.',
            'el': 'Απάντησε μόνο στα ελληνικά.',
            'bg': 'Отговаряй само на български.',
            'hr': 'Odgovaraj samo na hrvatskom.',
            'sr': 'Одговарај само на српском.',
            'lt': 'Atsakyk tik lietuviškai.',
            'lv': 'Atbildi tikai latviešu valodā.',
            'et': 'Vasta ainult eesti keeles.',
            'id': 'Jawab hanya dalam bahasa Indonesia.',
            'ms': 'Jawab hanya dalam Bahasa Melayu.',
            'th': 'ตอบเป็นภาษาไทยเท่านั้น',
            'vi': 'Chỉ trả lời bằng tiếng Việt.',
            'he': 'ענה רק בעברית.',
            'fa': 'فقط به فارسی پاسخ بده.',
            'bn': 'শুধুমাত্র বাংলায় উত্তর দিন।',
            'ta': 'தமிழில் மட்டும் பதிலளிக்கவும்.',
            'te': 'కేవలం తెలుగులో మాత్రమే జవాబు ఇవ్వండి.',
            'mr': 'फक्त मराठीत उत्तर द्या.',
            'ur': 'صرف اردو میں جواب دیں۔',
            'sw': 'Jibu kwa Kiswahili pekee.',
            'af': 'Antwoord slegs in Afrikaans.',
            'ca': 'Respon només en català.',
            'eu': 'Erantzun euskaraz soilik.',
            'gl': 'Responde só en galego.',
        };
 
        const langInstruction = langInstructions[langCode] || langInstructions['en'];
 
        // ─── 9. GROQ NARRATIVE ───────────────────────────────────────────────
        const traditionLabel = tradition === 'western' ? 'Western tropical' : tradition === 'chinese' ? 'Chinese' : 'Vedic Indian';
        const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                max_tokens: 1500,
                messages: [
                    {
                        role: "system",
                        content: `You are Babaji — an ancient, grounded cosmic interpreter fluent in all astrological traditions. Speak in rich, unhurried prose. No bullet points. No fluff. Interpret the seeker's ${traditionLabel} chart as if reading from a worn celestial ledger. Reference specific placements. Be precise, poetic, and occasionally wry. When referencing degrees always round to two decimal places. LANGUAGE INSTRUCTION: ${langInstruction}`
                    },
                    {
                        role: "user",
                        content: `Seeker: ${name}\nTradition: ${traditionLabel}\n\n${planetSummary}\n\nGive a full natal reading.`
                    }
                ]
            })
        });
        const aiData = await groqResponse.json();
        const reading = aiData.choices[0].message.content;
 
        // ─── 10. TTS VOICE SELECTION ─────────────────────────────────────────
        // Build the best available voice for the detected language + tradition
        const ttsVoice = selectTTSVoice(langCode, scriptTag, tradition);
 
        // ─── 11. CHUNKED TTS ─────────────────────────────────────────────────
        // Google TTS limit is 5000 bytes. We chunk conservatively at 4500 chars.
        const audioBase64 = await synthesizeChunked(reading, ttsVoice, process.env.GOOGLE_TTS_KEY);
 
        // ─── 12. RESPOND ─────────────────────────────────────────────────────
        res.status(200).json({
            reading,
            audio: audioBase64 || null,
            planets: tradition === 'chinese' ? [] : (planets || []),
            aspects: [],
            lang: langCode
        });
 
    } catch (e) {
        console.error("PIPELINE CRASH:", e.message);
        res.status(200).json({
            reading: "CRASH: " + e.message,
            planets: [],
            aspects: []
        });
    }
};
 
// ─── VOICE SELECTION ─────────────────────────────────────────────────────────
function selectTTSVoice(langCode, scriptTag, tradition) {
    // WaveNet voices by language — best quality available
    const voiceMap = {
        // English — tradition-aware
        'en-western': { languageCode: 'en-GB', name: 'en-GB-Wavenet-B', ssmlGender: 'MALE' },
        'en-indian':  { languageCode: 'en-IN', name: 'en-IN-Wavenet-C', ssmlGender: 'MALE' },
        'en-chinese': { languageCode: 'en-US', name: 'en-US-Wavenet-D', ssmlGender: 'MALE' },
 
        // Russian
        'ru': { languageCode: 'ru-RU', name: 'ru-RU-Wavenet-D', ssmlGender: 'MALE' },
        // Hindi
        'hi': { languageCode: 'hi-IN', name: 'hi-IN-Wavenet-C', ssmlGender: 'MALE' },
        // Chinese Simplified
        'zh': { languageCode: 'cmn-CN', name: 'cmn-CN-Wavenet-B', ssmlGender: 'MALE' },
        // Chinese Traditional (TW or HK)
        'zh-tw': { languageCode: 'cmn-TW', name: 'cmn-TW-Wavenet-B', ssmlGender: 'MALE' },
        'zh-hk': { languageCode: 'yue-HK', name: 'yue-HK-Standard-B', ssmlGender: 'MALE' },
        // French
        'fr': { languageCode: 'fr-FR', name: 'fr-FR-Wavenet-B', ssmlGender: 'MALE' },
        // German
        'de': { languageCode: 'de-DE', name: 'de-DE-Wavenet-B', ssmlGender: 'MALE' },
        // Spanish
        'es': { languageCode: 'es-ES', name: 'es-ES-Wavenet-B', ssmlGender: 'MALE' },
        // Italian
        'it': { languageCode: 'it-IT', name: 'it-IT-Wavenet-C', ssmlGender: 'MALE' },
        // Portuguese
        'pt': { languageCode: 'pt-PT', name: 'pt-PT-Wavenet-B', ssmlGender: 'MALE' },
        'pt-br': { languageCode: 'pt-BR', name: 'pt-BR-Wavenet-B', ssmlGender: 'MALE' },
        // Arabic
        'ar': { languageCode: 'ar-XA', name: 'ar-XA-Wavenet-B', ssmlGender: 'MALE' },
        // Japanese
        'ja': { languageCode: 'ja-JP', name: 'ja-JP-Wavenet-C', ssmlGender: 'MALE' },
        // Korean
        'ko': { languageCode: 'ko-KR', name: 'ko-KR-Wavenet-C', ssmlGender: 'MALE' },
        // Turkish
        'tr': { languageCode: 'tr-TR', name: 'tr-TR-Wavenet-B', ssmlGender: 'MALE' },
        // Polish
        'pl': { languageCode: 'pl-PL', name: 'pl-PL-Wavenet-B', ssmlGender: 'MALE' },
        // Dutch
        'nl': { languageCode: 'nl-NL', name: 'nl-NL-Wavenet-B', ssmlGender: 'MALE' },
        // Swedish
        'sv': { languageCode: 'sv-SE', name: 'sv-SE-Wavenet-C', ssmlGender: 'MALE' },
        // Danish
        'da': { languageCode: 'da-DK', name: 'da-DK-Wavenet-A', ssmlGender: 'FEMALE' },
        // Finnish
        'fi': { languageCode: 'fi-FI', name: 'fi-FI-Wavenet-A', ssmlGender: 'FEMALE' },
        // Norwegian
        'nb': { languageCode: 'nb-NO', name: 'nb-NO-Wavenet-B', ssmlGender: 'MALE' },
        // Ukrainian
        'uk': { languageCode: 'uk-UA', name: 'uk-UA-Wavenet-A', ssmlGender: 'FEMALE' },
        // Czech
        'cs': { languageCode: 'cs-CZ', name: 'cs-CZ-Wavenet-A', ssmlGender: 'FEMALE' },
        // Romanian
        'ro': { languageCode: 'ro-RO', name: 'ro-RO-Wavenet-A', ssmlGender: 'FEMALE' },
        // Greek
        'el': { languageCode: 'el-GR', name: 'el-GR-Wavenet-A', ssmlGender: 'FEMALE' },
        // Hungarian — Standard only
        'hu': { languageCode: 'hu-HU', name: 'hu-HU-Standard-A', ssmlGender: 'FEMALE' },
        // Indonesian
        'id': { languageCode: 'id-ID', name: 'id-ID-Wavenet-B', ssmlGender: 'MALE' },
        // Malay — Standard only
        'ms': { languageCode: 'ms-MY', name: 'ms-MY-Wavenet-B', ssmlGender: 'MALE' },
        // Thai
        'th': { languageCode: 'th-TH', name: 'th-TH-Neural2-C', ssmlGender: 'FEMALE' },
        // Vietnamese
        'vi': { languageCode: 'vi-VN', name: 'vi-VN-Wavenet-B', ssmlGender: 'MALE' },
        // Hebrew
        'he': { languageCode: 'he-IL', name: 'he-IL-Wavenet-B', ssmlGender: 'MALE' },
        // Bengali
        'bn': { languageCode: 'bn-IN', name: 'bn-IN-Wavenet-B', ssmlGender: 'MALE' },
        // Tamil
        'ta': { languageCode: 'ta-IN', name: 'ta-IN-Wavenet-C', ssmlGender: 'MALE' },
        // Telugu
        'te': { languageCode: 'te-IN', name: 'te-IN-Standard-B', ssmlGender: 'MALE' },
        // Afrikaans
        'af': { languageCode: 'af-ZA', name: 'af-ZA-Standard-B', ssmlGender: 'MALE' },
        // Catalan
        'ca': { languageCode: 'ca-ES', name: 'ca-ES-Standard-A', ssmlGender: 'FEMALE' },
        // Slovak — fallback to Czech
        'sk': { languageCode: 'sk-SK', name: 'sk-SK-Wavenet-A', ssmlGender: 'FEMALE' },
        // Swahili
        'sw': { languageCode: 'sw-KE', name: 'sw-KE-Standard-B', ssmlGender: 'MALE' },
        // Urdu
        'ur': { languageCode: 'ur-IN', name: 'ur-IN-Wavenet-B', ssmlGender: 'MALE' },
    };
 
    // For English, pick voice based on tradition
    if (langCode === 'en') {
        return voiceMap[`en-${tradition}`] || voiceMap['en-western'];
    }
 
    // For zh-TW and zh-HK use full script tag
    if (scriptTag === 'zh-tw') return voiceMap['zh-tw'];
    if (scriptTag === 'zh-hk') return voiceMap['zh-hk'];
    if (scriptTag === 'pt-br') return voiceMap['pt-br'];
 
    // Return mapped voice or fallback to English
    return voiceMap[langCode] || voiceMap[`en-${tradition}`] || voiceMap['en-western'];
}
 
// ─── CHUNKED TTS SYNTHESIS ───────────────────────────────────────────────────
async function synthesizeChunked(text, voice, apiKey) {
    const CHUNK_SIZE = 4500; // well under the 5000 byte limit
    const chunks = splitTextIntoChunks(text, CHUNK_SIZE);
    const audioBuffers = [];
 
    for (const chunk of chunks) {
        const ttsResponse = await fetch(
            `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    input: { text: chunk },
                    voice: voice,
                    audioConfig: {
                        audioEncoding: "MP3",
                        speakingRate: 0.80,
                        pitch: -2.0
                    }
                })
            }
        );
        const ttsData = await ttsResponse.json();
        if (ttsData.audioContent) {
            audioBuffers.push(ttsData.audioContent); // base64 strings
        } else {
            console.warn("TTS chunk failed:", JSON.stringify(ttsData));
        }
    }
 
    if (!audioBuffers.length) return null;
    if (audioBuffers.length === 1) return audioBuffers[0];
 
    // Concatenate multiple base64 MP3 chunks
    // MP3 frames are self-synchronizing — simple binary concat works
    const combined = Buffer.concat(audioBuffers.map(b => Buffer.from(b, 'base64')));
    return combined.toString('base64');
}
 
// ─── SMART TEXT SPLITTER ─────────────────────────────────────────────────────
function splitTextIntoChunks(text, maxChars) {
    const chunks = [];
    let remaining = text;
 
    while (remaining.length > 0) {
        if (remaining.length <= maxChars) {
            chunks.push(remaining);
            break;
        }
 
        // Try to split at sentence boundary within limit
        let splitAt = maxChars;
        const sentenceEnd = remaining.lastIndexOf('. ', maxChars);
        const newlineEnd = remaining.lastIndexOf('\n', maxChars);
        const commaEnd = remaining.lastIndexOf(', ', maxChars);
 
        if (sentenceEnd > maxChars * 0.5) {
            splitAt = sentenceEnd + 1; // include the period
        } else if (newlineEnd > maxChars * 0.5) {
            splitAt = newlineEnd;
        } else if (commaEnd > maxChars * 0.5) {
            splitAt = commaEnd + 1;
        }
 
        chunks.push(remaining.slice(0, splitAt).trim());
        remaining = remaining.slice(splitAt).trim();
    }
 
    return chunks.filter(c => c.length > 0);
}
 
