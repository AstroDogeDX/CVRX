const tooltip = document.querySelector('#tooltip');

function applyTooltips() {
    document.querySelectorAll('[data-tooltip]').forEach((e) => {
        if (e.hasAttribute('has-tooltip')) {
            console.log('[astrolib/tooltip.js] Node already has tooltip applied, skipping...');
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
