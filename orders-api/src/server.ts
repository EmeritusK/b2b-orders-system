import 'dotenv/config';
import express from 'express';
import productsRouter from './features/products/products.controller';
import ordersRouter from './features/orders/orders.controller';
import { errorHandler } from './middleware/error-handler';

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'orders-api' }));

app.use(productsRouter);
app.use(ordersRouter);

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

export default app;
