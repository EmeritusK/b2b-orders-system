import express from 'express';

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'customers-api' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Customers API listening on port ${PORT}`);
});
