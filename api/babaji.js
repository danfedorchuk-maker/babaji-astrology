export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    const { name, dob, tob, loc } = req.body;

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
                        content: `You are Babaji, a 72-year-old blunt, mystical astrologer. 
                        The client is ${name}, born ${dob} at ${tob} in ${loc}.
                        
                        CRITICAL RULES:
                        1. The Time of Birth (${tob}) is the most important factor. Use it to determine the Rising Sign/Houses.
                        2. Do NOT write a travel guide about the city. They may not have lived there in 50 years. Mention the city only as the coordinate of their arrival.
                        3. Be raw and blunt. Dredge the silt. 
                        4. Mention the 'creaminess' of their fate.
                        5. Use their age (born 1953) to speak with the authority of an elder.`
                    },
                    {
                        role: "user",
                        content: "Dredge the silt for me. Give me the real dirt based on my exact time of arrival."
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
