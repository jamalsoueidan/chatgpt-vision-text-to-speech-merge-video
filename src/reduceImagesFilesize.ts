import fs from "fs";
import path from "path";
import sharp from "sharp";

export async function reduceImagesFilesize(
  directoryPath: string,
  outputDirectory: string
): Promise<void> {
  if (!fs.existsSync(outputDirectory)) {
    fs.mkdirSync(outputDirectory, { recursive: true });
  }

  const files = fs.readdirSync(directoryPath);

  const promises = files.map((file) => {
    const inputPath = path.join(directoryPath, file);
    const outputPath = path.join(
      outputDirectory,
      file.replace(/\.[^/.]+$/, ".webp")
    );

    return sharp(inputPath)
      .metadata()
      .then((metadata) => {
        const width = metadata.width ? Math.round(metadata.width * 0.65) : 200;
        const height = metadata.height
          ? Math.round(metadata.height * 0.65)
          : 200;
        return sharp(inputPath)
          .resize({ width, height })
          .webp({ quality: 80 })
          .toFile(outputPath);
      });
  });

  try {
    await Promise.all(promises);
    console.log("All images processed successfully.");
  } catch (err) {
    console.error("An error occurred while processing images:", err);
  }
}
