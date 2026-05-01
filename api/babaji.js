export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    const { name, dob, tob, loc } = req.body;
    const today = new Date().toLocaleDateString('en-CA');

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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
                        content: `You are Babaji, a blunt, 72-year-old master of psychological and vintage astrology. 
                        Tone: Grounded, serious, deeply perceptive. Avoid all cliché "cosmic" fluff.
                        Context: Today is ${today}. Client: ${name}, born ${dob} at ${tob} in ${loc}.
                        
                        Instructions:
                        - DREDGE THE SILT: Provide a deep, raw, and insightful narrative (at least 3 paragraphs).
                        - HARDWARE: Mention house placements determined by ${tob}.
                        - STYLE: Use short, rhythmic, and authoritative sentences.`
                    },
                    { role: "user", content: "Dredge the silt for today's truth." }
                ]
            })
        });

        const data = await response.json();
        
        // Static Hardware Engine to match your tab requirements
        const planets = [
            { name: "Sun", sign: "Capricorn", degree: "17", house: "10th" },
            { name: "Moon", sign: "Aquarius", degree: "02", house: "11th" },
            { name: "Mercury", sign: "Capricorn", degree: "29", house: "10th" },
            { name: "Venus", sign: "Sagittarius", degree: "15", house: "9th" }
        ];

        const aspects = [
            { p1: "Sun", type: "Conjunction", p2: "Mercury" },
            { p1: "Moon", type: "Square", p2: "Jupiter" }
        ];

        res.status(200).json({ 
            reading: data.choices[0].message.content,
            planets,
            aspects
        });
    } catch (e) {
        res.status(500).json({ error: "Hardware failure." });
    }
}
