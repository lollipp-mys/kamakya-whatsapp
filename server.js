import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";

const app = express();
app.use(bodyParser.json());

// WhatsApp Cloud API Config
const token = "EAAKXNtx5mlABPLy1FvYmUiDNlnh6wRGuSeiKHxj3RHDmuap5G2lTBVoHFFbpwMzOl8aTXAm6a2UdBu5BD86h8H0phTf2Pq9ra8ZCkDmt0fp0JAh3ABKi3mIvKJZBT6SNErwacNKGKlF2AkIaMkvEvg45Ayx4ZBQnFQTgIGR0PH7NJZCMS5z9FCd2wq2JhgZDZD"; // Replace with your permanent token
const phone_number_id = "759432643911310"; // Your Phone Number ID

// Endpoint to receive Shopify Webhook
app.post("/webhook", async (req, res) => {
    try {
        const order = req.body;

        // Get customer name and phone
        const customerName = order.customer?.first_name || "Customer";
        let phone = order.shipping_address?.phone || order.billing_address?.phone;
        if (!phone) {
            console.log("No phone number found in order");
            return res.sendStatus(200);
        }

        // Clean up phone number and add country code
        phone = phone.replace(/\s+/g, "");
        if (!phone.startsWith("91")) {
            phone = "91" + phone;
        }

        // Message text
        const message = `Hello ${customerName}, thank you for shopping with Kamakya! Your order #${order.name} has been received and is being processed.`;

        // Send message via WhatsApp Cloud API
        const response = await fetch(`https://graph.facebook.com/v21.0/${phone_number_id}/messages`, {
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
        console.log("WhatsApp API Response:", data);

        res.sendStatus(200);
    } catch (error) {
        console.error("Error:", error);
        res.sendStatus(500);
    }
});

// Start the server
app.listen(10000, () => console.log("Server running on port 10000"));
