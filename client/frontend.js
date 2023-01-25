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