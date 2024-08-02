const fs = require("fs").promises;
const path = require("path");
const sharp = require("sharp");

const imageName = "981103788.jpg";
const imagePath = "./downloads";

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function processImage(imageName, imagePath = "./downloads") {
    try {
        const logoPath = path.join(__dirname, "../beet_logo.png");

        const inputImagePath = path.join(imagePath, imageName);
        const filename = path.basename(imageName);
        const extension = path.extname(filename);
        const outputImagePath = path.join(imagePath, `${path.basename(filename, extension)}_resized${extension}`);

        await sharp(inputImagePath)
            .resize(1080, 1080, { fit: "inside" })
            .composite([{ input: logoPath, top: 10, left: 10, height: 50 }])
            .jpeg({ quality: 50 })
            .toFile(outputImagePath);

        await fs.rename(outputImagePath, inputImagePath);

        console.log("Image processed and saved as:", imageName);
        return imageName;
    } catch (error) {
        console.error("Error processing the image:", error.message);
    }
}

async function addTextToImage(imageName, text, imageFolder = "./downloads") {
    try {

        const imagePath = path.join(imageFolder, imageName);
        // Load the original image
        const image = sharp(imagePath);

        const filename = path.basename(imageName);
        const extension = path.extname(filename);
        const outputImage = `${path.basename(filename, extension)}_branded${extension}`;
        const outputImagePath = path.join(imageFolder, outputImage);


        // Get the metadata of the original image
        const metadata = await image.metadata();
        const { width, height } = metadata;

        // Create an SVG image with the text
        const svgHeight = 24; // Adjust this if you change the SVG's height
        const fontSize = svgHeight / 2;
        const svgText = `
            <svg width="${width}" height="${svgHeight}">
                <rect x="0" y="0" width="100%" height="100%" fill="transparent" />
                <text x="50%" y="50%" font-size="${fontSize}" font-weight="bold" fill="white" text-anchor="middle" alignment-baseline="middle" stroke="black" stroke-width="0.1">
                    ${text}
                </text>
            </svg>`;
        // Convert the SVG to a Buffer
        const textImage = Buffer.from(svgText);

        // Calculate the top position to place the SVG 4px above the bottom
        const topPosition = height - svgHeight - 0;
        await image
            // .composite([{ input: textImage, blend: 'over' }])
            .composite([{ input: textImage, top: topPosition, left: 0 }])
            .toFile(outputImagePath);

        // await fs.rename(outputImagePath, imagePath);

        console.log('Image saved with text added:', imagePath);
        return outputImage;
    } catch (error) {
        console.error('Error adding text to image:', error);
    }
}
// addTextToImage('3595213.jpg', 'This is the added text');


// processImage(imageName, imagePath)
//     .then(createdFileName => console.log("Processed file:", createdFileName))
//     .catch(error => console.error("Processing error:", error));

module.exports = {
    processImage,
    addTextToImage,
};
