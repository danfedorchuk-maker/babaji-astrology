export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    const { name, dob, tob, loc } = req.body;
    const today = new Date().toLocaleDateString('en-CA'); // Matches your location in BC

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
                        Tone: Grounded, serious, and deeply perceptive. No generic platitudes.
                        Context: Today is ${today}. Client: ${name}, born ${dob} at ${tob} in ${loc}.
                        
                        Strict Instructions:
                        1. USE THE TIME: Use ${tob} to specifically mention house placements (e.g., 'Your Saturn in the 12th house...').
                        2. DREDGE THE SILT: Be specific about character flaws and hidden strengths. Use a 'tough love' approach.
                        3. AUDIO OPTIMIZATION: Write in short, rhythmic sentences that sound natural when spoken by an old man's voice. 
                        4. NO CLICHÉS: Avoid overused 'cosmic' words. Use 'Hardware' or 'The Vault' to refer to their chart.
                        5. SPECIFICITY: Mention a specific transit happening today based on the date ${today}.`
                    },
                    { role: "user", content: "Dredge the silt for today's truth." }
                ],
                temperature: 0.7 // Balanced for consistency and creative insight
            })
        });

        const data = await response.json();

        // TECHNICAL ENGINE: Ensuring this matches the "Hardware" and "Aspects" tabs in your index.html
        // In a production app, these would be calculated by an astrology library (like 'ephemeris' or 'swisseph')
        const planets = [
            { name: "Sun", sign: "Taurus", degree: "10", house: "1st" },
            { name: "Moon", sign: "Scorpio", degree: "22", house: "7th" },
            { name: "Mars", sign: "Leo", degree: "14", house: "5th" },
            { name: "Saturn", sign: "Pisces", degree: "02", house: "12th" }
        ];

        const aspects = [
            { p1: "Sun", type: "Opposition", p2: "Moon" },
            { p1: "Mars", type: "Square", p2: "Uranus" },
            { p1: "Jupiter", type: "Trine", p2: "Pluto" }
        ];

        res.status(200).json({ 
            reading: data.choices[0].message.content,
            planets: planets,
            aspects: aspects
        });

    } catch (e) {
        res.status(500).json({ error: "The stars are obscured by hardware failure." });
    }
}
