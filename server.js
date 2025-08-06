import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;

// ✅ WhatsApp API Credentials
const WHATSAPP_TOKEN =
  "EAAKXNtx5mlABPLy1FvYmUiDNlnh6wRGuSeiKHxj3RHDmuap5G2lTBVoHFFbpwMzOl8aTXAm6a2UdBu5BD86h8H0phTf2Pq9ra8ZCkDmt0fp0JAh3ABKi3mIvKJZBT6SNErwacNKGKlF2AkIaMkvEvg45Ayx4ZBQnFQTgIGR0PH7NJZCMS5z9FCd2wq2JhgZDZD";
const PHONE_NUMBER_ID = "759432643911310"; // Your WA phone number ID
const INTERNAL_NUMBER = "918147958503"; // Internal team number

// ✅ WhatsApp Template Details
const TEMPLATE_NAME = "order_confirmation"; // Approved template name
const IMAGE_URL =
  "https://drive.google.com/uc?export=view&id=1WcIbfgOZS9yVhDyiZWpjArILmmRBF4vo"; // Direct image link

// ✅ Function to send WhatsApp template message
async function sendWhatsAppMessage(phone, name, orderNumber) {
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
              image: { link: IMAGE_URL },
            },
          ],
        },
        {
          type: "body",
          parameters: [
            { type: "text", text: name },
            { type: "text", text: orderNumber },
          ],
        },
      ],
    },
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
    console.log(`✅ WhatsApp sent to ${phone}:`, response.data);
  } catch (error) {
    console.error(
      `❌ WhatsApp send error for ${phone}:`,
      error.response?.data || error.message
    );
  }
}

// ✅ Shopify Webhook Listener
app.post("/webhook", (req, res) => {
  try {
    const order = req.body;

    const customerName = order.customer?.first_name || "Customer";

    // ✅ Ensure order number is valid
    const orderNumber = order.name
      ? order.name.replace("#", "")
      : order.id
      ? `Order-${order.id}`
      : "Unknown";

    // ✅ Extract phone number from multiple places
    let customerPhone =
      order.customer?.phone ||
      order.shipping_address?.phone ||
      order.billing_address?.phone;

    if (customerPhone) {
      // Remove non-numeric characters
      customerPhone = customerPhone.replace(/\D/g, "");
      // ✅ Add country code if missing
      if (!customerPhone.startsWith("91")) {
        customerPhone = "91" + customerPhone;
      }
    }

    console.log(
      `📦 New order from ${customerName}, phone: ${
        customerPhone || "Not provided"
      }, order: ${orderNumber}`
    );

    // ✅ Respond immediately to Shopify to avoid retries
    res.status(200).send("✅ Webhook received");

    // ✅ Process WhatsApp notifications in background
    (async () => {
      if (customerPhone) {
        await sendWhatsAppMessage(customerPhone, customerName, orderNumber);
      } else {
        console.error("❌ No customer phone number found!");
      }

      // ✅ Always send internal notification
      await sendWhatsAppMessage(INTERNAL_NUMBER, customerName, orderNumber);
    })();
  } catch (err) {
    console.error("❌ Webhook error:", err.message);
    res.status(500).send("Webhook processing failed");
  }
});

// ✅ Start the server
app.listen(PORT, () =>
  console.log(`✅ Server running on port ${PORT}`)
);
