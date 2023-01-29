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
