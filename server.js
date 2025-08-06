import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";

const app = express();
app.use(bodyParser.json());

// WhatsApp Cloud API Config
const token = "EAAKXNtx5mlABPLy1FvYmUiDNlnh6wRGuSeiKHxj3RHDmuap5G2lTBVoHFFbpwMzOl8aTXAm6a2UdBu5BD86h8H0phTf2Pq9ra8ZCkDmt0fp0JAh3ABKi3mIvKJZBT6SNErwacNKGKlF2AkIaMkvEvg45Ayx4ZBQnFQTgIGR0PH7NJZCMS5z9FCd2wq2JhgZDZD"; // Your permanent token
const phone_number_id = "759432643911310"; // Your WhatsApp Phone Number ID
const headerImageUrl = "https://drive.google.com/uc?export=view&id=1WcIbfgOZS9yVhDyiZWpjArILmmRBF4vo"; // Image for header

// ✅ Webhook verification for Meta
app.get("/webhook", (req, res) => {
    const VERIFY_TOKEN = "kamakya_verify_token"; // Any token you want
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode && token) {
        if (mode === "subscribe" && token === VERIFY_TOKEN) {
            console.log("WEBHOOK_VERIFIED");
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
});

// ✅ Endpoint to receive Shopify Webhook
app.post("/webhook", async (req, res) => {
    try {
        const order = req.body;

        // Extract customer details
        const customerName = order.customer?.first_name || "Customer";
        const orderNumber = order.name || "Order";
        let phone = order.shipping_address?.phone || order.billing_address?.phone;

        if (!phone) {
            console.log("❌ No phone number found in order");
            return res.sendStatus(200);
        }

        // Format phone number
        phone = phone.replace(/\s+/g, "");
        if (!phone.startsWith("91")) {
            phone = "91" + phone; // India country code
        }

        console.log(`📦 New order from ${customerName}, sending WhatsApp to ${phone}`);

        // ✅ Send WhatsApp template message
        const response = await fetch(`https://graph.facebook.com/v21.0/${phone_number_id}/messages`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
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
                                        link: headerImageUrl // ✅ Image in header
                                    }
                                }
                            ]
                        },
                        {
                            type: "body",
                            parameters: [
                                { type: "text", text: customerName }, // {{1}} = Name
                                { type: "text", text: orderNumber }    // {{2}} = Order Number
                            ]
                        }
                    ]
                }
            })
        });

        const data = await response.json();
        console.log("📤 WhatsApp API Response:", data);

        res.sendStatus(200);
    } catch (error) {
        console.error("❌ Error sending WhatsApp message:", error);
        res.sendStatus(500);
    }
});

// ✅ Start the server
app.listen(10000, () => console.log("🚀 Server running on port 10000"));
