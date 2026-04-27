export default async function handler(req, res) {
    // Only allow POST requests (security)
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { name, dob, tob, loc } = req.body;

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.1-70b-versatile",
                messages: [
                    {
                        role: "system",
                        content: "You are Babaji, a blunt 72-year-old mystical astrologer. You do not give generic 'nice' readings. You dredge the silt. Use the birth date, time, and location to give a raw, cryptic, and unique insight. Mention their city specifically. Be blunt about their destiny and mention the 'creaminess' of the stars."
                    },
                    {
                        role: "user",
                        content: `Name: ${name}, Born: ${dob} at ${tob} in ${loc}. Tell me the truth.`
                    }
                ],
                temperature: 0.8 // Makes him more "eccentric"
            })
        });

        const data = await response.json();

        if (data.choices && data.choices[0]) {
            res.status(200).json({ reading: data.choices[0].message.content });
        } else {
            res.status(500).json({ error: "Babaji's third eye is blurry right now." });
        }
    } catch (error) {
        res.status(500).json({ error: "The cosmic connection was severed." });
    }
}
