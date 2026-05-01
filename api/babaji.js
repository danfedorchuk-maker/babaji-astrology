export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    const { name, dob, tob, loc } = req.body;

    try {
        // PHASE 1: Deterministic Math from AstrologyAPI
        const astroResponse = await fetch("https://json.astrologyapi.com/v1/western_horoscope", {
            method: "POST",
            headers: {
                "Authorization": "Basic " + Buffer.from(process.env.ASTRO_USER_ID + ":" + process.env.ASTRO_API_KEY).toString('base64'),
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                day: parseInt(dob.split('-')[2]),
                month: parseInt(dob.split('-')[1]),
                year: parseInt(dob.split('-')[0]),
                hour: parseInt(tob.split(':')[0]),
                min: parseInt(tob.split(':')[1]),
                lat: 43.6532, // Example: Toronto (Replace with dynamic geocoding)
                lon: -79.3832,
                tzone: -5.0
            })
        });
        
        const astroData = await astroResponse.json();

        // PHASE 2: Narrative Generation via Groq
        const aiResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    {
                        role: "system",
                        content: `You are Babaji, a blunt 72-year-old master astrologer. 
                        FACTS: ${JSON.stringify(astroData)}.
                        Dredge the silt for ${name}. Interpret the house placements and aspects with tough love.`
                    },
                    { role: "user", content: "Dredge the silt." }
                ]
            })
        });

        const aiData = await aiResponse.json();

        // PHASE 3: Unified Output to Frontend
        res.status(200).json({ 
            reading: aiData.choices[0].message.content,
            planets: astroData.planets, // Consistent math
            aspects: astroData.aspects   // Authentic glyph-ready data
        });
    } catch (e) {
        res.status(500).json({ error: "The stars are obscured by hardware failure." });
    }
}
