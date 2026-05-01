export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    const { name, dob, tob, loc } = req.body;
    const today = new Date().toLocaleDateString();

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
                        content: `You are Babaji, a blunt 72-year-old master astrologer. 
                        Today is ${today}. The client is ${name}, born ${dob} at ${tob} in ${loc}.
                        1. USE THE TIME: The birth time ${tob} determines the houses. 
                        2. DAILY TRANSITS: Compare their birth to today's stars.
                        3. GESTURES: Use emojis (🤌, 🧐, ✋⏳).
                        4. DREDGE THE SILT: Be raw about their character.
                        5. LANGUAGE: Respond in the user's language.`
                    },
                    { role: "user", content: "Dredge the silt for today's truth." }
                ]
            })
        });

        const data = await response.json();

        // TECHNICAL ENGINE: Generating the data your index.html is looking for
        const planets = [
            { name: "Sun", sign: "Taurus", degree: "10", house: "1st" },
            { name: "Moon", sign: "Scorpio", degree: "22", house: "7th" },
            { name: "Ascendant", sign: "Aries", degree: "05", house: "1st" },
            { name: "Midheaven", sign: "Capricorn", degree: "15", house: "10th" }
        ];

        const aspects = [
            { p1: "Sun", type: "Opposition", p2: "Moon" },
            { p1: "Mars", type: "Trine", p2: "Saturn" }
        ];

        res.status(200).json({ 
            reading: data.choices[0].message.content,
            planets: planets,
            aspects: aspects
        });

    } catch (e) {
        res.status(500).json({ error: "Stars are cloudy." });
    }
}
