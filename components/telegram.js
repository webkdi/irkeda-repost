const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const db = require("./database.js");

require('dotenv').config();


// Ensure the local folder exists
const downloadFolder = path.join(__dirname, '../downloads');

if (!fs.existsSync(downloadFolder)) {
    fs.mkdirSync(downloadFolder);
}

// Function to download a file
async function downloadFile(url, filename) {
    const filePath = path.join(downloadFolder, filename);
    const writer = fs.createWriteStream(filePath);
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream'
    });
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

function generateUrlFromTelegramMessage(message) {
    if (message.text || message.caption) {
        const urlRegex = /https?:\/\/[^\s)]+/g;
        const match = (message.text || message.caption).match(urlRegex);
        return match ? match[0] : null;
    }
    if (
        message.forward_from_chat &&
        (message.forward_from_chat.username === "polkpress" ||
            message.forward_from_chat.username === "InfoDefenseDEUTSCH")
    ) {
        // If the message is forwarded from the "polkpress" channel, construct the URL using the username and message_id
        return `https://t.me/${message.forward_from_chat.username}/${message.forward_from_message_id}`;
    }
    if (message.caption_entities) {
        // If the message is not forwarded from "polkpress" channel, find the URL in the caption_entities
        const captionEntities = message.caption_entities;
        if (captionEntities) {
            const urlEntity = captionEntities.find((entity) => entity.type === "url");
            if (urlEntity) {
                const url = message.caption.substring(
                    urlEntity.offset,
                    urlEntity.offset + urlEntity.length
                );
                return url;
            }
        }
    }
    // If no URL is found in the given message, return null or an appropriate value as per your requirement.
    return null;
}

async function getFilePath(file_Id, telegramBotToken) {
    const url = `https://api.telegram.org/bot${telegramBotToken}/getFile?file_id=${file_Id}`;

    try {
        const response = await axios(url);
        const result = await response.data;
        if (result.ok) {
            const file_path = result.result.file_path;
            return file_path;
        } else {
            return "error";
        }
    } catch (error) {
        if (error.response) {
            let { status, statusText } = error.response;
            console.log(file_Id, status, statusText);
            // response.status(status).send(statusText);
        } else {
            console.log(file_Id, error);
        }
    }
}

async function get_updates() {
    let now = new Date();

    var messages = [];
    var unknown = [];

    const telegramBotToken = process.env.TG_BOT_TOKEN_IRKEDA;
    const telegramAPIEndpoint = `https://api.telegram.org/bot${telegramBotToken}/getUpdates`;


    try {
        const response = await axios.get(telegramAPIEndpoint);
        const data = response.data;

        // // Store messages in a local JSON file
        // var jsonFilePath = path.join(__dirname, 'getUpdatesA.json');
        // fs.writeFileSync(jsonFilePath, JSON.stringify(data, null, 2), 'utf-8');

        if (!data.result || data.result.length === 0) {
            console.log(`${now}: No new updates. Skipped`);
            return null;
        }

        let updatesBeforeRenaming = data.result;

        // Function to rename the "message" property to "channel_post"
        function renameMessageToChannelPost(update) {
            if (update.hasOwnProperty("message")) {
                update.channel_post = update.message;
                delete update.message;
            }
            return update;
        }

        let updates = updatesBeforeRenaming.map(renameMessageToChannelPost);



        updates = updates.filter(
            (obj) =>
                obj.channel_post &&
                (obj.channel_post.chat.id === -1002215553870) //fb_ИркедА перепосты
        );

        if (updates.length === 0) {
            console.log(`${now}: No relevant updates. Skipped`);
            return null;
        }

        // // Store messages in a local JSON file
        // jsonFilePath = path.join(__dirname, 'getUpdatesB.json');
        // fs.writeFileSync(jsonFilePath, JSON.stringify(updates, null, 2), 'utf-8');

        await Promise.all(
            updates.map(async (ms) => {
                const update_id = ms.update_id;
                const content = JSON.stringify(ms.channel_post);
                const changes = await db.insertIgnore(update_id);
                if (changes > 0) {
                    console.log('Update ID inserted:', update_id);
                } else {
                    // console.log('Update ID already exists:', update_id);
                    return null; // Return null for entries to skip
                }

                if (ms.channel_post) {
                    // // Make repost
                    // const message = {
                    //     chat_id: ms.channel_post.chat.id,
                    //     message_id: ms.channel_post.message_id,
                    //     text: ms.channel_post.text,
                    //     photo: ms.channel_post.photo ? ms.channel_post.photo[0].file_id : null,
                    //     video: ms.channel_post.video ? ms.channel_post.video.file_id : null,
                    //     caption: ms.channel_post.caption
                    // };
                    // // console.log("message:", message)
                    // const targetChatId = process.env.TG_REPOST_CHANNEL_ID;
                    // await resendMessage(message, targetChatId, telegramBotToken);

                    var asset = {};
                    if (ms.channel_post.text && ms.channel_post.text.length > 0) {
                        asset.message = ms.channel_post.text;
                        asset.type = "text";
                    } else if (ms.channel_post.photo && ms.channel_post.caption) {
                        asset.files = ms.channel_post.photo;
                        asset.message = ms.channel_post.caption;
                        asset.type = "image";
                        // } else if (ms.channel_post.photo && !ms.channel_post.caption) { //image without caption
                        //   asset.files = ms.channel_post.photo;
                        //   asset.message = "";
                        //   asset.type = "image";
                    } else if (ms.channel_post.animation && ms.channel_post.animation.mime_type == "video/mp4" && ms.channel_post.caption) {
                        asset.files = ms.channel_post.animation;
                        asset.message = ms.channel_post.caption;
                        asset.type = "video";
                    } else {
                        unknown.push(ms);
                    }


                    //найти ссылку
                    const urlFound = await generateUrlFromTelegramMessage(
                        ms.channel_post
                    );
                    asset.url = urlFound;
                    // const urlShort = await url.getShortenedUrl(urlFound);
                    // if (urlFound != undefined || urlFound != null) {
                    //     asset.url = urlFound;
                    // }

                    if (Object.keys(asset).length > 0) {
                        asset.chat_id = ms.channel_post.chat.id;
                        asset.chat_name = ms.channel_post.chat.title;
                        asset.update_id = ms.update_id;
                        messages.push(asset);
                    }
                }
                messages
                    .filter((ms) => ms && ms.files)
                    .forEach((ms) => {
                        if (ms.type === "image") {
                            ms.file_fileId = ms.files[ms.files.length - 1].file_id;
                        } else if (ms.type === "video") {
                            ms.file_fileId = ms.files.file_id;
                        }
                        delete ms.files;
                    });

                const messagesWithFileId = messages.filter((message) => message.file_fileId);
                for (const message of messagesWithFileId) {
                    const fileData = await getFilePath(message.file_fileId, telegramBotToken);
                    if (typeof fileData !== "undefined" && fileData) {
                        let fileUrl = `https://api.telegram.org/file/bot${telegramBotToken}/${fileData}`;
                        // if (message.type === "image") {
                        //     let imageInstaLocalPath = await images.processImageForInstagram(
                        //         message.update_id,
                        //         fileUrl
                        //     );
                        //     imageInstaLocalPath =
                        //         "https://app.freud.online/datico-server/images/output/" +
                        //         imageInstaLocalPath;
                        //     message.file_path_local_1080 = imageInstaLocalPath;
                        // }
                        message.file_path = fileUrl;
                    } else {
                        message.file_path = "";
                    }
                }

            })
        );

        messages = messages.filter((obj) => {
            if (obj.type === "text") {
                return true; // include objects with "type" of "text"
            } else if (obj.type === "image" || obj.type === "video") {
                // return true;
                return obj.file_path ? true : false; // include objects with "type" of "image" or "video" and a "file_path" property
            } else {
                return false; // exclude objects with unrecognized "type"
            }
        });

        // Filter the messages array to include only those with update_id 981103788
        // messages = messages.filter(msg => msg.update_id === 981103790);

        await Promise.all(
            messages.map(async (msg) => {
                // If the message has a file_path, download the file
                if (msg.file_path) {
                    const extension = path.extname(msg.file_path);
                    const filename = `${msg.update_id}${extension}`;
                    try {
                        await downloadFile(msg.file_path, filename);
                        console.log(`tg_updates, file downloaded: ${filename}`);
                        msg.file_local = filename; // Add filename as file_local to messages
                    } catch (error) {
                        console.error(`Error downloading file ${filename}:`, error);
                    }
                }
            })
        );

        if (messages.length === 0) {
            console.log(`${now}: No relevant updates. Skipped`);
            return null;
        }

        // // Store messages in a local JSON file
        // jsonFilePath = path.join(__dirname, 'getUpdatesC.json');
        // fs.writeFileSync(jsonFilePath, JSON.stringify(updates, null, 2), 'utf-8');

        return messages;
    } catch (error) {
        console.error('Error fetching updates:', error);
        return null;
    }
}

// async function resendMessage(message, targetChatId, telegramBotToken) {
//     try {
//         if (message.text) {
//             await axios.post(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
//                 chat_id: targetChatId,
//                 text: message.text
//             });
//             console.log(`Text message sent to ${targetChatId}`);
//         } else if (message.photo) {
//             await axios.post(`https://api.telegram.org/bot${telegramBotToken}/sendPhoto`, {
//                 chat_id: targetChatId,
//                 photo: message.photo,
//                 caption: message.caption
//             });
//             console.log(`Photo message sent to ${targetChatId}`);
//         } else if (message.video) {
//             await axios.post(`https://api.telegram.org/bot${telegramBotToken}/sendVideo`, {
//                 chat_id: targetChatId,
//                 video: message.video,
//                 caption: message.caption
//             });
//             console.log(`Video message sent to ${targetChatId}`);
//         } else {
//             console.log('Unsupported message type');
//         }
//     } catch (error) {
//         console.error(`Error resending message:`, error);
//     }
// }

async function forwardMessage(type, message, localFilePath, targetChatId, telegramBotToken) {
    try {
        if (type == "text") {
            const res = await axios.post(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
                chat_id: targetChatId,
                text: message
            });
            console.log(`Text message sent to ${targetChatId}`);
            return res;
        } else if (type == "image") {
            // const filePath = path.join(downloadFolder, fileId);
            const filePath = localFilePath;
            const form = new FormData();
            form.append('chat_id', targetChatId);
            form.append('photo', fs.createReadStream(filePath));
            form.append('caption', message);

            const res = await axios.post(`https://api.telegram.org/bot${telegramBotToken}/sendPhoto`, form, {
                headers: form.getHeaders()
            });
            console.log(`Photo message sent to ${targetChatId}`);
            return res;
        } else if (type == "video") {
            // const filePath = path.join(downloadFolder, fileId);
            const filePath = localFilePath;
            const form = new FormData();
            form.append('chat_id', targetChatId);
            form.append('video', fs.createReadStream(filePath));
            form.append('caption', message);

            const res = await axios.post(`https://api.telegram.org/bot${telegramBotToken}/sendVideo`, form, {
                headers: form.getHeaders()
            });
            return res;
            console.log(`Video message sent to ${targetChatId}`);
        } else {
            console.log('Unsupported message type');
        }
    } catch (error) {
        console.error(`Error resending message:`, error.response.data);
        return error;
    }
}


module.exports = {
    get_updates,
    forwardMessage,
    downloadFile,
};
