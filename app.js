const fs = require('fs');
const path = require('path');
const tg = require("./components/telegram.js");
const vk = require("./components/vk.js");
const ok = require("./components/ok.js");
const image = require("./components/images.js");
const cron = require('node-cron');

// Define the main function
async function runTask() {
    try {

        // Get updates from Telegram
        const messages = await tg.get_updates();

        // Check if messages is null or not an array
        if (!Array.isArray(messages)) {
            if (messages === null) {
                console.log("No new updates. Skipping processing.");
                return;
            } else {
                throw new Error("Expected an array of messages, but got something else");
            }
        }

        // // Store messages in a local JSON file
        // const jsonFilePath = path.join(__dirname, 'messages.json');
        // fs.writeFileSync(jsonFilePath, JSON.stringify(messages, null, 2), 'utf-8');
        // console.log(`Messages have been stored in ${jsonFilePath}`);

        const downloadFolder = path.join(__dirname, './downloads');
        // Process each message
        for (const message of messages) {

            // add logo and resize image
            await image.processImage(message.file_local);

            const localFilePath = message.file_local ? path.join(downloadFolder, message.file_local) : null; // Adjusted to use local file path if it exists
            // console.log("localFilePath:", localFilePath);

            // repost to telegram
            const telegramBotToken = process.env.TG_BOT_TOKEN_IRKEDA;
            const targetChatId = process.env.TG_REPOST_CHANNEL_ID;
            await tg.forwardMessage(message.type, message.message, localFilePath, targetChatId, telegramBotToken);

            // repost to vk ok
            if (message.type === 'image') {
                const vkResponse = await vk.postImageWithMessage(localFilePath, message.message);
                console.log("vk.postImageWithMessage:", vkResponse);
                const okResponse = await ok.postImage(localFilePath, message.message)
                console.log("ok.postImage:", okResponse);
            } else if (message.type === 'video') {
                const vkResponse = await vk.postVideoWithMessage(localFilePath, message.message);
                console.log(vkResponse);
                const okResponse = await ok.postVideo(localFilePath, message.message);
                console.log("ok.postVideo:", okResponse);
            } else if (message.type === 'text') {
                const link = message.url ? message.url : null;
                const vkResponse = await vk.postText(message.message, link);
                console.log("vk.postText:", vkResponse);
                const okResponse = await ok.postText(message.message);
                console.log("ok.postText:", okResponse);
            }

            // Delete the local file
            fs.unlink(localFilePath, (err) => {
                if (err) {
                    console.error(`Error deleting file ${localFilePath}:`, err);
                } else {
                    console.log(`File ${localFilePath} deleted successfully.`);
                }
            });
        }
    } catch (error) {
        console.error("An error occurred:", error);
    }
}

// Schedule the task to run every hour
// cron.schedule('15 */2 * * * *', runTask);
// runTask();

// console.log('Cron job scheduled to run every hour.');

// # ┌────────────── second (optional)
// # │ ┌──────────── minute
// # │ │ ┌────────── hour
// # │ │ │ ┌──────── day of month
// # │ │ │ │ ┌────── month
// # │ │ │ │ │ ┌──── day of week
// # │ │ │ │ │ │
// # │ │ │ │ │ │
// # * * * * * *
//  '*/15 * * * * *' every 15 seconds
