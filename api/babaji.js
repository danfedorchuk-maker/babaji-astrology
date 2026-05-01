export default async function handler(req, res) {
    console.log("--- BABAJI START ---");

    try {
        const { dob, tob } = req.body;
        
        // 1. Correct parsing for your 10/09/1940 input
        const dateParts = dob.split('/'); 
        const day = parseInt(dateParts[0]);
        const month = parseInt(dateParts[1]);
        const year = parseInt(dateParts[2]);

        // 2. Combine your User ID and Key for the "Handshake"
        const authString = Buffer.from(`${process.env.ASTRO_USER_ID}:${process.env.ASTRO_API_KEY}`).toString('base64');

        // 3. The Astrology API Call
        const astroResponse = await fetch("https://json.astrologyapi.com/v1/western_horoscope", {
            method: "POST",
            headers: {
                "Authorization": `Basic ${authString}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                day, month, year,
                hour: parseInt(tob.split(':')[0]),
                min: parseInt(tob.split(':')[1]),
                lat: 53.4084, // Liverpool for Lennon
                lon: -2.9916,
                tzone: 1.0 
            })
        });

        const astroData = await astroResponse.json();

        // 4. Send data to Groq for the narrative
        const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [{ role: "system", content: "You are Babaji. Interpret: " + JSON.stringify(astroData) }]
            })
        });

        const aiData = await groqResponse.json();

        // 5. Final Output to your UI
        res.status(200).json({ 
            reading: aiData.choices[0].message.content, 
            planets: astroData.planets 
        });

    } catch (e) {
        console.error("PIPELINE CRASH:", e.message);
        res.status(200).json({ reading: "The stars are obscured by: " + e.message });
    }
}
