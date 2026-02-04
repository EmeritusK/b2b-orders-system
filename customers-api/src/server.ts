import 'dotenv/config';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import { join } from 'path';
import authRouter from './features/auth/auth.controller';
import customersRouter from './features/customers/customers.controller';
import { errorHandler } from './middleware/error-handler';
import { requireAuth } from './middleware/require-auth';

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'customers-api' }));

const swaggerDocument = YAML.load(join(__dirname, '../../openapi.yaml'));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use('/auth', authRouter);
app.use(requireAuth, customersRouter);


app.use((_req, res) => res.status(404).json({ error: 'Not found' }));


app.use(errorHandler);

export default app;
