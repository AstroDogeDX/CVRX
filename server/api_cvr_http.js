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
    return Authenticate(AuthMethod.ACCESS_KEY, username, accessKey);
};
exports.AuthenticateViaPassword = async (email, password) => {
    return Authenticate(AuthMethod.PASSWORD, email, password);
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
exports.GetUserStats = async () =>  Get('/public/userstats', false);

// Friends
exports.GetMyFriends = async () => Get('/friends');
exports.GetMyFriendRequests = async () => Get('/friends/requests');

// Users
exports.GetUserById = async (userId) => Get(`/users/${userId}`);

// Avatars
exports.GetMyAvatars = async () => Get('/avatars');
exports.GetAvatarById = async (avatarId) => Get(`/avatars/${avatarId}`);

// Categories
exports.GetCategories = async () => Get('/categories');
async function SetAvatarCategories(type, id, categoryIds) {
    return Post('/categories/assign', {Uuid: id, CategoryType: type, Categories: categoryIds});
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
exports.GetProps = async () => Get('/spawnables');
exports.GetPropById = async (propId) => Get(`/spawnables/${propId}`);

// Instances
exports.GetInstanceById = async (instanceId) => Get(`/instances/${instanceId}`);
exports.JoinInstance = async (instanceId) => Get(`/instances/${instanceId}/join`);
exports.GetInstancePortalById = async (instanceId) => Get(`/portals/instance/${instanceId}`);

// Search
exports.Search = async (term) => Get(`/search/${term}`);
exports.SearchVideoPlayer = async (term) => Get(`/videoplayer/search/${term}?result=20&order=Title`);
