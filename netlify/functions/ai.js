export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "GEMINI_API_KEY haijawekwa kwenye Netlify." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    const message = (body.message || body.prompt || "").toString().trim();
    const mode = (body.mode || "chat").toString(); // "chat" | "listing"
    const history = Array.isArray(body.history) ? body.history.slice(-8) : [];

    if (!message) {
      return new Response(
        JSON.stringify({ error: "Tafadhali andika ujumbe au maelezo ya bidhaa." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const systemInstruction =
      mode === "listing"
        ? `Wewe ni msaidizi wa matangazo wa jukwaa la SokoUsed TZ & Global (soko la kununua na kuuza bidhaa zilizotumika ndani ya Tanzania na kimataifa).
           Mtumiaji atakupa jina, hali, au maelezo mafupi ya bidhaa used.
           Andika maelezo ya tangazo yenye mvuto, ukweli, na mpangilio mzuri kwa Kiswahili fasaha (au lugha ya mtumiaji), ikijumuisha:
           1. Muhtasari wa hali ya bidhaa (used / imetumika vizuri).
           2. Sifa kuu na faida kwa mnunuzi.
           3. Makadirio ya bei rafiki (TZS kwa soko la Tanzania au USD kwa soko la kimataifa) na ushauri mfupi wa mazungumzo/usalama.`
        : `Wewe ni msaidizi mahiri wa AI wa jukwaa la SokoUsed TZ & Global — soko la kununua na kuuza bidhaa zilizotumika ndani ya Tanzania na nje ya Tanzania.
           Jibu kwa uwazi, heshima, na vitendo (kwa Kiswahili au lugha ya mtumiaji):
           - Saidia wanunuzi na wauzaji kukadiria bei ya bidhaa used (kwa TZS au USD).
           - Saidia kuandika au kuboresha matangazo ya bidhaa.
           - Toa ushauri wa usalama wakati wa kununua/kuuza bidhaa zilizotumika, kukutana sehemu salama, na kupanga usafirishaji ndani ya Tanzania au nje ya nchi.`;

    const contents = [
      ...history
        .filter((item) => item && typeof item.text === "string" && item.text.trim())
        .map((item) => ({
          role: item.role === "model" || item.role === "assistant" ? "model" : "user",
          parts: [{ text: item.text }],
        })),
      {
        role: "user",
        parts: [{ text: message }],
      },
    ];

    const geminiUrl =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemInstruction }],
        },
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 800,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error: data?.error?.message || "Hitilafu kutoka Gemini API.",
        }),
        {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const reply =
      data?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("")
        .trim() || "Sikupata jibu kwa sasa, tafadhali jaribu tena.";

    return new Response(
      JSON.stringify({ reply }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "Imeshindikana kuwasiliana na huduma ya AI.",
        details: err.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
