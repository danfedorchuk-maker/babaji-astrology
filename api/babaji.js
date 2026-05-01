export default async function handler(req, res) {
    console.log("--- BABAJI START ---");
    console.log("Received data:", req.body);

    const { name, dob, tob, loc } = req.body;

    try {
        console.log("Calling AstrologyAPI...");
        const astroResponse = await fetch("https://json.astrologyapi.com/v1/western_horoscope", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.ASTRO_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                day: parseInt(dob.split('-')[2]),
                month: parseInt(dob.split('-')[1]),
                year: parseInt(dob.split('-')[0]),
                hour: parseInt(tob.split(':')[0]),
                min: parseInt(tob.split(':')[1]),
                lat: 53.4084, 
                lon: -2.9916,
                tzone: 1.0 
            })
        });

        const astroData = await astroResponse.json();
        console.log("AstrologyAPI raw response:", JSON.stringify(astroData));

        if (astroData.error) {
            console.error("AstrologyAPI returned an error:", astroData.error);
        }

        // ... keep the rest of your Groq code here ...

    } catch (e) {
        console.error("CRASH DETECTED:", e.message);
        res.status(200).json({ reading: "The stars are obscured." });
    }
}
