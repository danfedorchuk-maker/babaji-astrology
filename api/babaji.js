export default async function handler(req, res) {
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
        res.status(200).json({ reading: data.choices[0].message.content });
    } catch (e) {
        res.status(500).json({ error: "Stars are cloudy." });
    }
}
