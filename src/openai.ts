import fs from "fs";
import OpenAI from "openai";
import path from "path";

const openai = new OpenAI({
  apiKey: "sk-proj-SQCuLj9szacTTcwzBPYnT3BlbkFJo5B1FXfnPvyTzBqimJSv",
});

function encodeImageToBase64(filePath: string) {
  const fileBuffer = fs.readFileSync(filePath);
  return fileBuffer.toString("base64");
}

function numericSort(a: string, b: string) {
  const numPattern = /(\d+)-(\d+)/; // Matches two groups of digits separated by '-'

  // Extract parts
  const partsA = a.match(numPattern);
  const partsB = b.match(numPattern);

  if (!partsA || !partsB) {
    throw new Error("Error happened");
  }
  const secA = parseInt(partsA[1], 10);
  const secB = parseInt(partsB[1], 10);
  if (secA !== secB) {
    return secA - secB;
  }

  const frameA = parseInt(partsA[2], 10);
  const frameB = parseInt(partsB[2], 10);
  return frameA - frameB;
}

export async function explainFrames(
  videoDuration: number,
  additionalInput: string
) {
  const directoryPath = path.join(__dirname, "frames");
  const files = fs.readdirSync(directoryPath).sort(numericSort);
  const webpFiles = files.filter((file) => file.endsWith(".webp"));
  const images: Array<{
    type: string;
    image_url: {
      url: string;
    };
  }> = [];

  const keyframes = [];
  for (const file of webpFiles) {
    if (file.endsWith(".webp")) {
      const filePath = path.join(directoryPath, file);
      const match = file.match(/(\d+)-(\d+)/);
      const indexOfFile = webpFiles.findIndex((f) => f === file) + 1;
      const numberOfSeconds = match ? parseInt(match[1], 10) : null;
      let text;
      if (indexOfFile === 1) {
        text = `First Image is the starting point, `;
      } else if (indexOfFile !== files.length) {
        text = `image number ${indexOfFile} ends by ${numberOfSeconds} seconds in the video,`;
      } else {
        text = `last image, ${indexOfFile}, ${numberOfSeconds}.`;
      }

      keyframes.push(text);
      console.log(filePath, text);
      const base64Image = encodeImageToBase64(filePath);
      images.push({
        type: "image_url",
        image_url: { url: `data:image/png;base64,${base64Image}` },
      });
    }
  }

  const estimateWordCount = videoDuration * 2;
  const text = `These are frames of a quick product demo walkthrough. Create a short voiceover script that outline the key actions to take, that can be used along this product demo. This video is ONLY ${videoDuration} seconds long, so make sure the voice over MUST be able to be explained in less than ${estimateWordCount} words. ${additionalInput}. Requirement: Danish language.`;

  console.log(text);
  const response = await openai.chat.completions.create({
    model: "gpt-4-turbo",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text,
          },
          ...(images as any),
        ],
      },
    ],
    max_tokens: 300,
  });

  return response.choices[0].message.content;
}

export async function text2Audio(input: string) {
  const speechFile = path.join(__dirname, "speech.mp3");

  const mp3 = await openai.audio.speech.create({
    model: "tts-1",
    voice: "alloy",
    input,
  });
  console.log(speechFile);
  const buffer = Buffer.from(await mp3.arrayBuffer());
  await fs.promises.writeFile(speechFile, buffer);
}
