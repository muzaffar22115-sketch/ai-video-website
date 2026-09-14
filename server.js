const express = require("express");
const path = require("path");
const fs = require("fs");
const { Client } = require("magic-hour");

const app = express();

app.use(express.json());
app.use(express.static(__dirname));

const client = new Client({
  token: process.env.MAGIC_HOUR_API_KEY
});

const jobs = new Map();

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.post("/generate-video", async (req, res) => {
  try {
    const prompt = req.body.prompt?.trim();

    const requestedAspectRatio = req.body.aspectRatio;

    const aspectRatio =
      requestedAspectRatio === "9:16" ? "9:16" : "16:9";

    if (!prompt) {
      return res.status(400).json({
        error: "Please enter a video idea."
      });
    }

    if (!process.env.MAGIC_HOUR_API_KEY) {
      return res.status(500).json({
        error: "MAGIC_HOUR_API_KEY is missing in Render."
      });
    }

    console.log("Prompt:", prompt);
    console.log("Aspect Ratio:", aspectRatio);

    // STEP 1: Create AI image
    console.log("Generating image...");

    const imageResult =
      await client.v1.aiImageGenerator.generate(
        {
          imageCount: 1,
          aspectRatio: aspectRatio,
          style: {
            prompt: prompt
          },
          name: "AI Video Image"
        },
        {
          waitForCompletion: true,
          downloadOutputs: true,
          downloadDirectory: "/tmp"
        }
      );

    const imagePath =
      imageResult.downloadedPaths?.[0] ||
      imageResult.downloaded_paths?.[0];

    if (!imagePath) {
      throw new Error(
        "AI image was created but its file was not found."
      );
    }

    console.log("Image created:", imagePath);

    // STEP 2: Convert image to video
    console.log("Generating video...");

    const videoResult =
      await client.v1.imageToVideo.generate(
        {
          assets: {
            imageFilePath: imagePath
          },
          endSeconds: 5,
          resolution: "480p",
          name: "AI Generated Video"
        },
        {
          waitForCompletion: true,
          downloadOutputs: true,
          downloadDirectory: "/tmp"
        }
      );

    const videoPath =
      videoResult.downloadedPaths?.[0] ||
      videoResult.downloaded_paths?.[0];

    if (!videoPath) {
      throw new Error(
        "Video was created but its file was not found."
      );
    }

    // STEP 3: Save video temporarily
    const jobId = Date.now().toString();

    const finalPath = path.join(
      "/tmp",
      `video-${jobId}.mp4`
    );

    fs.copyFileSync(videoPath, finalPath);

    jobs.set(jobId, {
      filePath: finalPath
    });

    console.log("Video ready:", finalPath);

    // STEP 4: Send video URL to website
    res.json({
      status: "completed",
      jobId: jobId,
      aspectRatio: aspectRatio,
      videoUrl: `/generated/${jobId}`
    });

  } catch (error) {

    console.error("VIDEO ERROR:", error);

    res.status(500).json({
      error:
        error.message ||
        "Video generation failed."
    });
  }
});

app.get("/generated/:jobId", (req, res) => {

  const job = jobs.get(req.params.jobId);

  if (
    !job ||
    !job.filePath ||
    !fs.existsSync(job.filePath)
  ) {
    return res.status(404).send(
      "Video not found."
    );
  }

  res.sendFile(job.filePath);
});

const PORT =
  process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(
    `Server running on port ${PORT}`
  );
});
