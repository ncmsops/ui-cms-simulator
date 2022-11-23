const express = require('express');
const path = require('path');
const app = express();
const port = 3000;
app.use('/vendors', express.static(path.join(__dirname, 'vendors')));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname, '/index.html'));
  });

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});