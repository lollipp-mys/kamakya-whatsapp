import express from "express";
import axios from "axios";
import cors from "cors";

const app = express();
app.use(express.json());

// ✅ Enable CORS for Shopify frontend only
app.use(
  cors({
    origin: "https://kamakyafashion.com",
    methods: ["POST"],
    allowedHeaders: ["Content-Type"],
  })
);

const PORT = process.env.PORT || 10000;

// ✅ WhatsApp Cloud API Credentials
const WHATSAPP_TOKEN =
  "EAAKXNtx5mlABPLy1FvYmUiDNlnh6wRGuSeiKHxj3RHDmuap5G2lTBVoHFFbpwMzOl8aTXAm6a2UdBu5BD86h8H0phTf2Pq9ra8ZCkDmt0fp0JAh3ABKi3mIvKJZBT6SNErwacNKGKlF2AkIaMkvEvg45Ayx4ZBQnFQTgIGR0PH7NJZCMS5z9FCd2wq2JhgZDZD";
const PHONE_NUMBER_ID = "759432643911310";
const INTERNAL_NUMBER = "919008055565";

// ✅ Template Names
const TEMPLATE_ORDER_CONFIRMATION = "order_confirmation";
const TEMPLATE_RETURN_REQUEST = "return_request";
const TEMPLATE_ORDER_READY = "order_ready_notification"; // ✅ Added this

// ✅ Google Drive direct image link (for order confirmation only)
const IMAGE_URL =
  "https://drive.google.com/uc?export=view&id=1WcIbfgOZS9yVhDyiZWpjArILmmRBF4vo";

const processedOrders = new Set();

// ✅ Function to send WhatsApp Template Message
async function sendWhatsAppMessage(phone, name, orderNumber, templateName, includeImage = false, reasonForReturn = "") {
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
      name: templateName,
      language: { code: "en" },
      components: [],
    },
  };

  // ✅ Add parameters based on template type
  if (templateName === TEMPLATE_ORDER_CONFIRMATION) {
    payload.template.components = [
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
          { type: "text", text: name || "Customer" },
          { type: "text", text: orderNumber || "N/A" },
        ],
      },
    ];
  } else if (templateName === TEMPLATE_RETURN_REQUEST) {
    payload.template.components = [
      {
        type: "body",
        parameters: [
          { type: "text", text: name || "Customer" },
          { type: "text", text: orderNumber || "N/A" },
 { type: "text", text: reasonForReturn || "N/A" },  // {{3}} Reason
        ],
      },
    ];
  }

  try {
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
    console.log(`✅ WhatsApp (${templateName}) sent to ${phone}:`, response.data);
  } catch (error) {
    console.error(
      `❌ WhatsApp send error for ${phone} (${templateName}):`,
      error.response?.data || error.message
    );
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
    const orderNumber =
      order.name?.replace("#", "") || `Order-${order.id}`;

    let customerPhone =
      order.customer?.phone ||
      order.shipping_address?.phone ||
      order.billing_address?.phone ||
      "";

    customerPhone = customerPhone.replace(/\D/g, "");
    if (customerPhone && !customerPhone.startsWith("91")) {
      customerPhone = "91" + customerPhone;
    }

    console.log(
      `📦 New order from ${customerName}, phone: ${
        customerPhone || "Not provided"
      }, order: ${orderNumber}`
    );

    res.status(200).send("✅ Webhook received");

    (async () => {
      if (customerPhone && orderNumber) {
        await sendWhatsAppMessage(
          customerPhone,
          customerName,
          orderNumber,
          TEMPLATE_ORDER_CONFIRMATION
        );
      } else {
        console.error(
          "❌ No customer phone number found or order number missing!"
        );
      }

      if (orderNumber && !processedOrders.has(orderNumber)) {
        processedOrders.add(orderNumber);
        await sendWhatsAppMessage(
          INTERNAL_NUMBER,
          customerName,
          orderNumber,
          TEMPLATE_ORDER_CONFIRMATION
        );
      }
    })();
  } catch (err) {
    console.error("❌ Webhook error:", err.message);
    res.status(500).send("Webhook processing failed");
  }
});

// ✅ Ready for Pickup Endpoint
app.post("/ready-for-pickup", async (req, res) => {
  const { phone, name, orderNumber } = req.body;

  if (!phone || !orderNumber) {
    return res.status(400).send("❌ Missing phone or order number");
  }

  let formattedPhone = phone.replace(/\D/g, "");
  if (!formattedPhone.startsWith("91")) {
    formattedPhone = "91" + formattedPhone;
  }

  console.log(
    `🚀 Marking order ready for pickup: ${orderNumber}, phone: ${formattedPhone}`
  );
  await sendWhatsAppMessage(
    formattedPhone,
    name || "Customer",
    orderNumber,
    TEMPLATE_ORDER_READY // ✅ Use correct template
  );

  return res.status(200).send("✅ Pickup notification sent");
});

// ✅ Return Request Form Submission Endpoint
app.post("/return-request", async (req, res) => {
  try {
    const { phone, name, orderNumber, reasonForReturn } = req.body;

    if (!phone || !orderNumber) {
      return res.status(400).send("❌ Missing phone or order number");
    }

    let formattedPhone = phone.replace(/\D/g, "");
    if (!formattedPhone.startsWith("91")) {
      formattedPhone = "91" + formattedPhone;
    }

    console.log(
      `↩️ Return request received for ${orderNumber}, phone: ${formattedPhone}, reason: ${reasonForReturn}`
    );

    await sendWhatsAppMessage(
      formattedPhone,
      name || "Customer",
      orderNumber,
      TEMPLATE_RETURN_REQUEST
      false, // includeImage (not needed here)
      reasonForReturn || "N/A"
    );

    return res.status(200).send("✅ Return request WhatsApp sent");
  } catch (err) {
    console.error("❌ Return request error:", err.message);
    return res.status(500).send("Return request send failed");
  }
});

// ✅ Start Server
app.listen(PORT, () =>
  console.log(`✅ Server running on port ${PORT}`)
);
