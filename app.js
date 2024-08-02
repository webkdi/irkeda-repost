const fs = require('fs');
const path = require('path');
const tg = require("./components/telegram.js");
const vk = require("./components/vk.js");
const ok = require("./components/ok.js");
const image = require("./components/images.js");
const mailru = require("./components/parse-health-mail-ru.js");
const cron = require('node-cron');

const downloadFolderForImages = './downloads';

async function deleteAllFilesInFolder() {
    const folderPath = path.join(__dirname, downloadFolderForImages);
    fs.readdir(folderPath, (err, files) => {
        if (err) {
            console.error(`Unable to scan directory: ${err}`);
            return;
        }

        files.forEach((file) => {
            const filePath = path.join(folderPath, file);
            fs.unlink(filePath, (err) => {
                if (err) {
                    console.error(`Error deleting file: ${filePath}, ${err}`);
                } else {
                    console.log(`Deleted file: ${filePath}`);
                }
            });
        });
    });
}

async function postMessages(messages) {

    // Ensure messages is an array before proceeding
    if (!Array.isArray(messages)) {
        console.error('Error: messages is not an array');
        return;
    }

    const downloadFolder = path.join(__dirname, downloadFolderForImages);

    // Process each message
    for (const message of messages) {
        console.log("update_id", message.update_id)

        // add logo and resize image
        if (message.type === 'image') {
            await image.processImage(message.file_local);
        }

        const localFilePath = message.file_local ? path.join(downloadFolder, message.file_local) : null; // Adjusted to use local file path if it exists
        // console.log("localFilePath:", localFilePath);

        // repost to telegram
        const telegramBotToken = process.env.TG_BOT_TOKEN_IRKEDA;
        const targetChatId = process.env.TG_REPOST_CHANNEL_ID;
        await tg.forwardMessage(message.type, message.message, localFilePath, targetChatId, telegramBotToken);


        //(de)reactivate vkok for test purposes
        repost_vkok = true;
        // repost to vk ok
        if (message.type === 'image' && repost_vkok) {
            const vkResponse = await vk.postImageWithMessage(localFilePath, message.message);
            console.log("vk.postImageWithMessage:", vkResponse);
            const okResponse = await ok.postImage(localFilePath, message.message);
            console.log("ok.postImage:", okResponse);
        } else if (message.type === 'video' && repost_vkok) {
            const vkResponse = await vk.postVideoWithMessage(localFilePath, message.message);
            console.log("vk.postVideoWithMessage:", vkResponse);
            const okResponse = await ok.postVideo(localFilePath, message.message);
            console.log("ok.postVideo:", okResponse);
        } else if (message.type === 'text' && repost_vkok) {
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

    return;
}

// Define the main function
async function runTask() {
    try {
        console.log('Task started at', new Date().toISOString()); // Log the start time

        // structure of minimum messages needed
        // messages = { 
        //     "type": "text" | "image" | "video",
        //     "message": "string", 
        //     "file_local": "string"
        // }

        // Get updates from Telegram
        const messagesFromTg = await tg.get_updates();
        if (messagesFromTg === null) {
            console.log("No new updates. Skipping processing.");
        } else {
            await postMessages(messagesFromTg);
        }

        // Get updates from Telegram
        const messagesFromMailRu = await mailru.fetchAndParse();
        if (messagesFromMailRu === null) {
            console.log("No new updates from messagesFromMailRu. Skipping processing.");
            return;
        } else {
            await postMessages(messagesFromMailRu);
        }

        // clean download
        await deleteAllFilesInFolder();
        console.log('Task completed at', new Date().toISOString()); // Log the completion time

        return;
    } catch (error) {
        console.error("runTask error:", error);
    }
}

// Schedule the task to run every hour
cron.schedule('15 */5 * * * *', runTask);
console.log('Cron job scheduled to run every 2 minutes at the 15th second.'); // Log when the cron job is scheduled
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
