import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;

// ✅ WhatsApp Cloud API Credentials
const WHATSAPP_TOKEN = "EAAKXNtx5mlABPLy1FvYmUiDNlnh6wRGuSeiKHxj3RHDmuap5G2lTBVoHFFbpwMzOl8aTXAm6a2UdBu5BD86h8H0phTf2Pq9ra8ZCkDmt0fp0JAh3ABKi3mIvKJZBT6SNErwacNKGKlF2AkIaMkvEvg45Ayx4ZBQnFQTgIGR0PH7NJZCMS5z9FCd2wq2JhgZDZD";
const PHONE_NUMBER_ID = "759432643911310";
const INTERNAL_NUMBER = "919008055565";
const TEMPLATE_NAME = "order_ready_notification";

// ✅ Google Drive direct image link
const IMAGE_URL = "https://drive.google.com/uc?export=view&id=1WcIbfgOZS9yVhDyiZWpjArILmmRBF4vo";

const processedOrders = new Set();

// ✅ Function to send WhatsApp Template Message
async function sendWhatsAppMessage(phone, name, orderNumber) {
  if (!phone) {
    console.log("❌ No phone number provided, skipping send");
    return;
  }

  const url = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name: TEMPLATE_NAME,
      language: { code: "en" },
      components: [
        {
          type: "header",
          parameters: [
            {
              type: "image",
              image: {
                link: IMAGE_URL
              }
            }
          ]
        },
        {
          type: "body",
          parameters: [
            {
              type: "text",
              text: name || "Customer"
            },
            {
              type: "text",
              text: orderNumber || "N/A"
            }
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

// ✅ Shopify Webhook Listener (for order creation)
app.post("/webhook", (req, res) => {
  try {
    const eventType = req.header("X-Shopify-Topic");
    if (eventType !== "orders/create") {
      console.log(`ℹ️ Ignored event: ${eventType}`);
      return res.status(200).send("Ignored non-create event");
    }

    const order = req.body;
    const customerName = order.customer?.first_name || "Customer";
    const orderNumber = order.name?.replace("#", "") || `Order-${order.id}`;

    let customerPhone =
      order.customer?.phone ||
      order.shipping_address?.phone ||
      order.billing_address?.phone ||
      "";

    customerPhone = customerPhone.replace(/\D/g, "");
    if (customerPhone && !customerPhone.startsWith("91")) {
      customerPhone = "91" + customerPhone;
    }

    console.log(`📦 New order from ${customerName}, phone: ${customerPhone || "Not provided"}, order: ${orderNumber}`);

    res.status(200).send("✅ Webhook received");

    (async () => {
      if (customerPhone && orderNumber) {
        await sendWhatsAppMessage(customerPhone, customerName, orderNumber);
      } else {
        console.error("❌ No customer phone number found or order number missing!");
      }

      // Also send to internal number, but only once per order
      if (orderNumber && !processedOrders.has(orderNumber)) {
        processedOrders.add(orderNumber);
        await sendWhatsAppMessage(INTERNAL_NUMBER, customerName, orderNumber);
      }
    })();
  } catch (err) {
    console.error("❌ Webhook error:", err.message);
    res.status(500).send("Webhook processing failed");
  }
});

// ✅ NEW: Ready for Pickup Endpoint
app.post("/ready-for-pickup", async (req, res) => {
  const { phone, name, orderNumber } = req.body;

  if (!phone || !orderNumber) {
    return res.status(400).send("❌ Missing phone or order number");
  }

  let formattedPhone = phone.replace(/\D/g, "");
  if (!formattedPhone.startsWith("91")) {
    formattedPhone = "91" + formattedPhone;
  }

  console.log(`🚀 Marking order ready for pickup: ${orderNumber}, phone: ${formattedPhone}`);
  await sendWhatsAppMessage(formattedPhone, name || "Customer", orderNumber);

  return res.status(200).send("✅ Pickup notification sent");
});

// ✅ Start Server
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
