const util = require('util');
const axios = require('axios');


const APIAddress = "https://api.abinteractive.net";
const APIVersion = "1";
const APIUserAgent = "ChilloutVR API-Requests";
const APIBase = `${APIAddress}/${APIVersion}`;


const UnauthenticatedCVRApi = axios.create({ baseURL: APIBase });

const CVRApi = axios.create({
    baseURL: APIBase,
    headers: {
        'Username': process.env.CVR_USERNAME,
        'AccessKey': process.env.CVR_ACCESS_KEY,
        'User-Agent': APIUserAgent,
    }
});


async function Get(url) {
    try {
        const response = await CVRApi.get(url);
        console.log(`[GET] ${url}`);
        console.log(util.inspect(response.data, {showHidden: false, depth: null, colors: true}));
        return response.data.data;
    }
    catch (error) {
        console.error(error);
    }
}


async function Post(url, data, authenticated = true) {
    try {
        const response = await (authenticated ? CVRApi : UnauthenticatedCVRApi).post(url, data);
        console.log(`[Post] ${response.request.url}`)
        console.log(util.inspect(response.data, {showHidden: false, depth: null, colors: true}));
        return response.data.data;
    }
    catch (error) {
        console.error(error);
    }
}


// API Constants

const CATEGORY_TYPES = Object.freeze({
    AVATARS: 'Avatars',
    FRIENDS: 'Friends',
    PROPS: 'Props',
    WORLDS: 'Worlds',
});


// API Endpoints

// Authenticate
exports.AuthenticateViaAccessKey = async (username, accessKey) => Post(`/users/auth`, { AuthType: 1, Username: username, Password: accessKey }, false);

// Friends
exports.GetMyFriends = async () => Get(`/friends`);
exports.GetMyFriendRequests = async () => Get(`/friends/requests`);

// Users
exports.GetUserById = async (userId) => Get(`/users/${userId}`);

// Avatars
exports.GetMyAvatars = async () => Get(`/avatars`);
exports.GetAvatarById = async (avatarId) => Get(`/avatars/${avatarId}`);

// Categories
exports.GetCategories = async () => Get(`/categories`);
async function SetAvatarCategories(type, id, categoryIds) {
    return Post(`/categories/assign`, {Uuid: id, CategoryType: type, Categories: categoryIds});
}
exports.SetAvatarCategories = async (avatarId, categoryIds) => SetAvatarCategories(CATEGORY_TYPES.AVATARS, avatarId, categoryIds);
exports.SetFriendCategories = async (userId, categoryIds) => SetAvatarCategories(CATEGORY_TYPES.FRIENDS, userId, categoryIds);
exports.SetPropCategories = async (propId, categoryIds) => SetAvatarCategories(CATEGORY_TYPES.PROPS, propId, categoryIds);
exports.SetWorldCategories = async (worldId, categoryIds) => SetAvatarCategories(CATEGORY_TYPES.WORLDS, worldId, categoryIds);

// Worlds
exports.GetWorldById = async (worldId) => Get(`/worlds/${worldId}`);
exports.GetWorldMetaById = async (worldId) => Get(`/worlds/${worldId}/meta`);
exports.GetWorldsByCategory = async (worldCategoryId) => Get(`/worlds/list/${worldCategoryId}`);
exports.GetWorldPortalById = async (worldId) => Get(`/portals/world/${worldId}`);
exports.SetWorldAsHome = async (worldId) => Get(`/worlds/${worldId}/sethome`);

// Spawnables
exports.GetProps = async () => Get(`/spawnables`);
exports.GetPropById = async (propId) => Get(`/spawnables/${propId}`);

// Instances
exports.GetInstanceById = async (instanceId) => Get(`/instances/${instanceId}`);
exports.JoinInstance = async (instanceId) => Get(`/instances/${instanceId}/join`);
exports.GetInstancePortalById = async (instanceId) => Get(`/portals/instance/${instanceId}`);

// Search
exports.Search = async (term) => Get(`/search/${term}`);
exports.SearchVideoPlayer = async (term) => Get(`/videoplayer/search/${term}?result=20&order=Title`);
