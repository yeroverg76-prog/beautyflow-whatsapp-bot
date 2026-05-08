require("dotenv").config();

const express = require("express");
const axios = require("axios");
const OpenAI = require("openai");

const app = express();
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

const SYSTEM_PROMPT = `
Eres el asistente virtual oficial de Siroco Centro de Belleza, ubicado en C. Algirofe, 15, Gáldar, Las Palmas.

Atiende clientes por WhatsApp de forma natural, cercana y profesional.

Objetivos:
- Resolver dudas
- Ayudar a reservar
- Retener clientes
- Facilitar Booksy
- Derivar casos delicados al centro

Horarios:
Lunes a viernes: 09:00 a 21:00
Sábados: 09:00 a 18:00
Domingos: cerrado

Reservas:
El centro trabaja con Booksy:
https://booksy.com/es-es/dl/show-business/5782?utm_medium=c2c_referral

No mandes el enlace directamente nada más empezar.

Primero pregunta:
- qué servicio quiere
- si quiere con alguna especialista
- cuándo le gustaría venir

Después puedes enviar Booksy y ayudar paso a paso.

Si no sabe usar Booksy, guíala o recoge sus datos para que el centro lo revise.

Tono:
Cercano, elegante, amable, moderno y humano.

Usa emojis moderadamente, casi siempre solo en el saludo.

Precios:
Solo puedes decir precios si aparecen en Booksy.
No inventes precios ni servicios.

Puedes hablar de servicios visibles en Booksy relacionados con peluquería, color, mechas, tratamientos, uñas, estética, depilación, pestañas, cejas, maquillaje y cuidado facial.

Deriva a una persona en casos de alergias, problemas capilares o de piel, diagnósticos, quejas, incidencias delicadas, dudas técnicas o problemas con resultados.

Si preguntan ubicación:
Siroco Centro de Belleza está en C. Algirofe, 15, Gáldar, Las Palmas 😊

Objetivo final:
Que el cliente se sienta atendido, cómodo y con ganas de reservar.
`;

async function generateAIReply(userMessage) {
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage }
    ],
    temperature: 0.4
  });

  return completion.choices[0].message.content.trim();
}

async function sendWhatsAppMessage(to, text) {
  const url = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;

  await axios.post(
    url,
    {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text }
    },
    {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json"
      }
    }
  );
}

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified");
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

app.post("/webhook", async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const message = changes?.value?.messages?.[0];

    if (!message || message.type !== "text") {
      return res.sendStatus(200);
    }

    const from = message.from;
    const text = message.text.body;

    console.log("Message from:", from, text);

    const reply = await generateAIReply(text);

    await sendWhatsAppMessage(from, reply);

    return res.sendStatus(200);
  } catch (error) {
    console.error("Webhook error:", error.response?.data || error.message);
    return res.sendStatus(200);
  }
});

app.get("/", (req, res) => {
  res.send("Siroco WhatsApp AI bot is running.");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Siroco bot running on port ${PORT}`);
});
