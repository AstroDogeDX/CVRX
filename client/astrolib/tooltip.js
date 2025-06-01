const tooltip = document.querySelector('#tooltip');
const overlay = document.querySelector('#tooltip-overlay');

let isPackaged = false;
window.API.isPackaged().then(packaged => {
    isPackaged = packaged;
});

let hideTooltipTimeout = null; // Store timeout ID
let safetyCheckTimeout = null; // Store safety check timeout ID

const log = (msg) => {
    if (!isPackaged) console.log(msg);
};

const moveTooltip = (e) => {
    const cursorPadding = 15; // Space from cursor
    const viewportMargin = 5; // Minimum space from viewport edges

    // Calculate initial desired position (e.g., bottom-right of cursor)
    let newLeft = e.clientX + cursorPadding;
    let newTop = e.clientY + cursorPadding;

    // Adjust if tooltip would go off the right edge
    if (newLeft + tooltip.offsetWidth + viewportMargin > window.innerWidth) {
        newLeft = e.clientX - tooltip.offsetWidth - cursorPadding;
    }
    // Adjust if tooltip would go off the left edge
    if (newLeft < viewportMargin) {
        newLeft = viewportMargin;
    }

    // Adjust if tooltip would go off thebottom edge
    if (newTop + tooltip.offsetHeight + viewportMargin > window.innerHeight) {
        newTop = e.clientY - tooltip.offsetHeight - cursorPadding;
    }
    // Adjust if tooltip would go off the top edge
    if (newTop < viewportMargin) {
        newTop = viewportMargin;
    }

    // Ensure tooltip is not wider than viewport (e.g. for very long tooltips)
    if (tooltip.offsetWidth > window.innerWidth - 2 * viewportMargin) {
        tooltip.style.width = `${window.innerWidth - 2 * viewportMargin}px`;
        // Recalculate newLeft if width was constrained, to ensure it's still positioned correctly
        if (e.clientX + cursorPadding + parseFloat(tooltip.style.width) + viewportMargin > window.innerWidth) {
            newLeft = e.clientX - parseFloat(tooltip.style.width) - cursorPadding;
        }
        if (newLeft < viewportMargin) {
            newLeft = viewportMargin;
        }
    } else {
        // Reset width if previously constrained and no longer needed
        tooltip.style.width = 'max-content';
    }
    
    // Ensure tooltip is not taller than viewport
    if (tooltip.offsetHeight > window.innerHeight - 2 * viewportMargin) {
        tooltip.style.maxHeight = `${window.innerHeight - 2 * viewportMargin}px`;
        tooltip.style.overflowY = 'auto'; // Add scroll for overflowing content
         // Recalculate newTop if height was constrained
        if (e.clientY + cursorPadding + parseFloat(tooltip.style.maxHeight) + viewportMargin > window.innerHeight) {
            newTop = e.clientY - parseFloat(tooltip.style.maxHeight) - cursorPadding;
        }
        if (newTop < viewportMargin) {
            newTop = viewportMargin;
        }
    } else {
        tooltip.style.maxHeight = '';
        tooltip.style.overflowY = '';
    }

    tooltip.style.left = `${newLeft}px`;
    tooltip.style.top = `${newTop}px`;
};

const showTooltip = (e) => {
    // Clear any pending hide timeout to prevent content from being cleared if shown again quickly
    if (hideTooltipTimeout) {
        clearTimeout(hideTooltipTimeout);
        hideTooltipTimeout = null;
    }

    tooltip.innerHTML = e.target.dataset.tooltip;
    tooltip.style.opacity = '1';
    tooltip.style.visibility = 'visible';
    tooltip.style.transform = 'translateY(0) scale(1)';
    // Move tooltip into position after content is set and it has dimensions
    moveTooltip(e);
};

const hideTooltip = () => {
    tooltip.style.opacity = '0';
    tooltip.style.visibility = 'hidden';
    tooltip.style.transform = 'translateY(5px) scale(0.95)';

    // Clear innerHTML after the transition (150ms, matches CSS transition duration)
    hideTooltipTimeout = setTimeout(() => {
        tooltip.innerHTML = '';
        hideTooltipTimeout = null;
    }, 150);
};

// Safety mechanism to hide stuck tooltips
const safetyCheck = (e) => {
    // Clear any pending safety check
    if (safetyCheckTimeout) {
        clearTimeout(safetyCheckTimeout);
    }
    
    // Set a new safety check with a small delay
    safetyCheckTimeout = setTimeout(() => {
        // Check if tooltip is currently visible
        if (tooltip.style.visibility === 'visible' && tooltip.style.opacity === '1') {
            // Check if the current mouse target has a tooltip
            const hasTooltip = e.target && (
                e.target.hasAttribute('data-tooltip') || 
                e.target.closest('[data-tooltip]')
            );
            
            // If no tooltip should be shown, hide it
            if (!hasTooltip) {
                log('[astrolib/tooltip.js] Safety check: hiding stuck tooltip');
                hideTooltip();
            }
        }
        safetyCheckTimeout = null;
    }, 100); // 100ms delay to avoid excessive checks
};

function applyTooltips() {
    const TOOLTIPS_ENABLED = 'tooltips-enabled';
    const HAS_TOOLTIP = 'has-tooltip';

    if (!overlay.hasAttribute(TOOLTIPS_ENABLED)) {
        // Add both tooltip positioning and safety check to mousemove
        window.addEventListener('mousemove', (e) => {
            moveTooltip(e);
            safetyCheck(e);
        });
        overlay.setAttribute(TOOLTIPS_ENABLED, 'true');
        log('[astrolib/tooltip.js] Tooltips Enabled');
    }

    document.querySelectorAll('[data-tooltip]').forEach((e) => {
        if (e.getAttribute('data-tooltip') === '') {
            log('[astrolib/tooltip.js] Node has no tooltip data, skipping...');
            return;
        }
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
