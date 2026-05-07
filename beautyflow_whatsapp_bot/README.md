# BeautyFlow AI — WhatsApp Bot Real

Este proyecto conecta WhatsApp Business Cloud API con OpenAI para crear un asistente real para peluquerías y centros de estética.

## Qué hace

- Recibe mensajes de WhatsApp.
- Responde con IA.
- Atiende reservas, horarios, precios orientativos, servicios y dudas.
- Si no sabe algo, dice que avisará al dueño.
- Si el tema no tiene que ver con el centro, deriva al dueño.

## Archivos

- `server.js`: servidor del bot.
- `.env.example`: variables que debes configurar.
- `package.json`: dependencias.

## Pasos rápidos

### 1. Crear API key de OpenAI

Ve a OpenAI Platform y crea una API key.

Ponla en:

```env
OPENAI_API_KEY=tu_api_key
```

### 2. Crear app en Meta Developers

Necesitas WhatsApp Cloud API.

Meta te dará:

```env
WHATSAPP_TOKEN=token_de_meta
PHONE_NUMBER_ID=id_del_numero
```

### 3. Subir a Render

1. Crea cuenta en Render.
2. New Web Service.
3. Sube este proyecto o conéctalo desde GitHub.
4. Build command:

```bash
npm install
```

5. Start command:

```bash
npm start
```

6. Añade las variables de entorno del `.env.example`.

### 4. Configurar Webhook en Meta

Callback URL:

```txt
https://TU-URL-DE-RENDER.onrender.com/webhook
```

Verify token:

```txt
beautyflow_verificacion_12345
```

Debe coincidir con `VERIFY_TOKEN`.

### 5. Probar

Escribe al número de prueba de WhatsApp desde Meta.

Ejemplo:

```txt
Hola, quiero reservar una cita para uñas mañana
```

Respuesta esperada:

```txt
¡Claro! 😊 Para reservar necesito tu nombre, el servicio que quieres y si prefieres mañana o tarde.
```

## Importante

No compartas tus tokens públicamente.
No pongas tus claves en capturas.
No envíes aquí claves privadas completas.
