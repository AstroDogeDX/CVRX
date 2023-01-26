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

window.API.onFriendsImageLoaded((_event, friendsImage) => {
    // Get image original url
    const imageUrl = friendsImage.url;
    console.log(imageUrl);

    // Image data in base64
    const imageData = friendsImage.imgBase64;
})