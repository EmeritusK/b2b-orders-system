import express from 'express';

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'orders-api' });
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Orders API listening on port ${PORT}`);
});
