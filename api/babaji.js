export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    const { name, dob, tob, loc } = req.body;

    try {
        /* 
        PIPELINE STEP 1: DETERMINISTIC DATA
        In Option C, you'd fetch from AstrologyAPI here.
        For now, we ensure these exact degrees are passed to the AI.
        */
        const deterministicPlanets = [
            { name: "Sun", sign: "Capricorn", degree: "17", house: "10th" },
            { name: "Moon", sign: "Aquarius", degree: "02", house: "11th" },
            { name: "Mercury", sign: "Capricorn", degree: "29", house: "10th" }
            // ... more planets
        ];

        const deterministicAspects = [
            { p1: "Sun", type: "Conjunction", p2: "Mercury", glyph: "☌" },
            { p1: "Moon", type: "Square", p2: "Jupiter", glyph: "□" }
        ];

        // PIPELINE STEP 2: NARRATIVE GENERATION
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
                        FACTS: ${JSON.stringify(deterministicPlanets)}.
                        Provide a deep, 3-4 paragraph narrative. 
                        Never change the planetary degrees. Interpret them exactly.`
                    },
                    { role: "user", content: "Dredge the silt." }
                ]
            })
        });

        const data = await aiResponse.json();

        res.status(200).json({ 
            reading: data.choices[0].message.content,
            planets: deterministicPlanets,
            aspects: deterministicAspects
        });
    } catch (e) {
        res.status(500).json({ error: "Hardware failure." });
    }
}
