const { TableClient } = require("@azure/data-tables");
const { DefaultAzureCredential } = require("@azure/identity");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getTableClient() {
  const connectionString = process.env.AZURE_TABLE_CONNECTION_STRING;
  const tableName = process.env.AZURE_TABLE_NAME || "NewsletterSubscribers";
  const accountName = process.env.AZURE_TABLE_ACCOUNT_NAME;

  if (connectionString) {
    return TableClient.fromConnectionString(connectionString, tableName);
  }

  if (!accountName) {
    return null;
  }

  const credential = new DefaultAzureCredential();
  const endpoint = `https://${accountName}.table.core.windows.net`;

  return new TableClient(endpoint, tableName, credential);
}

function hashEmail(email) {
  return crypto.createHash("sha256").update(email.toLowerCase()).digest("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function getBaseUrl(req) {
  const explicitUrl = process.env.PUBLIC_BASE_URL;

  if (explicitUrl) {
    return explicitUrl.replace(/\/$/, "");
  }

  const forwardedHost = req.headers["x-forwarded-host"];
  const host = forwardedHost || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";

  if (!host) {
    return null;
  }

  return `${proto}://${host}`;
}

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;

  if (!host || !user || !pass || !from) {
    return null;
  }

  return {
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass
    },
    from
  };
}

async function sendConfirmationEmail({ to, confirmationUrl }) {
  const smtp = getSmtpConfig();

  if (!smtp) {
    throw new Error("SMTP no configurado.");
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.auth
  });

  await transporter.sendMail({
    from: smtp.from,
    to,
    subject: "Confirma tu suscripción · God Lens",
    text: `Gracias por suscribirte. Para confirmar tu email, haz clic en este enlace: ${confirmationUrl}`,
    html: `
      <p>Gracias por suscribirte.</p>
      <p>Para confirmar tu email, haz clic en este enlace:</p>
      <p><a href="${confirmationUrl}">${confirmationUrl}</a></p>
      <p>Si no solicitaste esta suscripción, puedes ignorar este correo.</p>
    `
  });
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

    const baseUrl = getBaseUrl(req);

    if (!baseUrl) {
      return {
        status: 503,
        body: { message: "No se pudo determinar la URL de confirmación." }
      };
    }

    await tableClient.createTable();

    const normalizedEmail = email.trim().toLowerCase();
    const partitionKey = source || "landing-ensenanos";
    const rowKey = hashEmail(normalizedEmail);
    const token = crypto.randomBytes(24).toString("hex");
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
    const confirmationUrl = `${baseUrl}/api/confirm-subscription?source=${encodeURIComponent(partitionKey)}&id=${encodeURIComponent(rowKey)}&token=${encodeURIComponent(token)}`;

    const entity = {
      partitionKey,
      rowKey,
      email: normalizedEmail,
      consent: true,
      status: "pending",
      confirmationTokenHash: tokenHash,
      confirmationExpiresAt: expiresAt,
      createdAt: createdAt || new Date().toISOString(),
      userAgent: req.headers["user-agent"] || "unknown"
    };

    await tableClient.upsertEntity(entity, "Merge");

    await sendConfirmationEmail({
      to: normalizedEmail,
      confirmationUrl
    });

    return {
      status: 200,
      body: { message: "Revisa tu email para confirmar la suscripción." }
    };
  } catch (error) {
    context.log.error("Error en subscribe:", error);

    return {
      status: 500,
      body: { message: "Error interno al registrar suscripción." }
    };
  }
};
