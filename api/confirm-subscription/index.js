const { TableClient } = require("@azure/data-tables");
const { DefaultAzureCredential } = require("@azure/identity");
const crypto = require("crypto");

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

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

function html(message, ok = true) {
  const title = ok ? "Suscripción confirmada" : "No se pudo confirmar";
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${title}</title>
    <style>
      body { font-family: system-ui, sans-serif; background:#f4f6f9; color:#1a1f28; margin:0; }
      main { max-width:680px; margin:40px auto; background:#fff; border:1px solid #dde4ee; border-radius:18px; padding:28px; }
      h1 { margin:0 0 10px; font-size:28px; }
      p { color:#4b5566; line-height:1.6; }
      a { color:#111827; }
    </style>
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      <p>${message}</p>
      <p><a href="/">Volver al sitio</a></p>
    </main>
  </body>
</html>`;
}

module.exports = async function (context, req) {
  try {
    const tableClient = getTableClient();

    if (!tableClient) {
      return {
        status: 503,
        headers: { "Content-Type": "text/html; charset=utf-8" },
        body: html("El servicio no está configurado en este momento.", false)
      };
    }

    const source = req.query.source;
    const id = req.query.id;
    const token = req.query.token;

    if (!source || !id || !token) {
      return {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
        body: html("El enlace de confirmación es inválido.", false)
      };
    }

    let entity;

    try {
      entity = await tableClient.getEntity(source, id);
    } catch {
      return {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
        body: html("No encontramos esta suscripción.", false)
      };
    }

    if (entity.status === "confirmed") {
      return {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
        body: html("Tu email ya estaba confirmado. ¡Gracias!")
      };
    }

    if (!entity.confirmationTokenHash || !entity.confirmationExpiresAt) {
      return {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
        body: html("Este enlace ya no es válido.", false)
      };
    }

    const incomingTokenHash = hashToken(token);

    if (incomingTokenHash !== entity.confirmationTokenHash) {
      return {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
        body: html("El token de confirmación no coincide.", false)
      };
    }

    if (new Date(entity.confirmationExpiresAt).getTime() < Date.now()) {
      return {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
        body: html("El enlace de confirmación expiró. Vuelve a suscribirte.", false)
      };
    }

    entity.status = "confirmed";
    entity.confirmedAt = new Date().toISOString();
    entity.confirmationTokenHash = "";
    entity.confirmationExpiresAt = "";

    await tableClient.updateEntity(entity, "Merge");

    return {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
      body: html("Tu suscripción fue confirmada correctamente.")
    };
  } catch (error) {
    context.log.error("Error confirmando suscripción:", error);

    return {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
      body: html("Ocurrió un error al confirmar tu email.", false)
    };
  }
};
