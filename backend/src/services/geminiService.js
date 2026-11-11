const { GoogleGenAI } = require("@google/genai");

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is missing from backend/.env");
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const MAX_ATTEMPTS = 2;
const REQUEST_TIMEOUT_MS = 15000;
const RETRY_DELAY_MS = 2000;

async function verifyTaskResult(task, result) {
  const prompt = `
You are an AI task verification assistant.

Evaluate whether the submitted result reasonably satisfies the task.

Task title: ${task.title}
Task description: ${task.description}
Required capability: ${task.requiredCapability}

Submitted result:
${result}

Return only valid JSON:
{
  "verdict": "approved",
  "score": 85,
  "reasoning": "Explanation of the result",
  "missingItems": []
}

Allowed verdicts: approved, rejected, needs_review.

Do not claim that the task was actually performed based only on submitted text.
If evidence is insufficient, use needs_review.
`;

  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      console.log(
        `Gemini verification attempt ${attempt}/${MAX_ATTEMPTS}`
      );

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          httpOptions: {
            timeout: REQUEST_TIMEOUT_MS,
          },
        },
      });

      if (!response.text) {
        throw new Error("Gemini returned an empty response");
      }

      const verification = JSON.parse(response.text);

      if (
        !["approved", "rejected", "needs_review"].includes(
          verification.verdict
        ) ||
        typeof verification.score !== "number" ||
        !Number.isFinite(verification.score) ||
        verification.score < 0 ||
        verification.score > 100 ||
        typeof verification.reasoning !== "string" ||
        !Array.isArray(verification.missingItems)
      ) {
        throw new Error("Invalid Gemini verification response");
      }

      console.log("Gemini verification completed successfully");

      return verification;
    } catch (error) {
      lastError = error;

      const status = Number(
        error.status || error.statusCode
      );

      const isRetryable =
        [429, 500, 503, 504].includes(status) ||
        error.name === "AbortError" ||
        /timeout|timed out/i.test(error.message || "");

      console.error(
        `Gemini attempt ${attempt} failed:`,
        error.message
      );

      if (!isRetryable || attempt === MAX_ATTEMPTS) {
        break;
      }

      await new Promise((resolve) =>
        setTimeout(resolve, RETRY_DELAY_MS)
      );
    }
  }

  console.error(
    "Gemini verification unavailable:",
    lastError?.message
  );

  throw lastError;
}

module.exports = { verifyTaskResult };
