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
    allowedHeaders: ["Content-Type", "Accept"],
  })
);

const PORT = process.env.PORT || 10000;

// ✅ WhatsApp Cloud API Credentials
const WHATSAPP_TOKEN =
  "EAAKXNtx5mlABPLy1FvYmUiDNlnh6wRGuSeiKHxj3RHDmuap5G2lTBVoHFFbpwMzOl8aTXAm6a2UdBu5BD86h8H0phTf2Pq9ra8ZCkDmt0fp0JAh3ABKi3mIvKJZBT6SNErwacNKGKlF2AkIaMkvEvg45Ayx4ZBQnFQTgIGR0PH7NJZCMS5z9FCd2wq2JhgZDZD";
const PHONE_NUMBER_ID = "759432643911310";
const INTERNAL_NUMBER = "918277665707";

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

  // ✅ Order Confirmation
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

  // ✅ Return Request
  } else if (templateName === TEMPLATE_RETURN_REQUEST) {
    payload.template.components = [
      {
        type: "body",
        parameters: [
          { type: "text", text: name || "Customer" },
          { type: "text", text: orderNumber || "N/A" },
          { type: "text", text: reasonForReturn || "N/A" }, // Reason fix
        ],
      },
    ];

  // ✅ Order Ready Notification
  } else if (templateName === TEMPLATE_ORDER_READY) {
    payload.template.components = [
      {
        type: "header",
        parameters: [
          {
            type: "image",
            image: { link: "https://drive.google.com/uc?export=view&id=1WcIbfgOZS9yVhDyiZWpjArILmmRBF4vo" },
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
      TEMPLATE_RETURN_REQUEST,
      false, // includeImage (not needed here)
      reasonForReturn || "N/A"
    );

    return res.status(200).send("✅ Return request WhatsApp sent");
  } catch (err) {
    console.error("❌ Return request error:", err.message);
    return res.status(500).send("Return request send failed");
  }
});

// 📦 Add at top with other imports
import multer from "multer";
import nodemailer from "nodemailer";

// Multer storage (store in memory for email attach)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// 📩 Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER, // Your email
    pass: process.env.GMAIL_PASS, // Use App Password, not your Gmail password
  },
});

// ✅ New Endpoint for return form with file
app.post("/return-request-with-file", upload.single("Return_File"), async (req, res) => {
  try {
    const { Name, Email, Order_Number, WhatsApp_Number, Reason } = req.body;
    const file = req.file;

    if (!WhatsApp_Number || !Order_Number) {
      return res.status(400).send("❌ Missing phone or order number");
    }

    let formattedPhone = WhatsApp_Number.replace(/\D/g, "");
    if (!formattedPhone.startsWith("91")) {
      formattedPhone = "91" + formattedPhone;
    }

    console.log(`📩 Return request with file from ${Name}, order ${Order_Number}, reason: ${Reason}`);

    // ✅ Send WhatsApp as before
    await sendWhatsAppMessage(
      formattedPhone,
      Name || "Customer",
      Order_Number,
      TEMPLATE_RETURN_REQUEST,
      false,
      Reason || "N/A"
    );

    // ✅ Send email to store with attachment
    const mailOptions = {
      from: `"Kamakya Returns" <kamakyamysore@gmail.com>`,
      to: "kamakyamysore@gmail.com", // Store email
      subject: `New Return Request - ${Order_Number}`,
      html: `
        <h3>Return Request Details</h3>
        <p><b>Name:</b> ${Name}</p>
        <p><b>Email:</b> ${Email}</p>
        <p><b>Order Number:</b> ${Order_Number}</p>
        <p><b>WhatsApp Number:</b> ${WhatsApp_Number}</p>
        <p><b>Reason:</b> ${Reason}</p>
      `,
      attachments: file ? [{
        filename: file.originalname,
        content: file.buffer
      }] : []
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({ success: true, message: "✅ Return request processed" });


  } catch (err) {
    console.error("❌ return-request-with-file error:", err.message);
    return res.status(500).send("Return request with file failed");
  }
});


// ✅ Start Server
app.listen(PORT, () =>
  console.log(`✅ Server running on port ${PORT}`)
);
