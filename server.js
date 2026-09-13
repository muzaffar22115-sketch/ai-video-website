const express = require("express");
const path = require("path");
const fs = require("fs");
const { Client } = require("magic-hour");

const app = express();

app.use(express.json());
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const jobs = new Map();

app.post("/generate-video", async (req, res) => {
  try {
    const prompt = req.body.prompt?.trim();

    if (!prompt) {
      return res.status(400).json({
        error: "Please enter a video idea."
      });
    }

    if (!process.env.MAGIC_HOUR_API_KEY) {
      return res.status(500).json({
        error: "MAGIC_HOUR_API_KEY is not set in Render."
      });
    }

    const client = new Client({
      token: process.env.MAGIC_HOUR_API_KEY
    });

    const jobId = Date.now().toString();

    jobs.set(jobId, {
      status: "processing"
    });

    res.json({
      jobId,
      status: "processing"
    });

    try {
      const imageResult =
        await client.v1.ai_image_generator.generate({
          image_count: 1,
          style: {
            prompt: prompt,
            tool: "ai-image-generator"
          },
          aspect_ratio: "16:9",
          name: "AI Video Image",
          wait_for_completion: true,
          download_outputs: true,
          download_directory: "/tmp"
        });

      const imagePath = imageResult.downloaded_paths?.[0];

      if (!imagePath) {
        throw new Error("AI image was not created.");
      }

      const videoResult =
        await client.v1.image_to_video.generate({
          assets: {
            image_file_path: imagePath
          },
          style: {
            prompt: "Smooth natural cinematic movement based on the scene."
          },
          end_seconds: 3,
          resolution: "480p",
          name: "AI Generated Video",
          wait_for_completion: true,
          download_outputs: true,
          download_directory: "/tmp"
        });

      const videoPath = videoResult.downloaded_paths?.[0];

      if (!videoPath) {
        throw new Error("AI video was not created.");
      }

      jobs.set(jobId, {
        status: "completed",
        filePath: videoPath
      });

      console.log("Video completed:", videoPath);

    } catch (error) {
      console.error("Magic Hour error:", error);

      jobs.set(jobId, {
        status: "failed",
        error: error.message
      });
    }

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Server error: " + error.message
    });
  }
});

app.get("/video-status/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);

  if (!job) {
    return res.status(404).json({
      error: "Job not found."
    });
  }

  if (job.status === "processing") {
    return res.json({
      status: "processing"
    });
  }

  if (job.status === "failed") {
    return res.status(500).json({
      status: "failed",
      error: job.error
    });
  }

  return res.json({
    status: "completed",
    videoUrl: `/generated/${req.params.jobId}`
  });
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
