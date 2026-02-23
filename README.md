# Enséñanos a orar — Landing Page

Landing estática inspirada en el diseño visual de referencia, adaptada para el libro **"Enséñanos a orar"**.

## Estructura

- `index.html`
- `styles.css`
- `script.js`
- `terminos-condiciones.html`
- `politicas-privacidad.html`
- `api/subscribe` (endpoint de suscripción)
- `assets/cover-ensenanos-orar.svg` (fallback incluido)
- `assets/cover-ensenanos-a-orar.png` (portada final recomendada)
- `assets/cover-ensenanos-a-orar.jpg` (alternativa opcional)

## Uso

Abre `index.html` en tu navegador o usa una extensión como Live Server en VS Code.

## Nota de assets

La portada del libro usa fallback automático:

1. Si existe `assets/cover-ensenanos-a-orar.png`, se muestra ese archivo.
2. Si no existe PNG pero existe `assets/cover-ensenanos-a-orar.jpg`, se muestra JPG.
3. Si no existe ninguno, se muestra `assets/cover-ensenanos-orar.svg`.

Si deseas, puedo integrarte de inmediato una versión optimizada de la portada y ajustar tamaños exactos para desktop y móvil.

## Captación de emails

La landing envía suscripciones por `POST /api/subscribe`.

### Dónde se almacenan los emails

En Azure Table Storage, en la tabla definida por `AZURE_TABLE_NAME` (por defecto: `NewsletterSubscribers`).

### Variables de entorno requeridas en Azure Static Web App

- `AZURE_TABLE_ACCOUNT_NAME` (nombre de la cuenta de Storage)
- `AZURE_TABLE_NAME` (opcional)

Opcional de fallback:

- `AZURE_TABLE_CONNECTION_STRING` (solo si no se usa identidad administrada)

### Seguridad recomendada (aplicada)

- Static Web App en plan `Standard` con identidad administrada.
- Acceso a datos por RBAC (`Storage Table Data Contributor`) sin secretos en app settings.

### Flujo legal implementado

- El botón `Recibir aviso` se habilita solo cuando el usuario:
	- ingresa un email válido
	- acepta Políticas de Privacidad y Términos y Condiciones
