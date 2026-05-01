export default async function handler(req, res) {
    console.log("--- BABAJI ACTIVATED ---");
    console.log("Payload Received:", JSON.stringify(req.body));

    try {
        const { dob, tob } = req.body;

        // 1. UNIVERSAL DATE PARSING
        // This handles your '10/09/1940' input by splitting on slashes or dashes
        const dateParts = dob.includes('/') ? dob.split('/') : dob.split('-');
        const day = parseInt(dateParts[0]);
        const month = parseInt(dateParts[1]);
        const year = parseInt(dateParts[2]);

        // 2. TIME PARSING
        const hour = parseInt(tob.split(':')[0]);
        const min = parseInt(tob.split(':')[1]);

        // 3. ASTROLOGY API HANDSHAKE
        // AstrologyAPI requires Basic Auth: Base64(userId:apiKey)
        const authString = Buffer.from(`${process.env.ASTRO_USER_ID}:${process.env.ASTRO_API_KEY}`).toString('base64');

        console.log(`Dredging Hardware for: ${day}/${month}/${year} at ${hour}:${min}`);

        const astroResponse = await fetch("https://json.astrologyapi.com/v1/western_horoscope", {
            method: "POST",
            headers: {
                "Authorization": `Basic ${authString}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                day,
                month,
                year,
                hour,
                min,
                lat: 53.4084, // Hardcoded Liverpool for John Lennon test
                lon: -2.9916,
                tzone: 1.0    // BST offset for Oct 1940
            })
        });

        const astroData = await astroResponse.json();
        
        if (astroData.error || !astroData.planets) {
            console.error("Hardware Error:", astroData.error || "Malformed API response");
            throw new Error("AstrologyAPI failed to provide hardware data.");
        }

        console.log("Hardware Sync Success. Calling Groq...");

        // 4. GROQ AI NARRATIVE
        const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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
                        content: "You are Babaji, a vintage cosmologist. Use this raw astronomical data to provide a grounded, 'silt-dredging' psychological reading: " + JSON.stringify(astroData) 
                    }
                ],
                temperature: 0.7
            })
        });

        const aiData = await groqResponse.json();

        // 5. THE FINAL DELIVERY
        res.status(200).json({
            reading: aiData.choices[0].message.content,
            planets: astroData.planets // Populates your Hardware tab
        });

    } catch (error) {
        console.error("PIPELINE CRASH:", error.message);
        res.status(200).json({ 
            reading: "The stars are obscured by a technical ghost. Check your Vercel logs for: " + error.message 
        });
    }
}
