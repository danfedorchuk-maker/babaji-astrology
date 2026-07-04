const { cleanMarkdown, resolveVoice, synthesizeChunked, geocode, getTimezoneOffset } = require('./_lib');

module.exports = async function handler(req, res) {
    try {
        const { name, dob, tob, loc, tradition, lang, houseSystem, angles } = req.body;

        const langCode = (lang || 'en').toLowerCase();

        let day, month, year;
        if (dob.includes('-')) [year, month, day] = dob.split('-').map(Number);
        else [month, day, year] = dob.split('/').map(Number);

        const geo = await geocode(loc, req.body.country);
        if (!geo) return res.status(200).json({ reading: "LOCATION ERROR", planets: [], aspects: [] });
        const { lat, lon } = geo;
        const tzone = await getTimezoneOffset(lat, lon);

        const houseType = (houseSystem === 'topocentric') ? 'topocentric' : 'placidus';

        const endpoints = {
            western: 'https://json.astrologyapi.com/v1/planets/tropical',
            chinese: 'https://json.astrologyapi.com/v1/chinese_zodiac',
            indian:  'https://json.astrologyapi.com/v1/planets'
        };
        const astroBody = tradition === 'chinese'
            ? { day, month, year }
            : { day, month, year, hour: parseInt(tob.split(':')[0]), min: parseInt(tob.split(':')[1]), lat, lon, tzone, house_type: houseType };

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
            if (angles && angles.length) {
                planetSummary += '\n\nChart Angles (' + houseType.toUpperCase() + ' houses):\n';
                planetSummary += angles.map(a => `${a.name} (${a.label}): ${a.sign} ${a.degree}°`).join('\n');
            }
        } else {
            return res.status(200).json({ reading: `HARDWARE ERROR: ${JSON.stringify(astroData)}`, planets: [], aspects: [] });
        }

        const traditionLabel = { western: 'Western tropical', chinese: 'Chinese', indian: 'Vedic Indian' }[tradition] || 'Western tropical';
        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "openai/gpt-oss-120b",
                max_tokens: 1500,
                messages: [
                    {
                        role: "system",
                        content: `You are Babaji — ancient, grounded cosmic interpreter. Rich unhurried prose, no bullet points. Interpret the ${traditionLabel} chart from a worn celestial ledger. Precise, poetic, occasionally wry. Round degrees to two decimal places. The house system used is ${houseType.toUpperCase()}. Always mention the Ascendant (ASC), Midheaven (MC), IC, and Descendant (DSC) angles by name and sign in your reading. Respond in the language identified by BCP-47 code: ${langCode}.`
                    },
                    { role: "user", content: `Seeker: ${name}\nTradition: ${traditionLabel}\nHouse System: ${houseType.toUpperCase()}\n\n${planetSummary}\n\nGive a full natal reading.` }
                ]
            })
        });
        const aiData = await groqRes.json();
        const rawReading = aiData.choices[0].message.content;
        const reading = cleanMarkdown(rawReading);

        const voice = resolveVoice(langCode, tradition);
        const audio = await synthesizeChunked(reading, voice, process.env.GOOGLE_TTS_KEY);

        // Record free reading used in Redis
        const visitorId = req.body.visitorId;
        if (visitorId) {
            try {
                const baseUrl = process.env.KV_REST_API_URL;
                const token = process.env.KV_REST_API_TOKEN;
                await fetch(`${baseUrl}/incr/free:${visitorId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } catch(e) {}
        }

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
