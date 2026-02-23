const { TableClient } = require("@azure/data-tables");
const crypto = require("crypto");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getTableClient() {
  const connectionString = process.env.AZURE_TABLE_CONNECTION_STRING;
  const tableName = process.env.AZURE_TABLE_NAME || "NewsletterSubscribers";

  if (!connectionString) {
    return null;
  }

  return TableClient.fromConnectionString(connectionString, tableName);
}

function hashEmail(email) {
  return crypto.createHash("sha256").update(email.toLowerCase()).digest("hex");
}

module.exports = async function (context, req) {
  try {
    const { email, consent, source, createdAt } = req.body || {};

    if (!email || !EMAIL_REGEX.test(email)) {
      return {
        status: 400,
        body: { message: "Email inválido." }
      };
    }

    if (!consent) {
      return {
        status: 400,
        body: { message: "Consentimiento requerido." }
      };
    }

    const tableClient = getTableClient();

    if (!tableClient) {
      return {
        status: 503,
        body: { message: "Servicio de suscripción no configurado." }
      };
    }

    await tableClient.createTable();

    const normalizedEmail = email.trim().toLowerCase();
    const entity = {
      partitionKey: source || "landing-ensenanos",
      rowKey: hashEmail(normalizedEmail),
      email: normalizedEmail,
      consent: true,
      createdAt: createdAt || new Date().toISOString(),
      userAgent: req.headers["user-agent"] || "unknown"
    };

    await tableClient.upsertEntity(entity, "Merge");

    return {
      status: 200,
      body: { message: "Suscripción registrada." }
    };
  } catch (error) {
    context.log.error("Error en subscribe:", error);

    return {
      status: 500,
      body: { message: "Error interno al registrar suscripción." }
    };
  }
};
