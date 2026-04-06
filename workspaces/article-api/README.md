# Article API

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
