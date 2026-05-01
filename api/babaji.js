export default async function handler(req, res) {
    console.log("--- BABAJI UNIVERSAL START ---");

    try {
        const { dob, tob, loc } = req.body;
        
        // 1. DYNAMIC DATE PARSING: Handles 10/09/1940 or 05/22/1953
        const dateParts = dob.includes('/') ? dob.split('/') : dob.split('-');
        
        // 2. SECURITY HANDSHAKE: Using the IDs you added to Vercel
        const authString = Buffer.from(`${process.env.ASTRO_USER_ID}:${process.env.ASTRO_API_KEY}`).toString('base64');

        // 3. THE REQUEST: Sending the specific user's data
        const astroResponse = await fetch("https://json.astrologyapi.com/v1/western_horoscope", {
            method: "POST",
            headers: {
                "Authorization": `Basic ${authString}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                day: parseInt(dateParts[1]),   // Month
                month: parseInt(dateParts[0]), // Day
                year: parseInt(dateParts[2]),
                hour: parseInt(tob.split(':')[0]),
                min: parseInt(tob.split(':')[1]),
                lat: 43.6532, // Note: For a fully dynamic city, you'll eventually need a Geocoding API
                lon: -79.3832,
                tzone: -4.0   
            })
        });

        const astroData = await astroResponse.json();

        // 4. ERROR HANDLING: If the API rejects the user's specific data
        if (!astroData.planets) {
            return res.status(200).json({ 
                reading: `HARDWARE ERROR: ${astroData.msg || "The vault rejected these coordinates or date."}` 
            });
        }

        // 5. NARRATIVE GENERATION: Groq interprets the unique chart
        const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [{ role: "system", content: "You are Babaji. Interpret this specific birth chart: " + JSON.stringify(astroData) }]
            })
        });

        const aiData = await groqResponse.json();
        
        res.status(200).json({ 
            reading: aiData.choices[0].message.content, 
            planets: astroData.planets 
        });

    } catch (e) {
        console.error("PIPELINE CRASH:", e.message);
        res.status(200).json({ reading: "The stars are obscured by: " + e.message });
    }
}
