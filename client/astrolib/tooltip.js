const tooltip = document.querySelector('#tooltip');

let isPackaged = false;
window.API.isPackaged().then(packaged => {
    isPackaged = packaged;
    console.log(`Logging on the renderer will be: ${packaged ? 'disabled' : 'enabled'}!`);
});

function log(msg) {
    if (!isPackaged) console.log(msg);
}

function applyTooltips() {
    document.querySelectorAll('[data-tooltip]').forEach((e) => {
        if (e.hasAttribute('has-tooltip')) {
            log('[astrolib/tooltip.js] Node already has tooltip applied, skipping...');
        } else {
            e.addEventListener('mouseenter', (e) => {
                tooltip.style.display = 'block';
                tooltip.innerHTML = e.target.dataset.tooltip;
            });
            e.addEventListener('mouseleave', () => {
                tooltip.style.display = 'none';
                tooltip.innerHTML = '';
            });
            e.addEventListener('mousemove', (e) => {
                let offsetX = e.clientX >= (window.innerWidth / 2) ? -Math.abs(tooltip.offsetWidth + 5) : 15;
                let offsetY = e.clientY >= (window.innerHeight / 2) ? -Math.abs(tooltip.offsetHeight) : 15;
                tooltip.style.left = `${e.clientX + offsetX}px`;
                tooltip.style.top = `${e.clientY + offsetY}px`;
            });
            e.setAttribute('has-tooltip', 'true');
        }
    });
}

export { applyTooltips };
