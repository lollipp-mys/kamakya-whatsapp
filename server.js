// Internal team number
const INTERNAL_NUMBER = "918147958503"; // Replace with your internal number (with country code)

// Function to send WhatsApp template message
async function sendWhatsAppMessage(phone, name, orderNumber) {
  const url = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;
  
  const payload = {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name: "order_confirmation", // your template name
      language: { code: "en" },
      components: [
        {
          type: "header",
          parameters: [
            {
              type: "image",
              image: {
                link: "https://drive.google.com/uc?export=view&id=1WcIbfgOZS9yVhDyiZWpjArILmmRBF4vo" // or Shopify-hosted image
              }
            }
          ]
        },
        {
          type: "body",
          parameters: [
            { type: "text", text: name },
            { type: "text", text: orderNumber }
          ]
        }
      ]
    }
  };

  await axios.post(url, payload, {
    headers: {
      "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json"
    }
  });
}

// Send to customer
await sendWhatsAppMessage(customerPhone, customerName, orderNumber);

// Send to internal team (with a note)
await sendWhatsAppMessage(INTERNAL_NUMBER, customerName, orderNumber);
