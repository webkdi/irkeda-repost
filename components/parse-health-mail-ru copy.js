const axios = require('axios');
// const { HttpsProxyAgent } = require('https-proxy-agent');
const fs = require('fs');
const ai = require('./ai_gigachat.js');
const tg = require('./telegram.js');
const img = require('./images.js');
const google = require('./google_search.js');
const db = require("./database.js");
const url = require('url');
const cheerio = require('cheerio');


async function fetchArticleContent(articleUrl, updateId = 0, retries = 3) {

    // Proxy configuration
    // const proxyUrl = process.env.PROXY_URL;
    // const agent = new HttpsProxyAgent(proxyUrl);

    let resArticle = {
        "message": "",
        "type": "image",
        "update_id": updateId,
        "file_path": "https://path-to-file",
        "file_local": `${updateId}.jpg`,
        "url": articleUrl,
        "tmp_long_text": "here is the long text from article",
        "tmp_file_owner": "example Unsplash.com to add on image",
        "tmp_search_text": "this is article title for search",
        "tmp_source_name": "the source of the article",
        "tmp_source_url": "link to the source of the article",
        "tmp_source_orig": "link to the original",
    };

    try {
        const articleResponse = await axios.get(articleUrl, {
            // Uncomment these lines if you need to use the proxy
            // httpAgent: agent,
            // httpsAgent: agent
        });

        // Check if the content-type header is JSON
        const contentType = articleResponse.headers['content-type'];
        if (contentType && contentType.includes('application/json')) {
            const articleJson = articleResponse.data;
            updateId = articleJson.page_data.media_stat.entity_id;

            const changes = await db.insertIgnore(updateId);
            if (changes > 0) {
                console.log('Update ID inserted:', updateId);
            } else {
                // console.log('Update ID already exists:', update_id);
                return null; // Return null for entries to skip
            }

            resArticle.update_id = updateId;

            // Check if articleJson is an object or array (valid JSON root types)
            const fileName = `article_${updateId}.json`;
            if (typeof articleJson === 'object' && articleJson !== null) {
                // fs.writeFileSync(fileName, JSON.stringify(articleJson, null, 2), 'utf-8');
            } else {
                throw new Error('The response is not a valid JSON object or array.');
            }

            // START find original URL
            // Added 'let' for declaring variables
            let tmp_search_text = articleJson.page_data.article.title;
            let tmp_source_name = articleJson.page_data.article.source.title;
            let tmp_source_url = articleJson.page_data.article.source.url;

            resArticle.tmp_search_text = tmp_search_text;
            resArticle.tmp_source_name = tmp_source_name;
            resArticle.tmp_source_url = tmp_source_url;

            const origUrl = await google.googleSearch(`${resArticle.tmp_source_name} ${resArticle.tmp_search_text}`)
            resArticle.tmp_source_orig = origUrl;

            const parsedSourceUrl = new URL(tmp_source_url);
            const parsedSourceOrig = new URL(origUrl);
            if (parsedSourceUrl.hostname === parsedSourceOrig.hostname) {
                resArticle.url = origUrl;
                // Delete temporary properties after use
                delete resArticle.tmp_source_name;
                delete resArticle.tmp_source_url;
                delete resArticle.tmp_source_orig;
                delete resArticle.tmp_search_text;
            } else {
                resArticle.url = tmp_source_url;
            }
            // END find original URL

            const pictureItem = articleJson.page_data.article.content.find(item => item.type === 'picture');
            if (pictureItem && pictureItem.data && pictureItem.data.base) {
                const imageDetails = pictureItem.data.base;
                const image = `${imageDetails.baseURL}${imageDetails.uuid}/${imageDetails.key}.webp`;
                const imageOwner = imageDetails.source.title;
                resArticle.file_path = image;
                resArticle.tmp_file_owner = imageOwner;
            }
            await tg.downloadFile(resArticle.file_path, resArticle.file_local);
            const imgBranded = await img.addTextToImage(resArticle.file_local, resArticle.tmp_file_owner);
            resArticle.file_local = imgBranded;

            const textItems = articleJson.page_data.article.content.filter(item => item.type === 'html' || item.type === 'quote');
            let combinedText = '';
            textItems.forEach(item => {
                if (item.type === 'html') {
                    combinedText += item.html + ' ';
                } else if (item.type === 'quote') {
                    combinedText += item.content + ' ';
                }
            });
            combinedText = combinedText
                .replace(/&raquo;/g, '»')
                .replace(/&laquo;/g, '«')
                .replace(/&mdash;/g, '—')
                .replace(/&nbsp;/g, ' ')
                .replace(/&quot;/g, '"')
                .replace(/<\/?[^>]+(>|$)/g, "")
                .replace(/\n/g, '')
                .replace(/\n/g, '');

            resArticle.tmp_long_text = combinedText;

            var shortText = "dummy shortText";
            // Uncomment this if you want to use AI to generate shortText
            shortText = await ai.getPostOutOfArticle(combinedText);
            if (shortText.length < 300) {
                console.log(`ai generated too short text for ${updateId}`);
                await db.deleteUpdateId(updateId);
                return;
            }
            shortText += "\n\n#ЗожНости 🧐 " + resArticle.url;
            resArticle.message = shortText;

            return resArticle;

        } else {

            // message
            const articleContent = articleResponse.data;
            const paragraphMatches = articleContent.match(/<p>(.*?)<\/p>/g);
            const paragraphs = paragraphMatches.map(paragraph => {
                return paragraph.replace(/<\/?p>/g, '').trim();
            }).join(' '); // Join all paragraphs with a space separator
            resArticle.message = paragraphs;
            resArticle.tmp_long_text = paragraphs;

            // id and image name
            const entityIdMatch = articleContent.match(/entity_id:\s*"(\d+)"/);
            if (entityIdMatch && entityIdMatch[1]) {
                const update_id = entityIdMatch[1];
                resArticle.update_id = update_id;
                resArticle.file_local = `${update_id}.jpg`;
            }

            // Search title string 
            const contentMatch = articleContent.match(/<meta\s+property="og:title"\s+content="([^"]*)"/);
            if (contentMatch && contentMatch[1]) {
                resArticle.tmp_search_text = contentMatch[1];
            }

            // Source name
            const sourceMatch = articleContent.match(/<meta\s+property="marker:source"\s+content="([^"]*)"/);
            if (sourceMatch && sourceMatch[1]) {
                resArticle.tmp_source_name = sourceMatch[1];
            }

            // Regular expression to find the source object with the specific title and extract the url value
            const regexSource = new RegExp(`"source":\\{\\s*"title":"${sourceMatch[1].replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}","url":"([^"]*)"`, 'i');
            const urlSourceMatch = articleContent.match(regexSource);
            if (urlSourceMatch && urlSourceMatch[1]) {
                resArticle.tmp_source_url = urlSourceMatch[1];
            }

            const imageSourceMatch = articleContent.match(/"source":\s*\{\s*"title":\s*"([^"]*)"/);
            if (imageSourceMatch && imageSourceMatch[1]) {
                resArticle.tmp_file_owner = imageSourceMatch[1];
            }

            console.log(resArticle);

            const fileName = `article_skipped.html`;  // Corrected file extension to .html
            fs.writeFileSync(fileName, articleResponse.data, 'utf-8');
            throw new Error(`The content type is not application/json. Content type received: ${contentType}`);
        }

    } catch (err) {
        if (retries > 0) {
            console.log(`Retrying... Attempts left: ${retries}, Url: ${articleUrl}`);
            const randomDelay = Math.floor(Math.random() * (3000 - 1000 + 1) + 1000);
            await new Promise(resolve => setTimeout(resolve, randomDelay));
            return await fetchArticleContent(articleUrl, updateId, retries - 1);
        } else {
            console.error(`Failed to fetch the article at ${articleUrl} after multiple attempts:`, err.message);
            return null;
        }
    }
}

async function fetchAndParse() {
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
        fs.writeFileSync('articles_received.json', JSON.stringify(jsonData, null, 2), 'utf-8');

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
                    pictureOwner: picture.source.title,
                    sourceName: source.title,
                    sourceUrl: source.href
                });
            });
        }
        fs.writeFileSync('articles_extracted.json', JSON.stringify(articles, null, 2), 'utf-8');

        var messages = [];
        // Fetch and parse content from the first two href links
        for (let i = 0; i < articles.length; i++) {
            const randomDeay = Math.floor(Math.random() * (3000 - 1000 + 1) + 1000);
            await new Promise(resolve => setTimeout(resolve, randomDeay));
            const articleUrl = articles[i].href;
            // console.log(i, "), articleUrl", articleUrl);
            const newArticle = await fetchArticleContent(articleUrl);  // Use the new function

            if (newArticle) {
                messages.push(newArticle);
            }
        }

        // console.log(JSON.stringify(messages));
        fs.writeFileSync('articles_messages.json', JSON.stringify(messages, null, 2), 'utf-8');
        return messages;

    } catch (error) {
        console.error('Error fetching or parsing the data:', error);
    }
}
// fetchAndParse();

module.exports = {
    fetchAndParse
};
