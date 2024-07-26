const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

require('dotenv').config();

const okAccessToken = process.env.OK_ACCESS_TOKEN; // Наш вечный токен
const okPrivateKey = process.env.OK_PRIVATE_KEY; // Секретный ключ приложения
const okPublicKey = process.env.OK_PUBLIC_KEY; // Публичный ключ приложения

function arInStr(array) {
    const keys = Object.keys(array).sort();
    let string = '';
    keys.forEach(key => {
        const val = array[key];
        if (Array.isArray(val)) {
            string += `${key}=${arInStr(val)}`;
        } else {
            string += `${key}=${val}`;
        }
    });
    return string;
}

async function getVideoUploadUrl() {
    const params = {
        access_token: okAccessToken,
        application_key: okPublicKey,
        method: "video.getUploadUrl",
        gid: "70000006994251", // Group ID
        format: "json"
    };

    const sig = crypto.createHash('md5').update(arInStr(params) + crypto.createHash('md5').update(okAccessToken + okPrivateKey).digest('hex')).digest('hex');
    params.sig = sig;

    try {
        const response = await axios.get('https://api.ok.ru/fb.do', { params });
        console.log('Upload URL response:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error getting upload URL:', error.response ? error.response.data : error.message);
        return null;
    }
}

async function uploadVideo(uploadUrl, filePath) {
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));

    try {
        const response = await axios.post(uploadUrl, form, { headers: form.getHeaders() });
        console.log('Upload response:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error uploading video:', error.response ? error.response.data : error.message);
        return null;
    }
}

async function commitVideo(videoId, token) {
    const params = {
        access_token: okAccessToken,
        application_key: okPublicKey,
        method: "video.commit",
        video_id: videoId,
        token: token,
        format: "json"
    };

    const sig = crypto.createHash('md5').update(arInStr(params) + crypto.createHash('md5').update(okAccessToken + okPrivateKey).digest('hex')).digest('hex');
    params.sig = sig;

    try {
        const response = await axios.get('https://api.ok.ru/fb.do', { params });
        console.log('Commit video response:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error committing video:', error.response ? error.response.data : error.message);
        return null;
    }
}

async function postToGroup(videoId, caption) {
    const attachment = {
        "media": [
            {
                "type": "text",
                "text": "my text"
            },
            {
                "type": "video",
                "list": [
                    { "id": videoId }
                ]
            }
        ]
    };

    const params = {
        application_key: okPublicKey,
        method: "mediatopic.post",
        gid: "70000006994251", // Group ID
        type: "GROUP_THEME",
        attachment: JSON.stringify(attachment),
        format: "json",
        access_token: okAccessToken,
        message: caption
    };

    const sig = crypto.createHash('md5').update(arInStr(params) + crypto.createHash('md5').update(okAccessToken + okPrivateKey).digest('hex')).digest('hex');
    params.sig = sig;

    try {
        const result = await axios.post("https://api.ok.ru/fb.do", new URLSearchParams(params));
        console.log('Post to group response:', result.data);
        if (result.data && result.data.error_code === 5000) {
            const retryResult = await axios.post("https://api.ok.ru/fb.do", new URLSearchParams(params));
            console.log('Retry result:', retryResult.data);
        }
    } catch (error) {
        console.error('Error posting to group:', error.response ? error.response.data : error.message);
    }
}

const localVideoPath = path.join(__dirname, 'video.mp4'); // Local video file path
const caption = "Here is a video with a caption";

(async () => {
    try {
        // Step 1: Get the upload URL
        const uploadUrlResponse = await getVideoUploadUrl();
        if (!uploadUrlResponse || !uploadUrlResponse.upload_url) {
            console.error('Failed to get upload URL');
            return;
        }

        // Step 2: Upload the video
        const uploadResponse = await uploadVideo(uploadUrlResponse.upload_url, localVideoPath);
        if (!uploadResponse || !uploadResponse.video_id) {
            console.error('Failed to upload video');
            return;
        }

        // Extract the token from the upload response
        const videoId = uploadResponse.video_id;
        const token = uploadResponse.token;
        if (!token) {
            console.error('Failed to get video token');
            return;
        }
        console.log("videoId:", videoId)

        // Step 3: Commit the video
        const commitResponse = await commitVideo(videoId, token);
        if (!commitResponse || !commitResponse.video_id) {
            console.error('Failed to commit video');
            return;
        }

        // Step 4: Post to the group
        await postToGroup(videoId, caption);

    } catch (error) {
        console.error('An error occurred:', error);
    }
})();
