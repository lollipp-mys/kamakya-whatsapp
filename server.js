import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";

const app = express();
app.use(bodyParser.json());

// WhatsApp Cloud API Config
const token = "EAAKXNtx5mlABPLy1FvYmUiDNlnh6wRGuSeiKHxj3RHDmuap5G2lTBVoHFFbpwMzOl8aTXAm6a2UdBu5BD86h8H0phTf2Pq9ra8ZCkDmt0fp0JAh3ABKi3mIvKJZBT6SNErwacNKGKlF2AkIaMkvEvg45Ayx4ZBQnFQTgIGR0PH7NJZCMS5z9FCd2wq2JhgZDZD";
const phone_number_id = "759432643911310";
const VERIFY_TOKEN = "kamakya123";

// ✅ Meta Webhook Verification (GET)
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

// ✅ Shopify Order Webhook Handler (POST)
app.post("/webhook", async (req, res) => {
    try {
        const order = req.body;

        const customerName = order.customer?.first_name || "Customer";

        // Try multiple fields to find a phone number
        let phone =
            order.shipping_address?.phone ||
            order.billing_address?.phone ||
            order.customer?.phone ||
            null;

        if (!phone) {
            console.log("❌ No phone number found in order:", order.id || "Unknown");
            console.log("Full order dump:", JSON.stringify(order, null, 2)); // helpful for debugging
            return res.sendStatus(200); // Don't trigger Shopify retries
        }

        // Sanitize and add country code
        phone = phone.replace(/\D/g, ""); // Remove non-digit characters
        if (!phone.startsWith("91")) {
            phone = "91" + phone;
        }

        console.log(`📦 New order from ${customerName}, sending WhatsApp to ${phone}`);

        const message = `Hello ${customerName}, thank you for shopping with Kamakya! Your order ${order.name || "#"} has been received and is being processed.`;

        const response = await fetch(`https://graph.facebook.com/v18.0/${phone_number_id}/messages`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to: phone,
                type: "text",
                text: { body: message }
            })
        });

        const data = await response.json();
        console.log("✅ WhatsApp API Response:", data);

        res.sendStatus(200);
    } catch (error) {
        console.error("❌ Error handling webhook:", error);
        res.sendStatus(500);
    }
});

// ✅ Start server
app.listen(10000, () => console.log("🚀 Server running on port 10000"));
