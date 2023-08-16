const { app } = require('electron');

// const log = require('./logger').GetLogger('Utils');

exports.GetUserAgent = () => `CVRX/${app.getVersion()} (deployment:${app.isPackaged ? 'production' : 'development'})`;


/**
 * Deep clones an object using JSON methods.
 * This approach works for plain objects without circular references.
 *
 * @param {Object} obj - The object to be cloned.
 * @returns {Object} The deep cloned object.
 */
exports.DeepClone = (obj) => {
    return JSON.parse(JSON.stringify(obj));
};

/**
 * Renames properties of an entity based on a given mapping.
 *
 * @param {Object} entity - The object to rename properties for.
 * @param {Object} mapping - An object where keys are api property names and values are our property names.
 * @returns {Object} The entity with renamed properties.
 */
exports.MapEntity = (entity, mapping) => {

    // If it's an array, handle each entity separately
    if (Array.isArray(entity)) {
        const result = [];
        for (const entityElement of entity) {
            result.push(exports.MapEntity(entityElement, mapping));
        }
        return result;
    }

    const entityToMap = { ...entity };

    for (let apiKey in mapping) {
        if (Object.prototype.hasOwnProperty.call(entityToMap, apiKey)) {
            const ourKey = mapping[apiKey];
            // If the mapping is an object, it means it's a nested mapping
            if (typeof ourKey === 'object' && ourKey !== null) {
                entityToMap[ourKey.root] = exports.MapEntity(entityToMap[apiKey], ourKey.mapping);
            }
            // Otherwise let's just fix the key
            else {
                entityToMap[ourKey] = entityToMap[apiKey];
            }
            delete entityToMap[apiKey];
        }
    }

    return entityToMap;
};
