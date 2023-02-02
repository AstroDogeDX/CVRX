const { app, nativeImage } = require('electron');
const axios = require('axios');
const path = require('path');
const urlLib = require('url');
const crypto = require('crypto');
const fs = require('fs');

const { GetMaxCacheSize } = require('./config');

const AppDataPath = app.getPath('userData');
const CachePath = path.join(AppDataPath, 'CVRCache');
const CacheImagesPath = path.join(CachePath, 'Images');

let IsCleaningCache = false;

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
    // Process Queue if there is stuff in the queue
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

    // If we finished our queue, lets check the cache limits and clear if necessary
    else {
        await CleanCache();
    }
}


async function DownloadImage(url) {
    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer'
        });

        if (response.status !== 200) {
            console.error(`Error downloading image from ${url}. Error Status Code: ${response.status}`);

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
        console.error(`Error downloading image from ${url}. Error: ${error.message}`);
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
        //console.log(`Fetching ${url} from cache!`);
        return nativeImage.createFromBuffer(image);
    }

    // The image is not cached, let's download it
    else {
        const image = await DownloadImage(url);
        if (image !== null) {
            await fs.promises.mkdir(CacheImagesPath, { recursive: true }).catch(console.error);
            await CacheImage(imagePath, image);
            //console.log(`Fetching ${url} from http!`);
            return nativeImage.createFromBuffer(image);
        }
    }

    return null;
}

async function CacheImage(imagePath, image) {
    await fs.promises.writeFile(imagePath, image);
}

function BytesToMegabytes(bytesSize) {
    return bytesSize / Math.pow(1024, 2);
}

function MegabytesToBytes(megabytesSize) {
    return megabytesSize * Math.pow(1024, 2);
}

async function CleanCache() {

    try {
        // No point in cleaning if it is still cleaning!
        if (IsCleaningCache) return;
        IsCleaningCache = true;

        const MaxSizeInBytes = MegabytesToBytes(GetMaxCacheSize());

        const fileNames = await fs.promises.readdir(CacheImagesPath);

        let folderSize = 0;
        const files = [];
        for (const fileName of fileNames) {
            const filePath = path.join(CacheImagesPath, fileName);
            const fileStats = await fs.promises.stat(filePath);
            folderSize += fileStats.size;
            files.push({ path: filePath, size: fileStats.size, accessDate: fileStats.atime });
        }

        // We're over the cache limit, let's delete until we have less than 90% than our cache used!
        if (BytesToMegabytes(folderSize) > GetMaxCacheSize()) {
            const targetBytes = MaxSizeInBytes * 0.9;
            files.sort((a,b) => a.accessDate.getTime() - b.accessDate.getTime());
            for (const file of files) {
                await fs.promises.unlink(file.path);
                folderSize -= file.size;
                if (folderSize <= targetBytes) break;
            }
        }
    }
    catch (e) {
        console.error(e);
    }
    finally {
        IsCleaningCache = false;
    }
}
