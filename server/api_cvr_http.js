const axios = require('axios');
const utils = require('./utils');
const {createReadStream} = require('node:fs');

const log = require('./logger').GetLogger('API_HTTP');

const APIAddress = 'https://api.chilloutvr.net';
const APIBase = `${APIAddress}/1`;
const APIBase2 = `${APIAddress}/2`;

let CVRApi;
let CVRApiV2;

const UnauthenticatedCVRApi = axios.create({
    baseURL: APIBase,
    headers: {
        'MatureContentDlc': 'false',
        'Content-Type': 'application/json',
    },
});

async function Get(url, authenticated = true, apiVersion = 1) {
    try {
        const response = await (authenticated ? (apiVersion === 1 ? CVRApi : CVRApiV2) : UnauthenticatedCVRApi).get(url);
        log.debug(`[GET] [${response.status}] [${authenticated ? '' : 'Non-'}Auth] ${url}`, response.data);
        return response.data.data;
    }
    catch (error) {
        log.error(`[GET] [Error] [${authenticated ? '' : 'Non-'}Auth] ${url}`, error.toString(), error.stack, error?.response?.data);
        if (error?.response?.data?.message) {
            throw new Error(error.response.data.message);
        }
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
        log.error(`[Post] [Error] [${authenticated ? '' : 'Non-'}Auth] ${url}`, error.toString(), error.stack, error?.response?.data);
        if (error?.response?.data?.message) {
            throw new Error(error.response.data.message);
        }
        throw new Error(`Error:\n${error.stack}\n${error.toString()}`);
    }
}

async function Patch(url, data, authenticated = true, apiVersion = 1) {
    try {
        const response = await (authenticated ? (apiVersion === 1 ? CVRApi : CVRApiV2) : UnauthenticatedCVRApi).patch(url, data);
        log.debug(`[Patch] [${response.status}] [${authenticated ? '' : 'Non-'}Auth] ${url}`, response.data);
        return response.data;
    }
    catch (error) {
        log.error(`[Patch] [Error] [${authenticated ? '' : 'Non-'}Auth] ${url}`, error.toString(), error.stack, error?.response?.data);
        if (error?.response?.data?.message) {
            throw new Error(error.response.data.message);
        }
        throw new Error(`Error:\n${error.stack}\n${error.toString()}`);
    }
}

async function Put(url, filePathsMap, authenticated = true, apiVersion = 1) {
    try {
        const form = new FormData();
        // Iterate over the filePathsMap and append each file to the form
        for (const [fieldName, filePath] of Object.entries(filePathsMap)) {
            form.append(fieldName, createReadStream(filePath));
        }
        const axiosClient = authenticated ? (apiVersion === 1 ? CVRApi : CVRApiV2) : UnauthenticatedCVRApi;
        const response = await axiosClient.put(
            url,
            form,
            {
                headers: {
                    ...axiosClient.defaults.headers.common,
                    ...form.getHeaders(),
                },
                maxBodyLength: Infinity,
            });
        log.debug(`[Put] [${response.status}] [${authenticated ? '' : 'Non-'}Auth] ${url}`, response.data);
        return response.data;
    }
    catch (error) {
        log.error(`[Put] [Error] [${authenticated ? '' : 'Non-'}Auth] ${url}`, error.toString(), error.stack, error?.response?.data);
        if (error?.response?.data?.message) {
            throw new Error(error.response.data.message);
        }
        throw new Error(`Error:\n${error.stack}\n${error.toString()}`);
    }
}

async function Delete(url, authenticated = true, apiVersion = 1) {
    try {
        const response = await (authenticated ? (apiVersion === 1 ? CVRApi : CVRApiV2) : UnauthenticatedCVRApi).delete(url);
        log.debug(`[DELETE] [${response.status}] [${authenticated ? '' : 'Non-'}Auth] ${url}`, response.data);
        return response.data;
    }
    catch (error) {
        log.error(`[DELETE] [Error] [${authenticated ? '' : 'Non-'}Auth] ${url}`, error.toString(), error.stack, error?.response?.data);
        if (error?.response?.data?.message) {
            throw new Error(error.response.data.message);
        }
        throw new Error(`Error:\n${error.stack}\n${error.toString()}`);
    }
}

// API Constants

/**
 * @enum {string}
 */
const CategoryType = Object.freeze({
    AVATARS: 'Avatars',
    FRIENDS: 'Friends',
    PROPS: 'Props',
    WORLDS: 'Worlds',
});
exports.CategoryType = CategoryType;

/**
 * @enum {number}
 */
const AuthMethod = Object.freeze({
    ACCESS_KEY: 1,
    PASSWORD: 2,
});

/**
 * @enum {number}
 */
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

/**
 * @enum {number}
 */
const GroupMemberRole = Object.freeze({
    Trial: 0,
    Member: 1,
    Moderator: 2,
    Admin: 3,
    0: 'Trial',
    1: 'Member',
    2: 'Moderator',
    3: 'Admin',
});
exports.GroupMemberRole = GroupMemberRole;

/**
 * @enum {number}
 */
const SettingPrivacyJoin = Object.freeze({
    Public: 0,
    Request: 1,
    Invite: 2,
    Locked: 3,
    0: 'Public',
    1: 'Request',
    2: 'Invite',
    3: 'Locked',
});
exports.SettingPrivacyJoin = SettingPrivacyJoin;

/**
 * @enum {number}
 */
const SettingEventPublicity = Object.freeze({
    Public: 0,
    Members: 1,
    0: 'Public',
    1: 'Members',
});
exports.SettingEventPublicity = SettingEventPublicity;

/**
 * @enum {number}
 */
const SettingMemberPublicity = Object.freeze({
    Public: 0,
    Members: 1,
    Hidden: 2,
    0: 'Public',
    1: 'Members',
    2: 'Hidden',
});
exports.SettingMemberPublicity = SettingMemberPublicity;

/**
 * @enum {number}
 */
const GroupMemberOrder = Object.freeze({
    Default: 0,
    Joined: 1,
    Name: 2,
    0: 'Default',
    1: 'Joined',
    2: 'Name',
});
exports.GroupMemberOrder = GroupMemberOrder;


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
            'Platform': 'pc_standalone',
            'CompatibleVersions': '0,1,2',
            'MatureContentDlc': 'false',
            'Content-Type': 'application/json',
        },
    });
    CVRApiV2 = axios.create({
        baseURL: APIBase2,
        headers: {
            'Username': authentication.username,
            'AccessKey': authentication.accessKey,
            'User-Agent': utils.GetUserAgent(),
            'Platform': 'pc_standalone',
            'CompatibleVersions': '0,1,2',
            'MatureContentDlc': 'false',
            'Content-Type': 'application/json',
        },
    });
    return authentication;
}

// Get Stats
exports.GetUserStats = async () => await Get('/public/userstats', false);

// Account
exports.GetRemoteConfig = async () => await Get('/remoteconfig');
exports.SetMatureContentVisibility = async (enabled) => await Post('/account/settings/matureContent', { enabled: enabled });

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
exports.SetCurrentAvatar = async (avatarId) => await Get(`/avatars/${avatarId}/switchAvatar`);
exports.GetAvatarShares = async (avatarId) => await Get(`/avatars/${avatarId}/shares`);
exports.AddAvatarShare = async (avatarId, userId) => await Post(`/avatars/${avatarId}/shares/${userId}`, {});
exports.RemoveAvatarShare = async (avatarId, userId) => await Delete(`/avatars/${avatarId}/shares/${userId}`);

// Categories
exports.GetCategories = async () => await Get('/categories');
exports.AssignCategory = async (type, contentGuid, categoryIds) => await Post('/categories/assign', {
    Uuid: contentGuid,
    CategoryType: type,
    Categories: categoryIds,
});
exports.CreateCategory = async (type, categoryName) => await Post(`/categories/${type}`, {name: categoryName});
exports.DeleteCategory = async (type, categoryId) => await Delete(`/categories/${type}/${categoryId}`);
exports.ReorderCategories = async (type, newOrderedCategoryIds) => await Patch(`/categories/${type}`, {order: newOrderedCategoryIds});

// Worlds
exports.GetWorldById = async (worldId) => await Get(`/worlds/${worldId}`);
exports.GetWorldMetaById = async (worldId) => await Get(`/worlds/${worldId}/meta`);
exports.GetWorldsByCategory = async (worldCategoryId, page, sort, direction) => await Get(`/worlds/list/${worldCategoryId}?page=${page}&sort=${sort}&direction=${direction}`, true, 2);
exports.GetWorldPortalById = async (worldId) => await Get(`/portals/world/${worldId}`);
exports.SetWorldAsHome = async (worldId) => await Get(`/worlds/${worldId}/sethome`);

// Spawnables
exports.GetProps = async () => await Get('/spawnables');
exports.GetPropById = async (propId) => await Get(`/spawnables/${propId}`);
exports.GetPropShares = async (propId) => await Get(`/spawnables/${propId}/shares`);
exports.AddPropShare = async (propId, userId) => await Post(`/spawnables/${propId}/shares/${userId}`, {});
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
exports.GetMyGroups = async () => await Get('/groups');
exports.GetUserGroups = async (userId) => await Get(`/users/${userId}/groups`);
exports.GetGroupDetail = async (groupId) => await Get(`/groups/${groupId}`);
/* sortOrder - [Default, Joined, Name] */
exports.GetGroupMembers = async (id, page, sortOrder, sortAscending) => await Get(`/groups/${id}/members?page=${page}&sortOrder=${sortOrder}&sortAscending=${sortAscending}`);

// Groups Management
/* tag  - min: 3 max: 6 chars */
/* name - min: 3 max: 32 chars */
exports.CreateGroup = async (tag, name) => await Post('/groups', {tag: tag, name: name});
exports.DeleteGroup = async (groupId) => await Delete(`/groups/${groupId}`);
exports.JoinGroup = async (groupId) => await Post(`/groups/${groupId}/join`, null);
exports.LeaveGroup = async (groupId) => await Post(`/groups/${groupId}/leave`, null);
exports.SetFeaturedGroup = async (groupId) => await Post(`/groups/${groupId}/featured`, null);

// Groups Details Management
/* groupName   - min: 3 max: 32 chars */
exports.UpdateGroupName = async (groupId, groupName) => await Post(`/groups/${groupId}/name`, {name: groupName});
/* description - max: 1000 chars */
exports.UpdateGroupDescription = async (groupId, description) => await Post(`/groups/${groupId}/description`, {description: description});
exports.UpdateGroupImage = async (groupId, groupImgFilePath) => await Put(`/groups/${groupId}/image`, {file: groupImgFilePath});
exports.UpdateGroupSettings = async (groupId, listed, memberPublicity, eventPublicity, privacyJoin) => await Post(`/groups/${groupId}/settings`, { listed: listed, memberPublicity: memberPublicity, eventPublicity: eventPublicity, privacyJoin: privacyJoin });

// Groups Members Management
exports.InviteUserToGroup = async (groupId, userId) => await Post(`/groups/${groupId}/${userId}/invite`, null);
exports.KickMemberFromGroup = async (groupId, userId) => await Post(`/groups/${groupId}/member/${userId}/kick`, null);
exports.AssignGroupRoleToMember = async (groupId, userId, role) => await Post(`/groups/${groupId}/member/${userId}/role/${role}`, null);
exports.TransferGroupOwnership = async (groupId, userId) => await Post(`/groups/${groupId}/transfer/${userId}`, null);

// Group Invites and Invite Requests
exports.GetGroupInvites = async () => await Get('/groups/invites');
exports.DeclineGroupInvite = async (groupId) => await Delete(`/groups/${groupId}/invite`, null);
exports.RequestJoinGroup = async (groupId) => await Post(`/groups/${groupId}/join/request`, null);
exports.DeclineGroupInviteRequest = async (groupId, userId) => await Delete(`/groups/${groupId}/${userId}/request`);
exports.GetGroupInviteRequests = async (groupId) => await Get(`/groups/${groupId}/requestInvites`);

// Badges
exports.GetUserBadges = async (userId) => await Get(`/users/${userId}/badges`);
exports.SetFeaturedBadge = async (badgeId) => await Post(`/badges/${badgeId}/featured`, null);

