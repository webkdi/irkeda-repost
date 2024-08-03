const axios = require('axios');
// const { HttpsProxyAgent } = require('https-proxy-agent');
const fs = require('fs');
const ai = require('./ai_gigachat.js');
const tg = require('./telegram.js');
const img = require('./images.js');
const google = require('./google_search.js');
const db = require("./database.js");
const url = require('url');
const path = require('path');

const trackingFolder = path.join(__dirname, '../tracking');
if (!fs.existsSync(trackingFolder)) {
    fs.mkdirSync(trackingFolder);
}

async function fetchArticle(article) {

    // article = {
    //     "id": 3604852,
    //     "date": "2024-08-02T12:50:05+03:00",
    //     "title": "Раскрыт способ выбрать полезный фастфуд",
    //     "href": "https://health.mail.ru/news/3604852-raskryit-sposob-vyibrat-poleznyij-fastfud/",
    //     "description": "Вкусно и полезно!",
    //     "picture": "https://resizer.mail.ru/p/1f7cc37b-351a-5d78-8bec-ff7e3571a151/AQAE3l7q5sMgoMA-fFtciMZhxCmqFZv_jH3eHWrNwPkeYAyGlmrhG2WJ5L3Eds5udh40fk6Ob9owwjGYW9vrITTssEc.jpg",
    //     "pictureOwner": "Freepik.com/CC0",
    //     "sourceName": "Lenta.Ru",
    //     "sourceUrl": "https://lenta.ru"
    //   };

    const updateId = article.id;
    let resArticle = {
        "message": "",
        "type": "image",
        "update_id": updateId,
        "file_path": article.picture,
        "file_local": `${updateId}.jpg`,
        "url": article.href,
        "tmp_long_text": "here is the long text from article",
        "tmp_file_owner": article.pictureOwner,
        "tmp_search_text": article.title,
        "tmp_source_name": article.sourceName,
        "tmp_source_url": article.sourceUrl,
        "tmp_source_orig": "link to the original"
    };

    try {
        const articleResponse = await axios.get(article.href, {
            // Uncomment these lines if you need to use the proxy
            // httpAgent: agent,
            // httpsAgent: agent
        });

        // extract logn text from full article
        const contentType = articleResponse.headers['content-type'];
        const articleData = articleResponse.data;
        let combinedText = '';
        if (contentType && contentType.includes('application/json')) {
            const textItems = articleData.page_data.article.content.filter(item => item.type === 'html' || item.type === 'quote');
            textItems.forEach(item => {
                if (item.type === 'html') {
                    combinedText += item.html + ' ';
                } else if (item.type === 'quote') {
                    combinedText += item.content + ' ';
                }
            });
        } else {
            const paragraphMatches = articleData.match(/<p>(.*?)<\/p>/g);
            combinedText = paragraphMatches.map(paragraph => {
                return paragraph.replace(/<\/?p>/g, '').trim();
            }).join(' '); // Join all paragraphs with a space separator
        }
        combinedText = combinedText
            .replace(/&raquo;/g, '»')
            .replace(/&laquo;/g, '«')
            .replace(/&mdash;/g, '—')
            .replace(/&ndash;/g, '–') // Add this line to replace &ndash; with an en dash
            .replace(/&nbsp;/g, ' ')
            .replace(/&quot;/g, '"')
            .replace(/<\/?[^>]+(>|$)/g, "")
            .replace(/\n/g, '')
            .replace(/\n/g, '');
        resArticle.tmp_long_text = combinedText;

        // START source url
        const origUrl = await google.googleSearch(`${resArticle.tmp_source_name} ${resArticle.tmp_search_text}`)
        resArticle.tmp_source_orig = origUrl;

        const parsedSourceUrl = new URL(resArticle.tmp_source_url);
        const parsedSourceOrig = new URL(origUrl);
        if (parsedSourceUrl.hostname === parsedSourceOrig.hostname) {
            resArticle.url = origUrl;
            delete resArticle.tmp_source_name;
            delete resArticle.tmp_source_url;
            delete resArticle.tmp_source_orig;
            delete resArticle.tmp_search_text;
        } else {
            resArticle.url = resArticle.tmp_source_url;
        }
        // END source url

        // AI text
        var shortText = "dummy shortText";
        // Uncomment this if you want to use AI to generate shortText
        shortText = await ai.getPostOutOfArticle(combinedText);
        shortText += "\n\n#ЗожНости 🧐 " + resArticle.url;
        if (shortText.length < 300 || shortText.length > 1000) {
            console.log(`ai generated ${shortText.length} characters, skipped for TG: id ${updateId}, url: ${article.href}`);
            await db.deleteUpdateId(updateId);
            return;
        }
        resArticle.message = shortText;

        await tg.downloadFile(resArticle.file_path, resArticle.file_local);
        const imgBranded = await img.addTextToImage(resArticle.file_local, resArticle.tmp_file_owner);
        resArticle.file_local = imgBranded;

        return resArticle;

    } catch (err) {
        console.error(`Failed to fetch the article ${updateId} at ${article.sourceUrl}:`, err.message);
        return null;
    }
}

async function fetchAndParse() {

    const storeFilesForTracking = true;
    try {
        // Proxy configuration
        const proxyUrl = process.env.PROXY_URL;
        // const agent = new HttpsProxyAgent(proxyUrl);
        const response = await axios.get('https://health.mail.ru/news/list/eating/', {
            // Uncomment these lines if you need to use the proxy
            // httpAgent: agent,
            // httpsAgent: agent
        });
        const jsonData = response.data;

        if (storeFilesForTracking) {
            const filePath = path.join(trackingFolder, '1_articles_received.json');
            fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2), 'utf-8');
        }

        // Extract the articles from the JSON structure
        const articles = [];
        if (jsonData && jsonData.data && jsonData.data.items) {
            jsonData.data.items.forEach(item => {
                const { id, title, href, published, description, picture, source } = item;
                articles.push({
                    id: id,
                    date: published.rfc3339,
                    title: title,
                    href: `https://health.mail.ru${href}`,
                    description: description,
                    picture: `${picture.baseURL}${picture.uuid}/${picture.key}.jpg`,
                    pictureOwner: picture.source ? picture.source.title : '',  // Check if source exists
                    sourceName: source ? source.title : 'Здоровье Mail.ru',  // Check if source exists
                    sourceUrl: source ? source.href : 'https://health.mail.ru/',  // Check if source exists
                });
            });
        }

        if (storeFilesForTracking) {
            const filePath = path.join(trackingFolder, '2_articles_extracted.json');
            fs.writeFileSync(filePath, JSON.stringify(articles, null, 2), 'utf-8');
        }

        for (let i = 0; i < articles.length; i++) {
            const newId = articles[i].id;
            const changes = await db.insertIgnore(newId);
            if (changes > 0) {
                console.log('Update ID inserted:', newId);
            } else {
                // console.log('Update exists, skipped:', newId);
                articles.splice(i, 1); // Remove the current entry from articles
                i--; // Decrement the index to account for the removed item
            }
        }

        var messages = [];
        // Fetch and parse content from the articles
        for (const article of articles) {
            const randomDelay = Math.floor(Math.random() * (3000 - 1000 + 1) + 1000);
            await new Promise(resolve => setTimeout(resolve, randomDelay));
            const newArticle = await fetchArticle(article);  // Use the new function

            if (newArticle) {
                messages.push(newArticle);
            }
        }

        if (storeFilesForTracking) {
            const filePath = path.join(trackingFolder, '3_articles_messages.json');
            fs.writeFileSync(filePath, JSON.stringify(messages, null, 2), 'utf-8');
        }

        return messages;

    } catch (error) {
        console.error('Error fetching or parsing the data:', error);
    }
}
// fetchAndParse();

module.exports = {
    fetchAndParse
};
