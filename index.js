const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const http2 = require("http2");

const app = express();

// Enable CORS for all origins (or restrict by providing an origin)
app.use(cors());
// Parse JSON bodies
app.use(bodyParser.json());

app.post("/send", (req, res) => {
  // Extract required parameters and optional customizations from the request body.
  const {
    jwtToken,
    deviceToken,
    bundleId,
    environment = "sandbox", // defaults to sandbox if not provided
    payload,                // complete payload if provided
    headers: customHeaders, // additional or overriding APNs headers
    title,                  // optional title if custom payload not provided
    body,                   // optional body if custom payload not provided
    sound                   // optional sound (defaults to "default")
  } = req.body;

  // Validate required fields
  if (!jwtToken || !deviceToken || !bundleId) {
    return res.status(400).json({
      error: "Missing required fields: jwtToken, deviceToken, and bundleId are required."
    });
  }

  // Determine APNs host based on the environment
  const apnsHost =
    environment === "production"
      ? "https://api.push.apple.com"
      : "https://api.sandbox.push.apple.com";

  // Set default payload if one isn't provided
  const notificationPayload = payload || {
    aps: {
      alert: {
        title: title || "Hello!",
        body: body || "This is a test notification"
      },
      sound: sound || "default"
    }
  };

  // Connect to APNs via HTTP/2
  const client = http2.connect(apnsHost);

  // Construct the request path using the device token
  const path = `/3/device/${deviceToken}`;

  // Merge default headers with any custom headers provided.
  const requestHeaders = {
    ":method": "POST",
    ":path": path,
    "authorization": `bearer ${jwtToken}`,
    "apns-topic": bundleId,
    "apns-push-type": (customHeaders && customHeaders["apns-push-type"]) || "alert",
    "content-type": "application/json",
    ...customHeaders // spread any additional custom headers provided in the request
  };

  // Create the HTTP/2 request
  const request = client.request(requestHeaders);

  let responseData = "";

  request.setEncoding("utf8");
  request.on("data", (chunk) => {
    responseData += chunk;
  });

  request.on("error", (error) => {
    console.error("APNs Error:", error);
    client.close();
    return res.status(500).json({ error: "Failed to send notification", details: error.message });
  });

  request.on("response", (responseHeaders) => {
    console.log("APNs Response Headers:", responseHeaders);
  });

  request.on("end", () => {
    client.close();
    res.json({ message: "Notification sent", response: responseData });
  });

  // Send the JSON payload
  request.write(JSON.stringify(notificationPayload));
  request.end();
});

// Simple root endpoint for health check
app.get("/", (req, res) => {
  res.send("APNs Server is running!");
});

// Start the server on the port provided by environment or default 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
