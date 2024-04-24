import fs from "fs";
import OpenAI from "openai";
import path from "path";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API,
});

function encodeImageToBase64(filePath: string) {
  const fileBuffer = fs.readFileSync(filePath);
  return fileBuffer.toString("base64");
}

export async function explainFrames(videoDuration: number) {
  const directoryPath = path.join(__dirname, "frames");
  const files = fs.readdirSync(directoryPath);
  const images: Array<{
    type: string;
    image_url: {
      url: string;
    };
  }> = [];

  const keyframes = [];
  for (const file of files) {
    if (file.endsWith(".png")) {
      const filePath = path.join(directoryPath, file);
      const match = file.match(/frame-(\d{3})\.webp/);

      const indexOfFile = files.findIndex((f) => f === file) + 1;
      const numberOfSeconds = match ? parseInt(match[1], 10) : null;
      if (indexOfFile === 1) {
        keyframes.push(`first image is the starting point`);
      } else if (indexOfFile !== files.length) {
        keyframes.push(
          `image number ${indexOfFile} ends by ${numberOfSeconds} seconds in the video, write down the text that needs to be said within this period of time.`
        );
      } else {
        keyframes.push(
          `last image ends the video at ${numberOfSeconds} seconds`
        );
      }
      const base64Image = encodeImageToBase64(filePath);
      images.push({
        type: "image_url",
        image_url: { url: `data:image/png;base64,${base64Image}` },
      });
    }
  }

  const wordCount = videoDuration * 3;
  const text = `These are frames of a quick product demo walkthrough creating services (ydelser). create a short voiceover script that outline the key actions to take, that can be used along this product demo. This video is ONLY ${videoDuration} seconds long, so make sure the text (words) can be used over the video in ${videoDuration} seconds of the video. Here is overview of the images. ${keyframes.join(
    ","
  )}, Please send me answer in danish, and only the text that needs to be said, i will use your text to automatically sync text2audio`;

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
