import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";

const app = express();
app.use(bodyParser.json());

// WhatsApp Cloud API Configuration
const token = "EAAKXNtx5mlABPLy1FvYmUiDNlnh6wRGuSeiKHxj3RHDmuap5G2lTBVoHFFbpwMzOl8aTXAm6a2UdBu5BD86h8H0phTf2Pq9ra8ZCkDmt0fp0JAh3ABKi3mIvKJZBT6SNErwacNKGKlF2AkIaMkvEvg45Ayx4ZBQnFQTgIGR0PH7NJZCMS5z9FCd2wq2JhgZDZD";
const phone_number_id = "759432643911310";
const VERIFY_TOKEN = "kamakya123";
const internalPhoneNumber = "918147958503"; // Internal team number

// ✅ Webhook Verification
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token && mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Meta Webhook Verified!");
    return res.status(200).send(challenge);
  } else {
    return res.sendStatus(403);
  }
});

// ✅ Order Handler
app.post("/webhook", async (req, res) => {
  try {
    const order = req.body;

    const customerName = order.customer?.first_name || "Customer";
    const orderId = order.name || "#";

    // Try multiple fields to find a phone number
    let phone =
      order.shipping_address?.phone ||
      order.billing_address?.phone ||
      order.customer?.phone ||
      null;

    if (!phone) {
      console.log("❌ No phone number found in order:", order.id || "Unknown");
      console.log("Full order dump:", JSON.stringify(order, null, 2));
      return res.sendStatus(200); // prevent Shopify retries
    }

    // Sanitize and add country code
    phone = phone.replace(/\D/g, "");
    if (!phone.startsWith("91")) {
      phone = "91" + phone;
    }

    console.log(`📦 New order from ${customerName}, sending WhatsApp to ${phone}`);

    // Send template to customer and internal team
    const sendTemplate = async (targetPhone) => {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${phone_number_id}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: targetPhone,
            type: "template",
            template: {
              name: "order_confirmation",
              language: { code: "en" },
              components: [
                {
                  type: "body",
                  parameters: [
                    { type: "text", text: customerName },
                    { type: "text", text: orderId },
                  ],
                },
              ],
            },
          }),
        }
      );

      const data = await response.json();
      console.log(`📤 Message sent to ${targetPhone}:`, JSON.stringify(data, null, 2));
    };

    await sendTemplate(phone);                // Send to customer
    await sendTemplate(internalPhoneNumber);  // Send to internal team

    res.sendStatus(200);
  } catch (error) {
    console.error("❌ Error handling webhook:", error);
    res.sendStatus(500);
  }
});

// ✅ Start server
app.listen(10000, () => console.log("🚀 Server running on port 10000"));
