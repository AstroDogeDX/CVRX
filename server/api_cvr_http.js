const axios = require('axios');
const utils = require('./utils');

const log = require('./logger').GetLogger('API_HTTP');

const APIAddress = 'https://api.abinteractive.net';
const APIVersion = '1';
const APIBase = `${APIAddress}/${APIVersion}`;

let CVRApi;

const UnauthenticatedCVRApi = axios.create({ baseURL: APIBase });

async function Get(url, authenticated = true) {
    try {
        const response = await (authenticated ? CVRApi : UnauthenticatedCVRApi).get(url);
        log.debug(`[GET] [${response.status}] [${authenticated ? '' : 'Non-'}Auth] ${url}`, response.data);
        return response.data.data;
    }
    catch (error) {
        log.error(`[GET] [Error] [${authenticated ? '' : 'Non-'}Auth] ${url}`, error.toString(), error.stack);
        throw new Error(`Error:\n${error.stack}\n${error.toString()}`);
    }
}


async function Post(url, data, authenticated = true) {
    try {
        const response = await (authenticated ? CVRApi : UnauthenticatedCVRApi).post(url, data);
        log.debug(`[Post] [${response.status}] [${authenticated ? '' : 'Non-'}Auth] ${url}`, response.data);
        return response.data.data;
    }
    catch (error) {
        log.error(`[Post] [Error] [${authenticated ? '' : 'Non-'}Auth] ${url}`, error.toString(), error.stack);
        throw new Error(`Error:\n${error.stack}\n${error.toString()}`);
    }
}


// API Constants

const CATEGORY_TYPES = Object.freeze({
    AVATARS: 'Avatars',
    FRIENDS: 'Friends',
    PROPS: 'Props',
    WORLDS: 'Worlds',
});

const AuthMethod = Object.freeze({
    ACCESS_KEY: 1,
    PASSWORD: 2,
});


// API Endpoints

// Authenticate
exports.AuthenticateViaAccessKey = async (username, accessKey) => {
    return await Authenticate(AuthMethod.ACCESS_KEY, username, accessKey);
};
exports.AuthenticateViaPassword = async (email, password) => {
    return await Authenticate(AuthMethod.PASSWORD, email, password);
};
async function Authenticate(authType, credentialUser, credentialSecret) {
    const authentication = await Post('/users/auth', { AuthType: authType, Username: credentialUser, Password: credentialSecret }, false);
    CVRApi = axios.create({
        baseURL: APIBase,
        headers: {
            'Username': authentication.username,
            'AccessKey': authentication.accessKey,
            'User-Agent': utils.GetUserAgent(),
        },
    });
    return authentication;
}

// Get Stats
exports.GetUserStats = async () => await Get('/public/userstats', false);

// Friends
exports.GetMyFriends = async () => await Get('/friends');
exports.GetMyFriendRequests = async () => await Get('/friends/requests');

// Users
exports.GetUserById = async (userId) => await Get(`/users/${userId}`);

// Avatars
exports.GetMyAvatars = async () => await Get('/avatars');
exports.GetAvatarById = async (avatarId) => await Get(`/avatars/${avatarId}`);

// Categories
exports.GetCategories = async () => await Get('/categories');
async function SetAvatarCategories(type, id, categoryIds) {
    return Post('/categories/assign', {Uuid: id, CategoryType: type, Categories: categoryIds});
}
exports.SetAvatarCategories = async (avatarId, categoryIds) => await SetAvatarCategories(CATEGORY_TYPES.AVATARS, avatarId, categoryIds);
exports.SetFriendCategories = async (userId, categoryIds) => await SetAvatarCategories(CATEGORY_TYPES.FRIENDS, userId, categoryIds);
exports.SetPropCategories = async (propId, categoryIds) => await SetAvatarCategories(CATEGORY_TYPES.PROPS, propId, categoryIds);
exports.SetWorldCategories = async (worldId, categoryIds) => await SetAvatarCategories(CATEGORY_TYPES.WORLDS, worldId, categoryIds);

// Worlds
exports.GetWorldById = async (worldId) => await Get(`/worlds/${worldId}`);
exports.GetWorldMetaById = async (worldId) => await Get(`/worlds/${worldId}/meta`);
exports.GetWorldsByCategory = async (worldCategoryId) => await Get(`/worlds/list/${worldCategoryId}`);
exports.GetWorldPortalById = async (worldId) => await Get(`/portals/world/${worldId}`);
exports.SetWorldAsHome = async (worldId) => await Get(`/worlds/${worldId}/sethome`);

// Spawnables
exports.GetProps = async () => await Get('/spawnables');
exports.GetPropById = async (propId) => await Get(`/spawnables/${propId}`);

// Instances
exports.GetInstanceById = async (instanceId) => await Get(`/instances/${instanceId}`);
exports.JoinInstance = async (instanceId) => await Get(`/instances/${instanceId}/join`);
exports.GetInstancePortalById = async (instanceId) => await Get(`/portals/instance/${instanceId}`);

// Search
exports.Search = async (term) => await Get(`/search/${term}`);
exports.SearchVideoPlayer = async (term) => await Get(`/videoplayer/search/${term}?result=20&order=Title`);
