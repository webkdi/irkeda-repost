const fs = require("fs").promises; // Use the promises API for fs
const path = require("path");
const sharp = require("sharp");

const imageName = "981103788.jpg";
const imagePath = "./downloads"; // Assuming this is the directory containing the image

async function processImage(imageName, imagePath = "./downloads") {
    try {
        const logoPath = path.join(__dirname, "../beet_logo.png"); // Correct relative path to bp_logo.png

        // Full path of the input image
        const inputImagePath = path.join(imagePath, imageName);

        // Extract the filename from the image name
        const filename = path.basename(imageName);

        // Resize the image and save it with low jpg quality
        const extension = path.extname(filename);
        const outputImagePath = path.join(imagePath, `${path.basename(filename, extension)}_resized${extension}`);

        await sharp(inputImagePath)
            .resize(1080, 1080, { fit: "inside" }) // Use fit: "contain" to keep aspect ratio within 1080x1080
            .composite([{ input: logoPath, top: 10, left: 10, height: 50 }])
            .jpeg({ quality: 50 })
            .toFile(outputImagePath);

        // // Delete the original input image
        // await fs.unlink(inputImagePath);

        // // Rename the output image to the original input image name
        // await fs.rename(outputImagePath, inputImagePath);

        console.log("Image processed and saved as:", imageName);
        return imageName;
    } catch (error) {
        console.error("Error processing the image:", error.message);
    }
}

// Call the function
processImage(imageName, imagePath)
    .then(createdFileName => console.log("Processed file:", createdFileName))
    .catch(error => console.error("Processing error:", error));

module.exports = {
    processImage,
};
