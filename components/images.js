const fs = require("fs").promises;
const path = require("path");
const sharp = require("sharp");

const imageName = "3651513.jpg";
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

async function addTextToImage(imageName, text, imageTitle, imageFolder = "./downloads") {
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

        // Create the first SVG (Footer)
        let svgHeightFooter = 24; // Height of the footer SVG
        let fontSizeFooter = svgHeightFooter / 2;
        let svgTextFooter = `
        <svg width="${width}" height="${svgHeightFooter}">
            <rect x="0" y="0" width="100%" height="100%" fill="transparent" />
            <text x="50%" y="50%" font-size="${fontSizeFooter}" font-weight="bold" fill="white" text-anchor="middle" alignment-baseline="middle" stroke="black" stroke-width="0.1">
                ${text}
            </text>
        </svg>
        `;
        let textImageBufferFooter = Buffer.from(svgTextFooter, 'utf-8');
        let topPositionFooter = height - svgHeightFooter - 4; // Position the footer SVG near the bottom


        // Create the second SVG (Title)
        let svgHeightTitle = 200; // Height of the title SVG
        let fontSizeTitle = Math.min(width / imageTitle.length * 1.8, svgHeightTitle / 1.8); // Adjust font size based on image width
        let svgTextTitle = `
        <svg width="${width}" height="${svgHeightTitle}">
            <defs>
                <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feOffset result="offOut" in="SourceAlpha" dx="3" dy="3" />
                    <feGaussianBlur result="blurOut" in="offOut" stdDeviation="3" />
                    <feBlend in="SourceGraphic" in2="blurOut" mode="normal" />
                    <feComponentTransfer>
                        <feFuncA type="linear" slope="0.5" />
                    </feComponentTransfer>
                    <feMerge>
                        <feMergeNode in="blurOut" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>
            <rect x="0" y="0" width="100%" height="100%" fill="transparent" />
            <text x="50%" y="50%" font-size="${fontSizeTitle}" font-family="cursive, 'Comic Sans MS', 'URW Chancery L', sans-serif" font-weight="bold" fill="white" text-anchor="middle" alignment-baseline="middle" stroke="#6B072A" stroke-width="0.5" filter="url(#shadow)">
                ${imageTitle}
            </text>
        </svg>
        `;
        let topPositionTitle = (height - svgHeightTitle) / 2 // Position the title SVG at the top
        let textImageBufferTitle = Buffer.from(svgTextTitle, 'utf-8');

        // Composite both SVGs onto the image
        await image
            .composite([
                { input: textImageBufferFooter, top: topPositionFooter, left: 0 },
                { input: textImageBufferTitle, top: topPositionTitle, left: 0 }
            ])
            .toFile(outputImagePath);

        console.log('Image saved with text added:', outputImagePath);
        return outputImage;
    } catch (error) {
        console.error('Error adding text to image:', error);
    }
}

// addTextToImage('3651513.jpg', 'Unsplash.com', 'Отказ от сахара - путь к здоровью');

// processImage(imageName, imagePath)
//     .then(createdFileName => console.log("Processed file:", createdFileName))
//     .catch(error => console.error("Processing error:", error));

module.exports = {
    processImage,
    addTextToImage,
};
