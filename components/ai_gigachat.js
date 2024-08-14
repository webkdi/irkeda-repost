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

async function generateChatResponse(token, messages) {
    const url = 'https://gigachat.devices.sberbank.ru/api/v1/chat/completions';
    const data = {
        model: "GigaChat",
        messages: messages,
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
        return output;
    } catch (error) {
        console.error('Error generating chat response:', error.response ? error.response.data : error.message);
    }
}

// Function to build a role-based message array for GigaChat
function buildMessages(articleText) {
    const systemMessage = {
        role: "system",
        content: 'Ты копирайтер по соцсетям. Тебе будет дан [ТЕКСТ]. Из [ТЕКСТ] напиши короткий пост для Телеграма. Используй простой молодежный язык. Добавляй немного емодзи и смайликов. Пост не должен превышать 900 символов, включая пробелы. Сначала напиши короткий красочный заголовок для поста. Потом резюмируй [ТЕКСТ] в 2-3 абзацах. НЕ добавляй ковычки для названия и основного теста. НЕ пиши пост только из емодзи. Примеры: [ТЕКСТ] """Ученые назвали продукт, помогающий бороться с болезнью Паркинсона. Его стоит добавить в рацион. Ученые из Университета Осаки в Японии обнаружили, что антиоксиданты в составе бурых морских водорослей могут защищать нейроны от повреждений при болезни Паркинсона. Результаты исследования опубликованы в журнале Nutrients. Ученые объяснили, что болезнь Паркинсона вызывается повреждением нейронов из-за чрезмерной выработки активных форм кислорода, известных как свободные радикалы (СР). Накапливаясь, СР вызывают прямое окислительное повреждение нуклеиновых кислот и белков. СР также индуцируют реакции белков с другими компонентами клетки, вызывая их расщепление и нарушение функций. Многочисленные исследования показали, что действие свободных радикалов можно нейтрализовать антиоксидантами — растительными полезными веществами. В рамках новой работы ученые решили проверить, могут ли полифенолы (разновидность антиоксидантов), содержащиеся в бурых морских водорослях Ecklonia cava (Эклония Кава), бороться с болезнью Паркинсона. Для этого они провели эксперимент на мышах. Грызунам с этим заболеванием перорально давали антиоксиданты из водорослей ежедневно в течение одной недели. Результатом стало улучшение моторной функции кишечника. Дополнительные исследования на клеточных культурах в лаборатории показали, что антиоксиданты способны активировать фермент AMPK (аденозинмонофосфат-активируемую протеинкиназу), так называемый внутриклеточный датчик энергии. Это подавляет выработку активных форм кислорода, которые вызывают разрушение нейрональных клеток. Ученые предположили, что полифенолы Ecklonia cava могут эффективно предотвращать болезнь Паркинсона и у людей. Для подтверждения этой гипотезы необходимы дополнительные исследования.""" Твой ответ: Бурые водоросли против болезни Паркинсона 🌊\n\nУчёные из Японии 🇯🇵 сделали крутое открытие в борьбе с болезнью Паркинсона 🧠. Оказывается, антиоксиданты в бурых морских водорослях 🌿, особенно в Ecklonia cava, могут защищать нейроны от повреждений 🛡️. Эти супер-полезные вещества нейтрализуют свободные радикалы 🌱, которые атакуют клетки и вызывают болезнь 🧬.\n\nВ эксперименте на мышах 🐭, которым ежедневно давали антиоксиданты из водорослей, учёные заметили улучшение моторных функций 🏃. В лабораторных условиях 🔬 антиоксиданты активировали фермент, который снижает уровень вредных веществ, разрушающих нейроны 💥. Хотя исследования ещё продолжаются, добавление бурых водорослей в рацион 🍽️ уже сейчас может стать отличным шагом для защиты мозга и профилактики болезни Паркинсона 💡.\n\nТак что, если хотите добавить что-то полезное в своё питание, обратите внимание на эти чудо-водоросли! 💚'
    };

    const userMessage = {
        role: "user",
        content: `[ТЕКСТ] ${articleText}`
    };

    return [systemMessage, userMessage];
}

function buildTitlePrompt(articleText) {
    const systemMessage = {
        role: "system",
        content: 'Ты копирайтер по соцсетям. Тебе будет дан [ТЕКСТ]. Из [ТЕКСТ] напиши яркий, вызывающий любопытство заголовок, от 1 до максимум 3 слов. НЕ 4 и более слов! Пример: [ТЕКСТ] """Бурые водоросли против болезни Паркинсона 🌊\n\nУчёные из Японии 🇯🇵 сделали крутое открытие в борьбе с болезнью Паркинсона 🧠. Оказывается, антиоксиданты в бурых морских водорослях 🌿, особенно в Ecklonia cava, могут защищать нейроны от повреждений 🛡️. Эти супер-полезные вещества нейтрализуют свободные радикалы 🌱, которые атакуют клетки и вызывают болезнь 🧬.\n\nВ эксперименте на мышах 🐭, которым ежедневно давали антиоксиданты из водорослей, учёные заметили улучшение моторных функций 🏃. В лабораторных условиях 🔬 антиоксиданты активировали фермент, который снижает уровень вредных веществ, разрушающих нейроны 💥. Хотя исследования ещё продолжаются, добавление бурых водорослей в рацион 🍽️ уже сейчас может стать отличным шагом для защиты мозга и профилактики болезни Паркинсона 💡.\n\nТак что, если хотите добавить что-то полезное в своё питание, обратите внимание на эти чудо-водоросли! 💚""" Твой ответ: Водоросли против Паркинсона'
    };

    const userMessage = {
        role: "user",
        content: `[ТЕКСТ] ${articleText}`
    };

    return [systemMessage, userMessage];
}

async function getPostOutOfArticle(articleText) {
    const token = await getAccessToken();
    const messages = buildMessages(articleText);
    if (token) {
        const res = await generateChatResponse(token, messages);
        console.log(res);
        return res;
    }
}

// Exported function to be used in other modules
async function getTitleOutIfPost(articleText) {
    const token = await getAccessToken();
    const messages = buildTitlePrompt(articleText);
    if (token) {
        const res = await generateChatResponse(token, messages);
        console.log(res);
        return res;
    }
}

module.exports = { getPostOutOfArticle, getTitleOutIfPost };