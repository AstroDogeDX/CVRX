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
const log = require('./logger').GetLogger('Cache');

let IsCleaningCache = false;

exports.GetHash = (string) => {
    return crypto.createHash('sha1').update(string).digest('hex');
};

let queue = [];
let window;
let processing = true;

exports.Initialize = (win) => {
    window = win;
};

exports.ResetProcessQueue = () => {
    queue = [];
    processing = false;
};
exports.StartProcessQueue = () => {
    processing = true;
    ProcessQueue().then().catch((err) => log.error('[Initialized] ProcessQueue...', err));
};

exports.QueueFetchImage = (urlObj) => {
    if (urlObj) {
        queue.push(urlObj);
        if (processing) {
            ProcessQueue().then().catch((err) => log.error('[QueueFetchImage] ProcessQueue...', err));
        }
    }
};

function SendNativeImage(nativeImg, urlObj) {
    if (!nativeImg) return;

    const imDataUrl = nativeImg.toDataURL();

    // Save the image to the object
    urlObj.obj.imageBase64 = imDataUrl;

    // Send the loaded image to the main window
    window.webContents.send('image-load', {
        imageUrl: urlObj.url,
        imageHash: urlObj.hash,
        imageBase64: imDataUrl,
    });
}

async function ProcessQueue() {
    // Process Queue if there is stuff in the queue
    if (queue.length > 0) {
        const urlObj = queue.shift();
        await FetchImage(urlObj);
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
            responseType: 'arraybuffer',
        });

        if (response.status !== 200) {
            log.error(`[DownloadImage] Error downloading image from ${url}. Error Status Code: ${response.status}`);

            return null;
        }

        // Check the image format
        const imageType = response.headers['content-type'];
        if (!imageType.startsWith('image/')) {
            log.error(`[DownloadImage] Invalid image format: ${imageType}`);
        }

        return response.data;
    }
    catch (error) {
        log.error(`[DownloadImage] Error downloading image from ${url}. Error: ${error.message}`);
        return null;
    }
}

async function FetchImage(urlObj) {

    const { url, hash } = urlObj;

    const fileExtension = path.extname(urlLib.parse(url).pathname);
    const imagePath = path.join(CacheImagesPath, hash + fileExtension);

    // Check if the image, and grab it if it does!
    if (fs.existsSync(imagePath)) {
        // Since it's not an api access we can do it sync
        fs.promises.readFile(imagePath).then(image => {
            // log.debug(`Fetching ${url} from cache!`);
            SendNativeImage(nativeImage.createFromBuffer(image), urlObj);
        }).catch(err => log.error(`[FetchImage] Reading ${imagePath} from cache...`, err));
    }

    // The image is not cached, let's download it
    else {
        const image = await DownloadImage(url);

        if (image !== null) {
            // Cache the image async
            fs.promises.mkdir(CacheImagesPath, { recursive: true }).then(() => {
                CacheImage(imagePath, image).then().catch(err => log.error(`[FetchImage] Caching image ${CacheImagesPath}...`, err));
            }).catch(err => log.error(`[FetchImage] Creating Path for ${imagePath}...`, err));

            // log.debug(`Fetching ${url} from http!`);
            SendNativeImage(nativeImage.createFromBuffer(image), urlObj);
        }
    }
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
            files.sort((a, b) => a.accessDate.getTime() - b.accessDate.getTime());
            for (const file of files) {
                await fs.promises.unlink(file.path);
                folderSize -= file.size;
                if (folderSize <= targetBytes) break;
            }
        }
    }
    catch (e) {
        log.error('[CleanCache] Cleaning cache...', e);
    }
    finally {
        IsCleaningCache = false;
    }
}
