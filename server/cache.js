const { app, nativeImage } = require('electron');
const axios = require('axios');
const path = require('path');
const urlLib = require('url');
const crypto = require('crypto');
const fs = require('fs');


const AppDataPath = app.getPath('userData');
const CachePath = path.join(AppDataPath, 'CVRCache');
const CacheImagesPath = path.join(CachePath, 'Images');


function GetHash(string) {
    return crypto.createHash('sha1').update(string).digest('hex');
}

const queue = [];
let window;

exports.Initialize = (win) => {
    window = win;
}

exports.QueueFetchImage = (url) => {
    if (url) {
        queue.push(url);
        ProcessQueue().then().catch(console.error);
    }
}

async function ProcessQueue() {
    if (queue.length > 0) {
        const url = queue.shift();
        const nativeImg = await FetchImage(url);

        if (nativeImg) {
            // Send the loaded image to the main window
            window.webContents.send('image-load', {
                url: url,
                imgBase64: nativeImg.toDataURL(),
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

async function FetchImage(url) {

    const hashedFileName = GetHash(url);
    const fileExtension = path.extname(urlLib.parse(url).pathname);
    const imagePath = path.join(CacheImagesPath, hashedFileName + fileExtension);

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
