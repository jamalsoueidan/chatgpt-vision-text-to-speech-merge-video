import dotenv from "dotenv";
import path from "path";

import { explainFrames, text2Audio } from "./openai";
import { reduceImagesFilesize } from "./reduceImagesFilesize";
import {
  getVideoDuration,
  mergeAudioWithVideo,
  videoToFrames,
} from "./videoProcessing";

dotenv.config();

let text = null;
async function processVideo(videoPath: string) {
  await videoToFrames(videoPath);
  console.log("picked keyframes from the video");
  await reduceImagesFilesize(
    path.join(__dirname, "frames"),
    path.join(__dirname, "frames")
  );
  console.log("images compromised!");
  const duration = await getVideoDuration(videoPath);
  console.log("video duration", duration);
  text = await explainFrames(
    duration,
    "Information about this product: This is a beauty platform, where users can sell treatments on their profil page as a beauty professional, before they can do that they need to add location, schedule and services."
  );
  if (text) {
    console.log("video text:", text);
    await text2Audio(text);
    const audioPath = path.join(__dirname, "speech.mp3");
    const outputPath = path.join(__dirname, "video_audio.mp4");

    await mergeAudioWithVideo(videoPath, audioPath, outputPath)
      .then(() => {
        console.log("Video with audio merged successfully.");
      })
      .catch((error) => {
        console.error("Error merging audio with video:", error);
      });
  }
  console.log("Video processing complete.");
}

const videoPath = process.argv[2];
processVideo(videoPath);
