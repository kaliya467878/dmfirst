const { Jimp } = require('jimp');
const path = require('path');

const convertIcons = async () => {
  console.log("Starting app icon PNG conversion...");
  const srcPath = path.join(__dirname, 'public', 'icon-512.jpg');
  const dest192 = path.join(__dirname, 'public', 'icon-192.png');
  const dest512 = path.join(__dirname, 'public', 'icon-512.png');

  try {
    // Read the source image using Jimp
    const image = await Jimp.read(srcPath);

    // 1. Create the 512x512 PNG
    console.log("Generating 512x512 PNG icon...");
    const img512 = image.clone().resize({ w: 512, h: 512 });
    await img512.write(dest512);
    console.log("Successfully created public/icon-512.png");

    // 2. Create the 192x192 PNG
    console.log("Generating 192x192 PNG icon...");
    const img192 = image.clone().resize({ w: 192, h: 192 });
    await img192.write(dest192);
    console.log("Successfully created public/icon-192.png");

    console.log("App icon PNG conversion completed successfully!");
  } catch (err) {
    console.error("Error during icon conversion:", err);
  }
};

convertIcons();
