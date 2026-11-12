const PAYPAL_SANDBOX_URL = "https://api-m.sandbox.paypal.com";
const PAYPAL_LIVE_URL = "https://api-m.paypal.com";

const getPayPalBaseUrl = () => {
  const configuredUrl = process.env.PAYPAL_BASE_URL;

  if (!configuredUrl) {
    throw new Error("PAYPAL_BASE_URL is missing");
  }

  const baseUrl = configuredUrl.replace(/\/+$/, "");

  if (
    baseUrl !== PAYPAL_SANDBOX_URL &&
    baseUrl !== PAYPAL_LIVE_URL
  ) {
    throw new Error("Invalid PayPal API base URL");
  }

  return baseUrl;
};

const validateOrderId = (orderId) => {
  if (
    typeof orderId !== "string" ||
    !/^[A-Za-z0-9]{17}$/.test(orderId)
  ) {
    throw new Error("Invalid PayPal order ID");
  }

  return orderId;
};

const validateRequestId = (requestId) => {
  if (
    typeof requestId !== "string" ||
    !/^[A-Za-z0-9-]{1,108}$/.test(requestId)
  ) {
    throw new Error("Invalid PayPal capture request ID");
  }

  return requestId;
};

const getPayPalAccessToken = async () => {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const baseUrl = getPayPalBaseUrl();

  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials are missing");
  }

  const credentials = Buffer.from(
    `${clientId}:${clientSecret}`
  ).toString("base64");

  const response = await fetch(
    `${baseUrl}/v1/oauth2/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error_description ||
      "PayPal authentication failed"
    );
  }

  return data.access_token;
};

const createPayPalOrder = async (
  amount,
  currency = "USD"
) => {
  const baseUrl = getPayPalBaseUrl();
  const accessToken = await getPayPalAccessToken();

  const numericAmount = Number(amount);

  if (
    !Number.isFinite(numericAmount) ||
    numericAmount <= 0
  ) {
    throw new Error("Invalid PayPal payment amount");
  }

  if (
    typeof currency !== "string" ||
    !/^[A-Z]{3}$/.test(currency)
  ) {
    throw new Error("Invalid currency code");
  }

  const frontendUrl = (
    process.env.FRONTEND_URL ||
    "https://payagent-protocol-frontend.onrender.com"
  ).replace(/\/+$/, "");

  const response = await fetch(
    `${baseUrl}/v2/checkout/orders`,
    {
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
              value: numericAmount.toFixed(2),
            },
          },
        ],
        application_context: {
          return_url: `${frontendUrl}/`,
          cancel_url: `${frontendUrl}/`,
          user_action: "PAY_NOW",
        },
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "PayPal order creation failed"
    );
  }

  return data;
};

const capturePayPalOrder = async (
  orderId,
  requestId
) => {
  const safeOrderId = validateOrderId(orderId);
  const safeRequestId = validateRequestId(requestId);

  const baseUrl = getPayPalBaseUrl();
  const accessToken = await getPayPalAccessToken();

  const response = await fetch(
    `${baseUrl}/v2/checkout/orders/${safeOrderId}/capture`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": safeRequestId,
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "PayPal payment capture failed"
    );
  }

  return data;
};

const getPayPalOrderDetails = async (orderId) => {
  const safeOrderId = validateOrderId(orderId);

  const baseUrl = getPayPalBaseUrl();
  const accessToken = await getPayPalAccessToken();

  const response = await fetch(
    `${baseUrl}/v2/checkout/orders/${safeOrderId}`,
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
    throw new Error(
      data.message || "Failed to retrieve PayPal order"
    );
  }

  return data;
};

module.exports = {
  getPayPalAccessToken,
  createPayPalOrder,
  capturePayPalOrder,
  getPayPalOrderDetails,
};
