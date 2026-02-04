import 'dotenv/config';
import express from 'express';
import customersRouter from './features/customers/customers.controller';
import { errorHandler } from './middleware/error-handler';

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'customers-api' }));

app.use(customersRouter);


app.use((_req, res) => res.status(404).json({ error: 'Not found' }));


app.use(errorHandler);

export default app;
