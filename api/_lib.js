// Shared helpers used by multiple /api endpoints.
// Filename starts with "_" so Vercel does not expose this as a route.

const VOICES = {
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

function resolveVoice(langCode, tradition) {
    const baseLang = (langCode || 'en').toLowerCase().split('-')[0];
    const key = baseLang === 'en' ? `en-${tradition || 'western'}` : (VOICES[langCode] ? langCode : baseLang);
    const [languageCode, name, ssmlGender] = VOICES[key] || VOICES['en-western'];
    return { languageCode, name, ssmlGender };
}

function cleanMarkdown(text) {
    return (text || '')
        .replace(/\*\*(.*?)\*\*/g, '$1')   // **bold**
        .replace(/\*(.*?)\*/g, '$1')       // *italic*
        .replace(/__(.*?)__/g, '$1')       // __bold__
        .replace(/_(.*?)_/g, '$1')         // _italic_
        .replace(/^#{1,6}\s+/gm, '')       // # headers
        .replace(/^[-*+]\s+/gm, '')        // - bullet points
        .replace(/`([^`]+)`/g, '$1')       // `inline code`
        .trim();
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

async function synthesizeChunked(text, voice, apiKey) {
    const isMultibyte = /[\u0400-\u04FF\u0900-\u097F\u4E00-\u9FFF\u3040-\u30FF]/.test(text);
    const chunkSize = isMultibyte ? 1500 : 4500;
    const chunks = splitText(text, chunkSize);
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
        if (d.audioContent) buffers.push(d.audioContent);
    }
    if (!buffers.length) return null;
    if (buffers.length === 1) return buffers[0];
    return Buffer.concat(buffers.map(b => Buffer.from(b, 'base64'))).toString('base64');
}

async function geocode(loc, country) {
    const query = country ? `${loc}, ${country}` : loc;
    const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
        { headers: { 'User-Agent': 'BabajiAstrology/1.0' } }
    );
    const geoData = await geoRes.json();
    if (!geoData.length) return null;
    return { lat: parseFloat(geoData[0].lat), lon: parseFloat(geoData[0].lon) };
}

async function getTimezoneOffset(lat, lon) {
    try {
        const tzRes = await fetch(`https://timeapi.io/api/timezone/coordinate?latitude=${lat}&longitude=${lon}`);
        const tzData = await tzRes.json();
        return tzData.currentUtcOffset?.seconds != null
            ? tzData.currentUtcOffset.seconds / 3600
            : (tzData.utcOffset ?? 0);
    } catch (e) {
        return 0;
    }
}

module.exports = { VOICES, resolveVoice, cleanMarkdown, splitText, synthesizeChunked, geocode, getTimezoneOffset };
