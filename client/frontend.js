// ===========
// GLOBAL VARS
// ===========

let currentUser;
let loadedFriends = {}; // NOTE: Temporary object; should probably replaced with a lite DB!

// =========
// FUNCTIONS
// =========

function swapNavPages(page) { // Page changes via the Nav Bar
    document.querySelectorAll(".display-wrapper").forEach((e) => {
        e.style.display = "none";
        document.getElementById(`display-${page}`).style.display = "grid";
        document.title = "CVRX - " + page.charAt(0).toUpperCase() + page.slice(1); // Sets the window title to 'CVRX - [Page Name]'
    })
}

function initSearchPage() { // Resets the search bar to an empty value and focus the search bar when the page is init'd
    document.querySelector("#search-bar").value = "";
    document.querySelector("#search-bar").focus({ focusVisible: true }); // FIXME: Figure out why the f*ck this doesn't work...
}

// ===============
// EVERYTHING ELSE
// ===============

swapNavPages("home"); // On start up, set page to Home

document.querySelectorAll(".navbar-button").forEach((e) => { // Navbar Control Logic
    let tooltip = e.querySelector(".navbar-tooltip"); // Tooltips!
    e.addEventListener("mouseenter", () => {
        tooltip.style.display = "block";
    });
    e.addEventListener("mouseleave", () => {
        tooltip.style.display = "none";
    });
    e.addEventListener("mousedown", () => { // Page changing!
        swapNavPages(e.dataset.page);
        if (e.dataset.page == "search") {
            initSearchPage();
        }
    })
})

// Friends Page & Online Sidebar
// -----------------------------

window.API.onSelfLoad((_event, ourUser) => {
    // ourUser = Same result as await window.API.getUserById(userId);
    currentUser = ourUser.name;
    document.getElementById.innerHTML = currentUser;
})

// Friend Element Builder 
function generateFriendSegment(username, image) {
    return;
}

window.API.onFriendsUpdates((_event, updatedFriends) => {
    // Array of:
    // categories: [],
    //     id: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    //     name: 'uSeRnAmE',
    //     imageUrl: 'https://files.abidata.io/user_images/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.png'
    // }
    let p = document.createElement("p");
    for (const updatedFriend of updatedFriends) {
        if (updatedFriend.name === undefined) {
            return;
        }
        let div = document.createElement("div");
        let img = new Image();
        img.src = updatedFriend.imageUrl;
        img.alt = `${updatedFriend.name}'s Avatar`;
        div.id = updatedFriend.id;
        div.innerHTML = `<p>${updatedFriend.name}</p>`;
        theFirstChild = div.firstChild;
        div.insertBefore(img, theFirstChild);
        document.querySelector(".friends-wrapper").appendChild(div);
        console.log(updatedFriend.id);
    }
})

/*window.API.onImageLoaded((_event, image) => {
    // Get image original url
    const imageUrl = image.url;
    console.log(imageUrl);

    let userID = imageUrl.slice(37,73)
    console.log(userID);

    let userEntry = document.getElementById(userID);

    let p = document.createElement("p");

    // Image data in base64
    const imageData = image.imgBase64;
    let img = new Image();
    img.src = imageData;
    userEntry.insertBefore(img, p);
    //document.querySelector(".friends-wrapper").appendChild(img);
    //console.log(imageData);
})*/

// Get user detailed info, images will be sent later via: window.API.onImageLoaded, check data.js for the structure
// const user = await window.API.getUserById(userId);

// Get active worlds, images will be sent later via: window.API.onImageLoaded, check data.js for the structure
// const worlds = await window.API.getWorldsActive();

// Get world detailed info, images will be sent later via: window.API.onImageLoaded, check data.js for the structure
// const world = await window.API.getWorldById(worldId);

// Get instance detailed info, images will be sent later via: window.API.onImageLoaded, check data.js for the structure
// const instance = await window.API.getInstanceById(instanceId);


window.API.onGetActiveUser((_event, activeUser) =>  {
    console.log("Active User!");
    console.log(activeUser);
    // activeUser = {
    //     onlineState: false,
    //     isConnected: false,
    //     isFriend: false,
    //     isBlocked: false,
    //     instance: null, // If we're online this might have our instance info
    //     categories: [],
    //     rank: 'User',
    //     featuredBadge: {
    //         name: 'No badge featured',
    //         image: 'https://files.abidata.io/static_web/NoHolderImage.png',
    //         imageHash: '0ad531a3b6934292ecb5da1762b3f54ce09cc1b4',
    //         badgeLevel: 0
    //     },
    //     featuredGroup: {
    //         name: 'No group featured',
    //         image: 'https://files.abidata.io/static_web/NoHolderImage.png',
    //         imageHash: '0ad531a3b6934292ecb5da1762b3f54ce09cc1b4'
    //     },
    //     avatar: {
    //         id: '5cde1f96-d62a-4231-bf53-a32693830fc2',
    //         name: 'Demo Bot',
    //         imageUrl: 'https://files.abidata.io/user_content/avatars/5cde1f96-d62a-4231-bf53-a32693830fc2/5cde1f96-d62a-4231-bf53-a32693830fc2.png',
    //         imageHash: '0ad531a3b6934292ecb5da1762b3f54ce09cc1b4'
    //     },
    //     id: 'c4eee443-98a0-bab8-a583-f1d9fa10a7d7',
    //     name: 'CVRX',
    //     imageUrl: 'https://files.abidata.io/user_images/c4eee443-98a0-bab8-a583-f1d9fa10a7d7-63cfb4a4061d4.png',
    //     imageHash: '0ad531a3b6934292ecb5da1762b3f54ce09cc1b4'
    // }
});

window.API.onFriendsRefresh((_event, friends) =>  {
    console.log("Friends Refresh!");
    console.log(friends);
    // Usually it will be an array with just those 4 elements.
    //
    // friends = [{
    //     id: 'c4eee443-98a0-bab8-a583-f1d9fa10a7d7',
    //     name: 'CVRX',
    //     imageUrl: 'https://files.abidata.io/user_images/c4eee443-98a0-bab8-a583-f1d9fa10a7d7-63cfb4a4061d4.png',
    //     imageHash: '0ad531a3b6934292ecb5da1762b3f54ce09cc1b4'
    // }];

    // But in case the refresh is not the first one at app start, some other info might be included
    // All the possible information is:
    //
    // friends = [
    //     {
    //         onlineState: false,
    //         isConnected: false,
    //         isFriend: false,
    //         isBlocked: false,
    //         instance: null, // ORRRR
    //         //instance: { id: "i+51985e5559117d5f-951509-ff0a95-1a3dc443", "name": "The Purple Fox (#417388)", "privacy":1 }
    //         categories: [],
    //         rank: 'User',
    //         featuredBadge: {
    //             name: 'No badge featured',
    //             image: 'https://files.abidata.io/static_web/NoHolderImage.png',
    //             imageHash: '0ad531a3b6934292ecb5da1762b3f54ce09cc1b4',
    //             badgeLevel: 0
    //         },
    //         featuredGroup: {
    //             name: 'No group featured',
    //             image: 'https://files.abidata.io/static_web/NoHolderImage.png',
    //             imageHash: '0ad531a3b6934292ecb5da1762b3f54ce09cc1b4'
    //         },
    //         avatar: {
    //             id: '5cde1f96-d62a-4231-bf53-a32693830fc2',
    //             name: 'Demo Bot',
    //             imageUrl: 'https://files.abidata.io/user_content/avatars/5cde1f96-d62a-4231-bf53-a32693830fc2/5cde1f96-d62a-4231-bf53-a32693830fc2.png',
    //             imageHash: '0ad531a3b6934292ecb5da1762b3f54ce09cc1b4'
    //         },
    //         id: 'c4eee443-98a0-bab8-a583-f1d9fa10a7d7',
    //         name: 'CVRX',
    //         imageUrl: 'https://files.abidata.io/user_images/c4eee443-98a0-bab8-a583-f1d9fa10a7d7-63cfb4a4061d4.png',
    //         imageHash: '0ad531a3b6934292ecb5da1762b3f54ce09cc1b4'
    //     }
    // ]
});


window.API.onFriendUpdate((_event, friend) =>  {
    console.log("Friend update!");
    console.log(friend);
    // As we have seen these updates can have the instance to null, or have the instance with different levels
    // Of privacy:
    // 0: Public
    // 1: Friends of Friends
    // 2: Friends Only (with a friend of mine)

    // Joined Friends of Friends
    //
    //friend = {
    //     "id":"2ff016ef-1d3b-4aff-defb-c167ed99b416",
    //     "isOnline":true,
    //     "isConnected":true,
    //     "instance": {
    //          "id":"i+51985e5559117d5f-951509-ff0a95-1a3dc443",
    //          "name":"The Purple Fox (#417388)",
    //          "privacy":1
    //     }
    //     // OR: "instance": null
    // }
});

window.API.onImageLoaded((_event, image) => {
    console.log(image);
    // image = {
    //     imageBase64: "data:image/png;base64,iVBORw0KG......................",
    //     imageHash: "d4fd45441c34e1d408c9d764953c1c9cfa236b16",
    //     imageUrl: "https://files.abidata.io/static_web/NoHolderImage.png"
    // }
});
