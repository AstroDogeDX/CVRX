const tooltip = document.querySelector('#tooltip');
const overlay = document.querySelector('#tooltip-overlay');

let isPackaged = false;

const log = (msg) => {
    if (!isPackaged) console.log(msg);
};

const moveTooltip = (e) => {
    const offsetX = e.clientX >= (window.innerWidth / 2) ? -Math.abs(tooltip.offsetWidth + 5) : 15;
    const offsetY = e.clientY >= (window.innerHeight / 2) ? -Math.abs(tooltip.offsetHeight) : 15;
    tooltip.style.left = `${e.clientX + offsetX}px`;
    tooltip.style.top = `${e.clientY + offsetY}px`;
};

const showTooltip = (e) => {
    tooltip.style.display = 'block';
    tooltip.innerHTML = e.target.dataset.tooltip;
};

const hideTooltip = () => {
    tooltip.style.display = 'none';
    tooltip.innerHTML = '';
};

function applyTooltips() {
    const TOOLTIPS_ENABLED = 'tooltips-enabled';
    const HAS_TOOLTIP = 'has-tooltip';

    if (!overlay.hasAttribute(TOOLTIPS_ENABLED)) {
        window.addEventListener('mousemove', moveTooltip);
        overlay.setAttribute(TOOLTIPS_ENABLED, 'true');
        log('[astrolib/tooltip.js] Tooltips Enabled');
    }

    document.querySelectorAll('[data-tooltip]').forEach((e) => {
        if (e.hasAttribute(HAS_TOOLTIP)) {
            log('[astrolib/tooltip.js] Node already has tooltip applied, skipping...');
        } else {
            e.addEventListener('mouseenter', showTooltip);
            e.addEventListener('mouseleave', hideTooltip);
            e.addEventListener('mouseup', hideTooltip);
            e.setAttribute(HAS_TOOLTIP, 'true');
        }
    });
}

export { applyTooltips };
