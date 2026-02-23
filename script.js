const SUBSCRIBE_ENDPOINT = "/api/subscribe";

const form = document.getElementById("newsletter-form");
const emailInput = document.getElementById("email-input");
const consentInput = document.getElementById("consent-input");
const button = document.getElementById("newsletter-btn");
const feedback = document.getElementById("newsletter-feedback");

function updateButtonState() {
  const hasConsent = consentInput?.checked;
  const hasEmail = emailInput?.value?.trim().length > 3;
  button.disabled = !(hasConsent && hasEmail);
}

function setFeedback(message, isError = false) {
  feedback.textContent = message;
  feedback.style.color = isError ? "#9b2c2c" : "#3f5168";
}

if (form && emailInput && consentInput && button && feedback) {
  emailInput.addEventListener("input", updateButtonState);
  consentInput.addEventListener("change", updateButtonState);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = emailInput.value.trim();
    const consent = consentInput.checked;

    if (!email || !consent) {
      setFeedback("Debes ingresar un email válido y aceptar las políticas.", true);
      return;
    }

    button.disabled = true;
    button.textContent = "Enviando...";
    setFeedback("");

    try {
      const response = await fetch(SUBSCRIBE_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email,
          consent,
          source: "landing-ensenanos",
          createdAt: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error("No se pudo registrar tu correo en este momento.");
      }

      setFeedback("¡Revisa tu email y confirma la suscripción para completar el alta!");
      form.reset();
      updateButtonState();
    } catch (error) {
      setFeedback("No pudimos registrar tu correo. Escribe a info@godlens.one", true);
    } finally {
      button.textContent = "Recibir aviso";
      updateButtonState();
    }
  });

  updateButtonState();
}
