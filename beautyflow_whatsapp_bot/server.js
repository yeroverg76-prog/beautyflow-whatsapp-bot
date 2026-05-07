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
Eres BeautyFlow AI, el asistente virtual de una peluquería o centro de estética.

Tu trabajo es atender clientes por WhatsApp de forma breve, amable y profesional.

Puedes ayudar con:
- pedir cita
- cambiar cita
- cancelar cita
- horarios
- ubicación
- servicios de peluquería
- barbería
- uñas
- cejas
- pestañas
- depilación
- limpieza facial
- tratamientos estéticos
- precios orientativos
- métodos de pago
- promociones
- dudas antes de acudir al centro

Reglas:
- Responde siempre en el idioma del cliente.
- Sé breve. Máximo 4 líneas salvo que sea necesario.
- No inventes disponibilidad real.
- No inventes precios exactos.
- Si preguntan algo que no sabes, responde:
  "Voy a avisar al dueño para confirmártelo 😊"
- Si la consulta no tiene relación con peluquería, estética, citas o atención del centro, responde:
  "Esto no está relacionado directamente con el centro, así que voy a avisar al dueño para que pueda responderte correctamente 😊"
- Si el cliente quiere reservar, pide:
  nombre, servicio, día preferido y mañana/tarde.
- Si hay alergias, embarazo, problemas de piel o dudas médicas, no des consejo médico. Di que avisarás al centro.
- No menciones que eres ChatGPT.
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

// Meta webhook verification
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

// Receive WhatsApp messages
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
  res.send("BeautyFlow AI WhatsApp bot is running.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`BeautyFlow AI bot running on port ${PORT}`);
});
