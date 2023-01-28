function swapNavPages(page) {
    document.querySelectorAll(".display-wrapper").forEach((e) => {
        e.style.display = "none";
        document.getElementById(`display-${page}`).style.display = "grid";
        document.title = "CVRX - " + page.charAt(0).toUpperCase() + page.slice(1);
    })
}

function initSearchPage() {
    document.querySelector("#search-bar").value = "";
    document.querySelector("#search-bar").focus({focusVisible: true});
}

// On start up, set page to Home
swapNavPages("home");

// Navbar Control Logic
document.querySelectorAll(".navbar-button").forEach((e) => {
    let tooltip = e.querySelector(".navbar-tooltip");
    e.addEventListener("mouseenter", () => {
        tooltip.style.display = "block";
    });
    e.addEventListener("mouseleave", () => {
        tooltip.style.display = "none";
    });
    e.addEventListener("mousedown", () => {
        swapNavPages(e.dataset.page);
        if(e.dataset.page == "search") {
            initSearchPage();
        }
    })
})


window.API.onSelfLoad((_event, ourUser) => {
    // ourUser = Same result as await window.API.getUserById(userId);
})

window.API.onFriendsUpdates((_event, updatedFriends) => {
    // Array of:
    // categories: [],
    //     id: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    //     name: 'uSeRnAmE',
    //     imageUrl: 'https://files.abidata.io/user_images/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.png'
    // }
    for (const updatedFriend of updatedFriends) {
        console.log(updatedFriend.id);
    }
})

window.API.onImageLoaded((_event, image) => {
    // Get image original url
    const imageUrl = image.url;
    console.log(imageUrl);

    // Image data in base64
    const imageData = image.imgBase64;
})

// Get user detailed info, images will be sent later via: window.API.onImageLoaded, check data.js for the structure
// const user = await window.API.getUserById(userId);

// Get active worlds, images will be sent later via: window.API.onImageLoaded, check data.js for the structure
// const worlds = await window.API.getWorldsActive();

// Get world detailed info, images will be sent later via: window.API.onImageLoaded, check data.js for the structure
// const world = await window.API.getWorldById(worldId);

// Get instance detailed info, images will be sent later via: window.API.onImageLoaded, check data.js for the structure
// const instance = await window.API.getInstanceById(instanceId);
