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


exports.GetHash = (string) => {
    return new Promise((resolve) => {
        resolve(crypto.createHash('sha1').update(string).digest('hex'));
    });
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

let timeoutId;
function QueueCacheClean() {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(CleanCache, 2000);
}

function SendNativeImage(nativeImg, urlObj) {
    if (!nativeImg) return;

    return new Promise((resolve) => {
        const imDataUrl = nativeImg.toDataURL();

        // Save the image to the object
        urlObj.obj.imageBase64 = imDataUrl;

        // Send the loaded image to the main window
        window.webContents.send('image-load', {
            imageUrl: urlObj.url,
            imageHash: urlObj.hash,
            imageBase64: imDataUrl,
        });

        resolve();
    });
}

let isProcessing = false;
async function ProcessQueue(recurring = false) {

    if (isProcessing && !recurring) {
        return;
    }

    // Process Queue if there is stuff in the queue
    if (queue.length > 0) {
        isProcessing = true;
        const urlObj = queue.shift();
        await FetchImage(urlObj);
        await ProcessQueue(true);
        if (queue.length === 0) {
            QueueCacheClean();
            isProcessing = false;
        }
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
    try {
        await fs.promises.access(imagePath, fs.constants.R_OK);
        try {
            // Since it's not an api access we can do it sync
            const image = await fs.promises.readFile(imagePath);
            // log.verbose(`Fetching ${url} from cache!`);
            await SendNativeImage(nativeImage.createFromBuffer(image), urlObj);
        }
        catch (err) {
            log.error(`[FetchImage] Reading ${imagePath} from cache...`, err);
        }
    }
    catch (err) {

        // The image is not cached, let's download it
        const image = await DownloadImage(url);

        if (image !== null) {
            try {
                // Cache the image async
                await fs.promises.mkdir(CacheImagesPath, { recursive: true });
            }
            catch (err) {
                log.error(`[FetchImage] Creating Path for ${imagePath}...`, err);
            }

            try {
                await CacheImage(imagePath, image);
            }
            catch (err) {
                log.error(`[FetchImage] Caching image ${CacheImagesPath}...`, err);
            }

            // log.verbose(`Fetching ${url} from http!`);
            await SendNativeImage(nativeImage.createFromBuffer(image), urlObj);
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

    log.verbose('[CleanCache] Cleaning the cache...');

    try {
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
}

async function ClearAllCachedImages() {
    log.info('[ClearAllCachedImages] Clearing all cached images...');
    
    try {
        // Check if the cache directory exists
        try {
            await fs.promises.access(CacheImagesPath, fs.constants.F_OK);
        } catch (err) {
            // Directory doesn't exist, nothing to clear
            log.info('[ClearAllCachedImages] Cache directory does not exist, nothing to clear');
            return { success: true, message: 'No cached images to clear' };
        }

        // Get all files in the cache directory
        const fileNames = await fs.promises.readdir(CacheImagesPath);
        
        if (fileNames.length === 0) {
            log.info('[ClearAllCachedImages] Cache directory is already empty');
            return { success: true, message: 'Cache directory is already empty' };
        }

        let deletedCount = 0;
        let totalSize = 0;

        // Delete all files
        for (const fileName of fileNames) {
            const filePath = path.join(CacheImagesPath, fileName);
            try {
                const fileStats = await fs.promises.stat(filePath);
                totalSize += fileStats.size;
                await fs.promises.unlink(filePath);
                deletedCount++;
            } catch (err) {
                log.error(`[ClearAllCachedImages] Failed to delete file ${filePath}:`, err);
            }
        }

        const totalSizeMB = BytesToMegabytes(totalSize);
        log.info(`[ClearAllCachedImages] Successfully deleted ${deletedCount} files, freed ${totalSizeMB.toFixed(2)} MB`);
        
        return { 
            success: true, 
            message: `Successfully cleared ${deletedCount} cached images (${totalSizeMB.toFixed(2)} MB freed)` 
        };
    }
    catch (e) {
        log.error('[ClearAllCachedImages] Error clearing cached images:', e);
        return { 
            success: false, 
            message: `Failed to clear cached images: ${e.message}` 
        };
    }
}

exports.ClearAllCachedImages = ClearAllCachedImages;
