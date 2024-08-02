const axios = require('axios');
const https = require('https');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

let tokenCache = {
    token: null,
    expiresAt: null
};

async function getAccessToken() {
    const currentTime = Date.now();

    // Check if the token is still valid
    if (tokenCache.token && tokenCache.expiresAt > currentTime + 5 * 60 * 1000) {
        return tokenCache.token;
    }

    // If no valid token, request a new one
    const url = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';
    const clientId = process.env.GIGACHAT_CLIENT_ID;
    const clientSecret = process.env.GIGACHAT_CLIENT_SECRET;
    const authData = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const rqUID = uuidv4();
    const data = 'scope=GIGACHAT_API_PERS';

    try {
        const response = await axios.post(url, data, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${authData}`,
                'Accept': 'application/json',
                'RqUID': rqUID
            },
            httpsAgent: new https.Agent({ rejectUnauthorized: false })
        });

        // Update the cache with the new token and expiration time
        const expiresIn = 30 * 60 * 1000; // 30 minutes
        tokenCache.token = response.data.access_token;
        tokenCache.expiresAt = currentTime + expiresIn;

        return tokenCache.token;
    } catch (error) {
        console.error('Error fetching access token:', error.response ? error.response.data : error.message);
    }
}

async function generateChatResponse(token, message) {
    const url = 'https://gigachat.devices.sberbank.ru/api/v1/chat/completions';
    const data = {
        model: "GigaChat",
        messages: [
            { role: "user", content: message }
        ],
        stream: false,
        repetition_penalty: 1
    };

    try {
        const response = await axios.post(url, data, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            httpsAgent: new https.Agent({ rejectUnauthorized: false }) // Bypass SSL
        });

        const output = response.data.choices[0].message.content;
        // console.log('Response from GigaChat:', output);
        return output;
    } catch (error) {
        console.error('Error generating chat response:', error.response ? error.response.data : error.message);
    }
}

// Exported function to be used in other modules
async function getPostOutOfArticle(articleText) {
    const token = await getAccessToken();
    const message = `
    Ты копирайтер по соцсетям. Из длинного текста статьи ты пишешь короткий пост, в фривольном стиле, с емодзи и смайликами, для Телеграма. Используй простой молодежный язык. Добавляй емодзи и смайлики. Сначала напиши короткое название для поста. Потом новую стороку. Потом резюмируй эту статью в коротком посте, максимальная длина поста - 800 символов включая пробелы: 
    """
    ${articleText}
    """
    `;
    if (token) {
        const res = await generateChatResponse(token, message);
        return res;
    }
}

module.exports = { getPostOutOfArticle };
