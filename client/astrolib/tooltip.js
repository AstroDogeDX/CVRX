const tooltip = document.querySelector('#tooltip');
const overlay = document.querySelector('#tooltip-overlay');

let isPackaged = false;
window.API.isPackaged().then(packaged => {
    isPackaged = packaged;
    console.log(`Logging on the renderer will be: ${packaged ? 'disabled' : 'enabled'}!`);
});

function log(msg) {
    if (!isPackaged) console.log(msg);
}

function applyTooltips() {
    if (!overlay.hasAttribute('tooltips-enabled')) {
        window.addEventListener('mousemove', (e) => {
            let offsetX = e.clientX >= (window.innerWidth / 2) ? -Math.abs(tooltip.offsetWidth + 5) : 15;
            let offsetY = e.clientY >= (window.innerHeight / 2) ? -Math.abs(tooltip.offsetHeight) : 15;
            tooltip.style.left = `${e.clientX + offsetX}px`;
            tooltip.style.top = `${e.clientY + offsetY}px`;
        });
        overlay.setAttribute('tooltips-enabled', 'true');
        log('[astrolib/tooltip.js] Tooltips Enabled');
    }
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
            e.addEventListener('mouseup', () => {
                tooltip.style.display = 'none';
                tooltip.innerHTML = '';
            });
            e.setAttribute('has-tooltip', 'true');
        }
    });
}

export { applyTooltips };
