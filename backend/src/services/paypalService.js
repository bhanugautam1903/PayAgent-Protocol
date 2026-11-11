const getPayPalAccessToken = async () => {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const baseUrl = process.env.PAYPAL_BASE_URL;

  if (!clientId || !clientSecret || !baseUrl) {
    throw new Error("PayPal environment variables are missing");
  }

  const credentials = Buffer.from(
    `${clientId}:${clientSecret}`
  ).toString("base64");

  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error_description || "PayPal authentication failed");
  }

  return data.access_token;
};

const createPayPalOrder = async (amount, currency = "USD") => {
  const accessToken = await getPayPalAccessToken();
  const baseUrl = process.env.PAYPAL_BASE_URL;

  const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: currency,
            value: Number(amount).toFixed(2),
          },
        },
      ],
      application_context: {
        return_url: "http://localhost:5173/",
        cancel_url: "http://localhost:5173/",
        user_action: "PAY_NOW",
      },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "PayPal order creation failed");
  }

  return data;
};

const capturePayPalOrder = async (orderId, requestId) => {
  const accessToken = await getPayPalAccessToken();
  const baseUrl = process.env.PAYPAL_BASE_URL;

  if (!requestId) {
    throw new Error("PayPal capture request ID is required");
  }

  const response = await fetch(
    `${baseUrl}/v2/checkout/orders/${orderId}/capture`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": requestId,
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "PayPal payment capture failed");
  }

  return data;
};

const getPayPalOrderDetails = async (orderId) => {
  const accessToken = await getPayPalAccessToken();
  const baseUrl = process.env.PAYPAL_BASE_URL;

  const response = await fetch(
    `${baseUrl}/v2/checkout/orders/${orderId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to retrieve PayPal order");
  }

  return data;
};

module.exports = {
  getPayPalAccessToken,
  createPayPalOrder,
  capturePayPalOrder,
  getPayPalOrderDetails,
};
