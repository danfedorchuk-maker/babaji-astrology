export default async function handler(req, res) {
    console.log("--- BABAJI START ---");

    try {
        const { dob, tob } = req.body;
        
        // FIX: This now correctly handles your 10/09/1940 input
        const dateParts = dob.split('/'); 
        const day = parseInt(dateParts[0]);
        const month = parseInt(dateParts[1]);
        const year = parseInt(dateParts[2]);

        // Authorization setup using your new ASTRO_USER_ID
        const authString = Buffer.from(`${process.env.ASTRO_USER_ID}:${process.env.ASTRO_API_KEY}`).toString('base64');

        const astroResponse = await fetch("https://json.astrologyapi.com/v1/western_horoscope", {
            method: "POST",
            headers: {
                "Authorization": `Basic ${authString}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                day: day,
                month: month,
                year: year,
                hour: parseInt(tob.split(':')[0]),
                min: parseInt(tob.split(':')[1]),
                lat: 53.4084, 
                lon: -2.9916,
                tzone: 1.0 
            })
        });

        const astroData = await astroResponse.json();

        // Groq AI Integration
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
        res.status(200).json({ 
            reading: aiData.choices[0].message.content, 
            planets: astroData.planets 
        });

    } catch (e) {
        console.error("CRASH:", e.message);
        res.status(200).json({ reading: "SYSTEM ERROR: " + e.message });
    }
}
