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

// processImage(imageName, imagePath)
//     .then(createdFileName => console.log("Processed file:", createdFileName))
//     .catch(error => console.error("Processing error:", error));

module.exports = {
    processImage,
};
