let navbarButtons = document.querySelectorAll(".navbar-button");

navbarButtons.forEach((e) => {
    let tooltip = e.querySelector(".navbar-tooltip");
    e.addEventListener("mouseenter", () => {
        tooltip.style.display = "block";
    });
    e.addEventListener("mouseleave", () => {
        tooltip.style.display = "none";
    });
})