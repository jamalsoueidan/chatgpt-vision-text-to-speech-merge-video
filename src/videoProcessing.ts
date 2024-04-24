import ffmpegStatic from "ffmpeg-static";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import pixelmatch from "pixelmatch";
import { PNG, PNGWithMetadata } from "pngjs";

let previousFrame: PNGWithMetadata | undefined = undefined;

function compareFrames(currentFramePath: string) {
  return new Promise((resolve, reject) => {
    if (!previousFrame) {
      // If no previous frame, save the first frame and exit
      previousFrame = PNG.sync.read(fs.readFileSync(currentFramePath));
      resolve(true);
      return;
    }

    const currentFrame = PNG.sync.read(fs.readFileSync(currentFramePath));
    const { width, height } = currentFrame;
    const diff = new PNG({ width, height });

    const numDiffPixels = pixelmatch(
      previousFrame.data,
      currentFrame.data,
      diff.data,
      width,
      height,
      {
        threshold: 0.01,
        includeAA: true,
        alpha: 0,
        diffMask: true,
      }
    );
    const percentDifference = (numDiffPixels / (width * height)) * 100;
    console.log(percentDifference);
    if (percentDifference < 1) {
      fs.unlinkSync(currentFramePath);
      resolve(false);
    } else {
      previousFrame = currentFrame;
      resolve(true);
    }
  });
}

export async function videoToFrames(videoPath: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const framesDir = path.join(__dirname, "frames");
    if (fs.existsSync(framesDir)) {
      fs.rmSync(framesDir, { recursive: true, force: true });
      console.log("Existing frames directory removed.");
    }

    fs.mkdirSync(framesDir, { recursive: true });

    ffmpeg(videoPath)
      .setFfmpegPath(ffmpegStatic || "")
      .output(path.join(framesDir, "frame-%03d.png"))
      .outputOptions(["-vf fps=fps=1,scale=iw*0.5:ih*0.5"])
      .on("end", async () => {
        console.log("Frames extracted");
        const files = fs.readdirSync(framesDir);
        await Promise.all(
          files.map(async (file, index) => {
            if (index !== files.length - 1) {
              await compareFrames(path.join(framesDir, file));
            }
          })
        );
        resolve();
      })
      .on("error", (err) => {
        console.error("Error in ffmpeg process:", err.message);
        reject(err);
      })
      .run();
  });
}

export async function getVideoDuration(videoPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        resolve(metadata.format.duration || 0);
      }
    });
  });
}

export async function mergeAudioWithVideo(
  videoPath: string,
  audioPath: string,
  outputPath: string
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(videoPath)
      .input(audioPath)
      .outputOptions([
        "-c:v copy", // Copy the video codec from the original
        "-c:a aac", // Encode audio to AAC
        "-strict experimental", // Allow experimental codecs like AAC
      ])
      .save(outputPath)
      .on("end", () => {
        console.log("Audio merged with video.");
        resolve();
      })
      .on("error", (err) => {
        console.error("Error merging audio with video:", err.message);
        reject(err);
      });
  });
}
