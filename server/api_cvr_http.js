const axios = require('axios');
const utils = require('./utils');

const log = require('./logger').GetLogger('API_HTTP');

const APIAddress = 'https://api.abinteractive.net';
const APIBase = `${APIAddress}/1`;
const APIBase2 = `${APIAddress}/2`;

let CVRApi;
let CVRApiV2;

const UnauthenticatedCVRApi = axios.create({ baseURL: APIBase });

async function Get(url, authenticated = true, apiVersion = 1) {
    try {
        const response = await (authenticated ? (apiVersion === 1 ? CVRApi : CVRApiV2) : UnauthenticatedCVRApi).get(url);
        log.debug(`[GET] [${response.status}] [${authenticated ? '' : 'Non-'}Auth] ${url}`, response.data);
        return response.data.data;
    }
    catch (error) {
        log.error(`[GET] [Error] [${authenticated ? '' : 'Non-'}Auth] ${url}`, error.toString(), error.stack);
        throw new Error(`Error:\n${error.stack}\n${error.toString()}`);
    }
}


async function Post(url, data, authenticated = true, apiVersion = 1) {
    try {
        const response = await (authenticated ? (apiVersion === 1 ? CVRApi : CVRApiV2) : UnauthenticatedCVRApi).post(url, data);
        log.debug(`[Post] [${response.status}] [${authenticated ? '' : 'Non-'}Auth] ${url}`, response.data);
        return response.data;
    }
    catch (error) {
        log.error(`[Post] [Error] [${authenticated ? '' : 'Non-'}Auth] ${url}`, error.toString(), error.stack);
        throw new Error(`Error:\n${error.stack}\n${error.toString()}`);
    }
}

async function Delete(url, authenticated = true, apiVersion = 1) {
    try {
        const response = await (authenticated ? (apiVersion === 1 ? CVRApi : CVRApiV2) : UnauthenticatedCVRApi).delete(url);
        log.debug(`[DELETE] [${response.status}] [${authenticated ? '' : 'Non-'}Auth] ${url}`, response.data);
        return response.data.data;
    }
    catch (error) {
        log.error(`[DELETE] [Error] [${authenticated ? '' : 'Non-'}Auth] ${url}`, error.toString(), error.stack);
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

const PrivacyLevel = Object.freeze({
    Public: 0,
    FriendsOfFriends: 1,
    Friends: 2,
    Group: 3,
    EveryoneCanInvite: 4,
    OwnerMustInvite: 5,
    GroupsPlus: 6,
});
exports.PrivacyLevel = PrivacyLevel;


// API Endpoints

// Authenticate
exports.AuthenticateViaAccessKey = async (username, accessKey) => {
    return await Authenticate(AuthMethod.ACCESS_KEY, username, accessKey);
};
exports.AuthenticateViaPassword = async (email, password) => {
    return await Authenticate(AuthMethod.PASSWORD, email, password);
};
async function Authenticate(authType, credentialUser, credentialSecret) {
    const authentication = (await Post('/users/auth', { AuthType: authType, Username: credentialUser, Password: credentialSecret }, false)).data;
    CVRApi = axios.create({
        baseURL: APIBase,
        headers: {
            'Username': authentication.username,
            'AccessKey': authentication.accessKey,
            'User-Agent': utils.GetUserAgent(),
            'MatureContentDlc': 'true',
            'Platform': 'pc_standalone',
            'CompatibleVersions': '0,1,2',
        },
    });
    CVRApiV2 = axios.create({
        baseURL: APIBase2,
        headers: {
            'Username': authentication.username,
            'AccessKey': authentication.accessKey,
            'User-Agent': utils.GetUserAgent(),
            'MatureContentDlc': 'true',
            'Platform': 'pc_standalone',
            'CompatibleVersions': '0,1,2',
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
exports.GetUserPublicAvatars = async (userId) => await Get(`/users/${userId}/avatars`);
exports.GetUserPublicWorlds = async (userId) => await Get(`/users/${userId}/worlds`);
exports.GetUserPublicSpawnables = async (userId) => await Get(`/users/${userId}/spawnables`);
exports.SetFriendNote = async (userId, note) => await Post(`/users/${userId}/note`, { note: note });

// Avatars
exports.GetMyAvatars = async () => await Get('/avatars');
exports.GetAvatarById = async (avatarId) => await Get(`/avatars/${avatarId}`);
exports.GetAvatarShares = async (avatarId) => await Get(`/avatars/${avatarId}/shares`);
exports.AddAvatarShare = async (avatarId, userId) => await Post(`/avatars/${avatarId}/shares/${userId}`, null);
exports.RemoveAvatarShare = async (avatarId, userId) => await Delete(`/avatars/${avatarId}/shares/${userId}`);

// Categories
exports.GetCategories = async () => await Get('/categories');
async function SetAvatarCategories(type, id, categoryIds) {
    return (await Post('/categories/assign', {Uuid: id, CategoryType: type, Categories: categoryIds})).data;
}
exports.SetAvatarCategories = async (avatarId, categoryIds) => await SetAvatarCategories(CATEGORY_TYPES.AVATARS, avatarId, categoryIds);
exports.SetFriendCategories = async (userId, categoryIds) => await SetAvatarCategories(CATEGORY_TYPES.FRIENDS, userId, categoryIds);
exports.SetPropCategories = async (propId, categoryIds) => await SetAvatarCategories(CATEGORY_TYPES.PROPS, propId, categoryIds);
exports.SetWorldCategories = async (worldId, categoryIds) => await SetAvatarCategories(CATEGORY_TYPES.WORLDS, worldId, categoryIds);

// Worlds
exports.GetWorldById = async (worldId) => await Get(`/worlds/${worldId}`);
exports.GetWorldMetaById = async (worldId) => await Get(`/worlds/${worldId}/meta`);
exports.GetWorldsByCategory = async (worldCategoryId) => await Get(`/worlds/list/${worldCategoryId}?page=0&direction=0`, true, 2);
exports.GetWorldPortalById = async (worldId) => await Get(`/portals/world/${worldId}`);
exports.SetWorldAsHome = async (worldId) => await Get(`/worlds/${worldId}/sethome`);

// Spawnables
exports.GetProps = async () => await Get('/spawnables');
exports.GetPropById = async (propId) => await Get(`/spawnables/${propId}`);
exports.GetPropShares = async (propId) => await Get(`/spawnables/${propId}/shares`);
exports.AddPropShare = async (propId, userId) => await Post(`/spawnables/${propId}/shares/${userId}`, null);
exports.RemovePropShare = async (propId, userId) => await Delete(`/spawnables/${propId}/shares/${userId}`);

// Instances
exports.GetInstanceById = async (instanceId) => await Get(`/instances/${instanceId}`);
exports.JoinInstance = async (instanceId) => await Get(`/instances/${instanceId}/join`);
exports.GetInstancePortalById = async (instanceId) => await Get(`/portals/instance/${instanceId}`);

// Search
exports.Search = async (term) => await Get(`/search/${term}`);
exports.SearchVideoPlayer = async (term) => await Get(`/videoplayer/search/${term}?result=20&order=Title`);

// Discover
exports.GetRandomAvatars = async (count = 20) => await Get(`/avatars/lists/random?count=${count}`, true, 2);
exports.GetRandomProps = async (count = 20) => await Get(`/spawnables/lists/random?count=${count}`, true, 2);
exports.GetRandomWorlds = async (count = 20) => await Get(`/worlds/lists/random?count=${count}`, true, 2);

// Groups
exports.GetGroups = async () => await Get('/groups');
