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

async function getVideoUploadUrl(fileName, fileSize) {
    // Construct the parameters including file_name and file_size
    const params = {
        access_token: okAccessToken,
        application_key: okPublicKey,
        method: "video.getUploadUrl",
        gid: "70000006994251", // Group ID
        file_name: fileName,   // Required parameter
        file_size: fileSize,   // Required parameter
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

        // Check if the upload was successful
        if (response.status === 200) {
            console.log('Video uploaded successfully:', response.status);
            return response.data; // Return the response data if needed for further processing
        } else {
            throw new Error(`Upload failed with status: ${response.status}`);
        }
    } catch (error) {
        // Log detailed error information
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
        "media": []
    };

    // Add text to the attachment if caption is provided
    if (caption) {
        attachment.media.push({
            "type": "text",
            "text": caption
        });
    }

    // // Add the media (video or photo) to the attachment
    // if (mediaType === 'photo' || mediaType === 'video') {
    //     attachment.media.push({
    //         "type": mediaType,
    //         "list": [
    //             { "id": mediaId.toString() }  // Ensure the ID is a string
    //         ]
    //     });
    // }

    // Add the media (video or photo) to the attachment
    if (mediaType === 'photo') {
        attachment.media.push({
            "type": "photo",
            "list": [{ "id": mediaId.toString() }]
        });
    } else if (mediaType === 'video') {
        attachment.media.push({
            "type": "movie",
            "list": [{ "id": mediaId.toString() }]
        });
    }

    const params = {
        application_key: okPublicKey,
        method: "mediatopic.post",
        gid: "70000006994251", // Group ID
        type: "GROUP_THEME",
        attachment: JSON.stringify(attachment),  // Convert the attachment to a JSON string
        format: "json",
        access_token: okAccessToken,
        message: caption
    };

    // Generate signature
    const sig = crypto.createHash('md5')
        .update(arInStr(params) + crypto.createHash('md5').update(okAccessToken + okPrivateKey).digest('hex'))
        .digest('hex');
    params.sig = sig;

    try {
        // Post the mediatopic
        const result = await axios.post("https://api.ok.ru/fb.do", new URLSearchParams(params));
        console.log('OK post to group response:', result.data);

        if (result.data && result.data.error_code) {
            throw new Error(`Failed to post to group, error_code: ${result.data.error_code}, error_msg: ${result.data.error_msg}`);
        }

        return result.data;
    } catch (error) {
        console.error('Error posting to group:', error.response ? error.response.data : error.message);
        return null;
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
        // Extract file name and file size from the local file path
        const fileName = path.basename(localVideoPath);
        const fileSize = fs.statSync(localVideoPath).size;

        // Step 1: Get the upload URL
        let uploadUrlResponse;
        try {
            uploadUrlResponse = await getVideoUploadUrl(fileName, fileSize);
            if (!uploadUrlResponse || !uploadUrlResponse.upload_url) {
                throw new Error('Failed to get upload URL');
            }
        } catch (error) {
            throw new Error(`Step 1 (Get Upload URL) Error: ${error.message}`);
        }

        // Step 2: Upload the video
        let uploadResponse;
        try {
            uploadResponse = await uploadVideo(uploadUrlResponse.upload_url, localVideoPath);
            if (!uploadResponse) {
                throw new Error('Failed to upload video');
            }

        } catch (error) {
            throw new Error(`Step 2 (Upload Video) Error: ${error.message}`);
        }

        // Step 3: Update the video information
        const videoId = uploadUrlResponse.video_id;
        let updateResponse;
        try {
            const params = {
                access_token: okAccessToken,
                application_key: okPublicKey,
                method: "video.update",
                vid: videoId,  // Correct parameter name for video ID
                title: caption,  // Assuming the caption is the title of the video
                // title: "🥦🍅🥑🍇🍓🍎🍉🥕🍠🌽🍊🍍🍒🍆🥒🥝🍌🍋🍏🥥🥬",
                format: "json"
            };

            const sig = crypto.createHash('md5')
                .update(arInStr(params) + crypto.createHash('md5').update(okAccessToken + okPrivateKey).digest('hex'))
                .digest('hex');
            params.sig = sig;

            // Perform the request using GET
            updateResponse = await axios.get('https://api.ok.ru/fb.do', { params });

            console.log('Update Response Status:', updateResponse.status); // Log the response status

            if (updateResponse.status === 200 && !updateResponse.data) {
                console.log('Video info updated successfully (empty response indicates success)');
            } else if (updateResponse.data && updateResponse.data.error_code) {
                throw new Error(`Failed to update video info, error_code: ${updateResponse.data.error_code}, error_msg: ${updateResponse.data.error_msg}`);
            }

        } catch (error) {
            console.error('Step 3 (Update Video Info) Error:');
            if (error.response) {
                console.error('Response status:', error.response.status);
                console.error('Response data:', error.response.data);
                console.error('Response headers:', error.response.headers);
            } else if (error.request) {
                console.error('No response received:', error.request);
            } else {
                console.error('Error message:', error.message);
            }
            console.error('Error config:', error.config);
            throw new Error(`Step 3 (Update Video Info) Error: ${error.message}`);
        }


        // Step 4: Post to the group
        try {
            const postResponse = await postToGroup(videoId, caption, 'video');
            if (!postResponse) {
                throw new Error('Failed to post video to the group');
            }
            return postResponse;
        } catch (error) {
            throw new Error(`Step 4 (Post to Group) Error: ${error.message}`);
        }

    } catch (error) {
        console.error('An error occurred while posting video:', error.message);
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
