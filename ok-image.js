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

async function getUploadUrl() {
    const params = {
        access_token: okAccessToken,
        application_key: okPublicKey,
        method: "photosV2.getUploadUrl",
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

async function uploadImage(uploadUrl, filePath) {
    //console.log(`Uploading image from ${filePath} to ${uploadUrl}...`);
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));

    try {
        const response = await axios.post(uploadUrl, form, { headers: form.getHeaders() });
        console.log('Upload response:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error uploading image:', error.response ? error.response.data : error.message);
        return null;
    }
}

async function commitPhoto(photoId, token) {
    const params = {
        access_token: okAccessToken,
        application_key: okPublicKey,
        method: "photosV2.commit",
        photo_id: photoId,
        token: token,
        format: "json"
    };

    const sig = crypto.createHash('md5').update(arInStr(params) + crypto.createHash('md5').update(okAccessToken + okPrivateKey).digest('hex')).digest('hex');
    params.sig = sig;

    try {
        const response = await axios.get('https://api.ok.ru/fb.do', { params });
        console.log('Commit photo response:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error committing photo:', error.response ? error.response.data : error.message);
        return null;
    }
}

async function postToGroup(photoId, caption) {
    const attachment = {
        "media": [
            {
                "type": "text",
                "text": "my text"
            },
            {
                "type": "photo",
                "list": [
                    { "id": photoId }
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

const localImagePath = path.join(__dirname, 'image.png'); // Local image file path
const caption = "Here is an image with a caption";

(async () => {
    try {
        // Step 1: Get the upload URL
        const uploadUrlResponse = await getUploadUrl();
        if (!uploadUrlResponse || !uploadUrlResponse.upload_url) {
            console.error('Failed to get upload URL');
            return;
        }

        // Step 2: Upload the image
        const uploadResponse = await uploadImage(uploadUrlResponse.upload_url, localImagePath);
        if (!uploadResponse || !uploadResponse.photos) {
            console.error('Failed to upload image');
            return;
        }

        // Extract the token from the upload response
        const photoId = Object.keys(uploadResponse.photos)[0];
        const token = uploadResponse.photos[photoId].token;
        if (!token) {
            console.error('Failed to get photo token');
            return;
        }
        console.log("photoId:", photoId)

        // Step 3: Commit the photo
        const commitResponse = await commitPhoto(photoId, token);
        if (!commitResponse || !commitResponse.photos) {
            console.error('Failed to commit photo');
            return;
        }

        // // Step 4: Post to the group
        // const assignedPhotoId = commitResponse.photos[0].assigned_photo_id;
        // await postToGroup(assignedPhotoId, caption);


        // Step 4: Post to the group
        await postToGroup(token, caption);

    } catch (error) {
        console.error('An error occurred:', error);
    }
})();
