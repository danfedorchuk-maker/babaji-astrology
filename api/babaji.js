module.exports = async function handler(req, res) {
    try {
        const { name, dob, tob, loc, tradition, lang } = req.body;

        const langCode = (lang || 'en').toLowerCase();
        const baseLang = langCode.split('-')[0];

        let day, month, year;
        if (dob.includes('-')) [year, month, day] = dob.split('-').map(Number);
        else [month, day, year] = dob.split('/').map(Number);

        const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(loc)}&format=json&limit=1`,
            { headers: { 'User-Agent': 'BabajiAstrology/1.0' } }
        );
        const geoData = await geoRes.json();
        if (!geoData.length) return res.status(200).json({ reading: "LOCATION ERROR", planets: [], aspects: [] });
        const lat = parseFloat(geoData[0].lat);
        const lon = parseFloat(geoData[0].lon);

        const tzRes = await fetch(`https://timeapi.io/api/timezone/coordinate?latitude=${lat}&longitude=${lon}`);
        const tzData = await tzRes.json();
        const tzone = tzData.currentUtcOffset?.seconds != null
            ? tzData.currentUtcOffset.seconds / 3600
            : (tzData.utcOffset ?? 0);

        const endpoints = {
            western: 'https://json.astrologyapi.com/v1/planets/tropical',
            chinese: 'https://json.astrologyapi.com/v1/chinese_zodiac',
            indian:  'https://json.astrologyapi.com/v1/planets'
        };
        const astroBody = tradition === 'chinese'
            ? { day, month, year }
            : { day, month, year, hour: parseInt(tob.split(':')[0]), min: parseInt(tob.split(':')[1]), lat, lon, tzone, house_type: "placidus" };

        const astroRes = await fetch(endpoints[tradition] || endpoints.western, {
            method: "POST",
            headers: { "x-astrologyapi-key": process.env.ASTRO_ACCESS_TOKEN, "Content-Type": "application/json" },
            body: JSON.stringify(astroBody)
        });
        const astroData = await astroRes.json();
        const planets = Array.isArray(astroData) ? astroData : astroData.planets || null;

        let planetSummary;
        if (tradition === 'chinese') {
            planetSummary = `Chinese Zodiac: ${astroData.name||''}, Element: ${astroData.element||''}, Force: ${astroData.force||''}, Stone: ${astroData.stone||''}`;
        } else if (planets) {
            planetSummary = planets.map(p => `${p.name} in ${p.sign} (${parseFloat(p.normDegree).toFixed(2)}°) — House ${p.house}`).join('\n');
        } else {
            return res.status(200).json({ reading: `HARDWARE ERROR: ${JSON.stringify(astroData)}`, planets: [], aspects: [] });
        }

        const traditionLabel = { western: 'Western tropical', chinese: 'Chinese', indian: 'Vedic Indian' }[tradition] || 'Western tropical';
        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                max_tokens: 1500,
                messages: [
                    {
                        role: "system",
                        content: `You are Babaji — ancient, grounded cosmic interpreter. Rich unhurried prose, no bullet points. Interpret the ${traditionLabel} chart from a worn celestial ledger. Precise, poetic, occasionally wry. Round degrees to two decimal places. Respond in the language identified by BCP-47 code: ${langCode}.`
                    },
                    { role: "user", content: `Seeker: ${name}\nTradition: ${traditionLabel}\n\n${planetSummary}\n\nGive a full natal reading.` }
                ]
            })
        });
        const aiData = await groqRes.json();
        const reading = aiData.choices[0].message.content;

        const voices = {
            'en-western': ['en-GB', 'en-GB-Wavenet-B',   'MALE'],
            'en-indian':  ['en-IN', 'en-IN-Wavenet-C',   'MALE'],
            'en-chinese': ['en-US', 'en-US-Wavenet-D',   'MALE'],
            ru:  ['ru-RU', 'ru-RU-Wavenet-D',  'MALE'],
            hi:  ['hi-IN', 'hi-IN-Wavenet-C',  'MALE'],
            zh:  ['cmn-CN','cmn-CN-Wavenet-B', 'MALE'],
            'zh-tw': ['cmn-TW','cmn-TW-Wavenet-B','MALE'],
            'zh-hk': ['yue-HK','yue-HK-Standard-B','MALE'],
            fr:  ['fr-FR', 'fr-FR-Wavenet-B',  'MALE'],
            de:  ['de-DE', 'de-DE-Wavenet-B',  'MALE'],
            es:  ['es-ES', 'es-ES-Wavenet-B',  'MALE'],
            it:  ['it-IT', 'it-IT-Wavenet-C',  'MALE'],
            pt:  ['pt-PT', 'pt-PT-Wavenet-B',  'MALE'],
            'pt-br': ['pt-BR','pt-BR-Wavenet-B','MALE'],
            ar:  ['ar-XA', 'ar-XA-Wavenet-B',  'MALE'],
            ja:  ['ja-JP', 'ja-JP-Wavenet-C',  'MALE'],
            ko:  ['ko-KR', 'ko-KR-Wavenet-C',  'MALE'],
            tr:  ['tr-TR', 'tr-TR-Wavenet-B',  'MALE'],
            pl:  ['pl-PL', 'pl-PL-Wavenet-B',  'MALE'],
            nl:  ['nl-NL', 'nl-NL-Wavenet-B',  'MALE'],
            sv:  ['sv-SE', 'sv-SE-Wavenet-C',  'MALE'],
            da:  ['da-DK', 'da-DK-Wavenet-A',  'FEMALE'],
            fi:  ['fi-FI', 'fi-FI-Wavenet-A',  'FEMALE'],
            nb:  ['nb-NO', 'nb-NO-Wavenet-B',  'MALE'],
            uk:  ['uk-UA', 'uk-UA-Wavenet-A',  'FEMALE'],
            cs:  ['cs-CZ', 'cs-CZ-Wavenet-A',  'FEMALE'],
            ro:  ['ro-RO', 'ro-RO-Wavenet-A',  'FEMALE'],
            el:  ['el-GR', 'el-GR-Wavenet-A',  'FEMALE'],
            hu:  ['hu-HU', 'hu-HU-Standard-A', 'FEMALE'],
            id:  ['id-ID', 'id-ID-Wavenet-B',  'MALE'],
            ms:  ['ms-MY', 'ms-MY-Wavenet-B',  'MALE'],
            th:  ['th-TH', 'th-TH-Neural2-C',  'FEMALE'],
            vi:  ['vi-VN', 'vi-VN-Wavenet-B',  'MALE'],
            he:  ['he-IL', 'he-IL-Wavenet-B',  'MALE'],
            bn:  ['bn-IN', 'bn-IN-Wavenet-B',  'MALE'],
            ta:  ['ta-IN', 'ta-IN-Wavenet-C',  'MALE'],
            te:  ['te-IN', 'te-IN-Standard-B', 'MALE'],
            af:  ['af-ZA', 'af-ZA-Standard-B', 'MALE'],
            ca:  ['ca-ES', 'ca-ES-Standard-A', 'FEMALE'],
            sk:  ['sk-SK', 'sk-SK-Wavenet-A',  'FEMALE'],
            sw:  ['sw-KE', 'sw-KE-Standard-B', 'MALE'],
            ur:  ['ur-IN', 'ur-IN-Wavenet-B',  'MALE'],
        };

        const voiceKey = baseLang === 'en' ? `en-${tradition}` : (voices[langCode] ? langCode : baseLang);
        const [languageCode, voiceName, ssmlGender] = voices[voiceKey] || voices['en-western'];
        const audio = await synthesizeChunked(reading, { languageCode, name: voiceName, ssmlGender }, process.env.GOOGLE_TTS_KEY);

        res.status(200).json({
            reading,
            audio: audio || null,
            planets: tradition === 'chinese' ? [] : (planets || []),
            aspects: []
        });

    } catch (e) {
        console.error("CRASH:", e.message);
        res.status(200).json({ reading: "CRASH: " + e.message, planets: [], aspects: [] });
    }
};

async function synthesizeChunked(text, voice, apiKey) {
    const isMultibyte = /[\u0400-\u04FF\u0900-\u097F\u4E00-\u9FFF\u3040-\u30FF]/.test(text);
    const chunkSize = isMultibyte ? 1500 : 4500;
    const chunks = splitText(text, chunkSize);
    console.log(`TTS: ${chunks.length} chunks, multibyte: ${isMultibyte}`);
    const buffers = [];
    for (let i = 0; i < chunks.length; i++) {
        const r = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                input: { text: chunks[i] },
                voice,
                audioConfig: { audioEncoding: "MP3", speakingRate: 0.80, pitch: -2.0 }
            })
        });
        const d = await r.json();
        console.log(`Chunk ${i+1}: ${d.audioContent ? 'OK' : 'FAILED'} — ${JSON.stringify(d.error || '')}`);
        if (d.audioContent) buffers.push(d.audioContent);
    }
    if (!buffers.length) return null;
    if (buffers.length === 1) return buffers[0];
    return Buffer.concat(buffers.map(b => Buffer.from(b, 'base64'))).toString('base64');
}

function splitText(text, max) {
    const chunks = [];
    let rem = text;
    while (rem.length > 0) {
        if (rem.length <= max) { chunks.push(rem); break; }
        let at = max;
        const s = rem.lastIndexOf('. ', max);
        const n = rem.lastIndexOf('\n', max);
        if (s > max * 0.5) at = s + 1;
        else if (n > max * 0.5) at = n;
        chunks.push(rem.slice(0, at).trim());
        rem = rem.slice(at).trim();
    }
    return chunks.filter(Boolean);
}
