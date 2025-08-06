import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;

const WHATSAPP_TOKEN = "EAAKXNtx5mlABPLy1FvYmUiDNlnh6wRGuSeiKHxj3RHDmuap5G2lTBVoHFFbpwMzOl8aTXAm6a2UdBu5BD86h8H0phTf2Pq9ra8ZCkDmt0fp0JAh3ABKi3mIvKJZBT6SNErwacNKGKlF2AkIaMkvEvg45Ayx4ZBQnFQTgIGR0PH7NJZCMS5z9FCd2wq2JhgZDZD";
const PHONE_NUMBER_ID = "759432643911310"; // Your WA business ID
const INTERNAL_NUMBER = "918147958503"; // Internal team number with country code

// ✅ Function to send WhatsApp message
async function sendWhatsAppMessage(phone, name, orderNumber) {
  if (!phone) return console.log("❌ No phone number provided, skipping send");

  const url = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name: "order_confirmation", // Your approved template name
      language: { code: "en" },
      components: [
        {
          type: "header",
          parameters: [
            {
              type: "image",
              image: {
                link: "https://drive.google.com/uc?export=view&id=1WcIbfgOZS9yVhDyiZWpjArILmmRBF4vo"
              }
            }
          ]
        },
        {
          type: "body",
          parameters: [
            { type: "text", text: name || "Customer" },
            { type: "text", text: orderNumber ? `#${orderNumber}` : "N/A" }
          ]
        }
      ]
    }
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json"
      }
    });
    console.log(`✅ WhatsApp sent to ${phone}:`, response.data);
  } catch (error) {
    console.error(`❌ WhatsApp send error for ${phone}:`, error.response?.data || error.message);
  }
}

// ✅ Shopify Webhook Listener
app.post("/webhook", async (req, res) => {
  try {
    // Shopify sends many events, let's filter:
    const eventType = req.header("X-Shopify-Topic");
    if (eventType !== "orders/create") {
      console.log(`ℹ️ Ignored event: ${eventType}`);
      return res.status(200).send("Ignored non-create event");
    }

    const order = req.body;
    const customerName = order.customer?.first_name || "Customer";
    const orderNumber = order.name?.replace("#", "") || null;
    const customerPhone = order.customer?.phone ? order.customer.phone.replace(/\D/g, "") : null;

    console.log(`📦 New order from ${customerName}, phone: ${customerPhone || "Not provided"}, order: ${orderNumber || "Unknown"}`);

    // ✅ Send to customer if phone exists
    if (customerPhone && orderNumber) {
      await sendWhatsAppMessage(customerPhone, customerName, orderNumber);
    } else {
      console.error("❌ No customer phone number found or order number missing!");
    }

    // ✅ Send to internal team only if valid details
    if (orderNumber && customerName !== "Customer") {
      await sendWhatsAppMessage(INTERNAL_NUMBER, customerName, orderNumber);
    }

    res.status(200).send("✅ Webhook processed");
  } catch (err) {
    console.error("❌ Webhook error:", err.message);
    res.status(500).send("Webhook processing failed");
  }
});

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
