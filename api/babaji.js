export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    const { name, dob, tob, loc } = req.body;
    const today = new Date().toLocaleDateString('en-CA');

    try {
        /* 
        PHASE 1: EXTERNAL API CALL (Option C)
        Replace with your chosen provider's endpoint (e.g., AstrologyAPI, Pro-Astrology, etc.)
        This ensures Sun is ALWAYS at 17° Capricorn for Bowie.
        */
        const astroResponse = await fetch("https://api.your-provider.com/v1/birth_chart", {
            method: "POST",
            headers: { "Authorization": `Basic ${process.env.ASTRO_API_KEY}` },
            body: JSON.stringify({ dob, tob, loc })
        });
        const astroData = await astroResponse.json();

        /* 
        PHASE 2: AI INTERPRETATION (The Narrative Layer)
        We feed the verified numbers into Llama-3.3.
        */
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
                        HARDWARE (FACTS): ${JSON.stringify(astroData.planets)}.
                        ASPECTS: ${JSON.stringify(astroData.aspects)}.
                        TASK: Provide a deep, raw 3-paragraph narrative. 
                        Never hallucinate new positions. Interpret the exact hardware provided.`
                    },
                    { role: "user", content: "Dredge the silt for today's truth." }
                ],
                temperature: 0.7
            })
        });

        const data = await aiResponse.json();

        /* 
        PHASE 3: UNIFIED OUTPUT
        */
        res.status(200).json({ 
            reading: data.choices[0].message.content,
            planets: astroData.planets, // Deterministic data
            aspects: astroData.aspects   // Deterministic data
        });

    } catch (e) {
        console.error("Pipeline Failure:", e);
        res.status(500).json({ error: "Hardware failure in the vault." });
    }
}
