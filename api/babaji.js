export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    const { name, dob, tob, loc } = req.body;
    const today = new Date().toISOString().split('T')[0];

    if (!process.env.GROQ_API_KEY) {
        return res.status(500).json({ reading: "Babaji says: The Vault is locked." });
    }

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
                        content: `You are Babaji, a 72-year-old blunt master of the stars. 
                        The client is ${name}, born ${dob} at ${tob} in ${loc}. 
                        Today's date is ${today}. 

                        THE BABAJI PROTOCOL:
                        1. TRANSITS: Compare their birth arrival to today's celestial weather. Every reading must feel different.
                        2. LANGUAGE: Support 130 languages. Respond in the language the user uses.
                        3. GESTURES: Use emojis to represent physical actions (e.g., 🤌, 🧐, ✋⏳).
                        4. THE DIRT: Be raw, blunt, and dredge the silt of their character. No tourism.
                        5. FORMATTING: Use punchy paragraphs.`
                    },
                    {
                        role: "user",
                        content: "The coordinates are set. Dredge the silt of my arrival for today's truth."
                    }
                ]
            })
        });

        const data = await response.json();
        res.status(200).json({ reading: data.choices[0].message.content });

    } catch (error) {
        res.status(500).json({ reading: "The stars are cloudy: " + error.message });
    }
}
