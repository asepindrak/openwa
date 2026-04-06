const { v4: uuidv4 } = require('uuid');
let articles = [];

exports.list = (req, res) => res.json(articles);

exports.getById = (req, res) => {
  const article = articles.find(a => a.id === req.params.id);
  if (!article) return res.status(404).json({ error: 'Article not found' });
  res.json(article);
};

exports.create = (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'title and content are required' });
  const article = { id: uuidv4(), title, content, createdAt: new Date().toISOString() };
  articles.push(article);
  res.status(201).json(article);
};

exports.update = (req, res) => {
  const article = articles.find(a => a.id === req.params.id);
  if (!article) return res.status(404).json({ error: 'Article not found' });
  const { title, content } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'title and content are required' });
  article.title = title;
  article.content = content;
  article.updatedAt = new Date().toISOString();
  res.json(article);
};

exports.remove = (req, res) => {
  const idx = articles.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Article not found' });
  articles.splice(idx, 1);
  res.status(204).end();
};
