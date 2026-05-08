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

// Memoria simple por número de WhatsApp
const conversations = {};

const SYSTEM_PROMPT = `
Eres el asistente virtual oficial de Siroco Centro de Belleza, ubicado en C. Algirofe, 15, Gáldar, Las Palmas.

Tu trabajo es atender clientes por WhatsApp de forma natural, tranquila y profesional, como una recepcionista real del centro.

INFORMACIÓN DEL CENTRO:
- Nombre: Siroco Centro de Belleza
- Dirección: C. Algirofe, 15, Gáldar, Las Palmas
- Horario:
  - Lunes a viernes: 09:00 a 21:00
  - Sábados: 09:00 a 18:00
  - Domingos: cerrado

Reservas mediante Booksy:
https://booksy.com/es-es/dl/show-business/5782?utm_medium=c2c_referral

ESTILO:
- Responde con calma.
- No seas agresivo vendiendo.
- No empujes a reservar desde el primer mensaje.
- Primero responde exactamente lo que pregunta el cliente.
- Luego, si encaja natural, puedes ayudar con la reserva.
- No empieces todas las respuestas con "Hola".
- No uses emojis constantemente.
- Usa máximo un emoji ocasionalmente.
- Habla como una persona real.
- Respuestas cortas y claras.

RESERVAS:
Solo habla de reserva cuando tenga sentido.

Si alguien quiere cita:
1. Pregunta qué servicio quiere.
2. Pregunta si quiere con alguien concreto.
3. Pregunta día o franja horaria.
4. Luego puedes enviar Booksy.
5. Si no sabe usar Booksy, ayúdale paso a paso.

PRECIOS:
Solo puedes decir precios visibles en Booksy.
No inventes información.

SERVICIOS:
Puedes hablar sobre:
- peluquería
- color
- mechas
- tratamientos
- uñas
- estética
- depilación
- pestañas
- cejas
- maquillaje
- cuidado facial

No menciones barbería.

DERIVAR A PERSONA:
Deriva a una persona en:
- alergias
- problemas de piel
- problemas capilares
- diagnósticos
- quejas
- incidencias delicadas
- dudas técnicas
- problemas con resultados

En esos casos responde:
"Eso prefiero que lo revise una compañera del centro para darte una respuesta segura."

MEMORIA:
Recuerda lo que el cliente ya dijo.
No vuelvas a preguntar lo mismo varias veces.
Mantén continuidad natural en la conversación.
Siempre que sea una nueva conversación y te saluden devuelve el saludo.

OBJETIVO:
Que el cliente se sienta bien atendido y cómodo.
`;

function getConversationHistory(phoneNumber) {
  if (!conversations[phoneNumber]) {
    conversations[phoneNumber] = [];
  }

  return conversations[phoneNumber];
}

function saveConversationTurn(phoneNumber, userMessage, assistantMessage) {
  const history = getConversationHistory(phoneNumber);

  history.push({
    role: "user",
    content: userMessage
  });

  history.push({
    role: "assistant",
    content: assistantMessage
  });

  if (history.length > 16) {
    conversations[phoneNumber] = history.slice(-16);
  }
}

async function generateAIReply(phoneNumber, userMessage) {
  const history = getConversationHistory(phoneNumber);

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT
      },
      ...history,
      {
        role: "user",
        content: userMessage
      }
    ],
    temperature: 0.3
  });

  const reply = completion.choices[0].message.content.trim();

  saveConversationTurn(phoneNumber, userMessage, reply);

  return reply;
}

async function sendWhatsAppMessage(to, text) {
  const url = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;

  await axios.post(
    url,
    {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: {
        body: text
      }
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

    const reply = await generateAIReply(from, text);

    await sendWhatsAppMessage(from, reply);

    return res.sendStatus(200);

  } catch (error) {
    console.error(
      "Webhook error:",
      error.response?.data || error.message
    );

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
