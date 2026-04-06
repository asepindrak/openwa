const express = require('express');
const articlesRouter = require('./routes/articles');
const app = express();
app.use(express.json());
app.use('/articles', articlesRouter);
app.use((req, res) => res.status(404).json({ error: 'Not found' }));
const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Server listening on ' + port));
