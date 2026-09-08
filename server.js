app.use(express.json());

app.post("/generate-video", (req, res) => {

  const prompt = req.body.prompt;

  res.json({
    message: "Your AI video request received: " + prompt
  });

});
