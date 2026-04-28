export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    const { name, dob, tob, loc } = req.body;

    // DIAGNOSTIC: Check if the vault is actually open
    if (!process.env.GROQ_API_KEY) {
        return res.status(500).json({ reading: "Babaji says: The Vault is locked. (Missing API Key in Vercel)" });
    }

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama3-70b-8192", // Stable model name
                messages: [
                    {
                        role: "system",
                        content: "You are Babaji, a blunt 72-year-old mystical astrologer. You dredge the silt. Give a raw, unique reading. Mention their city. Mention the 'creaminess' of their fate."
                    },
                    {
                        role: "user",
                        content: `Name: ${name}, Born: ${dob} at ${tob} in ${loc}. Give me the dirt.`
                    }
                ]
            })
        });

        const data = await response.json();

        if (data.error) {
            return res.status(500).json({ reading: "Babaji's third eye has a speck of dust: " + data.error.message });
        }

        res.status(200).json({ reading: data.choices[0].message.content });

    } catch (error) {
        res.status(500).json({ reading: "The stars are cloudy: " + error.message });
    }
}
