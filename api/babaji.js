export default async function handler(req, res) {
    // 1. Add CORS headers to allow your frontend to connect
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 2. Handle the "Preflight" request Chrome sends before the actual POST
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 3. Keep your strict POST check
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'POST only' });
    }

    const { name, dob, tob, loc } = req.body;
    const today = new Date().toLocaleDateString();

    try {
        // 4. Connect to Groq using your llama-3.3-70b-versatile model
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
                        content: `You are Babaji, a blunt 72-year-old master astrology. 
                        Today is ${today}. The client is ${name}, born ${dob} at ${tob} in ${loc}.
                        
                        1. USE THE TIME: The birth time ${tob} determines the houses. 
                        2. DAILY TRANSITS: Compare their birth to today's stars so every reading is unique.
                        3. GESTURES: Use emojis (🤌, 🧐, ✋⏳) to describe your actions.
                        4. DREDGE THE SILT: Be raw about their character. Mention the 'creaminess' of their fate.
                        5. LANGUAGE: Support 130 languages. Respond in the user's language.`
                    },
                    { role: "user", content: "Dredge the silt for today's truth." }
                ]
            })
        });

        const data = await response.json();

        // 5. Check if the Groq API returned an error (like an invalid API key)
        if (!response.ok) {
            return res.status(response.status).json({ error: data.error?.message || "Groq connection failed." });
        }

        res.status(200).json({ reading: data.choices[0].message.content });
    } catch (e) {
        // 6. Generic error handling for failed fetches
        res.status(500).json({ error: "Stars are cloudy." });
    }
}
