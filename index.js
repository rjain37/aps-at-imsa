const express = require('express');
const app = express();
const fs = require('fs');
const path = require('path');
const CsvReadableStream = require('csv-reader');
const http = require('http').createServer(app);

// preliminary actions
let subjectNames = fs.readFileSync(path.join(__dirname, '/subjects.txt'), 'utf8').split("\n");

// set the view engine to ejs
app.set('view engine', 'ejs');

app.get('/', (req, res) => {
    res.set('Cache-Control', 'public, max-age=25200');
    res.render('pages/main.ejs');
});

app.get('/about', (req, res) => {
    res.render('pages/about.ejs');
});

// ending
const server = http.listen(8080, () => {
    const host = server.address().address;
    const port = server.address().port;

    console.log(`App listening at http://localhost:${port}`);
});