const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();

app.use(express.json());
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const jobs = new Map();

app.post("/generate-video", async (req, res) => {
  try {
    const prompt = req.body.prompt;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({
        error: "Please enter a video prompt."
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is not set in Render."
      });
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          instances: [
            {
              prompt: prompt.trim()
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || "Video generation failed."
      });
    }

    const jobId = Date.now().toString();

    jobs.set(jobId, {
      operation: data.name
    });

    res.json({
      jobId,
      status: "processing"
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Server error: " + error.message
    });
  }
});

app.get("/video-status/:jobId", async (req, res) => {
  try {
    const job = jobs.get(req.params.jobId);

    if (!job) {
      return res.status(404).json({
        error: "Job not found."
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/" +
        job.operation,
      {
        headers: {
          "x-goog-api-key": apiKey
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || "Status check failed."
      });
    }

    if (!data.done) {
      return res.json({
        status: "processing"
      });
    }

    const videoUri =
      data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;

    if (!videoUri) {
      return res.status(500).json({
        error: "Video was generated but video URL was not found."
      });
    }

    const videoResponse = await fetch(videoUri, {
      headers: {
        "x-goog-api-key": apiKey
      }
    });

    if (!videoResponse.ok) {
      return res.status(500).json({
        error: "Could not download generated video."
      });
    }

    const buffer = Buffer.from(await videoResponse.arrayBuffer());

    const fileName = `video-${req.params.jobId}.mp4`;
    const filePath = path.join("/tmp", fileName);

    fs.writeFileSync(filePath, buffer);

    jobs.get(req.params.jobId).filePath = filePath;

    res.json({
      status: "completed",
      videoUrl: `/generated/${req.params.jobId}`
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Status error: " + error.message
    });
  }
});

app.get("/generated/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);

  if (!job || !job.filePath || !fs.existsSync(job.filePath)) {
    return res.status(404).send("Video not found.");
  }

  res.sendFile(job.filePath);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
