const executor = require("../server/services/tool-executor");

(async () => {
  try {
    const files = [
      {
        path: "article-api/package.json",
        content: JSON.stringify(
          {
            name: "article-api",
            version: "1.0.0",
            main: "index.js",
            scripts: { start: "node index.js", dev: "nodemon index.js" },
            dependencies: { express: "*", uuid: "*" },
            devDependencies: { nodemon: "*" },
          },
          null,
          2,
        ),
      },
      {
        path: "article-api/index.js",
        content: `const express = require('express');
const articlesRouter = require('./routes/articles');
const app = express();
app.use(express.json());
app.use('/articles', articlesRouter);
app.use((req, res) => res.status(404).json({ error: 'Not found' }));
const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Server listening on ' + port));
`,
      },
      {
        path: "article-api/routes/articles.js",
        content: `const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/articlesController');

router.get('/', ctrl.list);
router.get('/:id', ctrl.getById);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
`,
      },
      {
        path: "article-api/controllers/articlesController.js",
        content: `const { v4: uuidv4 } = require('uuid');
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
`,
      },
      {
        path: "article-api/README.md",
        content: `# Article API

Simple Express.js CRUD API for articles.

Run:

npm install
npm run dev

Examples:

Create:

curl -X POST http://localhost:3000/articles -H "Content-Type: application/json" -d '{"title":"Hello","content":"World"}'

List:

curl http://localhost:3000/articles

Get:

curl http://localhost:3000/articles/<id>

Update:

curl -X PUT http://localhost:3000/articles/<id> -H "Content-Type: application/json" -d '{"title":"New","content":"Body"}'

Delete:

curl -X DELETE http://localhost:3000/articles/<id>
`,
      },
    ];

    const res = await executor.executeTool({
      action: "write_files",
      data: { files },
      userId: "system",
    });
    console.log("Scaffold result:", JSON.stringify(res, null, 2));
    process.exit(0);
  } catch (e) {
    console.error("Error:", e && e.message ? e.message : e);
    process.exit(1);
  }
})();
