const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

class VKBot {
    constructor(postToken, imageToken, groupId) {
        this.postToken = postToken;
        this.imageToken = imageToken;
        this.groupId = groupId;
        this.version = '5.199';
    }

    async sendQueryVk(method, dataQuery, token, usePost = true) {
        dataQuery['access_token'] = token;
        dataQuery['v'] = this.version;

        const url = `https://api.vk.com/method/${method}`;
        const config = {
            method: usePost ? 'POST' : 'GET',
            url: url,
            headers: { 'Content-Type': usePost ? 'application/x-www-form-urlencoded' : undefined },
            data: usePost ? dataQuery : null,
            params: !usePost ? dataQuery : null
        };

        try {
            const response = await axios(config);
            if (response.data.error) {
                console.error(`VK API Error ${method}: ${response.data.error.error_msg}`);
                console.error(`Error Details: ${JSON.stringify(response.data.error)}`);
                return null;
            }
            console.log(method, response.data);
            return response.data;
        } catch (error) {
            console.error(`Error sending VK query: ${error}`);
            return null;
        }
    }

    async sendWallPost(message, attachments = '', token = this.postToken) {
        const dataQuery = {
            owner_id: `-${this.groupId}`, // Group ID should be negative
            from_group: 1,
            scope: "wall",
            message: message,
            attachments: attachments
        };
        return this.sendQueryVk('wall.post', dataQuery, token);
    }

    // Add the postText method here
    async postText(caption) {
        try {
            const response = await this.sendWallPost(caption);
            console.log('Post text response:', response);
            return response;
        } catch (error) {
            console.error('An error occurred while posting text:', error);
            return null;
        }
    }

    async getWallUploadServer() {
        const dataQuery = { group_id: this.groupId };
        const response = await this.sendQueryVk('photos.getWallUploadServer', dataQuery, this.imageToken, false);
        if (response && response.response && response.response.upload_url) {
            return response.response.upload_url;
        } else {
            console.error('getWallUploadServer: Error retrieving upload server URL');
            return null;
        }
    }

    async saveWallPhoto(uploadResponse) {
        if (!uploadResponse) {
            console.error('No upload response provided');
            return null;
        }

        const dataQuery = {
            server: uploadResponse.server,
            photo: uploadResponse.photo,
            hash: uploadResponse.hash,
            group_id: this.groupId
        };
        return this.sendQueryVk('photos.saveWallPhoto', dataQuery, this.imageToken, false);
    }

    async uploadPhoto(filePath, uploadUrl) {
        const form = new FormData();
        form.append('photo', fs.createReadStream(filePath));

        try {
            const uploadResponse = await axios.post(uploadUrl, form, { headers: form.getHeaders() });
            console.log("uploadPhoto:", uploadResponse.data);
            return uploadResponse.data;
        } catch (error) {
            console.error(`Error uploading photo: ${error}`);
            return null;
        }
    }

    async getVideoUploadUrl() {
        const dataQuery = {
            group_id: this.groupId,
            // wallpost: 1,
            description: "Bla Bla",
            title: "Video Title"
        };
        const response = await this.sendQueryVk('video.save', dataQuery, this.postToken, true);
        if (response && response.response && response.response.upload_url) {
            return response.response.upload_url;
        } else {
            console.error('getVideoUploadUrl: Error retrieving upload server URL');
            return null;
        }
    }

    async uploadVideo(filePath, uploadUrl) {
        const form = new FormData();
        form.append('video_file', fs.createReadStream(filePath));

        try {
            const uploadResponse = await axios.post(uploadUrl, form, { headers: form.getHeaders() });
            console.log("uploadVideo:", uploadResponse.data);
            return uploadResponse.data;
        } catch (error) {
            console.error(`Error uploading video: ${error}`);
            return null;
        }
    }

    async getVideoProcessingStatus(owner_id, video_id) {
        const dataQuery = { videos: `${owner_id}_${video_id}` };
        return this.sendQueryVk('video.get', dataQuery, this.postToken, false);
    }
}

// Global constants
const postToken = process.env.VK_TOKEN;
const imageToken = postToken;
const groupId = process.env.VK_GROUP_ID;
const vkBot = new VKBot(postToken, imageToken, groupId);

async function postImageWithMessage(imagePath, message) {
    try {
        const uploadUrl = await vkBot.getWallUploadServer();
        if (!uploadUrl) throw new Error('Failed to get upload URL');

        const uploadResponse = await vkBot.uploadPhoto(imagePath, uploadUrl);
        if (!uploadResponse) throw new Error('Failed to upload photo');

        const saveResponse = await vkBot.saveWallPhoto(uploadResponse);
        if (!saveResponse) throw new Error('Failed to save photo');

        const photo = saveResponse.response[0];
        const attachment = `photo${photo.owner_id}_${photo.id}`;

        const postResponse = await vkBot.sendWallPost(message, attachment);
        console.log('Post with photo response:', postResponse);
    } catch (error) {
        console.error('Error posting message with photo:', error);
    }
}

async function postVideoWithMessage(videoPath, message) {
    try {
        // const curlirize = await import('axios-curlirize').then(module => module.default);
        // // Initialize axios-curlirize
        // curlirize(axios);

        const uploadUrl = await vkBot.getVideoUploadUrl();
        if (!uploadUrl) throw new Error('Failed to get upload URL');

        const uploadResponse = await vkBot.uploadVideo(videoPath, uploadUrl);
        if (!uploadResponse) throw new Error('Failed to upload video');

        // let statusResponse;
        // do {
        //     await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

        //     statusResponse = await vkBot.getVideoProcessingStatus(uploadResponse.owner_id, uploadResponse.video_id);
        //     fs.writeFileSync('statusResponse.json', JSON.stringify(statusResponse, null, 2));

        //     if (statusResponse.response.items[0].restriction) {
        //         console.log(statusResponse.response.items[0].restriction.title);
        //     }
        // } while (statusResponse.response.items[0].restriction);

        const attachment = `video${uploadResponse.owner_id}_${uploadResponse.video_id}`;
        console.log("attachment:", attachment);

        const postResponse = await vkBot.sendWallPost(message, attachment);
        console.log('Post with video response:', postResponse);
    } catch (error) {
        console.error('Error posting message with video:', error);
    }
}

async function postText(caption, link) {
    try {
        // const attachment = `{link}`;
        const response = await vkBot.sendWallPost(caption, link);
        console.log('Post text response:', response);
        return response;
    } catch (error) {
        console.error('An error occurred while posting text:', error);
        return null;
    }
}

// Usage example
const imagePath = path.join(__dirname, 'image.png');
const videoPath = path.join(__dirname, 'video2.mp4');

// postImageWithMessage(imagePath, 'Post with image from Node.js!');
// postVideoWithMessage(videoPath, 'Post with video from Node.js!');

module.exports = {
    postVideoWithMessage,
    postImageWithMessage,
    postText,
};