const express = require("express");
const path = require("path");

const app = express();

app.use(express.json());

app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.post("/generate-video", (req, res) => {

  const prompt = req.body.prompt;

  res.json({
    message: "Your AI video request received: " + prompt
  });

});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("running");
});
