const { app, nativeImage } = require('electron');
const axios = require('axios');
const path = require('path');
const urlLib = require('url');
const crypto = require('crypto');
const fs = require('fs');


const AppDataPath = app.getPath('userData');
const CachePath = path.join(AppDataPath, 'CVRCache');
const CacheImagesPath = path.join(CachePath, 'Images');


exports.GetHash = (string) => {
    return crypto.createHash('sha1').update(string).digest('hex');
}

const queue = [];
let window;

exports.Initialize = (win) => {
    window = win;
}

exports.QueueFetchImage = (urlObj) => {
    if (urlObj) {
        queue.push(urlObj);
        ProcessQueue().then().catch(console.error);
    }
}

async function ProcessQueue() {
    if (queue.length > 0) {
        const urlObj = queue.shift();
        const nativeImg = await FetchImage(urlObj);

        if (nativeImg) {
            // Send the loaded image to the main window
            window.webContents.send('image-load', {
                imageUrl: urlObj.url,
                imageHash: urlObj.hash,
                imageBase64: nativeImg.toDataURL(),
            });
        }

        await ProcessQueue();
    }
}


async function DownloadImage(url) {
    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer'
        });

        if (response.status !== 200) {
            console.error(`Error with status code ${response.status}`);
            return null;
        }

        // Check the image format
        const imageType = response.headers['content-type'];
        if (!imageType.startsWith('image/')) {
            console.error(`Invalid image format: ${imageType}`);
        }

        return response.data;
    }
    catch (error) {
        console.error(`Error downloading image: ${error.message}`);
        return null;
    }
}

async function FetchImage(urlObj) {

    const { url, hash } = urlObj;

    const fileExtension = path.extname(urlLib.parse(url).pathname);
    const imagePath = path.join(CacheImagesPath, hash + fileExtension);

    // Check if the image, and grab it if it does!
    if (fs.existsSync(imagePath)) {
        const image = await fs.promises.readFile(imagePath);
        console.log(`Fetching ${url} from cache!`);
        return nativeImage.createFromBuffer(image);
    }

    // The image is not cached, let's download it
    else {
        const image = await DownloadImage(url);
        if (image !== null) {
            await fs.promises.mkdir(CacheImagesPath, { recursive: true }).catch(console.error);
            await CacheImage(imagePath, image);
            console.log(`Fetching ${url} from http!`);
            return nativeImage.createFromBuffer(image);
        }
    }

    return null;
}

async function CacheImage(imagePath, image) {
    // Todo: Implement cache limit and cleaning system
    await fs.promises.writeFile(imagePath, image);
}