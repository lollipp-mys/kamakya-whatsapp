import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";

const app = express();
app.use(bodyParser.json());

// ✅ WhatsApp Cloud API Config
const token = "EAAKXNtx5mlABPLy1FvYmUiDNlnh6wRGuSeiKHxj3RHDmuap5G2lTBVoHFFbpwMzOl8aTXAm6a2UdBu5BD86h8H0phTf2Pq9ra8ZCkDmt0fp0JAh3ABKi3mIvKJZBT6SNErwacNKGKlF2AkIaMkvEvg45Ayx4ZBQnFQTgIGR0PH7NJZCMS5z9FCd2wq2JhgZDZD"; // Your permanent token
const phone_number_id = "759432643911310"; // WhatsApp Phone Number ID
const template_name = "order_confirmation"; // Your approved template name
const language = "en"; // Language code

// ✅ Public image URL for header (IMPORTANT: Google Drive Direct Link Format)
const image_url = "https://drive.google.com/uc?id=1WcIbfgOZS9yVhDyiZWpjArILmmRBF4vo";


// ✅ Shopify Webhook Endpoint
app.post("/webhook", async (req, res) => {
    try {
        const order = req.body;

        // Extract customer details
        const customerName = order.customer?.first_name || "Customer";
        const orderNumber = order.name; // e.g., "#1057"
        let phone = order.shipping_address?.phone || order.billing_address?.phone;

        if (!phone) {
            console.log("❌ No phone number found in the order");
            return res.sendStatus(200);
        }

        // ✅ Format phone number (remove spaces and add country code if missing)
        phone = phone.replace(/\s+/g, "");
        if (!phone.startsWith("91")) {
            phone = "91" + phone;
        }

        console.log(`📦 New order from ${customerName}, sending WhatsApp to ${phone}`);

        // ✅ Send message via WhatsApp Cloud API using TEMPLATE
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
                    name: template_name,
                    language: { code: language },
                    components: [
                        {
                            type: "header",
                            parameters: [
                                { type: "image", image: { link: image_url } }
                            ]
                        },
                        {
                            type: "body",
                            parameters: [
                                { type: "text", text: customerName },
                                { type: "text", text: orderNumber }
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
        console.error("❌ Error:", error);
        res.sendStatus(500);
    }
});

// ✅ Start the server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
