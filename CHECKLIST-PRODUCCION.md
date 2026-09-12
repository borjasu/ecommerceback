# Checklist de producción — ecommerceback (Railway)

No existía este archivo antes de esta sesión — se creó desde cero a partir de
una auditoría del código real (qué variable lee cada módulo vía
`configService.get`/`process.env`, no lo que "debería" leer). Si agregas una
variable nueva en una sesión futura, agrégala aquí también en el mismo commit.

Despliegue objetivo: Railway, con **la URL gratuita de la plataforma**
(`*.up.railway.app`) — todavía no hay dominio propio. Eso cambia cómo se
llenan `COOKIE_SAME_SITE`/`COOKIE_DOMAIN`/`CORS_ORIGIN` (ver más abajo).

## Cómo leer esta tabla

- **Ya se puede definir ahora**: no depende de nada externo, defínela en
  Railway antes del primer deploy.
- **Depende de un trámite externo**: falta una decisión o credencial que no
  es tuya (dominio, credenciales reales de un tercero) — usa el placeholder
  indicado mientras tanto y no olvides volver aquí cuando llegue.

## Variables

| Variable | Valor en tu `.env` local | Qué poner en Railway | Estado |
|---|---|---|---|
| `NODE_ENV` | `development` | `production` | Ya se puede definir |
| `PORT` | `3000` | Railway la inyecta sola (no la fijes a mano) | Ya se puede definir |
| `DATABASE_URL` | Postgres local | La `DATABASE_URL` del plugin de Postgres de Railway (referenciada, no copiada a mano) | Ya se puede definir |
| `JWT_ACCESS_SECRET` | secreto de 32+ chars | Genera uno NUEVO para producción (`openssl rand -hex 32`) — nunca reutilices el de local | Ya se puede definir |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | `15m` (sin cambios) | Ya se puede definir |
| `JWT_REFRESH_SECRET` | secreto de 32+ chars | Genera uno NUEVO, distinto del de `JWT_ACCESS_SECRET` | Ya se puede definir |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | `7d` (sin cambios) | Ya se puede definir |
| `COOKIE_DOMAIN` | vacío | Vacío mientras no haya dominio propio (Railway y Vercel manejan su propio dominio, no hace falta fijar uno) | Ya se puede definir |
| `COOKIE_SAME_SITE` | `lax` | **`none`** — frontend (Vercel) y backend (Railway) son dominios distintos, cross-site para el navegador; `strict`/`lax` harían que la cookie de sesión nunca viajara y el login no persistiría. Volver a `strict` cuando haya dominio propio compartido (ej. `app.frankjeans.com` + `api.frankjeans.com`) | Ya se puede definir (es una decisión de arquitectura, no depende de un tercero) |
| `CORS_ORIGIN` | `http://localhost:4200,http://127.0.0.1:4200` | La URL real de Vercel una vez asignada (ej. `https://tu-proyecto.vercel.app`) | **Depende de un trámite externo** — necesitas la URL de Vercel primero (deploy el frontend, copia la URL, vuelve aquí) |
| `FRONTEND_URL` | `http://localhost:4200` | Misma URL de Vercel que `CORS_ORIGIN` — arma los `back_urls` de Mercado Pago | **Depende de un trámite externo** (misma URL de Vercel) |
| `BACKEND_URL` | `http://localhost:3000` | La URL pública que Railway asigna al servicio (ej. `https://tu-proyecto.up.railway.app`) | **Depende de un trámite externo** — Railway la asigna al crear el servicio |
| `MERCADOPAGO_ACCESS_TOKEN` | token TEST | El Access Token de **producción** (no el de test) de la cuenta real de Mercado Pago del cliente | **Depende de un trámite externo** — credenciales reales del cliente |
| `MERCADOPAGO_WEBHOOK_SECRET` | secreto TEST | El secreto de firma del webhook de producción (se genera al configurar el webhook real en el panel de Mercado Pago apuntando a `BACKEND_URL/pagos/webhook`) | **Depende de un trámite externo** |
| `SKYDROPX_CLIENT_ID` | credencial sandbox | Credencial de producción de Skydropx | **Depende de un trámite externo** — cuenta de producción de Skydropx |
| `SKYDROPX_CLIENT_SECRET` | credencial sandbox | Credencial de producción de Skydropx | **Depende de un trámite externo** |
| `SKYDROPX_ENVIRONMENT` | `sandbox` | `production` | Ya se puede definir (el día que ya tengas las credenciales de arriba) |
| `SKYDROPX_API_URL` | `https://sb-pro.skydropx.com` | `https://pro.skydropx.com` (¡host distinto, no el mismo con un flag!) | Ya se puede definir (junto con lo anterior) |
| `SKYDROPX_WEBHOOK_SECRET` | vacío (opcional) | Si Skydropx expone un secreto de firma de webhook en producción, póngalo aquí; si no, se deja vacío (el webhook igual se procesa, solo sin validar HMAC) | **Depende de un trámite externo** (opcional) |
| `STORE_ORIGIN_STREET` | Calle 5 de Mayo 123 | Dirección real de la tienda | Ya se puede definir |
| `STORE_ORIGIN_POSTAL_CODE` | 72000 | CP real de la tienda | Ya se puede definir |
| `STORE_ORIGIN_CITY` | Puebla | Ciudad real | Ya se puede definir |
| `STORE_ORIGIN_STATE` | Puebla | Estado real | Ya se puede definir |
| `STORE_ORIGIN_NEIGHBORHOOD` | Centro | Colonia real | Ya se puede definir |
| `STORE_ORIGIN_COUNTRY_CODE` | MX | MX (sin cambios) | Ya se puede definir |
| `STORE_ORIGIN_NAME` | Frank Jeans | Nombre real del remitente | Ya se puede definir |
| `STORE_ORIGIN_PHONE` | número de prueba | Teléfono real de la tienda | Ya se puede definir |
| `STORE_ORIGIN_EMAIL` | contacto@frankjeans.com | Email real de la tienda | Ya se puede definir |
| `ENVIO_REQUIERE_PICKUP` | `true` | Según cómo opere realmente Frank Jeans (¿Skydropx recoge en tienda o se deja en la paquetería?) | Ya se puede definir — es una decisión de negocio, no técnica |
| `PEDIDO_ABANDONO_MINUTOS` | `120` | `120` (o el valor que decidan de negocio) | Ya se puede definir |
| `THROTTLE_TTL` | `60000` | `60000` (sin cambios) | Ya se puede definir |
| `THROTTLE_LIMIT` | `100` | `100` (sin cambios, ajustar si el tráfico real lo exige) | Ya se puede definir |
| `THROTTLE_AUTH_TTL` | `60000` | `60000` (sin cambios) | Ya se puede definir |
| `THROTTLE_AUTH_LIMIT` | `5` | `5` (sin cambios) | Ya se puede definir |
| `CLOUDINARY_CLOUD_NAME` | **vacío — sin llenar** | Tu cloud name real (cloudinary.com/console) | **Bloqueante** — el backend no arranca sin esto, ver nota abajo |
| `CLOUDINARY_API_KEY` | **vacío — sin llenar** | Tu API key real | **Bloqueante** |
| `CLOUDINARY_API_SECRET` | **vacío — sin llenar** | Tu API secret real | **Bloqueante** |

## Notas agregadas en esta sesión

- **`MERCADOPAGO_PUBLIC_KEY` ya NO es una variable del backend.** Nunca la
  leía ningún código aquí — es una credencial pensada para el frontend
  (inicializa el SDK JS del Payment Brick). Vive en
  `ecommerfront/src/environments/environment.ts` como
  `mercadoPagoPublicKey`. Si la ves todavía en algún `.env` viejo del
  backend, es inofensiva pero se puede borrar.
- **Cloudinary es nuevo** (antes las fotos de producto se guardaban en disco
  local vía `fs.writeFile`, lo cual se habría perdido en cada redeploy de
  Railway por su filesystem efímero). El backend **no arranca** sin las tres
  variables de Cloudinary — son `required()` en `env.validation.ts`, igual
  que `DATABASE_URL`. No están llenas en el `.env` local a propósito: no se
  tenían credenciales reales al momento de escribir esto.
- **`COOKIE_SAME_SITE` es nuevo.** Antes era `'strict'` fijo en el código.
  Con frontend y backend en dominios `*.vercel.app`/`*.up.railway.app`
  (sites distintos para el navegador), `strict` habría roto el login en
  producción sin ningún error visible — la respuesta del login llega bien,
  pero ninguna petición protegida posterior traería la cookie. Cuando exista
  un dominio propio compartido, vuelve este valor a `strict` en Railway.
- Se aplicó una migración de base de datos nueva en esta sesión
  (`AgregarImagenPublicIdProductoColor1788839229842`, agrega la columna
  `imagen_public_id` a `producto_color_imagenes`, necesaria para poder
  borrar imágenes de Cloudinary). Corre `npm run migration:run` en Railway
  como parte del deploy si no está automatizado ya.

## Antes del primer deploy a Railway

1. Llena las variables marcadas "Ya se puede definir" directamente en el
   dashboard de variables de Railway.
2. Crea la cuenta de Cloudinary (o usa una existente) y llena las 3
   `CLOUDINARY_*` — sin esto el deploy arranca y muere en el healthcheck.
3. Despliega, copia la URL pública que Railway asigna, y vuelve a llenar
   `BACKEND_URL` con ese valor real (puede requerir un redeploy).
4. Despliega el frontend a Vercel, copia su URL, y llena `CORS_ORIGIN` y
   `FRONTEND_URL` con ella.
5. Deja `COOKIE_SAME_SITE=none` hasta que haya dominio propio.
6. Cuando el cliente entregue las credenciales reales de Mercado Pago y
   Skydropx, reemplaza esas 4 variables y cambia `SKYDROPX_ENVIRONMENT`/
   `SKYDROPX_API_URL` a producción.
