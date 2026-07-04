const { cleanMarkdown, resolveVoice, synthesizeChunked, geocode, getTimezoneOffset } = require('./_lib');

// ---- Low-precision planetary ephemeris ----
// Based on the standard orbital-elements method popularized by Paul Schlyter's
// "Computing Planetary Positions" tutorial — accurate to roughly a degree,
// which is plenty for determining zodiac sign, moon phase, and retrograde
// direction (this is a supportive/soft-astrology feature, not navigation).

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
function norm360(x) { return ((x % 360) + 360) % 360; }
function sinD(d) { return Math.sin(d * D2R); }
function cosD(d) { return Math.cos(d * D2R); }
function atan2D(y, x) { return norm360(Math.atan2(y, x) * R2D); }

function julianDay(y, m, d, hourUTC) {
    if (m <= 2) { y -= 1; m += 12; }
    const A = Math.floor(y / 100);
    const B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5 + (hourUTC || 0) / 24;
}

// d = days since J2000.0 epoch (2000 Jan 0.0 UT = JD 2451543.5), per Schlyter's convention
function daysSinceEpoch(jd) { return jd - 2451543.5; }

function solveEccentricAnomaly(M, e) {
    let E = M + (e * R2D) * sinD(M) * (1 + e * cosD(M));
    for (let i = 0; i < 3; i++) {
        const dM = M - (E - (e * R2D) * sinD(E));
        const dE = dM / (1 - e * cosD(E));
        E += dE;
    }
    return E;
}

// Returns heliocentric-style rectangular position for a body given its
// orbital elements (for Sun/Moon these are already geocentric by convention).
function orbitPosition(N, i, w, a, e, M) {
    const E = solveEccentricAnomaly(M, e);
    const xv = a * (cosD(E) - e);
    const yv = a * (Math.sqrt(1 - e * e) * sinD(E));
    const v = atan2D(yv, xv);
    const r = Math.sqrt(xv * xv + yv * yv);
    const vw = v + w;
    const xh = r * (cosD(N) * cosD(vw) - sinD(N) * sinD(vw) * cosD(i));
    const yh = r * (sinD(N) * cosD(vw) + cosD(N) * sinD(vw) * cosD(i));
    const zh = r * (sinD(vw) * sinD(i));
    return { x: xh, y: yh, z: zh, r };
}

function sunPosition(d) {
    const w = 282.9404 + 4.70935e-5 * d;
    const e = 0.016709 - 1.151e-9 * d;
    const M = norm360(356.0470 + 0.9856002585 * d);
    return orbitPosition(0, 0, w, 1.0, e, M); // Sun's apparent geocentric position
}

function moonLongitude(d) {
    const N = norm360(125.1228 - 0.0529538083 * d);
    const i = 5.1454;
    const w = norm360(318.0634 + 0.1643573223 * d);
    const a = 60.2666;
    const e = 0.054900;
    const M = norm360(115.3654 + 13.0649929509 * d);
    const pos = orbitPosition(N, i, w, a, e, M);
    return atan2D(pos.y, pos.x);
}

function planetGeocentricLongitude(d, elements) {
    const { N, i, w, a, e, M } = elements(d);
    const helio = orbitPosition(N, i, w, a, e, M);
    const sun = sunPosition(d); // Earth-Sun vector (Sun's apparent geocentric position)
    const xg = helio.x + sun.x;
    const yg = helio.y + sun.y;
    return atan2D(yg, xg);
}

const MERCURY_ELEMENTS = d => ({
    N: norm360(48.3313 + 3.24587e-5 * d),
    i: 7.0047 + 5.00e-8 * d,
    w: norm360(29.1241 + 1.01444e-5 * d),
    a: 0.387098,
    e: 0.205635 + 5.59e-10 * d,
    M: norm360(168.6562 + 4.0923344368 * d)
});
const VENUS_ELEMENTS = d => ({
    N: norm360(76.6799 + 2.46590e-5 * d),
    i: 3.3946 + 2.75e-8 * d,
    w: norm360(54.8910 + 1.38374e-5 * d),
    a: 0.723330,
    e: 0.006773 - 1.302e-9 * d,
    M: norm360(48.0052 + 1.6021302244 * d)
});

function sunLongitude(d) {
    const s = sunPosition(d);
    return atan2D(s.y, s.x);
}

// Returns { moonSignIdx, moonLon, sunLon, waxing, elongation, mercuryRetro, venusRetro }
function dayAstroState(jd) {
    const d = daysSinceEpoch(jd);
    const dPrev = daysSinceEpoch(jd - 1);
    const moonLon = moonLongitude(d);
    const sLon = sunLongitude(d);
    const mercuryLon = planetGeocentricLongitude(d, MERCURY_ELEMENTS);
    const mercuryLonPrev = planetGeocentricLongitude(dPrev, MERCURY_ELEMENTS);
    const venusLon = planetGeocentricLongitude(d, VENUS_ELEMENTS);
    const venusLonPrev = planetGeocentricLongitude(dPrev, VENUS_ELEMENTS);

    const angDiff = (a, b) => { let x = norm360(a - b); if (x > 180) x -= 360; return x; };

    const elongation = norm360(moonLon - sLon);
    return {
        moonSignIdx: Math.floor(norm360(moonLon) / 30),
        moonLon, sunLon: sLon,
        waxing: elongation < 180,
        elongation,
        mercuryRetro: angDiff(mercuryLon, mercuryLonPrev) < 0,
        venusRetro: angDiff(venusLon, venusLonPrev) < 0
    };
}

const ZODIAC = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
const FAVORABLE_MOON_SIGNS = [1, 3, 6, 11]; // Taurus, Cancer, Libra, Pisces
const DUSTHANA_OFFSETS = [5, 7, 11]; // 6th, 8th, 12th houses counted from a natal Moon sign (0-indexed offsets)

function scoreDay(state, natalMoonA, natalMoonB) {
    let score = 0;
    const reasons = [];
    if (!state.mercuryRetro) { score += 2; } else { score -= 2; reasons.push('Mercury retrograde'); }
    if (!state.venusRetro) { score += 2; } else { score -= 2; reasons.push('Venus retrograde'); }
    if (FAVORABLE_MOON_SIGNS.includes(state.moonSignIdx)) { score += 1; reasons.push(`Moon in ${ZODIAC[state.moonSignIdx]}`); }
    if (state.waxing) score += 1;
    if (state.elongation < 12 || state.elongation > 348) { score -= 1; reasons.push('near new moon'); }

    [natalMoonA, natalMoonB].forEach((natalIdx, idx) => {
        if (natalIdx == null) return;
        const offset = (state.moonSignIdx - natalIdx + 12) % 12;
        if (DUSTHANA_OFFSETS.includes(offset)) { score -= 2; reasons.push(`stressed for Partner ${idx === 0 ? 'A' : 'B'}'s natal Moon`); }
        else score += 1;
    });

    return { score, reasons };
}

async function natalMoonSignIdx(person) {
    if (!person || !person.dob) return null;
    const [y, m, dd] = person.dob.split('-').map(Number);
    let hourUTC = 12, offsetHours = 0;
    if (person.loc) {
        const geo = await geocode(person.loc, person.country);
        if (geo) {
            offsetHours = await getTimezoneOffset(geo.lat, geo.lon);
        }
    }
    if (person.tob) {
        const [hh, mm] = person.tob.split(':').map(Number);
        hourUTC = hh + mm / 60 - offsetHours;
    }
    const jd = julianDay(y, m, dd, hourUTC);
    const lon = moonLongitude(daysSinceEpoch(jd));
    return Math.floor(norm360(lon) / 30);
}

function parseDateOnly(str) {
    const [y, m, d] = str.split('-').map(Number);
    return { y, m, d };
}

module.exports = async function handler(req, res) {
    try {
        const { startDate, endDate, partnerA, partnerB, lang, visitorId } = req.body;
        if (!startDate || !endDate) {
            return res.status(200).json({ error: 'Missing date range', dates: [], reading: '' });
        }

        const start = parseDateOnly(startDate);
        const end = parseDateOnly(endDate);
        const startJD = julianDay(start.y, start.m, start.d, 12);
        const endJD = julianDay(end.y, end.m, end.d, 12);
        let totalDays = Math.round(endJD - startJD);
        if (totalDays < 1) totalDays = 1;
        if (totalDays > 365) totalDays = 365; // sanity cap

        const [natalA, natalB] = await Promise.all([
            natalMoonSignIdx(partnerA),
            natalMoonSignIdx(partnerB)
        ]);

        const candidates = [];
        for (let offset = 0; offset <= totalDays; offset++) {
            const jd = startJD + offset;
            const state = dayAstroState(jd);
            const { score, reasons } = scoreDay(state, natalA, natalB);
            candidates.push({ jd, offset, score, reasons, state });
        }

        candidates.sort((a, b) => b.score - a.score);

        // Pick top distinct dates, spaced at least 4 days apart so results
        // aren't just one good week repeated five times.
        const picked = [];
        for (const c of candidates) {
            if (picked.length >= 5) break;
            if (picked.some(p => Math.abs(p.offset - c.offset) < 4)) continue;
            picked.push(c);
        }
        picked.sort((a, b) => a.offset - b.offset);

        function jdToDateStr(jd) {
            // Convert back to a calendar date (UTC) for display
            const unixMs = (jd - 2440587.5) * 86400000;
            return new Date(unixMs).toISOString().slice(0, 10);
        }

        const dateResults = picked.map(c => ({
            date: jdToDateStr(c.jd),
            score: c.score,
            moonSign: ZODIAC[c.state.moonSignIdx],
            waxing: c.state.waxing,
            mercuryRetro: c.state.mercuryRetro,
            venusRetro: c.state.venusRetro,
            notes: c.reasons
        }));

        const langCode = (lang || 'en').toLowerCase();
        const nameA = (partnerA && partnerA.name) || 'Partner A';
        const nameB = (partnerB && partnerB.name) || 'Partner B';

        const summaryForAI = dateResults.map(d =>
            `${d.date} — score ${d.score}, Moon in ${d.moonSign}${d.waxing ? ' (waxing)' : ' (waning)'}, Mercury ${d.mercuryRetro ? 'retrograde' : 'direct'}, Venus ${d.venusRetro ? 'retrograde' : 'direct'}${d.notes.length ? ', notes: ' + d.notes.join('; ') : ''}`
        ).join('\n');

        let reading = '';
        let audio = null;
        try {
            const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "openai/gpt-oss-120b",
                    max_tokens: 1200,
                    messages: [
                        {
                            role: "system",
                            content: `You are Babaji — ancient, grounded cosmic interpreter, consulted here on Vivaha Muhurta (auspicious wedding timing). Rich unhurried prose, no bullet points, no markdown formatting. Explain briefly what Mercury/Venus retrograde and Moon sign/phase mean for choosing a wedding date, then walk through the ranked candidate dates given, in order, explaining the reasoning for each in plain terms. Be honest if the whole window is mediocre rather than oversell a weak date. Close with brief general guidance for the couple. Respond in the language identified by BCP-47 code: ${langCode}.`
                        },
                        { role: "user", content: `Seekers: ${nameA} and ${nameB}\nSearch window: ${startDate} to ${endDate}\n\nCandidate dates ranked by favorability:\n${summaryForAI}\n\nGive your counsel on the best time to marry.` }
                    ]
                })
            });
            const aiData = await groqRes.json();
            reading = cleanMarkdown(aiData.choices[0].message.content);

            const voice = resolveVoice(langCode, 'indian');
            audio = await synthesizeChunked(reading, voice, process.env.GOOGLE_TTS_KEY);
        } catch (e) {
            reading = 'The ledger is smudged and Babaji cannot speak on this just now — but the ranked dates above stand on their own merits.';
        }

        if (visitorId) {
            try {
                const baseUrl = process.env.KV_REST_API_URL;
                const token = process.env.KV_REST_API_TOKEN;
                await fetch(`${baseUrl}/incr/free:${visitorId}`, { headers: { Authorization: `Bearer ${token}` } });
            } catch (e) {}
        }

        res.status(200).json({ dates: dateResults, reading, audio: audio || null });

    } catch (e) {
        console.error("CRASH:", e.message);
        res.status(200).json({ error: e.message, dates: [], reading: '' });
    }
};
