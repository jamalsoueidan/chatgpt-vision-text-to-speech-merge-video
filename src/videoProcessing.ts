import ffmpegStatic from "ffmpeg-static";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import pixelmatch from "pixelmatch";
import { PNG, PNGWithMetadata } from "pngjs";

function renameFiles(outputDir: string, fps: number) {
  const files = fs.readdirSync(outputDir).sort();
  files.forEach((file, index) => {
    const frameNumber = index + 1;
    const second = Math.floor((frameNumber - 1) / fps);
    const frameInSecond = ((frameNumber - 1) % fps) + 1;

    const newFilename = `frame-${second
      .toString()
      .padStart(2, "0")}-${frameInSecond.toString().padStart(2, "0")}.png`;

    fs.renameSync(
      path.join(outputDir, file),
      path.join(outputDir, newFilename)
    );
  });
}

let previousFrame: PNGWithMetadata | undefined = undefined;
let previousPath = "";

function compareFrames(currentFramePath: string) {
  return new Promise((resolve, reject) => {
    if (!previousFrame) {
      previousPath = currentFramePath;
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
        threshold: 0.02,
        includeAA: true,
        alpha: 0,
        diffMask: true,
      }
    );
    const percentDifference = (numDiffPixels / (width * height)) * 100;
    if (percentDifference < 0.4) {
      fs.unlinkSync(currentFramePath);
      resolve(false);
    } else {
      previousPath = currentFramePath;
      previousFrame = currentFrame;
      resolve(true);
    }
  });
}

export async function videoToFrames(videoPath: string): Promise<void> {
  const framesDir = path.join(__dirname, "frames");
  if (fs.existsSync(framesDir)) {
    fs.rmSync(framesDir, { recursive: true, force: true });
  }

  fs.mkdirSync(framesDir, { recursive: true });

  const frameRate = 3;

  return new Promise<void>((resolve, reject) => {
    ffmpeg(videoPath)
      .setFfmpegPath(ffmpegStatic || "")
      .output(path.join(framesDir, "frame-%04d.png"))
      .outputOptions([`-vf fps=fps=${frameRate},scale=iw*0.5:ih*0.5`])
      .on("end", async () => {
        renameFiles(framesDir, frameRate);
        let files = fs.readdirSync(framesDir).sort();
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
