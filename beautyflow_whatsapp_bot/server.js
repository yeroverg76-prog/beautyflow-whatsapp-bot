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

// Memoria simple por número de WhatsApp.
const conversations = new Map();

function getConversation(userId) {
  if (!conversations.has(userId)) {
    conversations.set(userId, {
      messages: [],
      hasGreeted: false,
      lastService: null
    });
  }
  return conversations.get(userId);
}

function detectService(text) {
  const msg = text.toLowerCase();

  if (msg.includes("uña") || msg.includes("unas") || msg.includes("manicura") || msg.includes("pedicura") || msg.includes("semipermanente")) return "uñas";
  if (msg.includes("mecha") || msg.includes("balayage") || msg.includes("tinte") || msg.includes("color")) return "color/mechas";
  if (msg.includes("corte") || msg.includes("pelo") || msg.includes("peinado")) return "peluquería";
  if (msg.includes("ceja") || msg.includes("pestaña") || msg.includes("lifting")) return "cejas/pestañas";
  if (msg.includes("depil")) return "depilación";
  if (msg.includes("facial") || msg.includes("piel") || msg.includes("limpieza")) return "tratamiento facial";
  if (msg.includes("barba") || msg.includes("barber")) return "barbería";

  return null;
}

const SYSTEM_PROMPT = `
Eres BeautyFlow AI, el asistente virtual de una peluquería o centro de estética.

Tu trabajo es atender clientes por WhatsApp de forma breve, natural y profesional.

OBJETIVO PRINCIPAL:
Ayudar al cliente a resolver dudas y, cuando tenga sentido, llevarlo hacia una cita.

PUEDES AYUDAR CON:
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

REGLAS DE CONVERSACIÓN:
- Ten en cuenta TODO el contexto anterior de la conversación.
- No trates cada mensaje como si fuera nuevo.
- No saludes de nuevo si ya estabas hablando con el cliente.
- No repitas preguntas que el cliente ya ha respondido.
- Si el cliente responde con una palabra corta como "uñas", "mechas", "corte" o "facial", entiende que está contestando a la pregunta anterior y continúa sobre ese servicio.
- Si el cliente menciona un servicio concreto, sigue hablando de ese servicio hasta que cambie de tema.
- Si el cliente solo pide información sobre un servicio, explícale opciones y luego pregunta si quiere pedir cita.
- Si el cliente quiere reservar, pide solo los datos que falten: nombre, servicio, día preferido y mañana/tarde.
- No inventes disponibilidad real.
- No inventes precios exactos.
- Cuando hables de precios, usa expresiones como "precio orientativo", "desde..." o "depende del caso", y ofrece avisar al centro para confirmar.
- Si algo no está claro, pregunta una sola cosa concreta.

EMOJIS:
- Usa emoji SOLO en el primer mensaje de la conversación.
- Después no uses emojis salvo que sea estrictamente necesario.
- No abuses del tono comercial.

DERIVACIÓN AL DUEÑO:
- Si preguntan algo que no sabes, responde:
"Voy a avisar al dueño para confirmártelo."
- Si la consulta no tiene relación con peluquería, estética, citas o atención del centro, responde:
"Esto no está relacionado directamente con el centro, así que voy a avisar al dueño para que pueda responderte correctamente."

SEGURIDAD:
- Si hay alergias, embarazo, problemas de piel, irritaciones o dudas médicas, no des consejo médico. Di que avisarás al centro.
- No prometas resultados médicos ni estéticos garantizados.

ESTILO:
- Respuestas cortas.
- Máximo 4 líneas.
- Tono de recepcionista real.
- Profesional, cercano y sin sonar robótico.
- No digas que eres ChatGPT.
`;

async function generateAIReply(userId, userMessage) {
  const conversation = getConversation(userId);

  const service = detectService(userMessage);
  if (service) conversation.lastService = service;

  const contextNote = `
Estado de la conversación:
- ¿Ya se saludó al cliente?: ${conversation.hasGreeted ? "sí" : "no"}
- Servicio detectado o tema actual: ${conversation.lastService || "ninguno todavía"}
Recuerda: si ya se saludó, NO saludes otra vez. Usa emojis solo si todavía no se saludó.
`;

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: contextNote },
    ...conversation.messages,
    { role: "user", content: userMessage }
  ];

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages,
    temperature: 0.35
  });

  const reply = completion.choices[0].message.content.trim();

  conversation.hasGreeted = true;
  conversation.messages.push({ role: "user", content: userMessage });
  conversation.messages.push({ role: "assistant", content: reply });

  if (conversation.messages.length > 12) {
    conversation.messages = conversation.messages.slice(-12);
  }

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

    const reply = await generateAIReply(from, text);

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
