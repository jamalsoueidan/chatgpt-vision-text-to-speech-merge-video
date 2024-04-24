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
      .webp({ quality: 80 })
      .toFile(outputPath)
      .catch((err) => {
        console.error("Error processing file:", file, err);
      });
  });

  await Promise.all(promises);
}
