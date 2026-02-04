import 'dotenv/config';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import { join } from 'path';
import productsRouter from './features/products/products.controller';
import ordersRouter from './features/orders/orders.controller';
import { errorHandler } from './middleware/error-handler';
import { requireAuth } from './middleware/require-auth';

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'orders-api' }));

const swaggerDocument = YAML.load(join(__dirname, '../../openapi.yaml'));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use(requireAuth, productsRouter);
app.use(requireAuth, ordersRouter);

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

export default app;
