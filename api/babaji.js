export default async function handler(req, res) {
    console.log("--- BABAJI UNIVERSAL START ---");
    try {
        const { name, dob, tob, loc } = req.body;

        // 1. DATE PARSING — handles both YYYY-MM-DD (HTML date input) and MM/DD/YYYY
        let day, month, year;
if (dob.includes('-')) {
    [year, month, day] = dob.split('-').map(Number);
} else {
    [month, day, year] = dob.split('/').map(Number);
}

        // 2. GEOCODING — convert birth city to real coordinates
        const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(loc)}&format=json&limit=1`,
            { headers: { 'User-Agent': 'BabajiAstrology/1.0' } }
        );
        const geoData = await geoRes.json();
        if (!geoData.length) {
            return res.status(200).json({ reading: "LOCATION ERROR: Could not find coordinates for that city." });
        }
        const lat = parseFloat(geoData[0].lat);
        const lon = parseFloat(geoData[0].lon);

        // 3. TIMEZONE — derive from coordinates
        const tzRes = await fetch(
            `https://timeapi.io/api/timezone/coordinate?latitude=${lat}&longitude=${lon}`
        );
        const tzData = await tzRes.json();
        const tzone = tzData.currentUtcOffset?.seconds ? tzData.currentUtcOffset.seconds / 3600 : 0;

        // 4. ASTROLOGYAPI AUTH
        const authString = Buffer.from(
            `${process.env.ASTRO_USER_ID}:${process.env.ASTRO_API_KEY}`
        ).toString('base64');

        // 5. FETCH CHART
        const astroResponse = await fetch("https://json.astrologyapi.com/v1/western_horoscope", {
            method: "POST",
            headers: {
                "Authorization": `Basic ${authString}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                day, month, year,
                hour: parseInt(tob.split(':')[0]),
                min: parseInt(tob.split(':')[1]),
                lat, lon, tzone
            })
        });
        const astroData = await astroResponse.json();

        if (!astroData.planets) {
            return res.status(200).json({
                reading: `HARDWARE ERROR: ${JSON.stringify(astroData)}`,
                planets: [],
                aspects: []
            });
        }

        // 6. BUILD CURATED CHART SUMMARY FOR BABAJI
        const planetSummary = astroData.planets
            .map(p => `${p.name} in ${p.sign} (${p.degree}°) — House ${p.house}`)
            .join('\n');

        const aspectSummary = (astroData.aspects || [])
            .map(a => `${a.p1} ${a.type} ${a.p2}`)
            .join('\n');

        // 7. GROQ NARRATIVE
        const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                max_tokens: 800,
                messages: [
                    {
                        role: "system",
                        content: `You are Babaji — an ancient, grounded cosmic interpreter. 
Speak in rich, unhurried prose. No bullet points. No fluff. 
Interpret the seeker's chart as if reading from a worn celestial ledger.
Reference specific placements. Be precise, poetic, and occasionally wry.`
                    },
                    {
                        role: "user",
                        content: `Seeker: ${name}\n\nPlanetary Positions:\n${planetSummary}\n\nAspects:\n${aspectSummary}\n\nGive a full natal reading.`
                    }
                ]
            })
        });
        const aiData = await groqResponse.json();

        // 8. RESPOND WITH ALL THREE DATA SETS
        res.status(200).json({
            reading: aiData.choices[0].message.content,
            planets: astroData.planets,
            aspects: (astroData.aspects || []).map(a => ({
                p1: a.p1,
                type: a.type,
                p2: a.p2
            }))
        });

    } catch (e) {
        console.error("PIPELINE CRASH:", e.message);
        res.status(200).json({
            reading: "The stars are obscured by: " + e.message,
            planets: [],
            aspects: []
        });
    }
}
