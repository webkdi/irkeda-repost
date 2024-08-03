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
        // console.log('Upload URL response:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error getting upload URL:', error.response ? error.response.data : error.message);
        return null;
    }
}

async function uploadImage(uploadUrl, filePath) {
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));

    try {
        const response = await axios.post(uploadUrl, form, { headers: form.getHeaders() });
        // console.log('Upload response:', response.data);
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
        // console.log('Commit photo response:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error committing photo:', error.response ? error.response.data : error.message);
        return null;
    }
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

async function postToGroup(mediaId, caption = "dummy text", mediaType) {
    const attachment = {
        "media": [
            {
                "type": "text",
                "text": caption
            }
        ]
    };

    if (mediaType === 'photo' || mediaType === 'video') {
        attachment.media.push({
            "type": mediaType,
            "list": [
                { "id": mediaId }
            ]
        });
    }

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
        // console.log('OK post to group response:', result.data);
        if (result.data && result.data.error_code === 5000) {
            const retryResult = await axios.post("https://api.ok.ru/fb.do", new URLSearchParams(params));
            console.log('Retry result:', retryResult.data);
        }
        return result.data;
    } catch (error) {
        console.error('Error posting to group:', error.response ? error.response.data : error.message);
    }
}

const localImagePath = path.join(__dirname, 'image.png'); // Local image file path
const localVideoPath = path.join(__dirname, 'video.mp4'); // Local video file path
const caption = "Here is some text";

// async function postImage(localImagePath, caption) {
//     try {
//         const uploadUrlResponse = await getUploadUrl();
//         if (uploadUrlResponse && uploadUrlResponse.upload_url) {
//             const uploadResponse = await uploadImage(uploadUrlResponse.upload_url, localImagePath);
//             if (uploadResponse && uploadResponse.photos) {
//                 const photoId = Object.keys(uploadResponse.photos)[0];
//                 const photoToken = uploadResponse.photos[photoId].token;
//                 if (photoToken) {
//                     const commitResponse = await commitPhoto(photoId, photoToken);
//                     if (commitResponse && commitResponse.photos) {
//                         await postToGroup(photoToken, caption, 'photo');
//                     }
//                 }
//             }
//         }
//     } catch (error) {
//         console.error('An error occurred while posting image:', error);
//     }
// }

async function postImage(localImagePath, caption) {
    try {
        // Step 1: Get the upload URL
        const uploadUrlResponse = await getUploadUrl();
        if (!uploadUrlResponse || !uploadUrlResponse.upload_url) {
            throw new Error('Failed to get upload URL');
        }

        // Step 2: Upload the image
        const uploadResponse = await uploadImage(uploadUrlResponse.upload_url, localImagePath);
        if (!uploadResponse || !uploadResponse.photos) {
            throw new Error('Failed to upload image');
        }

        const photoId = Object.keys(uploadResponse.photos)[0];
        const photoToken = uploadResponse.photos[photoId].token;
        if (!photoToken) {
            throw new Error('Failed to get photo token');
        }

        // Step 3: Commit the photo
        const commitResponse = await commitPhoto(photoId, photoToken);
        if (!commitResponse || !commitResponse.photos) {
            throw new Error('Failed to commit photo');
        }

        // Step 4: Post to the group
        const postResponse = await postToGroup(photoToken, caption, 'photo');
        if (!postResponse) {
            throw new Error('Failed to post image to the group');
        }

        // Return the final result of the post operation
        return {
            success: true,
            photoId: photoId,
            photoToken: photoToken,
            commitResponse: JSON.stringify(commitResponse, null, 2),
            postResponse: postResponse
        };
    } catch (error) {
        console.error('An error occurred while posting image:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}


async function postVideo(localVideoPath, caption) {
    try {
        const uploadUrlResponse = await getVideoUploadUrl();
        if (uploadUrlResponse && uploadUrlResponse.upload_url) {
            const uploadResponse = await uploadVideo(uploadUrlResponse.upload_url, localVideoPath);
            if (uploadResponse && uploadResponse.video_id) {
                const videoId = uploadResponse.video_id;
                const videoToken = uploadResponse.token;
                if (videoToken) {
                    const commitResponse = await commitVideo(videoId, videoToken);
                    if (commitResponse && commitResponse.video_id) {
                        await postToGroup(videoId, caption, 'video');
                    }
                }
            }
        }
    } catch (error) {
        console.error('An error occurred while posting video:', error);
    }
}

async function postText(caption) {
    try {
        const res = await postToGroup(null, caption, 'text');
        return res;
    } catch (error) {
        console.error('An error occurred while posting text:', error);
    }
}

// (async () => {
//     const test = await postText("Какой-то текст");
//     console.log("test:", test);
// })();

module.exports = {
    postImage,
    postVideo,
    postText,
};
