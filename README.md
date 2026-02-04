# Sistema de pedidos B2B

Sistema de prueba con dos APIs REST y una funcion lambda para crear y confirmar un pedido en una sola llamada

## Contenido del repositorio

- **`customers-api`** (Express + MySQL): login de operador (JWT) + CRUD de clientes
- **`orders-api`** (Express + MySQL): CRUD de productos + ciclo de vida de pedidos
- **`lambda-orchestrator`** (Serverless Framework offline): llama a Customers + Orders usando un token de servicio compartido
- **`db`**: esquema + datos de seed para MySQL local

En `customers-api` y `orders-api` hay scripts NPM: `migrate`, `seed` (y `build`/`start` si se corre fuera de Docker). Ver `package.json` de cada uno.

## Puertos locales

- **MySQL**: `3306`
- **Customers API**: `3001`
- **Orders API**: `3002`
- **Orquestador (serverless-offline)**: `3003`

## Requisitos

- **Docker Desktop**
- **Node.js 22+**

El orquestador usa **Serverless Framework v3**, ya que la v4 obliga crear a crear una cuenta para configurar una licencia solo para probar el sistema.  

## Inicio del proyecto (servicios en Docker)

### 1) Crear archivos de entorno

Copiar los ejemplos y ajustar los valores:

- `customers-api/.env.example` → `customers-api/.env`
- `orders-api/.env.example` → `orders-api/.env`
- `lambda-orchestrator/.env.example` → `lambda-orchestrator/.env`

Importante: Se debe usar **el mismo** valor de `SERVICE_TOKEN` en:

- `customers-api/.env`
- `orders-api/.env`
- `lambda-orchestrator/.env`

### 2) Levantar Base de datos y APIs

Desde la raiz del repo:

```bash
docker compose up --build
```

Health checks:

- `GET http://localhost:3001/health`
- `GET http://localhost:3002/health`

## Autenticacion (como consumir las APIs)

### Login de operador (JWT)

Customers API emite JWTs en:

- `POST http://localhost:3001/auth/login`

Las credenciales salen de variables de entorno en `customers-api/.env`:

- `OPERATOR_EMAIL`
- `OPERATOR_PASSWORD_HASH` (hash bcrypt)

Para generar un hash de contraseña en local:

```bash
cd customers-api
npm install
npm run hash-password operator123
```

Luego pega el valor en `customers-api/.env` como `OPERATOR_PASSWORD_HASH=...` y recrea el contenedor:

```bash
docker compose up -d --force-recreate customers-api
```

Despues del login, llama a los endpoints protegidos con:

- `Authorization: Bearer <JWT>`

### Autenticacion entre servicios (SERVICE_TOKEN)

Las dos APIs aceptan tambien un token compartido (bearer) para llamadas internas:

- `Authorization: Bearer <SERVICE_TOKEN>`

Esto es lo que usa el orquestador cuando llama a:

- Customers: `GET /internal/customers/:id`
- Orders: `POST /orders`, `POST /orders/:id/confirm`

## Orquestador (Serverless Offline)

El orquestador expone un único endpoint:

- `POST http://localhost:3003/orchestrator/create-and-confirm-order`

### 1) Ejecutar en local

Desde `lambda-orchestrator/`:

```bash
npm install
npx serverless offline
```

Si se ve `EADDRINUSE` en el puerto `3002`, significa que ya hay otro proceso escuchando ahí.
En este repo, serverless-offline corre en **`3003`** para no chocar con Orders API (`3002`).

### 2) Auth del orquestador (opcional)

Si `ORCHESTRATOR_TOKEN` está definido en `lambda-orchestrator/.env`, llamar al orquestador con:

- `Authorization: Bearer <ORCHESTRATOR_TOKEN>`

Si `ORCHESTRATOR_TOKEN` está vacío/no existe, el orquestador permite llamadas sin ese header (para pruebas locales).

### 3) Ejemplo de request

```bash
curl -X POST "http://localhost:3003/orchestrator/create-and-confirm-order" ^
  -H "content-type: application/json" ^
  -H "authorization: Bearer orchestrator-secret-token" ^
  -d "{\"customer_id\":1,\"items\":[{\"product_id\":1,\"qty\":1}],\"idempotency_key\":\"demo-1\"}"
```

Respuesta esperada (201): `success`, `correlationId` (si se envió) y `data` con `customer`, `order` e `items`.

### 4) Exponer local con URL pública (opcional)

Para invocar el orquestador desde otra máquina o con una URL pública: `ngrok http 3003`.

### 5) Despliegue en AWS

Desde `lambda-orchestrator/`: `npx serverless deploy`. Configurar `CUSTOMERS_API_BASE` y `ORDERS_API_BASE` en `.env` (o en el stage) con las URLs públicas de las APIs.

## OpenAPI (Swagger)

La documentación Swagger está disponible directamente en cada servicio:

- **Customers API**: `http://localhost:3001/docs`
- **Orders API**: `http://localhost:3002/docs`

Tambien se puede ver los archivos YAML directamente:
- `customers-api/openapi.yaml`
- `orders-api/openapi.yaml`

En AWS las rutas `/docs` siguen expuestas pero la documentación apunta a localhost, así que para probar contra lo desplegado conviene usar Postman.

## Probar con Postman

Colección y ambientes en: [b2b-orders-jelou](https://www.postman.com/jairparedes/workspace/b2b-orders-jelou).

Hay dos ambientes: uno para servicios en **AWS** y otro para **local** (localhost). Levantar los servicios según este README, elegir el ambiente en Postman y ejecutar las peticiones.